import { useState, useEffect } from "react";
import {
  Settings,
  Users,
  BookOpen,
  Activity,
  Save,
  BarChart2,
  FileText,
  Bell,
  Clock,
  RefreshCw,
  CalendarDays,
  Menu,
  X,
  Send,
  Link,
  Sun,
  AlertTriangle,
  Book,
} from "lucide-react";

function OverviewTab() {
  const [stats, setStats] = useState<any>({
    totalMessages: 0,
    activeUsers: 0,
    totalReminders: 0,
    totalNotes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [cronLoading, setCronLoading] = useState(false);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      });
  }, []);

  const triggerCron = async () => {
    setCronLoading(true);
    try {
      const res = await fetch("/api/cron", { method: "POST" });
      const data = await res.json();
      alert(
        `Manual trigger sukses!\nPengingat terkirim: ${data.remindersSent}\nLaporan Pagi Terkirim: ${data.morningReportsSent}`,
      );
    } catch (e: any) {
      alert(`Gagal trigger cron: ${e.message}`);
    }
    setCronLoading(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Ringkasan Sistem</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500 font-medium mb-1 flex items-center gap-2">
            <Users size={16} /> Pengguna Aktif
          </p>
          <p className="text-3xl font-bold text-gray-800">
            {loading ? "-" : stats.activeUsers}
          </p>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500 font-medium mb-1 flex items-center gap-2">
            <BarChart2 size={16} /> Total Pesan
          </p>
          <p className="text-3xl font-bold text-gray-800">
            {loading ? "-" : stats.totalMessages}
          </p>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500 font-medium mb-1 flex items-center gap-2">
            <Bell size={16} /> Pengingat
          </p>
          <p className="text-3xl font-bold text-gray-800">
            {loading ? "-" : stats.totalReminders}
          </p>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500 font-medium mb-1 flex items-center gap-2">
            <FileText size={16} /> Buku Catatan
          </p>
          <p className="text-3xl font-bold text-gray-800">
            {loading ? "-" : stats.totalNotes}
          </p>
        </div>
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-100 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <Clock size={20} /> Eksekusi Cron Manual
        </h3>
        <p className="text-sm text-blue-700 mb-4">
          Gunakan tombol ini untuk menjalankan sistem pengecekan pengingat dan
          laporan pagi tanpa harus menunggu jadwal cronjob dari pihak ketiga.
          Berguna untuk keperluan testing.
        </p>
        <button
          onClick={triggerCron}
          disabled={cronLoading}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition disabled:opacity-50"
        >
          <RefreshCw size={18} className={cronLoading ? "animate-spin" : ""} />
          {cronLoading ? "Menjalankan..." : "Jalankan Cron Sekarang"}
        </button>
      </div>
    </div>
  );
}

