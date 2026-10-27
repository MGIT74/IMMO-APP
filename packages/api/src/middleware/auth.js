import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';

// Chaque requête recharge le rôle et l'état du compte : désactivation immédiate.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Non authentifié.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: Number(payload.userId) },
      select: { id: true, email: true, role: true, active: true },
    });
    if (!user || !user.active) return res.status(401).json({ error: 'Compte désactivé ou inexistant.' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Session invalide ou expirée.' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Accès réservé à l’administrateur.' });
  next();
}
