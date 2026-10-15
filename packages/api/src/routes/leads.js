import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const leadsPublicRouter = Router();
export const leadsAdminRouter = Router();

// --- PUBLIC : un visiteur envoie une demande d'information ---
leadsPublicRouter.post('/', async (req, res) => {
  const { bienId, nom, email, tel, message, website, consent } = req.body;

  // Piège à robots : si ce champ caché est rempli, on ignore silencieusement.
  if (website) return res.status(201).json({ ok: true });

  if (!nom || (!email && !tel)) {
    return res.status(400).json({ error: 'Merci de renseigner votre nom et un email ou un téléphone.' });
  }
  // RGPD : consentement requis (case à cocher du formulaire)
  if (!consent) {
    return res.status(400).json({ error: 'Merci de cocher la case de consentement pour envoyer votre demande.' });
  }

  const lead = await prisma.lead.create({
    data: {
      bienId: bienId ? Number(bienId) : null,
      nom,
      email: email || null,
      tel: tel || null,
      message: message || null,
      source: 'site',
      consent: consent === true,
    },
  });

  res.status(201).json({ ok: true, id: lead.id });
});

// --- ADMIN : consulter les demandes reçues (CRM prospect) ---
leadsAdminRouter.use(requireAuth);

const LEAD_STATUTS = ['nouveau', 'a_contacter', 'contacte', 'interesse', 'visite', 'offre', 'archive'];

leadsAdminRouter.get('/', async (req, res) => {
  const leads = await prisma.lead.findMany({
    include: {
      bien: { select: { id: true, titre: true, prix: true, ville: true, type: true, surface: true, pieces: true, categorie: true } },
      evenements: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(leads);
});

// Suivi prospect : statut, budget, mémo, favori
leadsAdminRouter.patch('/:id/crm', async (req, res) => {
  const { statut, budgetMin, budgetMax, noteMemo, estFavori } = req.body ?? {};
  if (statut !== undefined && !LEAD_STATUTS.includes(statut)) {
    return res.status(400).json({ error: `statut doit être : ${LEAD_STATUTS.join(', ')}` });
  }
  const lead = await prisma.lead.update({
    where: { id: Number(req.params.id) },
    data: {
      ...(statut !== undefined ? { statut } : {}),
      ...(budgetMin !== undefined ? { budgetMin: budgetMin === null ? null : Number(budgetMin) } : {}),
      ...(budgetMax !== undefined ? { budgetMax: budgetMax === null ? null : Number(budgetMax) } : {}),
      ...(noteMemo !== undefined ? { noteMemo } : {}),
      ...(estFavori !== undefined ? { estFavori } : {}),
    },
  });
  if (statut !== undefined) {
    await prisma.leadEvenement.create({
      data: { leadId: lead.id, type: 'statut', detail: `Statut → ${statut}` },
    });
  }
  res.json(lead);
});

// Journal : appel / note / suggestion de bien
leadsAdminRouter.post('/:id/evenements', async (req, res) => {
  const { type, detail } = req.body ?? {};
  if (!['appel', 'note', 'suggestion'].includes(type)) {
    return res.status(400).json({ error: 'type doit être : appel, note ou suggestion' });
  }
  const evt = await prisma.leadEvenement.create({
    data: { leadId: Number(req.params.id), type, detail: detail ?? null },
  });
  res.status(201).json(evt);
});

leadsAdminRouter.delete('/:id', async (req, res) => {
  await prisma.lead.delete({ where: { id: Number(req.params.id) } });
  res.status(204).end();
});
