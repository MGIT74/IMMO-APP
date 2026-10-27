import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';
import { requireAuth, requireAdmin, AVAILABLE_MENUS, userMenus } from '../middleware/auth.js';

export const usersRouter = Router();
usersRouter.use(requireAuth, requireAdmin);
const fields = { id: true, email: true, role: true, menus: true, active: true, createdAt: true };
const ROLES = ['agent_commercial', 'prospecteur', 'employe'];
function parseMenus(menus) {
  if (!Array.isArray(menus) || menus.some(m => !AVAILABLE_MENUS.includes(m))) return null;
  return [...new Set(menus)].join(',');
}
const output = u => ({ ...u, menus: userMenus(u) });
usersRouter.get('/', async (_req, res) => res.json((await prisma.user.findMany({ select: fields, orderBy: { createdAt: 'desc' } })).map(output)));

usersRouter.post('/', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const role = req.body?.role || 'prospecteur';
  const menus = parseMenus(req.body?.menus ?? ['pige', 'agenda']);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || password.length > 128 || !ROLES.includes(role) || menus === null)
    return res.status(400).json({ error: 'Email, mot de passe (12 à 128 caractères), rôle ou permissions invalides.' });
  try {
    const user = await prisma.user.create({ data: { email, passwordHash: await bcrypt.hash(password, 12), role, menus, active: true }, select: fields });
    res.status(201).json(output(user));
  } catch (e) {
    res.status(e.code === 'P2002' ? 409 : 500).json({ error: e.code === 'P2002' ? 'Cet email existe déjà.' : 'Création impossible.' });
  }
});

usersRouter.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0 || id === req.user.id) return res.status(400).json({ error: 'Compte non modifiable.' });
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing || existing.role === 'admin') return res.status(404).json({ error: 'Employé introuvable.' });
  const data = {};
  if (typeof req.body?.active === 'boolean') data.active = req.body.active;
  if (req.body?.role !== undefined) {
    if (!ROLES.includes(req.body.role)) return res.status(400).json({ error: 'Rôle invalide.' });
    data.role = req.body.role;
  }
  if (req.body?.menus !== undefined) {
    const menus = parseMenus(req.body.menus);
    if (menus === null) return res.status(400).json({ error: 'Menus invalides.' });
    data.menus = menus;
  }
  if (req.body?.password !== undefined) {
    if (typeof req.body.password !== 'string' || req.body.password.length < 12 || req.body.password.length > 128)
      return res.status(400).json({ error: 'Mot de passe de 12 à 128 caractères requis.' });
    data.passwordHash = await bcrypt.hash(req.body.password, 12);
  }
  if (!Object.keys(data).length) return res.status(400).json({ error: 'Aucune modification.' });
  res.json(output(await prisma.user.update({ where: { id }, data, select: fields })));
});
