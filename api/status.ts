import * as adminImport from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const admin = (adminImport as any).default || adminImport;

let _db: FirebaseFirestore.Firestore | null = null;

function getDb() {
  if (_db) return _db;
  
  if (!admin.apps?.length) {
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
  }
  _db = getFirestore();
  return _db;
}

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const db = getDb();

    if (req.query.type === 'stats') {
      const [chatsSnap, remindersSnap, notesSnap] = await Promise.all([
         db.collection("chats").count().get(),
         db.collection("reminders").count().get(),
         db.collection("notes").count().get()
      ]);

      let totalMessages = 0;
      const chatsDataSnap = await db.collection("chats").get();
      chatsDataSnap.docs.forEach(d => {
         totalMessages += (d.data().history?.length || 0);
      });

      return res.status(200).json({ 
        totalMessages, 
        activeUsers: chatsSnap.data().count, 
        totalReminders: remindersSnap.data().count, 
        totalNotes: notesSnap.data().count 
      });
    }
    
    // Uji koneksi dengan menulis dan membaca dari koleksi "system_status"
    const testRef = db.collection("system_status").doc("connection_test");
    
    // Tulis data (Timestamp)
    await testRef.set({
      connected: true,
      lastCheck: FieldValue.serverTimestamp()
    }, { merge: true });
    
    // Baca data
    const doc = await testRef.get();
    
    if (doc.exists) {
      return res.status(200).json({ 
        status: "OK", 
        firebase: "KONEKSI BERHASIL (CONNECTED)",
        info: "Aplikasi berhasil terhubung dan dapat membaca/menulis ke Firestore.",
        data: doc.data()
      });
    } else {
      throw new Error("Dokumen berhasil ditulis tapi tidak bisa dibaca.");
    }

  } catch (error: any) {
    if (req.query.type === 'stats') {
      return res.status(500).json({ error: error.message || String(error) });
    }
    return res.status(500).json({ 
      status: "ERROR", 
      firebase: "KONEKSI GAGAL (DISCONNECTED)",
      info: "Terjadi kesalahan saat menghubungkan ke Firebase.",
      error_detail: error.message || String(error)
    });
  }
}
