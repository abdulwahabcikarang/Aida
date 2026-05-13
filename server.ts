import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import webhookHandler from "./api/webhook";
import statusHandler from "./api/status";
import settingsHandler from "./api/settings";
import contactsHandler from "./api/contacts";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Load API Handlers
  app.all("/api/settings", settingsHandler);
  app.all("/api/contacts", contactsHandler);
  app.all("/api/status", statusHandler);

  // Webhook for Fonnte (WhatsApp) - works on both /api/webhook and /webhook
  app.all("/api/webhook", webhookHandler);
  app.all("/webhook", webhookHandler);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
