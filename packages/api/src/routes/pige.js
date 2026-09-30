import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { executerRecherche, ingestParSource } from '../pige/ingest.js';

export const pigeAdminRouter = Router();

// Endpoint d'ingest destiné à n8n (make/zapier possible aussi) :
// authentification par secret partagé via l'en-tête X-Ingest-Secret,
// pas de JWT (n8n ne gère pas le login admin).
export const pigeIngestRouter = Router();

pigeIngestRouter.post('/ingest', async (req, res) => {
  const secret = req.headers['x-ingest-secret'];
  if (!process.env.PIGE_INGEST_SECRET || secret !== process.env.PIGE_INGEST_SECRET) {
    return res.status(401).json({ error: 'Secret invalide.' });
  }
  const { source, items } = req.body ?? {};
  if (!['leboncoin', 'seloger'].includes(source) || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Body attendu : { source: "leboncoin"|"seloger", items: [...] }' });
  }
  try {
    const stats = await ingestParSource(source, items);
    res.json({ ok: true, ...stats });
  } catch (err) {
    res.status(500).json({ error: String(err.message ?? err) });
  }
});

// Toutes les routes pige admin sont réservées à l'admin connecté
pigeAdminRouter.use(requireAuth);

/* ---------- Recherches ---------- */

// Liste des recherches + compteur d'annonces
pigeAdminRouter.get('/recherches', async (req, res) => {
  const recherches = await prisma.pigeRecherche.findMany({
    include: { _count: { select: { runs: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const counts = await prisma.pigeAnnonce.groupBy({ by: ['rechercheId'], _count: true });
  const map = Object.fromEntries(counts.map((c) => [c.rechercheId, c._count]));
  res.json(recherches.map((r) => ({ ...r, nbAnnonces: map[r.id] ?? 0 })));
});

// Créer une recherche (source, nom, apifyInput = critères de l'actor)
pigeAdminRouter.post('/recherches', async (req, res) => {
  const { nom, source, apifyInput, active } = req.body;
  if (!nom || !source || !['leboncoin', 'seloger'].includes(source)) {
    return res.status(400).json({ error: 'nom et source (leboncoin|seloger) requis.' });
  }
  const exists = await prisma.pigeRecherche.findUnique({ where: { nom_source: { nom, source } } });
  if (exists) return res.status(409).json({ error: 'Une recherche porte déjà ce nom pour cette source.' });
  const rech = await prisma.pigeRecherche.create({
    data: { nom, source, apifyInput: apifyInput ?? {}, active: active ?? true },
  });
  res.status(201).json(rech);
});

pigeAdminRouter.patch('/recherches/:id', async (req, res) => {
  const { nom, apifyInput, active } = req.body;
  const rech = await prisma.pigeRecherche.update({
    where: { id: Number(req.params.id) },
    data: {
      ...(nom !== undefined ? { nom } : {}),
      ...(apifyInput !== undefined ? { apifyInput } : {}),
      ...(active !== undefined ? { active } : {}),
    },
  });
  res.json(rech);
});

pigeAdminRouter.delete('/recherches/:id', async (req, res) => {
  await prisma.pigeRecherche.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

// Lancer une recherche maintenant (synchrones : attends la fin du run Apify)
pigeAdminRouter.post('/recherches/:id/run', async (req, res) => {
  try {
    const result = await executerRecherche(Number(req.params.id));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err.message ?? err) });
  }
});

/* ---------- Annonces avec filtres ---------- */

pigeAdminRouter.get('/annonces', async (req, res) => {
  const { cp, ville, trans, typeBien, prixMin, prixMax, surfMin, surfMax, dpe, nouveau, rechercheId, q, page = 1, perPage = 30 } = req.query;

  const where = {
    ...(cp ? { cp: { startsWith: String(cp).slice(0, 2) } } : {}),
    ...(ville ? { ville: { contains: String(ville) } } : {}),
    ...(trans ? { trans } : {}),
    ...(typeBien ? { typeBien: { contains: String(typeBien) } } : {}),
    ...(dpe ? { dpe: { in: String(dpe).split(',') } } : {}),
    ...(nouveau === '1' ? { estNouveau: true } : {}),
    ...(rechercheId ? { rechercheId: Number(rechercheId) } : {}),
    ...(prixMin || prixMax ? { prix: { ...(prixMin ? { gte: Number(prixMin) } : {}), ...(prixMax ? { lte: Number(prixMax) } : {}) } } : {}),
    ...(surfMin || surfMax ? { surface: { ...(surfMin ? { gte: Number(surfMin) } : {}), ...(surfMax ? { lte: Number(surfMax) } : {}) } } : {}),
    ...(q ? { OR: [{ titre: { contains: String(q) } }, { texte: { contains: String(q) } }, { ville: { contains: String(q) } }] } : {}),
  };

  const [annonces, total] = await Promise.all([
    prisma.pigeAnnonce.findMany({
      where,
      include: { contact: true },
      orderBy: { dateParution: 'desc' },
      skip: (Number(page) - 1) * Number(perPage),
      take: Number(perPage),
    }),
    prisma.pigeAnnonce.count({ where }),
  ]);
  res.json({ total, page: Number(page), perPage: Number(perPage), annonces });
});

// Détail d'une annonce
pigeAdminRouter.get('/annonces/:id', async (req, res) => {
  const annonce = await prisma.pigeAnnonce.findUnique({
    where: { id: Number(req.params.id) },
    include: { contact: true, prixHistorique: { orderBy: { date: 'desc' } } },
  });
  if (!annonce) return res.status(404).json({ error: 'Annonce introuvable.' });
  res.json(annonce);
});

/* ---------- Runs & stats ---------- */

pigeAdminRouter.get('/runs', async (req, res) => {
  const runs = await prisma.pigeRun.findMany({
    include: { recherche: { select: { nom: true, source: true } } },
    orderBy: { startedAt: 'desc' },
    take: 50,
  });
  res.json(runs);
});

pigeAdminRouter.get('/stats', async (req, res) => {
  const [total, avecTel, nouveaux7j, coutTotal] = await Promise.all([
    prisma.pigeAnnonce.count(),
    prisma.pigeContact.count({ where: { telephone: { not: null } } }),
    prisma.pigeAnnonce.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 864e5) } } }),
    prisma.pigeRun.aggregate({ _sum: { coutUsd: true } }),
  ]);
  res.json({
    totalAnnonces: total,
    avecTelephone: avecTel,
    nouveaux7j,
    coutTotalUsd: coutTotal._sum.coutUsd ?? 0,
  });
});