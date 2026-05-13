import * as adminImport from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

const admin = adminImport.default || adminImport;

let _db: FirebaseFirestore.Firestore | null = null;
function getDb() {
  if (_db) return _db;
  if (!admin.apps?.length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) : null;
    if (serviceAccount) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } else {
      admin.initializeApp();
    }
  }
  _db = getFirestore();
  return _db;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = getDb();
    const settingsRef = db.collection("settings").doc("global");

    if (req.method === 'GET') {
      const doc = await settingsRef.get();
      if (doc.exists) {
        return res.status(200).json(doc.data());
      } else {
        return res.status(200).json({ systemPrompt: "Kamu adalah asisten AI di WhatsApp yang sangat ramah. Namamu adalah AIDA.", creativity: 0.7, maxMemory: 10, knowledgeBase: "" });
      }
    } else if (req.method === 'POST') {
      const { systemPrompt, creativity, maxMemory, knowledgeBase } = req.body || {};
      await settingsRef.set({
        systemPrompt: systemPrompt ?? "Kamu adalah asisten AI di WhatsApp yang sangat ramah. Namamu adalah AIDA.",
        creativity: typeof creativity === 'number' ? creativity : 0.7,
        maxMemory: typeof maxMemory === 'number' ? maxMemory : 10,
        knowledgeBase: knowledgeBase || ""
      }, { merge: true });
      return res.status(200).json({ status: "ok" });
    } else {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message || String(error) });
  }
}
