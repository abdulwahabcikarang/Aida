import { getFirestore } from "firebase-admin/firestore";
import * as adminImport from "firebase-admin";

const admin = (adminImport as any).default || adminImport;

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = getDb();
    
    if (req.method === 'GET') {
       const snapshot = await db.collection("journals").orderBy("createdAt", "desc").get();
       const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
       return res.status(200).json(data);
    }
    
    if (req.method === 'DELETE') {
       const { id } = req.query;
       if (!id) return res.status(400).json({ error: "Missing ID" });
       await db.collection("journals").doc(id).delete();
       return res.status(200).json({ success: true });
    }
    
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || String(error) });
  }
}
