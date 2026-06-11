import { getFirestore } from "firebase-admin/firestore";
import * as adminImport from "firebase-admin";
import { GoogleGenAI } from "@google/genai";

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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { rawText, startDate } = req.body;
    if (!rawText) {
      return res.status(400).json({ error: "Missing raw text" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "API Key Gemini tidak ditemukan." });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Panggil model untuk mengekstrak topik
    const prompt = `Saya memiliki sekumpulan ide atau catatan acak. Tolong ekstrak teks ini menjadi daftar topik harian yang bisa ditanyakan oleh asisten AI kepada pengguna. 
Buat agar setiap topik terdengar luwes dan menarik untuk dibahas.

Teks mentah:
"""
${rawText}
"""

Berikan output DALAM BENTUK JSON ARRAY of strings (hanya array berisi string). Contoh:
["Apa pendapatmu tentang masa depan AI?", "Pernahkah kamu mencoba hobi baru akhir-akhir ini?", "Coba ceritakan buku yang sedang kamu baca."]
Pastikan response HANYA berupa JSON valid.`;

    const modelResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.7,
      },
    });

    let generatedText = modelResponse.text() || "[]";
    // Clean up markdown markers if any
    generatedText = generatedText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let extractedTopics: string[] = [];
    try {
      extractedTopics = JSON.parse(generatedText);
      if (!Array.isArray(extractedTopics)) {
        extractedTopics = [generatedText];
      }
    } catch (e) {
      return res
        .status(500)
        .json({ error: "Gagal memparsing respons dari AI." });
    }

    if (extractedTopics.length === 0) {
      return res
        .status(400)
        .json({
          error: "Tidak ada topik yang bisa diekstrak dari teks tersebut.",
        });
    }

    const db = getDb();
    const topicsRef = db.collection("random_topics");

    // Ambil data yang sudah ada untuk mencari tanggal kosong
    const snapshot = await topicsRef.get();
    const existingDates = new Set(snapshot.docs.map((doc) => doc.id));

    // Mulai dari startDate atau hari ini
    let currentDate = startDate ? new Date(startDate) : new Date();

    let savedCount = 0;

    // Simpan tiap topik ke tanggal yang masih kosong
    for (const topic of extractedTopics) {
      // Cari tanggal selanjutnya yang kosong
      let dateString = currentDate.toISOString().split("T")[0];
      while (existingDates.has(dateString)) {
        currentDate.setDate(currentDate.getDate() + 1);
        dateString = currentDate.toISOString().split("T")[0];
      }

      await topicsRef.doc(dateString).set({ topic });
      existingDates.add(dateString); // Tandai sudah dipakai
      savedCount++;
    }

    return res.status(200).json({
      success: true,
      message: `Berhasil menjadwalkan ${savedCount} topik baru.`,
      savedCount,
    });
  } catch (error: any) {
    console.error("Bulk Topics Error:", error);
    return res.status(500).json({ error: String(error) });
  }
}
