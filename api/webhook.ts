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
    let incomingMsg = (body.message || body.text || "").trim();
    const name = body.name;

    if (!incomingMsg && body.url) {
      incomingMsg = `[Menerima file berupa ${body.type || 'lampiran'} dari user. URL file: ${body.url}]`;
    } else if (body.url) {
      incomingMsg += `\n[Catatan: Pesan ini dilampirkan berbarengan dengan sebuah file/dokumen berjenis ${body.type || 'lampiran'}. Kamu bsia menyebutkan bahwa kamu telah menerima link file nya di url: ${body.url}]`;
    }

    // Fonnte initial validation step
    if (!sender || !incomingMsg) {
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
    let isMaster = false;
    let finalSystemPrompt = globalSettings.systemPrompt;
    if (globalSettings.masterContact && sender === globalSettings.masterContact) {
      isMaster = true;
      finalSystemPrompt += "\n\n⚠️ ANDA ADALAH MASTER CONTACT (SUPER ADMIN). Anda memiliki otorisasi penuh untuk melihat, mencari, dan bertanya mengenai data (notes, pengingat, chats) milik semua pengguna di sistem ini. Anda bisa menggunakan alat administrator.";
    }

    if (globalSettings.knowledgeBase && globalSettings.knowledgeBase.trim() !== "") {
      finalSystemPrompt += `\n\n--- PENGETAHUAN TAMBAHAN ---\n${globalSettings.knowledgeBase}\n--------------------------`;
    }
    
    let userDetails = "";
    if (contactData.city) userDetails += `- Kota Sekarang: ${contactData.city}\n`;
    if (contactData.hobby) userDetails += `- Hobi: ${contactData.hobby}\n`;
    if (contactData.interest) userDetails += `- Minat: ${contactData.interest}\n`;
    
    if (contactData.smartProfile) {
       for (const key in contactData.smartProfile) {
          const p = contactData.smartProfile[key];
          userDetails += `- ${p.displayKey}: ${p.value}\n`;
       }
    }
    
    if (userDetails !== "") {
      finalSystemPrompt += `\n\n--- PROFIL PINGTAR PENGGUNA INI ---\n${userDetails}`;
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
Jika pengguna memberikan jurnal harian atau ditanya tentang harinya lalu bercerita, gunakan tool 'save_journal'.
Jika Anda mendeteksi atau diberitahu informasi profil tentang pengguna secara natural (misal: alamat, tempat kerja, hobi kegemaran, makanan kesukaan, dll), SECARA OTOMATIS panggil tool 'update_user_profile' untuk merekamnya di Buku Profil Pintar.
Jika pengguna meminta untuk mencatat ringkasan hal (ide/proyek) lainnya yang panjang, gunakan tool 'save_note' dkk.
PENTING: Selalu simpan dengan waktu ISO dalam UTC atau zona waktu yang tepat.
DILARANG KERAS menggunakan kalimat basa-basi pengantar seperti "Berikut adalah pesan/drafnya", "Tentu, ini balasannya:", atau "Baik, pesan untuk nona adalah:". Langsung tulis isi pesannya 100% natural.`;

    const toolsList: any[] = [
      {
        name: "send_message_to_contact",
        description: "Mengirim pesan WhatsApp kepada pengguna lain berdasarkan namanya yg tercermin di manajamen pengguna. Gunakan jika pengguna meminta tolong menyampaikan sesuatu misal 'beritahu nona untuk membawa tas'. AI harus bahasakan secara natural.",
        parameters: {
          type: "OBJECT",
          properties: {
            target_name: { type: "STRING", description: "Nama orang yang dituju untuk pesan, misal 'nona'" },
            message: { type: "STRING", description: "Isi pesan yang dikirimkan kepada orang tersebut. Pesan yang diisikan di sini akan langsung dikirim oleh AIDA." }
          },
          required: ["target_name", "message"]
        }
      },
      {
        name: "update_user_profile",
        description: "Menambahkan atau memperbarui informasi spesifik ke profil pintar (smart profile) pengguna. Gunakan secara otomatis jika mengetahui fakta baru tentang pengguna (misal: profesi, alamat/kota, makanan kesukaan, kesukaan/opsi, hobi).",
        parameters: {
          type: "OBJECT",
          properties: {
            category: { type: "STRING", description: "Kategori profil, misalnya: 'Kota/Alamat', 'Hobi', 'Minat', 'Profesi', 'Email', 'Makanan Favorit', 'Lainnya'" },
            value: { type: "STRING", description: "Isi atau nilai untuk kategori tersebut. Jika sebelumnya ada, AI harus menggabungkan/memperlengkapinya di argumen ini." }
          },
          required: ["category", "value"]
        }
      },
      {
        name: "save_journal",
        description: "Menyimpan catatan harian pengguna (diary) dari ceritanya hari ini ke basis data catatan harian khusus.",
        parameters: {
          type: "OBJECT",
          properties: {
            content: { type: "STRING", description: "Isi catatan harian / cerita pengguna hari ini" }
          },
          required: ["content"]
        }
      },
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
    ];

    if (isMaster) {
      toolsList.push({
        name: "master_search_all_notes",
        description: "[ADMIN] Mencari seluruh catatan dari SEMUA PENGGUNA. Berguna jika master bertanya tentang data milik orang lain.",
        parameters: {
          type: "OBJECT",
          properties: { keyword: { type: "STRING", description: "Kata kunci untuk pencarian di seluruh database catatan" } },
          required: ["keyword"]
        }
      });
      toolsList.push({
        name: "master_get_all_contacts",
        description: "[ADMIN] Mendapatkan daftar nomor kontak yang pernah berinteraksi dengan AI.",
        parameters: { type: "OBJECT" }
      });
    }

    const aiConfig: any = {
      temperature: globalSettings.creativity ?? 0.7,
      systemInstruction: systemInstruction,
      tools: [
        {
          functionDeclarations: toolsList
        }
      ]
    };

    cleanHistory.push({ role: "user", parts: [{ text: incomingMsg }] });

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
          else if (call.name === "update_user_profile") {
            const { category, value } = call.args as any;
            try {
              const cleanedCategory = String(category).toLowerCase().replace(/[^a-z0-9_]/g, '_');
              const currentProfile = contactData.smartProfile || {};
              currentProfile[cleanedCategory] = {
                displayKey: category,
                value: value,
                updatedAt: new Date().toISOString()
              };
              
              const updatePayload: any = { smartProfile: currentProfile };
              
              // Also map some explicit fields if matching
              if (cleanedCategory.includes('kota') || cleanedCategory.includes('alamat')) updatePayload.city = value;
              if (cleanedCategory.includes('hobi')) updatePayload.hobby = value;
              if (cleanedCategory.includes('minat')) updatePayload.interest = value;

              await chatRef.set(updatePayload, { merge: true });
              
              historyCopied.push({
                 role: "model",
                 parts: [{ functionCall: call }]
              });
              historyCopied.push({
                 role: "function",
                 parts: [{ functionResponse: { name: call.name, response: { success: true, message: `Buku Profil Pintar berhasil diperbarui untuk kategori: ${category}` } } }]
              });
              
              // Inform AI that tool works, continue generating response seamlessly
              // To do this we must continue loop
              loopCount++;
              continue;
            } catch (e) {
              return "Gagal memperbarui profil pengguna.";
            }
          }
          else if (call.name === "save_journal") {
             const { content } = call.args as any;
             await db.collection("journals").add({ sender, content, date: new Date().toISOString().split('T')[0], createdAt: FieldValue.serverTimestamp() });
             return `Catatan harian berhasil disimpan! 📓\nTerima kasih sudah berbagi cerita hari ini.`;
          }
          else if (call.name === "save_note") {
             const { title, content } = call.args as any;
             await db.collection("notes").add({ sender, title, content, createdAt: FieldValue.serverTimestamp() });
             return `Catatan tersimpan: *${title}* 📝\n\n${content}`;
          }

          // Read/Update/Delete operations
          // We need to return result to Gemini so it can answer the user
          let toolResponseData: any = { error: "Unknown function" };
          
          if (call.name === "send_message_to_contact") {
             const { target_name, message } = call.args as any;
             try {
                const contactsSnap = await db.collection("chats").get();
                const matchedContact = contactsSnap.docs.find(d => {
                   const cName = (d.data().name || "").toLowerCase();
                   return cName.length > 0 && (cName.includes(target_name.toLowerCase()) || target_name.toLowerCase().includes(cName));
                });
                
                if (matchedContact && matchedContact.data().sender) {
                   const targetPhone = matchedContact.data().sender;
                   await fetch("https://api.fonnte.com/send", {
                      method: "POST",
                      headers: {
                         "Authorization": fonnteToken,
                         "Content-Type": "application/json"
                      },
                      body: JSON.stringify({
                         target: targetPhone,
                         message: message,
                      })
                   });
                   toolResponseData = { success: true, message: `Pesan sukses dikirim ke ${matchedContact.data().name || target_name}` };
                } else {
                   toolResponseData = { success: false, error: `Gagal. Kontak bernama mirip '${target_name}' tidak ditemukan di sistem.` };
                }
             } catch(e) {
                toolResponseData = { success: false, error: String(e) };
             }
          }
          else if (call.name === "search_notes") {
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
          else if (call.name === "master_search_all_notes" && isMaster) {
             const keyword = (call.args as any).keyword?.toLowerCase() || "";
             const snapshot = await db.collection("notes").get();
             const notes = snapshot.docs
               .map(d => ({ id: d.id, ...d.data() }))
               .filter((n: any) => (n.title?.toLowerCase().includes(keyword) || n.content?.toLowerCase().includes(keyword)))
               .slice(0, 10);
             toolResponseData = { notes: notes.map((n:any) => ({ id: n.id, sender: n.sender, title: n.title, content: n.content })) };
          }
          else if (call.name === "master_get_all_contacts" && isMaster) {
             const snapshot = await db.collection("chats").select("name", "sender").limit(50).get();
             toolResponseData = { contacts: snapshot.docs.map(d => d.data()) };
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

    // Send reply via Fonnte API if not simulation
    if (!body.simulator) {
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
      
      const fonnteText = await fonnteRes.text();
      try {
        const fonnteData = JSON.parse(fonnteText);
        console.log("Fonnte API Response:", fonnteData);
      } catch (e) {
        console.warn("Fonnte returned non-JSON:", fonnteText);
      }
    }

    return res.status(200).json({ status: "success", reply });

  } catch (error) {
    console.error("Webhook Error:", error);
    // Return 200 OK to Fonnte even on error, so it doesn't retry infinitely and drain resources or cause more errors
    return res.status(200).json({ status: "error", error: "Internal Server Error", details: String(error) });
  }
}

