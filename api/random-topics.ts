import { getFirestore } from "firebase-admin/firestore";
import * as adminImport from "firebase-admin";

const admin = adminImport.default || adminImport;
let _db: FirebaseFirestore.Firestore | null = null;
function getDb() {
  if (_db) return _db;
  if (!admin.apps?.length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : null;
    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      admin.initializeApp();
    }
  }
  _db = getFirestore();
  return _db;
}

export default async function handler(req: any, res: any) {
  try {
    const db = getDb();
    const topicsRef = db.collection("random_topics");

    if (req.method === "GET") {
      const snapshot = await topicsRef.get();
      const topics = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      return res.status(200).json({ topics });
    }

    if (req.method === "POST") {
      const { id, topic } = req.body;
      if (!id || !topic) {
        return res.status(400).json({ error: "Missing id or topic" });
      }
      // ID represents the date format YYYY-MM-DD
      await topicsRef.doc(id).set({ topic });
      return res.status(200).json({ success: true });
    }

    if (req.method === "DELETE") {
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ error: "Missing id" });
      }
      await topicsRef.doc(id).delete();
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (error: any) {
    console.error("Dashboard Random Topics Error:", error);
    return res.status(500).json({ error: String(error) });
  }
}
