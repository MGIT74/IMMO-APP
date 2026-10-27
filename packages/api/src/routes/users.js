import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

export const usersRouter = Router();
usersRouter.use(requireAuth, requireAdmin);

const publicFields = { id: true, email: true, role: true, active: true, createdAt: true };
usersRouter.get('/', async (_req, res) => {
  res.json(await prisma.user.findMany({ select: publicFields, orderBy: { createdAt: 'desc' } }));
});

usersRouter.post('/', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || password.length > 128) {
    return res.status(400).json({ error: 'Email valide et mot de passe de 12 à 128 caractères requis.' });
  }
  try {
    const user = await prisma.user.create({
      data: { email, passwordHash: await bcrypt.hash(password, 12), role: 'prospecteur', active: true },
      select: publicFields,
    });
    res.status(201).json(user);
  } catch (err) {
    res.status(err.code === 'P2002' ? 409 : 500).json({ error: err.code === 'P2002' ? 'Cet email existe déjà.' : 'Création impossible.' });
  }
});

usersRouter.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0 || id === req.user.id) return res.status(400).json({ error: 'Compte non modifiable.' });
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing || existing.role !== 'prospecteur') return res.status(404).json({ error: 'Prospecteur introuvable.' });
  const data = {};
  if (typeof req.body?.active === 'boolean') data.active = req.body.active;
  if (req.body?.password !== undefined) {
    if (typeof req.body.password !== 'string' || req.body.password.length < 12 || req.body.password.length > 128) return res.status(400).json({ error: 'Mot de passe de 12 à 128 caractères requis.' });
    data.passwordHash = await bcrypt.hash(req.body.password, 12);
  }
  if (!Object.keys(data).length) return res.status(400).json({ error: 'Aucune modification.' });
  res.json(await prisma.user.update({ where: { id }, data, select: publicFields }));
});
