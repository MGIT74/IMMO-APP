import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const leadsPublicRouter = Router();
export const leadsAdminRouter = Router();

// --- PUBLIC : un visiteur envoie une demande d'information ---
leadsPublicRouter.post('/', async (req, res) => {
  const { bienId, nom, email, tel, message, website } = req.body;

  // Piège à robots : si ce champ caché est rempli, on ignore silencieusement.
  if (website) return res.status(201).json({ ok: true });

  if (!nom || (!email && !tel)) {
    return res.status(400).json({ error: 'Merci de renseigner votre nom et un email ou un téléphone.' });
  }

  const lead = await prisma.lead.create({
    data: {
      bienId: bienId ? Number(bienId) : null,
      nom,
      email: email || null,
      tel: tel || null,
      message: message || null,
      source: 'site',
    },
  });

  res.status(201).json({ ok: true, id: lead.id });
});

// --- ADMIN : consulter les demandes reçues ---
leadsAdminRouter.use(requireAuth);

leadsAdminRouter.get('/', async (req, res) => {
  const leads = await prisma.lead.findMany({
    include: { bien: { select: { id: true, titre: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(leads);
});

leadsAdminRouter.delete('/:id', async (req, res) => {
  await prisma.lead.delete({ where: { id: Number(req.params.id) } });
  res.status(204).end();
});
