import * as adminImport from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const admin = adminImport.default || adminImport;

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
    return res.status(500).json({ 
      status: "ERROR", 
      firebase: "KONEKSI GAGAL (DISCONNECTED)",
      info: "Terjadi kesalahan saat menghubungkan ke Firebase.",
      error_detail: error.message || String(error)
    });
  }
}
