import * as adminImport from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";

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

let ai: GoogleGenAI | null = null;
function getAi() {
  if (!ai) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is required");
    }
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
}

async function generateMorningReport(
  sender: string,
  name: string,
  db: FirebaseFirestore.Firestore,
  jakartaTime: Date,
) {
  const genAi = getAi();

  // Get Reminders today for this specific user
  const remsSnap = await db
    .collection("reminders")
    .where("sender", "==", sender)
    .get();
  const userReminders = remsSnap.docs
    .filter((d) => d.data().status === "pending")
    .map((d) => {
      const dt = d.data().time?.toDate
        ? d.data().time.toDate()
        : new Date(d.data().time);
      return { msg: d.data().message, time: dt };
    })
    .filter((r) => r.time.getTime() < Date.now() + 24 * 60 * 60 * 1000);

  const notesSnap = await db
    .collection("notes")
    .where("sender", "==", sender)
    .get();
  const recentNotes = notesSnap.docs
    .map((d) => ({
      title: d.data().title,
      createdAt: d.data().createdAt?.toDate
        ? d.data().createdAt.toDate().getTime()
        : 0,
    }))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);

  const prompt = `Ini adalah tugas Laporan Pagi Eksekutif otomatis.
Sapa pengguna ini dengan hangat. Namanya adalah: ${name}.
Waktu saat ini (Jakarta): ${jakartaTime.toLocaleString("id-ID")}.

Pengingat hari ini:
${userReminders.length > 0 ? userReminders.map((r, i) => `- ${r.time.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} : ${r.msg}`).join("\n") : "Tidak ada jadwal khusus."}

Topik/catatan terakhir di Buku Catatan:
${recentNotes.length > 0 ? recentNotes.map((r, i) => `- ${r.title}`).join("\n") : "Tidak ada catatan."}

Instruksi:
Tuliskan 1 pesan laporan pagi (Morning Report) ala asisten eksekutif cerdas (namamu AIDA).
Berikan sapaan semangat, sebutkan cuaca secara umum (seperti "semoga hari cerah"), 
daftar pekerjaan/pengingat (format rapi), dan sebutkan secara singkat bahwa kamu mengingat catatan-catatan terakhir mereka.
Jangan gunakan intro/outro. Tulis pesan langsung yang siap dikirim di WhatsApp tanpa kalimat pengantar seperti "Tentu, ini draf pesannya:". Pastikan menggunakan Emoji.`;

  const response = await genAi.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: { temperature: 0.8 },
  });
  return (
    response.text || "Selamat pagi! Semoga harimu menyenangkan bersama AIDA. 😊"
  );
}

