import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get('/', async (req, res) => {
  const setting = await prisma.setting.findUnique({ where: { key: 'taux_honoraires' } });
  res.json({ tauxHonoraires: setting ? parseFloat(setting.value) : 5 });
});

settingsRouter.put('/', async (req, res) => {
  const { tauxHonoraires } = req.body;
  const value = Math.max(0, Math.min(100, Number(tauxHonoraires) || 0));

  await prisma.setting.upsert({
    where: { key: 'taux_honoraires' },
    update: { value: String(value) },
    create: { key: 'taux_honoraires', value: String(value) },
  });

  res.json({ tauxHonoraires: value });
});
