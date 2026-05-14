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
    
    // In a large production app, counting using size or size() can be expensive,
    // but for our personal AI Dashboard, getting full col is okay for small sets.
    // If it gets big, we should use aggregation queries `count()`.
    
    const [chatsSnap, remindersSnap, notesSnap] = await Promise.all([
       db.collection("chats").count().get(),
       db.collection("reminders").count().get(),
       db.collection("notes").count().get()
    ]);

    // Count total messages
    let totalMessages = 0;
    const chatsDataSnap = await db.collection("chats").get();
    chatsDataSnap.docs.forEach(d => {
       const data = d.data();
       totalMessages += (data.history?.length || 0);
    });

    const activeUsers = chatsSnap.data().count;
    const totalReminders = remindersSnap.data().count;
    const totalNotes = notesSnap.data().count;

    return res.status(200).json({
      totalMessages,
      activeUsers,
      totalReminders,
      totalNotes
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || String(error) });
  }
}