function SetupStatusTab() {
  const webhookUrl = `${import.meta.env.VITE_APP_URL || window.location.origin}/api/webhook`;
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const checkStatus = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/status");
      const data = await res.json();
      setStatus(data);
    } catch (e: any) {
      setStatus({ status: "ERROR", error_detail: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-gray-700">
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          1. Fonnte Configuration
        </h2>
        <p className="mb-2">
          Copy the following Webhook URL and paste it into your{" "}
          <a
            href="https://md.fonnte.com/api/api.php"
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:underline"
          >
            Fonnte API settings
          </a>
          :
        </p>
        <div className="bg-gray-100 p-3 rounded flex items-center justify-between border border-gray-200">
          <code className="text-sm text-pink-600 break-all">{webhookUrl}</code>
          <button
            onClick={() => navigator.clipboard.writeText(webhookUrl)}
            className="ml-4 px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            Copy
          </button>
        </div>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          2. System Status Check
        </h2>
        <p className="mb-4">
          Click the button below to test the connection between the deployment
          environment and Firebase/Firestore.
        </p>
        <button
          onClick={checkStatus}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Checking..." : "Check System Status"}
        </button>

        {status && (
          <div
            className={`mt-4 p-4 rounded ${status.status === "OK" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}
          >
            <h3
              className={`font-bold ${status.status === "OK" ? "text-green-800" : "text-red-800"}`}
            >
              {status.status === "OK"
                ? "✅ System is Healthy"
                : "❌ System Error"}
            </h3>
            <p className="text-sm mt-1 mb-2 font-mono">
              Firebase: {status.firebase || status.status}
            </p>
            {status.info && <p className="text-sm">{status.info}</p>}
            {status.error_detail && (
              <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-auto text-red-900 border border-red-200">
                {status.error_detail}
              </pre>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          3. Setup Fitur Pengingat & Laporan Eksekutif Pagi (Cron Job)
        </h2>
        <p className="mb-2 text-sm">
          Agar asisten AI dapat mengingatkan Anda serta mengirimkan{" "}
          <b>Laporan Pagi Eksekutif</b> (sapaan, jadwal hari ini, & riwayat
          catatan) pada jam 6 pagi, Anda harus men-trigger sistem setiap 1
          menit. Anda dapat menggunakan layanan gratis seperti{" "}
          <a
            href="https://cron-job.org/"
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:underline"
          >
            cron-job.org
          </a>
          .
        </p>
        <div className="bg-gray-100 p-3 rounded flex items-center justify-between border border-gray-200">
          <code className="text-sm text-pink-600 break-all">
            {import.meta.env.VITE_APP_URL || window.location.origin}/api/cron
          </code>
          <button
            onClick={() =>
              navigator.clipboard.writeText(
                `${import.meta.env.VITE_APP_URL || window.location.origin}/api/cron`,
              )
            }
            className="ml-4 px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            Copy URL
          </button>
        </div>
        <ol className="list-decimal pl-5 mt-3 space-y-1 text-sm bg-blue-50/50 p-4 rounded border border-blue-100">
          <li>Daftar/Login ke cron-job.org</li>
          <li>Buat Cronjob baru (Create Cronjob)</li>
          <li>Paste URL di atas ke kolom URL</li>
          <li>
            Set jadwal eksekusi menjadi <b>Every 1 minute</b>
          </li>
          <li>
            Simpan. Asisten Anda kini mendukung Pengingat (Reminder) Otomatis
            dan Laporan Eksekutif setiap pagi jam 6!
          </li>
        </ol>

        <div className="mt-6 bg-white p-4 rounded border border-gray-200 shadow-sm">
          <h3 className="text-lg font-medium text-gray-800 mb-2">
            ✨ Fitur Baru Tersedia
          </h3>
          <ul className="list-disc pl-5 text-sm space-y-2">
            <li>
              <b>Buku Catatan AI:</b> Anda sekarang bisa menyuruh AIDA menyimpan
              info penting, mencari catatan, memperbarui, hingga menghapusnya
              nanti.
            </li>
            <li>
              <b>Laporan Pagi Eksekutif:</b> Setiap jam 6 pagi AIDA akan
              memeriksa pengingat hari itu, merangkum riwayat catatan terakhir,
              dan mengirimkan pesan motivasi pagi ala asisten profesional.
            </li>
            <li>
              <b>Pengingat Terjadwal:</b> Minta AIDA untuk "Ingatkan saya
              meeting besok jam 10 pagi".
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}

function NotesTab() {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNote, setEditingNote] = useState<any>(null);

  const fetchNotes = () => {
    setLoading(true);
    fetch("/api/dashboard-notes")
      .then((r) => r.json())
      .then((data) => {
        setNotes(data.notes || []);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const saveNote = async () => {
    if (!editingNote.title?.trim() || !editingNote.content?.trim()) {
      alert("Judul dan isi tidak boleh kosong.");
      return;
    }
    await fetch("/api/dashboard-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingNote),
    });
    setEditingNote(null);
    fetchNotes();
  };

  const deleteNote = async (id: string) => {
    if (!confirm("Hapus catatan ini?")) return;
    await fetch("/api/dashboard-notes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchNotes();
  };

  if (editingNote) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setEditingNote(null)}
          className="text-sm text-blue-600 hover:underline mb-4"
        >
          ← Kembali
        </button>
        <h2 className="text-xl font-bold">Edit Catatan</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Judul</label>
          <input
            value={editingNote.title}
            onChange={(e) =>
              setEditingNote({ ...editingNote, title: e.target.value })
            }
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Isi Catatan</label>
          <textarea
            value={editingNote.content}
            onChange={(e) =>
              setEditingNote({ ...editingNote, content: e.target.value })
            }
            className="w-full h-40 p-2 border rounded"
          />
        </div>
        <button
          onClick={saveNote}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Simpan
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Buku Catatan AI</h2>
      <p className="text-sm text-gray-600 mb-4">
        Daftar semua informasi yang diingat atau dicatat oleh asisten AIDA untuk
        pengguna Anda.
      </p>

      {loading ? (
        <p>Memuat catatan...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map((note) => (
            <div
              key={note.id}
              className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl shadow-sm flex flex-col"
            >
              <div className="flex justify-between items-start mb-2">
                <h3
                  className="font-bold text-gray-800 line-clamp-1"
                  title={note.title}
                >
                  {note.title}
                </h3>
                <span className="text-[10px] text-gray-500 bg-white px-2 py-1 rounded-full border">
                  {note.sender}
                </span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-4 flex-1">
                {note.content}
              </p>
              <div className="flex justify-between items-center mt-4 pt-3 border-t border-yellow-200">
                <span className="text-xs text-gray-500">
                  {new Date(note.createdAt).toLocaleDateString("id-ID")}
                </span>
                <div className="flex gap-3">
                  <button
                    onClick={() => setEditingNote(note)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          ))}
          {notes.length === 0 && (
            <p className="text-gray-500 italic col-span-full">
              Belum ada catatan.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function RemindersTab() {
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReminders = () => {
    setLoading(true);
    fetch("/api/dashboard-reminders")
      .then((r) => r.json())
      .then((data) => {
        setReminders(data.reminders || []);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchReminders();
  }, []);

  const deleteReminder = async (id: string) => {
    if (!confirm("Hapus pengingat ini secara permanen?")) return;
    await fetch("/api/dashboard-reminders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchReminders();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Daftar Pengingat</h2>
      <p className="text-sm text-gray-600 mb-4">
        Semua pengingat yang telah dijadwalkan oleh pengguna maupun riwayat masa
        lalu.
      </p>

      {loading ? (
        <p>Memuat pengingat...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reminders.map((rem) => (
            <div
              key={rem.id}
              className="bg-white border rounded-xl p-4 shadow-sm flex flex-col relative"
            >
              <div className="flex justify-between items-start mb-2">
                <span
                  className={`text-[10px] px-2 py-1 rounded-full border font-bold uppercase ${rem.status === "pending" ? "bg-orange-100 text-orange-700 border-orange-200" : "bg-green-100 text-green-700 border-green-200"}`}
                >
                  {rem.status}
                </span>
                <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-1 rounded-full border">
                  {rem.sender}
                </span>
              </div>
              <p className="text-sm text-gray-800 font-medium whitespace-pre-wrap flex-1 my-3">
                {rem.message}
              </p>
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <div className="text-xs text-gray-500 flex flex-col">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />{" "}
                    {new Date(rem.time).toLocaleString("id-ID")}
                  </span>
                </div>
                <button
                  onClick={() => deleteReminder(rem.id)}
                  className="text-red-500 hover:text-red-700 text-sm font-medium border border-red-100 px-2 py-1 rounded-md hover:bg-red-50"
                >
                  Hapus
                </button>
              </div>
            </div>
          ))}
          {reminders.length === 0 && (
            <p className="text-gray-500 italic col-span-full">
              Belum ada pengingat.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function GlobalSettingsTab() {
  const [settings, setSettings] = useState({
    systemPrompt: "",
    creativity: 0.7,
    maxMemory: 10,
    morningReportTime: 6,
    morningReportEnabled: true,
    randomGreetingEnabled: true,
    masterContact: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings((prev) => ({ ...prev, ...data }));
      });
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    alert("Pengaturan Berhasil Disimpan!");
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Global AI Settings</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nomor Master (Super Admin)
        </label>
        <input
          type="text"
          value={settings.masterContact}
          onChange={(e) =>
            setSettings({ ...settings, masterContact: e.target.value })
          }
          placeholder="contoh: 081234567890 (kosongkan jika tidak ada)"
          className="w-full p-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
        />
        <p className="text-xs text-blue-600 mt-1">
          ⚠️ Nomor ini dapat mencari data catatan seluruh pengguna.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          System Prompt / Peran AI
        </label>
        <textarea
          value={settings.systemPrompt}
          onChange={(e) =>
            setSettings({ ...settings, systemPrompt: e.target.value })
          }
          className="w-full h-32 p-3 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
          placeholder="Kamu adalah asisten AI..."
        />
        <p className="text-xs text-gray-500 mt-1">
          Instruksi utama untuk perilaku AI.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Kreativitas (Temperature): {settings.creativity}
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={settings.creativity}
            onChange={(e) =>
              setSettings({
                ...settings,
                creativity: parseFloat(e.target.value),
              })
            }
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>Kaku & Akurat (0.0)</span>
            <span>Sangat Kreatif (2.0)</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Batas Ingatan (Maksimal Pesan History)
          </label>
          <input
            type="number"
            min="1"
            max="50"
            value={settings.maxMemory}
            onChange={(e) =>
              setSettings({ ...settings, maxMemory: parseInt(e.target.value) })
            }
            className="w-full p-2 border rounded-lg"
          />
        </div>
      </div>

      <div className="border-t pt-6 mt-6">
        <h3 className="text-lg font-medium text-gray-800 mb-4">
          Sapaan Acak Harian & Laporan Pagi
        </h3>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="morningReportEnabled"
              checked={settings.morningReportEnabled}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  morningReportEnabled: e.target.checked,
                })
              }
              className="w-5 h-5 text-blue-600 rounded"
            />
            <label
              htmlFor="morningReportEnabled"
              className="text-sm font-medium text-gray-700"
            >
              Aktifkan Laporan Pagi Otomatis
            </label>
          </div>

          {settings.morningReportEnabled && (
            <div className="pl-7">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Jam Kirim Laporan (Waktu Jakarta / UTC+7)
              </label>
              <select
                value={settings.morningReportTime}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    morningReportTime: parseInt(e.target.value),
                  })
                }
                className="w-full md:w-48 p-2 border rounded-lg"
              >
                {[...Array(24)].map((_, i) => (
                  <option
                    key={i}
                    value={i}
                  >{`${i.toString().padStart(2, "0")}:00`}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Laporan pagi akan dikirimkan pada jam ini setiap hari.
              </p>
            </div>
          )}

          <div className="flex items-start gap-2 pt-2">
            <input
              type="checkbox"
              id="randomGreetingEnabled"
              checked={settings.randomGreetingEnabled}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  randomGreetingEnabled: e.target.checked,
                })
              }
              className="w-5 h-5 text-blue-600 rounded mt-0.5"
            />
            <div>
              <label
                htmlFor="randomGreetingEnabled"
                className="text-sm font-medium text-gray-700 block"
              >
                Aktifkan Sapaan Acak Siang/Sore
              </label>
              <p className="text-xs text-gray-500 mt-1">
                AIDA akan mengirim sapaan ramah dan menanyakan kabar secara acak
                pada setiap kontak antara pukul 08:00 hingga 20:00. Pesan
                dihasilkan secara dinamis berdasarkan memori pengguna.
              </p>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={saveSettings}
        disabled={saving}
        className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded shadow hover:bg-blue-700 disabled:opacity-50"
      >
        <Save size={18} /> {saving ? "Menyimpan..." : "Simpan Pengaturan"}
      </button>
    </div>
  );
}

function KnowledgeTab() {
  const [knowledge, setKnowledge] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setKnowledge(data.knowledgeBase || "");
      });
  }, []);

  const saveKnowledge = async () => {
    setSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ knowledgeBase: knowledge }),
    });
    setSaving(false);
    alert("Pengetahuan Berhasil Disimpan!");
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">
        Basis Pengetahuan (Knowledge Base)
      </h2>
      <p className="text-sm text-gray-600">
        Tempelkan informasi, panduan, atau FAQ perusahaan di sini. AI akan
        menggunakan informasi ini sebagai referensi saat membalas pesan.
      </p>

      <textarea
        value={knowledge}
        onChange={(e) => setKnowledge(e.target.value)}
        className="w-full h-80 p-3 border rounded-lg focus:ring-blue-500 focus:border-blue-500 font-mono text-sm leading-relaxed"
        placeholder="Informasi produk, harga, jam operasional..."
      />

      <button
        onClick={saveKnowledge}
        disabled={saving}
        className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded shadow hover:bg-blue-700 disabled:opacity-50"
      >
        <Save size={18} /> {saving ? "Menyimpan..." : "Simpan Pengetahuan"}
      </button>
    </div>
  );
}

function ContactsTab() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<any[] | null>(null);

  const fetchContacts = () => {
    setLoading(true);
    fetch("/api/contacts")
      .then((r) => r.json())
      .then((data) => {
        setContacts(data.contacts || []);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const saveContact = async () => {
    setSaving(true);
    await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    setSaving(false);
    setEditing(null);
    fetchContacts();
  };

  const viewLogs = async (sender: string) => {
    setLogs([]);
    const res = await fetch(`/api/dashboard-logs?sender=${sender}`);
    const data = await res.json();
    setLogs(data.history || []);
  };

  if (logs !== null) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setLogs(null)}
          className="text-sm text-blue-600 hover:underline mb-4"
        >
          ← Kembali
        </button>
        <h2 className="text-2xl font-bold text-gray-800">Log Percakapan</h2>
        <div className="bg-gray-50 border rounded-lg p-4 h-96 overflow-y-auto space-y-4">
          {logs.length === 0 && (
            <p className="text-gray-500 text-sm">Belum ada history.</p>
          )}
          {logs.map((msg, i) => (
            <div
              key={i}
              className={`flex flex-col ${msg.role === "model" ? "items-start" : "items-end"}`}
            >
              <div
                className={`max-w-[80%] rounded-xl p-3 text-sm ${msg.role === "model" ? "bg-white border text-gray-800" : "bg-blue-600 text-white"}`}
              >
                {msg.parts.map((p: any, j: number) => {
                  if (p.text)
                    return (
                      <p key={j} className="whitespace-pre-wrap">
                        {p.text}
                      </p>
                    );
                  if (p.functionCall)
                    return (
                      <p key={j} className="text-xs italic opacity-75">
                        🔧 Alat dipanggil: {p.functionCall.name}
                      </p>
                    );
                  if (p.functionResponse)
                    return (
                      <p key={j} className="text-xs italic opacity-75">
                        ✅ Hasil alat diterima.
                      </p>
                    );
                  return null;
                })}
              </div>
              <span className="text-[10px] text-gray-400 mt-1">
                {msg.role === "model" ? "AIDA" : "User"}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setEditing(null)}
          className="text-sm text-blue-600 hover:underline mb-4"
        >
          ← Kembali ke daftar
        </button>
        <h2 className="text-2xl font-bold text-gray-800">
          Edit Kontak: {editing.sender}
        </h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nama Panggilan
          </label>
          <input
            type="text"
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            className="w-full p-2 border rounded-lg"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kota Saat Ini
            </label>
            <input
              type="text"
              value={editing.city || ""}
              onChange={(e) => setEditing({ ...editing, city: e.target.value })}
              className="w-full p-2 border rounded-lg"
              placeholder="Contoh: Jakarta"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hobi
            </label>
            <input
              type="text"
              value={editing.hobby || ""}
              onChange={(e) =>
                setEditing({ ...editing, hobby: e.target.value })
              }
              className="w-full p-2 border rounded-lg"
              placeholder="Contoh: Membaca, Bersepeda"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Minat / Kesukaan Lainnya
            </label>
            <input
              type="text"
              value={editing.interest || ""}
              onChange={(e) =>
                setEditing({ ...editing, interest: e.target.value })
              }
              className="w-full p-2 border rounded-lg"
              placeholder="Contoh: Teknologi, Film Sci-Fi"
            />
          </div>
        </div>

        {editing.smartProfile &&
          Object.keys(editing.smartProfile).length > 0 && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl shadow-sm">
              <h3 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-1">
                ✨ Profil Pintar (Auto-Ekstrak AI)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.keys(editing.smartProfile).map((key) => {
                  const sp = editing.smartProfile[key];
                  return (
                    <div
                      key={key}
                      className="bg-white p-2 rounded border border-blue-100"
                    >
                      <p className="text-[10px] uppercase font-bold text-blue-500 mb-0.5">
                        {sp.displayKey}
                      </p>
                      <p className="text-sm text-gray-800">{sp.value}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Instruksi Spesifik untuk Nomor ini
          </label>
          <textarea
            value={editing.instruction}
            onChange={(e) =>
              setEditing({ ...editing, instruction: e.target.value })
            }
            className="w-full h-24 p-3 border rounded-lg"
            placeholder="Contoh: Ini adalah bos saya, jawab dengan sangat sopan..."
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="humanOverride"
            checked={editing.humanTakeover}
            onChange={(e) =>
              setEditing({ ...editing, humanTakeover: e.target.checked })
            }
            className="w-5 h-5 text-blue-600 rounded"
          />
          <label
            htmlFor="humanOverride"
            className="text-sm font-medium text-red-600"
          >
            Human Takeover (Matikan AI untuk nomor ini)
          </label>
        </div>

        <button
          onClick={saveContact}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded shadow hover:bg-blue-700 disabled:opacity-50"
        >
          <Save size={18} /> {saving ? "Menyimpan..." : "Simpan Kontak"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">
        Manajemen Pengguna & Personal AI
      </h2>
      <p className="text-sm text-gray-600">
        Daftar pengguna yang pernah berinteraksi dengan AI. Anda dapat mematikan
        AI (Human Takeover) atau memberikan catatan spesifik pada kontak
        tertentu.
      </p>

      {loading ? (
        <p>Memuat data kontak...</p>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left bg-white min-w-[500px]">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-3 text-sm font-medium text-gray-600">
                    Pengguna (Nomor)
                  </th>
                  <th className="p-3 text-sm font-medium text-gray-600">
                    Pesan
                  </th>
                  <th className="p-3 text-sm font-medium text-gray-600">
                    Takeover?
                  </th>
                  <th className="p-3 text-sm font-medium text-gray-600">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="p-3">
                      <div className="font-medium text-gray-900">{c.name}</div>
                      {c.name !== c.sender && (
                        <div className="text-xs text-gray-500">{c.sender}</div>
                      )}
                    </td>
                    <td className="p-3 text-sm text-gray-600">
                      {c.messageCount} history
                    </td>
                    <td className="p-3">
                      {c.humanTakeover ? (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                          Nonaktif
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          Aktif AI
                        </span>
                      )}
                    </td>
                    <td className="p-3 flex gap-3">
                      <button
                        onClick={() => viewLogs(c.sender)}
                        className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                      >
                        Logs
                      </button>
                      <button
                        onClick={() => setEditing(c)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {contacts.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-4 text-center text-gray-500 text-sm"
                    >
                      Belum ada chat masuk.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function BroadcastTab() {
  const [target, setTarget] = useState("all");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const sendBroadcast = async () => {
    if (!message.trim()) return alert("Pesan tidak boleh kosong");
    if (!confirm("Kirim pesan broadcast sekarang?")) return;

    setLoading(true);
    try {
      const res = await fetch("/api/dashboard-broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, message }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Siaran berhasil dikirim ke ${data.sentCount} penerima!`);
        setMessage("");
      } else {
        alert("Gagal: " + (data.error || "Unknown"));
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Broadcast Pesan</h2>
      <p className="text-sm text-gray-600">
        Kirim pesan siaran (broadcast) kepada pengguna AI Anda secara massal.
      </p>

      <div>
        <label className="block text-sm font-medium mb-1">
          Target Penerima
        </label>
        <input
          type="text"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="'all' untuk semua, atau pisahkan dengan koma: 0812.., 0813.."
          className="w-full p-2 border rounded-lg"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Pesan Siaran</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full h-32 p-3 border rounded-lg"
          placeholder="Ketik pesan Anda di sini..."
        />
      </div>
      <button
        onClick={sendBroadcast}
        disabled={loading}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50"
      >
        <Send size={18} />{" "}
        {loading ? "Mengirim..." : "Kirim Broadcast Sekarang"}
      </button>
    </div>
  );
}

function IntegrationsTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">
        API Eksternal & Integrasi
      </h2>
      <p className="text-sm text-gray-600">
        Kelola URL Endpoint dan API Key eksternal (seperti Cek Resi, Cuaca,
        Google Calendar) secara terpusat.
      </p>

      <div className="bg-white border rounded-xl p-6 text-center">
        <p className="text-gray-500 italic">
          Fitur manajemen API akan segera hadir. Anda akan dapat menambahkan
          endpoint dan API Key di sini nantinya.
        </p>
      </div>
    </div>
  );
}

function MorningReportLogsTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Riwayat Laporan Pagi</h2>
      <p className="text-sm text-gray-600">
        Arsip lengkap laporan pagi eksekutif yang pernah dikirim AIDA ke
        pengguna.
      </p>

      <div className="bg-white border rounded-xl p-6 text-center">
        <p className="text-gray-500 italic">
          Belum ada riwayat laporan pagi yang tercatat.
        </p>
      </div>
    </div>
  );
}

function ErrorLogsTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Log Error Sistem</h2>
      <p className="text-sm text-gray-600">
        Lacak pengiriman pesan gagal, error API Gemini, atau error operasional
        lainnya.
      </p>

      <div className="bg-gray-900 border rounded-xl p-6 text-left">
        <div className="text-green-400 font-mono text-sm">
          [INFO] System is running normally. No recent errors.
        </div>
      </div>
    </div>
  );
}

function JournalsTab() {
  const [journals, setJournals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJournals = () => {
    setLoading(true);
    fetch("/api/dashboard-journals")
      .then((r) => r.json())
      .then((data) => {
        setJournals(data || []);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchJournals();
  }, []);

  const deleteJournal = async (id: string) => {
    if (!confirm("Hapus catatan harian ini?")) return;
    await fetch("/api/dashboard-journals?id=" + id, { method: "DELETE" });
    fetchJournals();
  };

  const exportCSV = () => {
    if (journals.length === 0) return alert("Belum ada data.");
    const header = "Pengguna,Tanggal,Catatan\n";
    const csv = journals
      .map(
        (j) =>
          `"${j.sender}","${j.date}","${(j.content || "").replace(/"/g, '""')}"`,
      )
      .join("\n");
    const blob = new Blob([header + csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "catatan-harian.csv";
    a.click();
  };

  const exportTXT = () => {
    if (journals.length === 0) return alert("Belum ada data.");
    const txt = journals
      .map(
        (j) =>
          `Pengguna: ${j.sender}\nTanggal: ${j.date}\nCatatan:\n${j.content}\n--------------------------`,
      )
      .join("\n\n");
    const blob = new Blob([txt], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "catatan-harian.txt";
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Catatan Harian (Diary)
          </h2>
          <p className="text-sm text-gray-600">
            Catatan keseharian pengguna yang ditanyakan AIDA setiap jam 8 malam.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-medium text-sm"
          >
            Download CSV
          </button>
          <button
            onClick={exportTXT}
            className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded font-medium text-sm"
          >
            Download TXT
          </button>
        </div>
      </div>

      {loading ? (
        <p>Memuat catatan harian...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {journals.map((j) => (
            <div
              key={j.id}
              className="bg-blue-50 border border-blue-200 p-4 rounded-xl shadow-sm flex flex-col"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {j.date}
                </span>
                <span className="text-[10px] text-gray-500 bg-white px-2 py-1 rounded-full border border-gray-200">
                  {j.sender}
                </span>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap mt-2 flex-1">
                {j.content}
              </p>
              <div className="mt-4 pt-3 border-t border-blue-200 text-right">
                <button
                  onClick={() => deleteJournal(j.id)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Hapus
                </button>
              </div>
            </div>
          ))}
          {journals.length === 0 && (
            <p className="text-gray-500 italic col-span-full">
              Belum ada catatan harian.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function RandomTopicsTab() {
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkStartDate, setBulkStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });

  const fetchTopics = () => {
    setLoading(true);
    fetch("/api/random-topics")
      .then((r) => r.json())
      .then((data) => {
        const sorted = (data.topics || []).sort((a: any, b: any) =>
          a.id.localeCompare(b.id),
        );
        setTopics(sorted);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTopics();
  }, []);

  const saveTopic = async () => {
    if (!editing.id || !editing.topic)
      return alert("Tanggal dan topik tidak boleh kosong");
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(editing.id))
      return alert("Format tanggal harus YYYY-MM-DD");

    await fetch("/api/random-topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    setEditing(null);
    fetchTopics();
  };

  const deleteTopic = async (id: string) => {
    if (!confirm("Hapus topik ini?")) return;
    await fetch("/api/random-topics", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchTopics();
  };

  const handleBulkProcess = async () => {
    if (!bulkText.trim()) return alert("Teks tidak boleh kosong");
    setBulkLoading(true);
    try {
      const res = await fetch("/api/random-topics-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: bulkText, startDate: bulkStartDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memproses bulk text");
      alert(data.message);
      setBulkMode(false);
      setBulkText("");
      fetchTopics();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setBulkLoading(false);
    }
  };

  if (bulkMode) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setBulkMode(false)}
          className="text-sm text-blue-600 hover:underline mb-4"
        >
          ← Kembali
        </button>
        <h2 className="text-xl font-bold flex items-center gap-2">
          ✨ Input Cerdas dengan AI
        </h2>
        <p className="text-sm text-gray-600">
          Masukkan daftar ide, paragraf, atau teks panjang apa saja. AI akan
          mengekstraknya menjadi daftar topik harian dan secara otomatis
          menjadwalkannya ke tanggal-tanggal yang masih kosong.
        </p>

        <div>
          <label className="block text-sm font-medium mb-1">
            Mulai Jadwal Dari (Opsional)
          </label>
          <input
            type="date"
            value={bulkStartDate}
            onChange={(e) => setBulkStartDate(e.target.value)}
            className="w-full sm:w-64 p-2 border rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Teks Mentah / Kumpulan Ide
          </label>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            className="w-full h-64 p-3 border rounded font-mono text-sm"
            placeholder="1. Tanyakan tentang hobi membacanya.&#10;2. Bahas cuaca hari ini.&#10;3. Bagaimana pendapatnya soal film sci-fi?&#10;..."
          />
        </div>

        <button
          onClick={handleBulkProcess}
          disabled={bulkLoading}
          className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded shadow flex items-center gap-2 font-medium disabled:opacity-50"
        >
          {bulkLoading
            ? "Memproses dengan AI..."
            : "Proses & Jadwalkan Otomatis"}
        </button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setEditing(null)}
          className="text-sm text-blue-600 hover:underline mb-4"
        >
          ← Kembali
        </button>
        <h2 className="text-xl font-bold">Edit Topik Harian</h2>
        <div>
          <label className="block text-sm font-medium mb-1">
            Tanggal (YYYY-MM-DD)
          </label>
          <input
            type="date"
            value={editing.id}
            onChange={(e) => setEditing({ ...editing, id: e.target.value })}
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Topik Pembicaraan
          </label>
          <textarea
            value={editing.topic}
            onChange={(e) => setEditing({ ...editing, topic: e.target.value })}
            className="w-full h-40 p-2 border rounded"
            placeholder="Contoh: Tanyakan pendapatnya tentang AI atau buku yang sedang dibacanya..."
          />
        </div>
        <button
          onClick={saveTopic}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          Simpan
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Topik Pesan Acak Harian
          </h2>
          <p className="text-sm text-gray-600">
            Tetapkan topik yang akan dibahas oleh AIDA setiap hari untuk sapaan
            siang/sore.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setBulkMode(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded font-medium text-sm flex items-center gap-1"
          >
            ✨ Input Cerdas
          </button>
          <button
            onClick={() => setEditing({ id: "", topic: "" })}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium text-sm"
          >
            + Tambah Topik
          </button>
        </div>
      </div>

      {loading ? (
        <p>Memuat topik...</p>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-left bg-white min-w-[500px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3 text-sm font-medium text-gray-600 w-32">
                  Tanggal
                </th>
                <th className="p-3 text-sm font-medium text-gray-600">Topik</th>
                <th className="p-3 text-sm font-medium text-gray-600 w-32">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {topics.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="p-3 flex items-center gap-2">
                    <CalendarDays size={16} className="text-gray-400" />
                    <span className="font-bold text-gray-800">{t.id}</span>
                  </td>
                  <td className="p-3 text-sm text-gray-700 whitespace-pre-wrap">
                    {t.topic}
                  </td>
                  <td className="p-3 hover:underline">
                    <button
                      onClick={() => setEditing(t)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteTopic(t.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
              {topics.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="p-4 text-center text-gray-500 italic text-sm"
                  >
                    Belum ada topik. Jika kosong, AIDA akan menanyakan
                    keseharian biasa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { id: "overview", label: "Ringkasan", icon: <Activity size={18} /> },
    { id: "notes", label: "Buku Catatan", icon: <FileText size={18} /> },
    { id: "journals", label: "Catatan Harian", icon: <Book size={18} /> },
    { id: "reminders", label: "Pengingat", icon: <CalendarDays size={18} /> },
    {
      id: "random_topics",
      label: "Topik Pesan Acak",
      icon: <CalendarDays size={18} />,
    },
    { id: "broadcast", label: "Broadcast Pesan", icon: <Send size={18} /> },
    { id: "integrations", label: "API & Integrasi", icon: <Link size={18} /> },
    { id: "morning_reports", label: "Laporan Pagi", icon: <Sun size={18} /> },
    { id: "contacts", label: "Manajemen Pengguna", icon: <Users size={18} /> },
    {
      id: "knowledge",
      label: "Basis Pengetahuan",
      icon: <BookOpen size={18} />,
    },
    {
      id: "settings",
      label: "Pengaturan Global",
      icon: <Settings size={18} />,
    },
    {
      id: "error_logs",
      label: "Log Error Sistem",
      icon: <AlertTriangle size={18} />,
    },
    { id: "status", label: "Status Webhook", icon: <Activity size={18} /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col hidden sm:flex fixed h-full z-10 overflow-y-auto hide-scrollbar">
        <div className="p-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            AIDA Dashboard
          </h1>
          <p className="text-xs text-gray-500 mt-1">AI WhatsApp Controller</p>
        </div>
        <nav className="flex-1 px-4 pb-6 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === item.id
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 sm:ml-64 p-3 sm:p-8">
        <div className="sm:hidden flex items-center justify-between mb-4 px-2">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            AIDA Dashboard
          </h1>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-gray-600 bg-white border border-gray-200 rounded-lg shadow-sm"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {isMobileMenuOpen && (
          <div className="sm:hidden mb-6 bg-white border border-gray-200 rounded-xl shadow-sm p-2 flex flex-col gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === item.id
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </div>
        )}

        <div className="max-w-4xl mx-auto bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-8 md:p-10 min-h-[80vh]">
          {activeTab === "overview" && <OverviewTab />}
          {activeTab === "notes" && <NotesTab />}
          {activeTab === "journals" && <JournalsTab />}
          {activeTab === "random_topics" && <RandomTopicsTab />}
          {activeTab === "reminders" && <RemindersTab />}
          {activeTab === "broadcast" && <BroadcastTab />}
          {activeTab === "integrations" && <IntegrationsTab />}
          {activeTab === "morning_reports" && <MorningReportLogsTab />}
          {activeTab === "contacts" && <ContactsTab />}
          {activeTab === "knowledge" && <KnowledgeTab />}
          {activeTab === "settings" && <GlobalSettingsTab />}
          {activeTab === "error_logs" && <ErrorLogsTab />}
          {activeTab === "status" && <SetupStatusTab />}
        </div>
      </main>
    </div>
  );
}
