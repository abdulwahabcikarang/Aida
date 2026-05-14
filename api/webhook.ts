import { GoogleGenAI } from "@google/genai";
import * as adminImport from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const admin = adminImport.default || adminImport;

// Helper to initialize and get db lazily
let _db: FirebaseFirestore.Firestore | null = null;
function getDb() {
  if (_db) return _db;
  
  if (!admin.apps?.length) {
    try {
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
    } catch (e) {
      console.error("Firebase admin init error:", e);
      throw new Error("Failed to initialize Firebase Admin");
    }
  }
  _db = getFirestore();
  return _db;
}

let ai: GoogleGenAI | null = null;

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = req.body || {};
    const sender = body.sender;
    const message = body.message || body.text;
    const name = body.name;

    // Fonnte initial validation step
    if (!sender || !message) {
      return res.status(200).json({ status: "ok", detail: "Payload received but missing sender or message" });
    }

    if (!ai) {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is required");
      }
      ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }

    const fonnteToken = process.env.FONNTE_TOKEN;
    if (!fonnteToken) {
      throw new Error("FONNTE_TOKEN is required");
    }

    let history: { role: string; parts: { text: string }[] }[] = [];
    let chatRef: any = null;
    let globalSettings: any = {
      systemPrompt: "Kamu adalah asisten AI di WhatsApp yang sangat ramah. Namamu adalah AIDA. Jawablah setiap pertanyaan dengan ringkas, jelas, dan sangat membantu.",
      creativity: 0.7,
      maxMemory: 10,
      knowledgeBase: ""
    };
    let contactData: any = {};
    const db = getDb();

    try {
      // Fetch global settings
      const settingsDoc = await db.collection("settings").doc("global").get();
      if (settingsDoc.exists) {
        globalSettings = { ...globalSettings, ...settingsDoc.data() };
      }

      chatRef = db.collection("chats").doc(sender);
      const chatDoc = await chatRef.get();
      if (chatDoc.exists) {
        contactData = chatDoc.data() || {};
        history = contactData.history || [];
      }
    } catch (e) {
      console.error("Firebase is not configured properly or failed to read (proceeding without history):", e);
    }

    if (contactData.humanTakeover) {
      // Ignore AI processing if human takeover is active
      return res.status(200).json({ status: "ignored", detail: "Human takeover active" });
    }
    
    // Default system prompt builder
    let finalSystemPrompt = globalSettings.systemPrompt;
    if (globalSettings.knowledgeBase && globalSettings.knowledgeBase.trim() !== "") {
      finalSystemPrompt += `\n\n--- PENGETAHUAN TAMBAHAN ---\n${globalSettings.knowledgeBase}\n--------------------------`;
    }
    if (contactData.instruction && contactData.instruction.trim() !== "") {
      finalSystemPrompt += `\n\n--- CATATAN TENTANG PENGGUNA INI ---\n${contactData.instruction}`;
    }

    // Clean up history to ensure valid format for the API
    let cleanHistory = history.filter(h => h.role === "user" || h.role === "model");

    // Menambahkan Waktu Lokal Jakarta
    const timeInJakarta = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    const systemInstruction = `${finalSystemPrompt}\n\nWaktu saat ini (waktu Indonesia/Jakarta): ${timeInJakarta}. 
Jika pengguna meminta dijadwalkan pengingat, gunakan tool 'schedule_reminder'.
Jika pengguna meminta untuk mencatat sesuatu yang penting (buku catatan), gunakan tool 'save_note', 'search_notes', 'update_note', atau 'delete_note'.
PENTING: Selalu simpan dengan waktu ISO dalam UTC atau zona waktu yang tepat.`;

    const aiConfig: any = {
      temperature: globalSettings.creativity ?? 0.7,
      systemInstruction: systemInstruction,
      tools: [
        {
          functionDeclarations: [
            {
              name: "schedule_reminder",
              description: "Jadwalkan pengingat yang akan dikirim secara otomatis ke nomor WhatsApp pengguna pada waktu tertentu.",
              parameters: {
                type: "OBJECT",
                properties: {
                  time_iso: { type: "STRING", description: "Waktu ISO 8601 (contoh: 2026-05-14T02:00:00Z)." },
                  reminder_message: { type: "STRING", description: "Pesan pengingat." }
                },
                required: ["time_iso", "reminder_message"]
              }
            },
            {
              name: "save_note",
              description: "Menyimpan data, ide, atau catatan penting terkait pengguna. Gunakan saat pengguna minta mencatat atau mengingat informasi jangka panjang.",
              parameters: {
                type: "OBJECT",
                properties: {
                  title: { type: "STRING", description: "Judul catatan" },
                  content: { type: "STRING", description: "Isi catatan lengkap" }
                },
                required: ["title", "content"]
              }
            },
            {
              name: "search_notes",
              description: "Mencari buku catatan pengguna berdasarkan kata kunci apabila pengguna menanyakan informasi yang pernah dicatat.",
              parameters: {
                type: "OBJECT",
                properties: { keyword: { type: "STRING" } },
                required: ["keyword"]
              }
            },
            {
              name: "get_recent_notes",
              description: "Mendapatkan 5 daftar catatan terakhir milik pengguna.",
              parameters: { type: "OBJECT" }
            },
            {
              name: "delete_note",
              description: "Menghapus catatan berdasarkan ID catatan.",
              parameters: {
                type: "OBJECT",
                properties: { note_id: { type: "STRING" } },
                required: ["note_id"]
              }
            },
            {
              name: "update_note",
              description: "Memperbarui isi/judul catatan berdasarkan ID catatan.",
              parameters: {
                type: "OBJECT",
                properties: {
                  note_id: { type: "STRING" },
                  new_title: { type: "STRING" },
                  new_content: { type: "STRING" }
                },
                required: ["note_id", "new_title", "new_content"]
              }
            }
          ]
        }
      ]
    };

    cleanHistory.push({ role: "user", parts: [{ text: message }] });

    let finalHistoryToSave = [...cleanHistory];

    const generateResponseRecursive = async (currentHistory: any[], maxLoops = 3): Promise<string> => {
      let loopCount = 0;
      let historyCopied = [...currentHistory];

      while (loopCount < maxLoops) {
        const response = await ai!.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: historyCopied,
          config: aiConfig
        });

        if (response.functionCalls && response.functionCalls.length > 0) {
          const call = response.functionCalls[0];
          
          if (call.name === "schedule_reminder") {
            const { time_iso, reminder_message } = call.args as any;
            try {
              const targetTime = new Date(time_iso);
              await db.collection("reminders").add({
                sender: sender,
                message: reminder_message,
                time: targetTime,
                status: "pending",
                createdAt: FieldValue.serverTimestamp()
              });
              const localTime = targetTime.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
              return `Oke! Pengingat dicatat. Aku akan mengingatkanmu pesan: "${reminder_message}" pada ${localTime}. 🕰️`;
            } catch (e: any) {
              return "Maaf, ada kendala mengatur pengingat.";
            }
          }
          else if (call.name === "save_note") {
             const { title, content } = call.args as any;
             await db.collection("notes").add({ sender, title, content, createdAt: FieldValue.serverTimestamp() });
             return `Catatan tersimpan: *${title}* 📝\n\n${content}`;
          }

          // Read/Update/Delete operations
          // We need to return result to Gemini so it can answer the user
          let toolResponseData: any = { error: "Unknown function" };
          
          if (call.name === "search_notes") {
             const keyword = (call.args as any).keyword.toLowerCase();
             const snapshot = await db.collection("notes").where("sender", "==", sender).get();
             const notes = snapshot.docs
               .map(d => ({ id: d.id, ...d.data() }))
               .filter((n: any) => (n.title?.toLowerCase().includes(keyword) || n.content?.toLowerCase().includes(keyword)))
               .slice(0, 5);
             toolResponseData = { notes: notes.map((n:any) => ({ id: n.id, title: n.title, content: n.content })) };
          } 
          else if (call.name === "get_recent_notes") {
             const snapshot = await db.collection("notes").where("sender", "==", sender).orderBy("createdAt", "desc").limit(5).get();
             toolResponseData = { notes: snapshot.docs.map(d => ({ id: d.id, title: d.data().title, content: d.data().content })) };
          }
          else if (call.name === "delete_note") {
             const note_id = (call.args as any).note_id;
             try {
                await db.collection("notes").doc(note_id).delete();
                toolResponseData = { success: true, message: "Terhapus." };
             } catch(e) {
                toolResponseData = { success: false, error: String(e) };
             }
          }
          else if (call.name === "update_note") {
             const { note_id, new_title, new_content } = call.args as any;
             try {
                await db.collection("notes").doc(note_id).update({ title: new_title, content: new_content, updatedAt: FieldValue.serverTimestamp() });
                toolResponseData = { success: true, message: "Terperbarui." };
             } catch(e) {
                toolResponseData = { success: false, error: String(e) };
             }
          }

          historyCopied.push({ role: "model", parts: [{ functionCall: call }] });
          historyCopied.push({ 
            role: "user", 
            parts: [{ functionResponse: { name: call.name, response: toolResponseData } }] 
          });

          finalHistoryToSave = [...historyCopied];
          loopCount++;
        } else {
          return response.text || "";
        }
      }
      return "Maaf, permintaannya terlalu rumit untukku saat ini.";
    };

    let reply = await generateResponseRecursive(cleanHistory);
    if (!reply || reply.trim() === "") reply = "Maaf, aku tidak bisa memproses permintaan itu saat ini.";

    const limit = typeof globalSettings.maxMemory === 'number' ? globalSettings.maxMemory : 10;

    // Save to Firebase
    try {
      if (chatRef) {
        await chatRef.set({
          sender,
          name: contactData.name || name || sender,
          history: [
            ...finalHistoryToSave,
            { role: "model", parts: [{ text: reply }] }
          ].slice(-limit), // Batasi penyimpanan
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }
    } catch (e) {
      console.error("Firebase write error:", e);
    }

    // Send reply via Fonnte API
    const fonnteRes = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        "Authorization": fonnteToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        target: sender,
        message: reply,
      })
    });
    
    const fonnteData = await fonnteRes.json();
    console.log("Fonnte API Response:", fonnteData);

    return res.status(200).json({ status: "success", reply });

  } catch (error) {
    console.error("Webhook Error:", error);
    return res.status(500).json({ error: "Internal Server Error", details: String(error) });
  }
}

