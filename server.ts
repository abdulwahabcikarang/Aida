import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import admin from "firebase-admin";

import fs from "fs";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Initialize Firebase Admin (uses Application Default Credentials in Cloud Run)
let db: FirebaseFirestore.Firestore;
try {
  const config = JSON.parse(fs.readFileSync(path.resolve('./firebase-applet-config.json'), 'utf8'));
  const firebaseApp = admin.initializeApp({ projectId: config.projectId });
  db = getFirestore(firebaseApp, config.firestoreDatabaseId);
} catch (e) {
  console.log("Using default admin init");
  const firebaseApp = admin.initializeApp();
  db = getFirestore(firebaseApp);
}

// Initialize Gemini
let ai: GoogleGenAI | null = null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Webhook for Fonnte (WhatsApp)
  app.post("/api/webhook", async (req, res) => {
    try {
      const { sender, message, name } = req.body;

      // Fonnte sends validation webhook initially
      if (!sender || !message) {
        return res.status(200).json({ status: "ok", detail: "Payload received" });
      }

      console.log(`Received message from ${sender} (${name}): ${message}`);

      // Initialize AI lazily
      if (!ai) {
        if (!process.env.GEMINI_API_KEY) {
          throw new Error("GEMINI_API_KEY environment variable is required");
        }
        ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      }

      const fonnteToken = process.env.FONNTE_TOKEN;
      if (!fonnteToken) {
        throw new Error("FONNTE_TOKEN environment variable is required");
      }

      // Fetch chat history from Firebase
      const chatRef = db.collection("chats").doc(sender);
      const chatDoc = await chatRef.get();
      
      let history: { role: string; parts: { text: string }[] }[] = [];
      if (chatDoc.exists) {
        history = chatDoc.data()?.history || [];
      } else {
        history = [
          {
            role: "user",
            parts: [{ text: "Kamu adalah asisten AI yang ramah di WhatsApp. Tolong jawab pertanyaan saya dengan singkat dan membantu." }]
          },
          {
            role: "model",
            parts: [{ text: "Halo! Saya adalah asisten AI Anda. Ada yang bisa saya bantu?" }]
          }
        ];
      }

      // We append user message to history, but for Gemini SDK, history is passed to chat instance
      // Wait, let's just use ai.chats.create
      const chat = ai.chats.create({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: "Kamu adalah asisten AI berbasis WhatsApp. Jawablah dengan ringkas, ramah, dan gunakan bahasa Indonesia.",
        }
      });
      // GenAI SDK handles history manually if we use `generateContent` or we can pass history in `create` but type might differ.
      // Easiest is just generateContent with full parts list.
      const prompt = history.map(m => `${m.role === 'model' ? 'Asisten AI' : 'Pengguna'}: ${m.parts[0].text}`).join('\n') + `\nPengguna: ${message}\nAsisten AI:`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const reply = response.text || "Maaf, saya tidak bisa memproses permintaan itu.";

      // Update history in Firebase
      await chatRef.set({
        sender,
        name: name || sender,
        history: [
          ...history,
          { role: "user", parts: [{ text: message }] },
          { role: "model", parts: [{ text: reply }] }
        ].slice(-10), // keep only last 10 messages
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      // Send reply via Fonnte API
      const fonnteRes = await fetch("https://api.fonnte.com/send", {
        method: "POST",
        headers: {
          "Authorization": fonnteToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          target: sender,
          message: reply,
          delay: "1" // delay in seconds (optional)
        })
      });

      const fonnteData = await fonnteRes.json();
      console.log("Fonnte API Response:", fonnteData);

      res.status(200).json({ status: "success", reply });
    } catch (error) {
      console.error("Webhook Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
