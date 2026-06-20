import * as adminImport from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

const admin = (adminImport as any).default || adminImport;

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
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const db = getDb();
    const chatsRef = db.collection("chats");

    if (req.method === "GET") {
      const snapshot = await chatsRef.get();
      const contacts: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        contacts.push({
          id: doc.id,
          name: data.name || doc.id,
          sender: data.sender || doc.id,
          instruction: data.instruction || "",
          city: data.city || "",
          hobby: data.hobby || "",
          interest: data.interest || "",
          humanTakeover: !!data.humanTakeover,
          messageCount: data.history ? data.history.length : 0,
          smartProfile: data.smartProfile || {},
          alarms: data.alarms || [],
          updatedAt: data.updatedAt ? data.updatedAt.toDate() : null,
        });
      });
      return res.status(200).json({ contacts });
    } else if (req.method === "POST") {
      const {
        id,
        name,
        instruction,
        humanTakeover,
        city,
        hobby,
        interest,
        alarms,
      } = req.body || {};
      if (!id) return res.status(400).json({ error: "Missing contact id" });

      await chatsRef.doc(id).set(
        {
          name: name || id,
          instruction: instruction || "",
          humanTakeover: !!humanTakeover,
          city: city || "",
          hobby: hobby || "",
          interest: interest || "",
          alarms: Array.isArray(alarms) ? alarms : [],
        },
        { merge: true },
      );
      return res.status(200).json({ status: "ok" });
    } else {
      return res.status(405).json({ error: "Method Not Allowed" });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message || String(error) });
  }
}
