import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';

export const authRouter = Router();

// --- Anti brute-force maison (aucune dépendance) : 10 échecs / 15 min / IP ---
const LIMITE = 10;
const FENETRE_MS = 15 * 60_000;
const essais = new Map(); // ip -> { n, resetAt }
setInterval(() => {
  for (const [ip, e] of essais) if (Date.now() >= e.resetAt) essais.delete(ip);
}, 5 * 60_000).unref?.();

function bloqueSiTropDechecs(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || '?';
  const e = essais.get(ip);
  if (e && Date.now() >= e.resetAt) essais.delete(ip);
  if (essais.get(ip)?.n >= LIMITE) {
    const restant = Math.ceil((essais.get(ip).resetAt - Date.now()) / 60_000);
    return res.status(429).json({ error: `Trop de tentatives — réessayez dans ${restant} min.` });
  }
  req._essaisIp = ip;
  next();
}

function noteEchec(req) {
  const e = essais.get(req._essaisIp) ?? { n: 0, resetAt: Date.now() + FENETRE_MS };
  e.n++;
  essais.set(req._essaisIp, e);
}

authRouter.post('/login', bloqueSiTropDechecs, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    noteEchec(req);
    return res.status(401).json({ error: 'Identifiants incorrects.' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    noteEchec(req);
    return res.status(401).json({ error: 'Identifiants incorrects.' });
  }

  // Connexion OK : on repart à zéro pour cette IP
  essais.delete(req._essaisIp);

  const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });

  res.json({ token, email: user.email });
});
