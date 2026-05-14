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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = getDb();
    
    if (req.method === 'GET') {
       // Download all collections as JSON
       const chats = await db.collection("chats").get();
       const notes = await db.collection("notes").get();
       const reminders = await db.collection("reminders").get();
       const settings = await db.collection("settings").get();

       const data = {
          chats: chats.docs.map(d => ({ id: d.id, ...d.data() })),
          notes: notes.docs.map(d => ({ id: d.id, ...d.data() })),
          reminders: reminders.docs.map(d => ({ id: d.id, ...d.data() })),
          settings: settings.docs.map(d => ({ id: d.id, ...d.data() }))
       };

       res.setHeader('Content-Type', 'application/json');
       res.setHeader('Content-Disposition', 'attachment; filename=aida-database-backup.json');
       return res.status(200).json(data);
    }
    
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || String(error) });
  }
}