export default async function handler(req: any, res: any) {
  // Hanya proses jika metoda adalah GET atau POST
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const db = getDb();
    const now = new Date();
    const fonnteToken = process.env.FONNTE_TOKEN;
    if (!fonnteToken) {
      return res.status(500).json({ error: "Missing FONNTE_TOKEN" });
    }

    let reportSent = 0;

    // ============================================
    // 1. LAPORAN PAGI EKSEKUTIF
    // ============================================
    const settingsDoc = await db.collection("settings").doc("global").get();
    const settings = settingsDoc.exists ? settingsDoc.data() : {};
    const reportTime =
      typeof settings?.morningReportTime === "number"
        ? settings.morningReportTime
        : 6;
    const reportEnabled = settings?.morningReportEnabled !== false;

    const jakartaTimeStr = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Jakarta",
    });
    const jakartaTime = new Date(jakartaTimeStr);
    const dateString = `${jakartaTime.getFullYear()}-${jakartaTime.getMonth() + 1}-${jakartaTime.getDate()}`;
    const isoDateString = `${jakartaTime.getFullYear()}-${String(jakartaTime.getMonth() + 1).padStart(2, "0")}-${String(jakartaTime.getDate()).padStart(2, "0")}`;

    let todayTopic = "";
    try {
      const topicDoc = await db
        .collection("random_topics")
        .doc(isoDateString)
        .get();
      if (topicDoc.exists) {
        todayTopic = topicDoc.data()?.topic || "";
      }
    } catch (e) {}

    // Jika jam sesuai dengan yang di-setting (Cron berjalan setiap menit)
    if (reportEnabled && jakartaTime.getHours() === reportTime) {
      const chatSnapshot = await db.collection("chats").get();
      for (const doc of chatSnapshot.docs) {
        const chatData = doc.data();
        if (chatData.lastMorningReportDate !== dateString && chatData.sender) {
          const sender = chatData.sender;
          const userName = chatData.name || "Bapak/Ibu";

          try {
            const reportMsg = await generateMorningReport(
              sender,
              userName,
              db,
              jakartaTime,
            );

            await fetch("https://api.fonnte.com/send", {
              method: "POST",
              headers: {
                Authorization: fonnteToken,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                target: sender,
                message: reportMsg,
              }),
            });

            await doc.ref.update({ lastMorningReportDate: dateString });
            reportSent++;
          } catch (e) {
            console.error(`Gagal kirim Morning Report ke ${sender}`, e);
          }
        }
      }
    }

    // ============================================
    // 1b. SAPAAN ACAK (RANDOM GREETING)
    // ============================================
    const randomGreetingEnabled = settings?.randomGreetingEnabled !== false;
    let randomGreetingsSent = 0;

    if (randomGreetingEnabled) {
      const currentHour = jakartaTime.getHours();
      // Berlaku antara pukul 08:00 hingga 19:59
      if (currentHour >= 8 && currentHour < 20) {
        const chatSnapshot = await db.collection("chats").get();
        for (const doc of chatSnapshot.docs) {
          const chatData = doc.data();
          if (
            chatData.sender &&
            chatData.lastRandomGreetingDate !== dateString
          ) {
            let plannedTime = chatData.plannedRandomGreetingTime;
            let plannedDate = chatData.plannedRandomGreetingDate;

            if (plannedDate !== dateString) {
              const minMinute = 8 * 60;
              const maxMinute = 19 * 60 + 59;
              plannedTime =
                Math.floor(Math.random() * (maxMinute - minMinute + 1)) +
                minMinute;
              plannedDate = dateString;
              await doc.ref.update({
                plannedRandomGreetingTime: plannedTime,
                plannedRandomGreetingDate: plannedDate,
              });
            }

            const currentTotalMinutes =
              currentHour * 60 + jakartaTime.getMinutes();
            if (currentTotalMinutes >= plannedTime) {
              const userName = chatData.name || "di sana";

              try {
                const notesSnap = await db
                  .collection("notes")
                  .where("sender", "==", chatData.sender)
                  .get();
                const recentNotesDocs = notesSnap.docs
                  .map((d) => ({
                    title: d.data().title,
                    createdAt: d.data().createdAt?.toDate
                      ? d.data().createdAt.toDate().getTime()
                      : 0,
                  }))
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .slice(0, 3);
                const recentNotes = recentNotesDocs
                  .map((d) => d.title)
                  .join(", ");

                const prompt = `Ini adalah tugas mengirim "Sapaan Siang/Sore" otomatis ke kontak.
Namanya: ${userName}.
Waktu di Jakarta: ${jakartaTime.toLocaleString("id-ID")}.

${recentNotes ? `Sebagai konteks tambahan, pengguna memiliki catatan mengenai: ${recentNotes}. Gunakan jika dirasa relevan atau bisa diabaikan.` : ""}

${todayTopic ? `TOPIK PEMBICARAAN HARI INI: ${todayTopic}\nAnda DIWAJIBKAN menggunakan topik ini sebagai bahan obrolan sekarang.` : "Jika tidak ada topik khusus, tanyakan keseharian biasa."}

Instruksi PENTING:
- Tuliskan pesan singkat yang kasual, santai, seolah-olah chat dari asisten teman sendiri tanpa pembukaan kaku (JANGAN gunakan sapaan formal atau tulisan "Halo AIDA di sini"). Langsung saja seperti mengajak ngobrol.
- Tanyakan kabarnya atau bagaimana harinya berjalan. Jangan menggurui. Bisa bahas sedikit konteks / kesukaan jika kamu tahu.
- Jangan tulis salam pembuka/penutup.
- DILARANG menggunakan awalan seperti "Tentu, ini draf pesannya:". Langsung tulis pesannya.
- Sertakan emoji sewajarnya.`;

                const genAi = getAi();
                const response = await genAi.models.generateContent({
                  model: "gemini-2.5-flash",
                  contents: prompt,
                  config: { temperature: 0.95 },
                });

                const greetingMsg =
                  response.text ||
                  "Ngomong-ngomong, gimana harimu sejauh ini? Kalau mau cerita atau butuh bantuan, ketik aja ya! 😊";

                await fetch("https://api.fonnte.com/send", {
                  method: "POST",
                  headers: {
                    Authorization: fonnteToken,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    target: chatData.sender,
                    message: greetingMsg,
                  }),
                });

                await doc.ref.update({ lastRandomGreetingDate: dateString });
                randomGreetingsSent++;
              } catch (e) {
                console.error(
                  `Gagal kirim Random Greeting ke ${chatData.sender}`,
                  e,
                );
              }
            }
          }
        }
      }
    }

    // ============================================
    // 1c. PERTANYAAN BUKU HARIAN MALAM (EVENING JOURNAL)
    // ============================================
    let eveningJournalSent = 0;
    const currentHourForJournal = jakartaTime.getHours();

    // Kirim pada jam 20:00 (jam 8 malam)
    if (currentHourForJournal === 20) {
      const chatSnapshot = await db.collection("chats").get();
      for (const doc of chatSnapshot.docs) {
        const chatData = doc.data();
        if (chatData.sender && chatData.lastEveningJournalDate !== dateString) {
          const userName = chatData.name || "kamu";

          try {
            const prompt = `Ini adalah tugas mengirim sapaan malam otomatis ke kontak untuk buku harian (diary).
Namanya: ${userName}.
Waktu di Jakarta: ${jakartaTime.toLocaleString("id-ID")}.

Instruksi PENTING:
- Sapa selamat malam dengan hangat dan bersahabat.
- Tanyakan kabarnya hari ini atau bagaimana harinya berjalan. 
- Tanya apakah ada sesuatu yang ingin ia ceritakan atau tulis untuk disimpan ke buku hariannya malam ini.
- Jangan terlalu panjang. Sekitar 2-3 kalimat santai.
- DILARANG menggunakan awalan komputasional seperti "Tentu, ini draf sapaan malam otomatisnya:". Langsung tulis pesannya saja seolah dari chat WA yang asli.
- Sertakan emoji yang menenangkan (seperti 🌙, 🍵, 📔, dll).`;

            const genAi = getAi();
            const response = await genAi.models.generateContent({
              model: "gemini-2.5-flash",
              contents: prompt,
              config: { temperature: 0.8 },
            });

            const journalMsg =
              response.text ||
              `Malam ${userName}! 🌙 Gimana harimu hari ini? Kalau ada cerita seru, keluh kesah, atau momen penting, ceritain aja ke aku ya. Nanti aku bantu simpan di buku harianmu. 📔`;

            await fetch("https://api.fonnte.com/send", {
              method: "POST",
              headers: {
                Authorization: fonnteToken,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                target: chatData.sender,
                message: journalMsg,
              }),
            });

            await doc.ref.update({ lastEveningJournalDate: dateString });
            eveningJournalSent++;
          } catch (e) {
            console.error(
              `Gagal kirim Evening Journal ke ${chatData.sender}`,
              e,
            );
          }
        }
      }
    }

    // ============================================
    // 1d. ALARM PENGINGAT HARIAN (DARI KONTAK)
    // ============================================
    let alarmsSent = 0;
    const hariIndo = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const currentHari = hariIndo[jakartaTime.getDay()];
    const currentJamStr = String(jakartaTime.getHours()).padStart(2, "0") + ":" + String(jakartaTime.getMinutes()).padStart(2, "0");

    const chatAlertSnapshot = await db.collection("chats").get();
    for (const doc of chatAlertSnapshot.docs) {
      const chatData = doc.data();
      if (chatData.sender && chatData.alarms && Array.isArray(chatData.alarms)) {
        let updatedAlarms = false;
        const userAlarms = chatData.alarms;

        for (const al of userAlarms) {
          const daysArr = Array.isArray(al.days) ? al.days : [];
          const isMatchDay = daysArr.includes("Setiap Hari") || daysArr.includes(currentHari);
          const isMatchTime = al.time === currentJamStr;

          if (isMatchDay && isMatchTime && al.lastSentDate !== dateString) {
            try {
              const userName = chatData.name || "Bapak/Ibu";
              const alarmMsgText = al.message || "Ada pengingat dari sistem.";

              const prompt = `Ini adalah alarm otomatis untuk kontak.
Nama: ${userName}.
Waktu saat ini (Jakarta): ${jakartaTime.toLocaleString("id-ID")}.
Judul/Pesan Alarm: ${alarmMsgText}

Instruksi:
Tuliskan satu pesan WA yang sangat suportif, hangat, ramah khas asisten pribadi yang memanggil pengguna dengan namanya. Ingatkan mengenai hal yang disebutkan di "Pesan Alarm" dengan natural. Sertakan emoji.
JANGAN gunakan intro "Tentu, ini draf pesannya". Langsung tulis draf jadinya.`;

              const genAi = getAi();
              const response = await genAi.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: { temperature: 0.8 },
              });

              const botMessage =
                response.text ||
                `Halo ${userName}, ini pengingat untukmu: ${alarmMsgText} ⏰ Semangat ya!`;

              await fetch("https://api.fonnte.com/send", {
                method: "POST",
                headers: {
                  Authorization: fonnteToken,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  target: chatData.sender,
                  message: botMessage,
                }),
              });

              al.lastSentDate = dateString;
              updatedAlarms = true;
              alarmsSent++;
            } catch (e) {
              console.error(\`Gagal kirim Alarm Harian ke \${chatData.sender}\`, e);
            }
          }
        }

        if (updatedAlarms) {
          await doc.ref.update({ alarms: userAlarms });
        }
      }
    }

    // ============================================
    // 2. PENGIRIMAN PENGINGAT (REMINDERS) APLIKASI
    // ============================================
    const snapshot = await db
      .collection("reminders")
      .where("status", "==", "pending")
      .get();

    // Filter di memory untuk menghindari error "query requires an index" di Firestore
    const dueDocs = snapshot.docs.filter((doc) => {
      const data = doc.data();
      // data.time bisa berupa objek Firestore Timestamp (jika disimpan lewat SDK) atau Date
      const reminderTime = data.time?.toDate
        ? data.time.toDate()
        : new Date(data.time);
      return reminderTime <= now;
    });

    if (dueDocs.length === 0 && reportSent === 0) {
      return res
        .status(200)
        .json({ status: "ok", sent: 0, message: "Tidak ada tugas." });
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
            Authorization: fonnteToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            target: data.sender,
            message: `🔔 *PENGINGAT* 🔔\n\n${data.message}`,
          }),
        });

        const result = await response.json();

        if (result.status) {
          // Tandai sebagai terkirim jika berhasil
          await doc.ref.update({
            status: "sent",
            sentAt: new Date(),
          });
          sentCount++;
        } else {
          console.error("Gagal mengirim pesan via Fonnte:", result);
          // Update status error agar tidak mengulang terus menerus
          await doc.ref.update({
            status: "error",
            error_reason: result.reason || "Unknown error from Fonnte",
            triedAt: new Date(),
          });
        }
      } catch (e: any) {
        console.error("Fetch Fonnte failed for reminder:", doc.id, e);
      }
    }

    return res.status(200).json({
      status: "ok",
      alarmsSent: alarmsSent,
      remindersSent: sentCount,
      morningReportsSent: reportSent,
      randomGreetingsSent: randomGreetingsSent,
      eveningJournalSent: eveningJournalSent,
    });
  } catch (error: any) {
    console.error("Cron Error:", error);
    return res.status(500).json({ error: error.message || String(error) });
  }
}
