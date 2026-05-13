export default function App() {
  const webhookUrl = `${import.meta.env.VITE_APP_URL || window.location.origin}/api/webhook`;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-2xl w-full">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
          🤖 WhatsApp AI Assistant
        </h1>
        
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
            <h2 className="text-xl font-semibold text-gray-800 mb-2">2. Environment Variables</h2>
            <p className="mb-2">Make sure you have set the following secrets in the AI Studio settings (or Vercel environment variables):</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><code className="bg-gray-100 px-1 py-0.5 rounded text-sm text-pink-600">FONNTE_TOKEN</code> - Your token from Fonnte.</li>
              <li><code className="bg-gray-100 px-1 py-0.5 rounded text-sm text-pink-600">GEMINI_API_KEY</code> - Your Google Gemini API Key.</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">3. Chat System</h2>
            <p>
              Send a text message to your Fonnte-connected WhatsApp number. The message will be processed by this webhook, generating an AI response via Gemini, and automatically sending the response back via WhatsApp! 
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Chat history is stored in your Firebase Firestore database automatically.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
