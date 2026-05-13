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
  // Hanya proses jika metoda adalah GET atau POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const db = getDb();
    const now = new Date();
    
    // Cari semua pengingat yang statusnya "pending"
    const snapshot = await db.collection("reminders")
      .where("status", "==", "pending")
      .get();

    // Filter di memory untuk menghindari error "query requires an index" di Firestore
    const dueDocs = snapshot.docs.filter(doc => {
      const data = doc.data();
      // data.time bisa berupa objek Firestore Timestamp (jika disimpan lewat SDK) atau Date
      const reminderTime = data.time?.toDate ? data.time.toDate() : new Date(data.time);
      return reminderTime <= now;
    });

    if (dueDocs.length === 0) {
      return res.status(200).json({ status: "ok", sent: 0, message: "Tidak ada pengingat yang jatuh tempo saat ini." });
    }

    const fonnteToken = process.env.FONNTE_TOKEN;
    if (!fonnteToken) {
      return res.status(500).json({ error: "Missing FONNTE_TOKEN" });
    }

    let sentCount = 0;
    
    // Proses semua pengingat satu per satu
    for (const doc of dueDocs) {
      const data = doc.data();
      
      try {
        // Kirim pengingat lewat Fonnte API
        const response = await fetch("https://api.fonnte.com/send", {
          method: "POST",
          headers: { 
            "Authorization": fonnteToken, 
            "Content-Type": "application/json" 
          },
          body: JSON.stringify({ 
            target: data.sender, 
            message: `🔔 *PENGINGAT* 🔔\n\n${data.message}` 
          })
        });

        const result = await response.json();
        
        if (result.status) {
          // Tandai sebagai terkirim jika berhasil
          await doc.ref.update({ 
            status: "sent", 
            sentAt: new Date() 
          });
          sentCount++;
        } else {
          console.error("Gagal mengirim pesan via Fonnte:", result);
          // Update status error agar tidak mengulang terus menerus
          await doc.ref.update({ 
            status: "error", 
            error_reason: result.reason || "Unknown error from Fonnte",
            triedAt: new Date() 
          });
        }
      } catch (e: any) {
        console.error("Fetch Fonnte failed for reminder:", doc.id, e);
      }
    }
    
    return res.status(200).json({ status: "ok", sent: sentCount });

  } catch (error: any) {
    console.error("Cron Error:", error);
    return res.status(500).json({ error: error.message || String(error) });
  }
}
