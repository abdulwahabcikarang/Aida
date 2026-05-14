import { getFirestore } from "firebase-admin/firestore";
import * as adminImport from "firebase-admin";

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
     return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const fonnteToken = process.env.FONNTE_TOKEN;
    if (!fonnteToken) {
      throw new Error("FONNTE_TOKEN is required to send messages");
    }

    const { message, target } = req.body;
    if (!message) return res.status(400).json({ error: "Pesan tidak boleh kosong" });

    let finalTargets: string[] = [];

    const db = getDb();
    if (target === 'all') {
       const snapshot = await db.collection("chats").select("sender").get();
       finalTargets = snapshot.docs.map(d => d.data().sender).filter(Boolean);
    } else if (target) {
       finalTargets = target.split(',').map((t: string) => t.trim()).filter(Boolean);
    }

    if (finalTargets.length === 0) {
       return res.status(400).json({ error: "Target penerima kosong" });
    }

    // Send via fonnte (can accept comma separated strings)
    const fonnteRes = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        "Authorization": fonnteToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        target: finalTargets.join(','),
        message: message,
      })
    });
    
    const fonnteData = await fonnteRes.json();

    return res.status(200).json({ success: true, fonnteData, sentCount: finalTargets.length });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || String(error) });
  }
}
