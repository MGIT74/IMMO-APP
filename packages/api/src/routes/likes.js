import { Router } from 'express';
import { prisma } from '../db.js';

export const likesRouter = Router();

// Le visiteur envoie un identifiant anonyme généré côté navigateur (stocké en
// localStorage) pour empêcher un même visiteur de liker plusieurs fois.
likesRouter.post('/:bienId', async (req, res) => {
  const bienId = Number(req.params.bienId);
  const { visitorId } = req.body;

  if (!visitorId) {
    return res.status(400).json({ error: 'visitorId requis.' });
  }

  const existing = await prisma.like.findUnique({
    where: { bienId_visitorId: { bienId, visitorId } },
  });

  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
  } else {
    await prisma.like.create({ data: { bienId, visitorId } });
  }

  const count = await prisma.like.count({ where: { bienId } });
  res.json({ liked: !existing, count });
});
