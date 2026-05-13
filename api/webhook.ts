import { GoogleGenAI } from "@google/genai";
import * as adminImport from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const admin = adminImport.default || adminImport;

// Helper to initialize and get db lazily
let _db: FirebaseFirestore.Firestore | null = null;
function getDb() {
  if (_db) return _db;
  
  if (!admin.apps?.length) {
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
    const body = req.body || {};
    const sender = body.sender;
    const message = body.message || body.text;
    const name = body.name;

    // Fonnte initial validation step
    if (!sender || !message) {
      return res.status(200).json({ status: "ok", detail: "Payload received but missing sender or message" });
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

    let history: { role: string; parts: { text: string }[] }[] = [];
    let chatRef: any = null;
    let globalSettings: any = {
      systemPrompt: "Kamu adalah asisten AI di WhatsApp yang sangat ramah. Namamu adalah AIDA. Jawablah setiap pertanyaan dengan ringkas, jelas, dan sangat membantu.",
      creativity: 0.7,
      maxMemory: 10,
      knowledgeBase: ""
    };
    let contactData: any = {};

    try {
      const db = getDb();
      // Fetch global settings
      const settingsDoc = await db.collection("settings").doc("global").get();
      if (settingsDoc.exists) {
        globalSettings = { ...globalSettings, ...settingsDoc.data() };
      }

      chatRef = db.collection("chats").doc(sender);
      const chatDoc = await chatRef.get();
      if (chatDoc.exists) {
        contactData = chatDoc.data() || {};
        history = contactData.history || [];
      }
    } catch (e) {
      console.error("Firebase is not configured properly or failed to read (proceeding without history):", e);
    }

    if (contactData.humanTakeover) {
      // Ignore AI processing if human takeover is active
      return res.status(200).json({ status: "ignored", detail: "Human takeover active" });
    }
    
    // Default system prompt builder
    let finalSystemPrompt = globalSettings.systemPrompt;
    if (globalSettings.knowledgeBase && globalSettings.knowledgeBase.trim() !== "") {
      finalSystemPrompt += `\n\n--- PENGETAHUAN TAMBAHAN ---\n${globalSettings.knowledgeBase}\n--------------------------`;
    }
    if (contactData.instruction && contactData.instruction.trim() !== "") {
      finalSystemPrompt += `\n\n--- CATATAN TENTANG PENGGUNA INI ---\n${contactData.instruction}`;
    }

    if (history.length === 0) {
      history = [
        {
          role: "user",
          parts: [{ text: finalSystemPrompt }]
        },
        {
          role: "model",
          parts: [{ text: "Siap! Aku akan membantu pengguna sesuai instruksi." }]
        }
      ];
    } else {
      // Update the very first message with the latest system prompt
      if (history[0] && history[0].role === 'user') {
        history[0].parts[0].text = finalSystemPrompt;
      }
    }

    // Format chat prompt manually for Gemini 2.5 Flash
    const formattedHistory = history.map(m => `${m.role === 'model' ? 'AIDA' : 'Sistem/Pengguna'}: ${m.parts[0].text}`).join('\n');
    const prompt = formattedHistory + `\nPengguna: ${message}\nAIDA:`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: globalSettings.creativity ?? 0.7,
      }
    });

    const reply = response.text || "Maaf, aku tidak bisa memproses permintaan itu saat ini.";
    const limit = typeof globalSettings.maxMemory === 'number' ? globalSettings.maxMemory : 10;

    // Save to Firebase
    try {
      if (chatRef) {
        await chatRef.set({
          sender,
          name: contactData.name || name || sender,
          history: [
            ...history,
            { role: "user", parts: [{ text: message }] },
            { role: "model", parts: [{ text: reply }] }
          ].slice(-(limit + 2)), // Keep last 'limit' messages + the 2 root system messages
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }
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
