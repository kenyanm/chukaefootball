import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // ==========================================
  // 1. HEALTH CHECK
  // ==========================================
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', server: 'Chuka eFootball Operations Backend' });
  });

  // Note: Google Sheets integration connects directly from the static frontend
  // (e.g. GitHub Pages) to Google Apps Script Web App (/exec) without an intermediate proxy.

  // ==========================================
  // 2. VITE MIDDLEWARE (DEV) & STATIC (PROD)
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Chuka eFootball server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
