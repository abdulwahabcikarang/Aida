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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = getDb();
    const { sender } = req.query;
    
    if (!sender) return res.status(400).json({ error: "Missing sender" });

    const doc = await db.collection("chats").doc(String(sender)).get();
    
    if (!doc.exists) {
       return res.status(404).json({ error: "Chat not found" });
    }

    const { history = [] } = doc.data() as any;

    return res.status(200).json({ history });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || String(error) });
  }
}
