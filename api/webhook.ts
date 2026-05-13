import { GoogleGenAI } from "@google/genai";
import * as admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Helper to initialize and get db lazily
let _db: FirebaseFirestore.Firestore | null = null;
function getDb() {
  if (_db) return _db;
  
  if (!admin.apps.length) {
    try {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        // Used in Vercel - Needs Private Key JSON
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      } else {
        // Used Locally / AI Studio config
        admin.initializeApp();
      }
    } catch (e) {
      console.error("Firebase admin init error:", e);
      throw new Error("Failed to initialize Firebase Admin");
    }
  }
  _db = getFirestore();
  return _db;
}

let ai: GoogleGenAI | null = null;

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { sender, message, name } = req.body;

    // Fonnte initial validation step
    if (!sender || !message) {
      return res.status(200).json({ status: "ok", detail: "Payload received" });
    }

    if (!ai) {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is required");
      }
      ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }

    const fonnteToken = process.env.FONNTE_TOKEN;
    if (!fonnteToken) {
      throw new Error("FONNTE_TOKEN is required");
    }

    const db = getDb();
    const chatRef = db.collection("chats").doc(sender);
    
    let history: { role: string; parts: { text: string }[] }[] = [];
    try {
      const chatDoc = await chatRef.get();
      if (chatDoc.exists) {
        history = chatDoc.data()?.history || [];
      }
    } catch (e) {
      console.error("Firebase read error (proceeding without history):", e);
    }
    
    // Default system prompt
    if (history.length === 0) {
      history = [
        {
          role: "user",
          parts: [{ text: "Kamu adalah asisten AI di WhatsApp yang sangat ramah. Namamu adalah AIDA. Jawablah setiap pertanyaan dengan ringkas, jelas, dan sangat membantu." }]
        },
        {
          role: "model",
          parts: [{ text: "Halo! Aku AIDA. Ada yang bisa aku bantu?" }]
        }
      ];
    }

    // Format chat prompt manually for Gemini 2.5 Flash
    const prompt = history.map(m => `${m.role === 'model' ? 'AIDA' : 'Pengguna'}: ${m.parts[0].text}`).join('\n') + `\nPengguna: ${message}\nAIDA:`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const reply = response.text || "Maaf, aku tidak bisa memproses permintaan itu saat ini.";

    // Save to Firebase
    try {
      await chatRef.set({
        sender,
        name: name || sender,
        history: [
          ...history,
          { role: "user", parts: [{ text: message }] },
          { role: "model", parts: [{ text: reply }] }
        ].slice(-10), // Keep last 10 messages
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error("Firebase write error:", e);
    }

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

    return res.status(200).json({ status: "success", reply });

  } catch (error) {
    console.error("Webhook Error:", error);
    return res.status(500).json({ error: "Internal Server Error", details: String(error) });
  }
}
