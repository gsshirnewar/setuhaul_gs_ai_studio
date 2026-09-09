import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiApp } from './src/serverApp';
import { db } from './src/db/dataStore';
import { pushSeedDriversToSupabase } from './src/db/supabaseService';

async function startServer() {
  const PORT = 3000;

  // Vite middleware in dev or static files in prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    apiApp.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    apiApp.use(express.static(distPath));
    apiApp.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  apiApp.listen(PORT, '0.0.0.0', () => {
    console.log(`SetuHaul Freight Operations server running on http://0.0.0.0:${PORT}`);
    // Sync seed drivers to Supabase with VERIFIED status
    pushSeedDriversToSupabase(db.getAllDrivers()).then(res => {
      if (res.success) {
        console.log(`[Supabase Init] ${res.message}`);
      } else if (res.missingTable) {
        console.log(`[Supabase Init] drivers table pending SQL creation in Supabase console.`);
      }
    }).catch(err => {
      console.warn('[Supabase Init] Error during initial driver sync:', err);
    });
  });
}

startServer();
