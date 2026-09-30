import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';

import { authRouter } from './routes/auth.js';
import { biensPublicRouter, biensAdminRouter } from './routes/biens.js';
import { leadsPublicRouter, leadsAdminRouter } from './routes/leads.js';
import { likesRouter } from './routes/likes.js';
import { settingsRouter } from './routes/settings.js';
import { uploadsRouter } from './routes/uploads.js';
import { pigeAdminRouter, pigeIngestRouter } from './routes/pige.js';
import { demarrerCronPige } from './pige/cron.js';

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// Sert les photos uploadées directement (en prod, mettez plutôt Nginx devant ce dossier).
app.use('/uploads', express.static(path.resolve('uploads')));

// --- Routes publiques (site vitrine Astro) ---
app.use('/api/biens', biensPublicRouter);
app.use('/api/leads', leadsPublicRouter);
app.use('/api/likes', likesRouter);

// --- Authentification ---
app.use('/api/auth', authRouter);

// --- Routes admin (protégées par JWT, utilisées par l'app React) ---
app.use('/api/admin/biens', biensAdminRouter);
app.use('/api/admin/leads', leadsAdminRouter);
app.use('/api/admin/settings', settingsRouter);
app.use('/api/admin/uploads', uploadsRouter);
app.use('/api/admin/pige', pigeAdminRouter);
app.use('/api/pige', pigeIngestRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

demarrerCronPige();

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`API Immo Listings démarrée sur http://localhost:${port}`);
});
