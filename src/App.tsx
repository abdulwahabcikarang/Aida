import { useState, useEffect } from 'react';
import { Settings, Users, BookOpen, Activity, Save } from 'lucide-react';

function SetupStatusTab() {
  const webhookUrl = `${import.meta.env.VITE_APP_URL || window.location.origin}/api/webhook`;
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const checkStatus = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setStatus(data);
    } catch (e: any) {
      setStatus({ status: 'ERROR', error_detail: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-gray-700">
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">1. Fonnte Configuration</h2>
        <p className="mb-2">Copy the following Webhook URL and paste it into your <a href="https://md.fonnte.com/api/api.php" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Fonnte API settings</a>:</p>
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
        <h2 className="text-xl font-semibold text-gray-800 mb-2">2. System Status Check</h2>
        <p className="mb-4">Click the button below to test the connection between the deployment environment and Firebase/Firestore.</p>
        <button 
          onClick={checkStatus} 
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Checking...' : 'Check System Status'}
        </button>

        {status && (
          <div className={`mt-4 p-4 rounded ${status.status === 'OK' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <h3 className={`font-bold ${status.status === 'OK' ? 'text-green-800' : 'text-red-800'}`}>
              {status.status === 'OK' ? '✅ System is Healthy' : '❌ System Error'}
            </h3>
            <p className="text-sm mt-1 mb-2 font-mono">Firebase: {status.firebase || status.status}</p>
            {status.info && <p className="text-sm">{status.info}</p>}
            {status.error_detail && (
              <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-auto text-red-900 border border-red-200">
                {status.error_detail}
              </pre>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function GlobalSettingsTab() {
  const [settings, setSettings] = useState({ systemPrompt: "", creativity: 0.7, maxMemory: 10 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      setSettings(prev => ({ ...prev, ...data }));
    });
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    await fetch('/api/settings', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });
    setSaving(false);
    alert("Pengaturan Berhasil Disimpan!");
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Global AI Settings</h2>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt / Peran AI</label>
        <textarea 
          value={settings.systemPrompt}
          onChange={e => setSettings({...settings, systemPrompt: e.target.value})}
          className="w-full h-32 p-3 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
          placeholder="Kamu adalah asisten AI..."
        />
        <p className="text-xs text-gray-500 mt-1">Instruksi utama untuk perilaku AI.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Kreativitas (Temperature): {settings.creativity}
        </label>
        <input 
          type="range" min="0" max="2" step="0.1" 
          value={settings.creativity}
          onChange={e => setSettings({...settings, creativity: parseFloat(e.target.value)})}
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
          type="number" min="1" max="50"
          value={settings.maxMemory}
          onChange={e => setSettings({...settings, maxMemory: parseInt(e.target.value)})}
          className="w-full p-2 border rounded-lg"
        />
      </div>

      <button onClick={saveSettings} disabled={saving} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded shadow hover:bg-blue-700 disabled:opacity-50">
        <Save size={18} /> {saving ? "Menyimpan..." : "Simpan Pengaturan"}
      </button>
    </div>
  );
}

function KnowledgeTab() {
  const [knowledge, setKnowledge] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      setKnowledge(data.knowledgeBase || "");
    });
  }, []);

  const saveKnowledge = async () => {
    setSaving(true);
    await fetch('/api/settings', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ knowledgeBase: knowledge })
    });
    setSaving(false);
    alert("Pengetahuan Berhasil Disimpan!");
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Basis Pengetahuan (Knowledge Base)</h2>
      <p className="text-sm text-gray-600">Tempelkan informasi, panduan, atau FAQ perusahaan di sini. AI akan menggunakan informasi ini sebagai referensi saat membalas pesan.</p>
      
      <textarea 
        value={knowledge}
        onChange={e => setKnowledge(e.target.value)}
        className="w-full h-80 p-3 border rounded-lg focus:ring-blue-500 focus:border-blue-500 font-mono text-sm leading-relaxed"
        placeholder="Informasi produk, harga, jam operasional..."
      />

      <button onClick={saveKnowledge} disabled={saving} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded shadow hover:bg-blue-700 disabled:opacity-50">
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

  const fetchContacts = () => {
    setLoading(true);
    fetch('/api/contacts').then(r => r.json()).then(data => {
      setContacts(data.contacts || []);
      setLoading(false);
    });
  };

  useEffect(() => { fetchContacts(); }, []);

  const saveContact = async () => {
    setSaving(true);
    await fetch('/api/contacts', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing)
    });
    setSaving(false);
    setEditing(null);
    fetchContacts();
  };

  if (editing) {
    return (
      <div className="space-y-6">
        <button onClick={() => setEditing(null)} className="text-sm text-blue-600 hover:underline mb-4">← Kembali ke daftar</button>
        <h2 className="text-2xl font-bold text-gray-800">Edit Kontak: {editing.sender}</h2>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nama Panggilan</label>
          <input 
            type="text" value={editing.name}
            onChange={e => setEditing({...editing, name: e.target.value})}
            className="w-full p-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Instruksi Spesifik untuk Nomor ini</label>
          <textarea 
            value={editing.instruction}
            onChange={e => setEditing({...editing, instruction: e.target.value})}
            className="w-full h-24 p-3 border rounded-lg"
            placeholder="Contoh: Ini adalah bos saya, jawab dengan sangat sopan..."
          />
        </div>

        <div className="flex items-center gap-2">
          <input 
            type="checkbox" id="humanOverride"
            checked={editing.humanTakeover}
            onChange={e => setEditing({...editing, humanTakeover: e.target.checked})}
            className="w-5 h-5 text-blue-600 rounded"
          />
          <label htmlFor="humanOverride" className="text-sm font-medium text-red-600">
            Human Takeover (Matikan AI untuk nomor ini)
          </label>
        </div>

        <button onClick={saveContact} disabled={saving} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded shadow hover:bg-blue-700 disabled:opacity-50">
          <Save size={18} /> {saving ? "Menyimpan..." : "Simpan Kontak"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Manajemen Kontak & Personal AI</h2>
      <p className="text-sm text-gray-600">Daftar kontak yang pernah berinteraksi dengan AI. Anda dapat mematikan AI (Human Takeover) atau memberikan catatan spesifik pada kontak tertentu.</p>
      
      {loading ? <p>Memuat data kontak...</p> : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left bg-white min-w-[500px]">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-3 text-sm font-medium text-gray-600">Pengirim (Nomor)</th>
                  <th className="p-3 text-sm font-medium text-gray-600">Pesan</th>
                  <th className="p-3 text-sm font-medium text-gray-600">Takeover?</th>
                  <th className="p-3 text-sm font-medium text-gray-600">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {contacts.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="p-3">
                      <div className="font-medium text-gray-900">{c.name}</div>
                      {c.name !== c.sender && <div className="text-xs text-gray-500">{c.sender}</div>}
                    </td>
                    <td className="p-3 text-sm text-gray-600">{c.messageCount} history</td>
                    <td className="p-3">
                      {c.humanTakeover ? (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">Nonaktif</span>
                      ) : (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Aktif AI</span>
                      )}
                    </td>
                    <td className="p-3">
                      <button onClick={() => setEditing(c)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {contacts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-gray-500 text-sm">Belum ada chat masuk.</td>
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

export default function App() {
  const [activeTab, setActiveTab] = useState('settings');

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col hidden sm:flex fixed h-full z-10">
        <div className="p-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            AIDA Dashboard
          </h1>
          <p className="text-xs text-gray-500 mt-1">AI WhatsApp Controller</p>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'settings' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Settings size={18} /> Global Settings
          </button>
          <button 
            onClick={() => setActiveTab('knowledge')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'knowledge' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <BookOpen size={18} /> Knowledge Base
          </button>
          <button 
            onClick={() => setActiveTab('contacts')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'contacts' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Users size={18} /> Contacts & Takeover
          </button>
          <button 
            onClick={() => setActiveTab('status')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'status' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Activity size={18} /> System Status
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 sm:ml-64 p-3 sm:p-8">
        <div className="sm:hidden flex items-center justify-between mb-4 px-2">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            AIDA Dashboard
          </h1>
        </div>
        
        <div className="max-w-4xl mx-auto bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-8 md:p-10 min-h-[80vh]">
          {/* Mobile menu fallback for demo/simplicity */}
          <div className="sm:hidden flex gap-2 overflow-x-auto mb-6 pb-2 border-b">
             <button onClick={() => setActiveTab('settings')} className={`px-4 py-2 whitespace-nowrap rounded-lg text-sm ${activeTab === 'settings' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}`}>Settings</button>
             <button onClick={() => setActiveTab('knowledge')} className={`px-4 py-2 whitespace-nowrap rounded-lg text-sm ${activeTab === 'knowledge' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}`}>Knowledge</button>
             <button onClick={() => setActiveTab('contacts')} className={`px-4 py-2 whitespace-nowrap rounded-lg text-sm ${activeTab === 'contacts' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}`}>Contacts</button>
             <button onClick={() => setActiveTab('status')} className={`px-4 py-2 whitespace-nowrap rounded-lg text-sm ${activeTab === 'status' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}`}>Status</button>
          </div>
          
          {activeTab === 'settings' && <GlobalSettingsTab />}
          {activeTab === 'knowledge' && <KnowledgeTab />}
          {activeTab === 'contacts' && <ContactsTab />}
          {activeTab === 'status' && <SetupStatusTab />}
        </div>
      </main>
    </div>
  );
}
