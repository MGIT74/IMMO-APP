import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { executerRecherche, ingestParSource } from '../pige/ingest.js';

export const pigeAdminRouter = Router();

// Endpoint d'ingest destiné à n8n (make/zapier possible aussi) :
// authentification par secret partagé via l'en-tête X-Ingest-Secret,
// pas de JWT (n8n ne gère pas le login admin).
export const pigeIngestRouter = Router();

const requirePigeIngestSecret = (req, res) => {
  const secret = req.headers['x-ingest-secret'];
  if (!process.env.PIGE_INGEST_SECRET || secret !== process.env.PIGE_INGEST_SECRET) {
    res.status(401).json({ error: 'Secret invalide.' });
    return false;
  }
  return true;
};

pigeIngestRouter.get('/recherches', async (req, res) => {
  if (!requirePigeIngestSecret(req, res)) return;
  const recherches = await prisma.pigeRecherche.findMany({
    where: { active: true, source: 'leboncoin' },
    select: { id: true, nom: true, source: true, apifyInput: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json(recherches);
});

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

// Configuration minimale de collecte : aucune annonce, aucun contact et aucun secret.
pigeAdminRouter.get('/schedule-config', async (req, res) => {
  const recherches = await prisma.pigeRecherche.findMany({
    where: { active: true, source: 'leboncoin' },
    select: { id: true, apifyInput: true },
    orderBy: { createdAt: 'asc' },
  });
  res.setHeader('Cache-Control', 'no-store');
  res.json(recherches);
});

// Toutes les routes pige admin sont réservées à l'admin connecté
pigeAdminRouter.use(requireAuth);

/* ---------- Zone géographique ---------- */
const distanceKm = (aLat, aLon, bLat, bLon) => {
  const R = 6371;
  const rad = (v) => v * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

pigeAdminRouter.get('/zone-communes', async (req, res) => {
  try {
    const nom = String(req.query.nom || '').trim();
    const rayonKm = Math.min(50, Math.max(1, Number(req.query.rayonKm) || 20));
    if (!nom) return res.status(400).json({ error: 'Commune centrale requise.' });

    const centreResp = await fetch('https://geo.api.gouv.fr/communes?nom=' + encodeURIComponent(nom) + '&fields=nom,code,codesPostaux,centre,codeDepartement&format=json&geometry=centre');
    if (!centreResp.ok) throw new Error('Service géographique indisponible.');
    const centres = await centreResp.json();
    const centre = centres[0];
    const coords = centre?.centre?.coordinates;
    if (!centre || !Array.isArray(coords)) return res.status(404).json({ error: 'Commune introuvable.' });

    const deptResp = await fetch('https://geo.api.gouv.fr/departements/' + encodeURIComponent(centre.codeDepartement) + '/communes?fields=nom,code,codesPostaux,centre&format=json&geometry=centre');
    if (!deptResp.ok) throw new Error('Impossible de charger les communes du département.');
    const communes = (await deptResp.json())
      .map((c) => {
        const cc = c?.centre?.coordinates;
        if (!Array.isArray(cc)) return null;
        return {
          code: c.code,
          nom: c.nom,
          codesPostaux: c.codesPostaux || [],
          distanceKm: Math.round(distanceKm(coords[1], coords[0], cc[1], cc[0]) * 10) / 10,
        };
      })
      .filter(Boolean)
      .filter((c) => c.distanceKm <= rayonKm)
      .sort((a, b) => a.distanceKm - b.distanceKm || a.nom.localeCompare(b.nom, 'fr'));

    res.json({
      centre: { code: centre.code, nom: centre.nom, codesPostaux: centre.codesPostaux || [], lat: coords[1], lon: coords[0] },
      rayonKm,
      communes,
    });
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
});

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
  const { cp, ville, trans, typeBien, prixMin, prixMax, surfMin, surfMax, dpe, nouveau, rechercheId, q, statut, favori, repub, page = 1, perPage = 30 } = req.query;

  const where = {
    ...(cp ? { cp: { startsWith: String(cp).slice(0, 2) } } : {}),
    ...(ville ? { ville: { contains: String(ville) } } : {}),
    ...(trans ? { trans } : {}),
    ...(typeBien ? { typeBien: { contains: String(typeBien) } } : {}),
    ...(dpe ? { dpe: { in: String(dpe).split(',') } } : {}),
    ...(nouveau === '1' ? { estNouveau: true } : {}),
    ...(rechercheId ? { rechercheId: Number(rechercheId) } : {}),
    ...(statut ? { statut: String(statut) } : {}),
    ...(favori === '1' ? { estFavori: true } : {}),
    ...(repub === '1' ? { nbRepubs: { gte: 1 } } : {}),
    ...(prixMin || prixMax ? { prix: { ...(prixMin ? { gte: Number(prixMin) } : {}), ...(prixMax ? { lte: Number(prixMax) } : {}) } } : {}),
    ...(surfMin || surfMax ? { surface: { ...(surfMin ? { gte: Number(surfMin) } : {}), ...(surfMax ? { lte: Number(surfMax) } : {}) } } : {}),
    ...(q ? { OR: [{ titre: { contains: String(q) } }, { texte: { contains: String(q) } }, { ville: { contains: String(q) } }] } : {}),
  };

  const [annonces, total] = await Promise.all([
    prisma.pigeAnnonce.findMany({
      where,
      include: {
        contact: true,
        prixHistorique: { orderBy: { date: 'asc' } },
      },
      orderBy: { dateParution: 'desc' },
      skip: (Number(page) - 1) * Number(perPage),
      take: Number(perPage),
    }),
    prisma.pigeAnnonce.count({ where }),
  ]);
  res.json({ total, page: Number(page), perPage: Number(perPage), annonces });
});

// Détail d'une annonce (historique prix + événements + contact)
pigeAdminRouter.get('/annonces/:id', async (req, res) => {
  const annonce = await prisma.pigeAnnonce.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      contact: true,
      prixHistorique: { orderBy: { date: 'asc' } },
      evenements: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  });
  if (!annonce) return res.status(404).json({ error: 'Annonce introuvable.' });
  res.json(annonce);
});

// Annonces republicées (même bien reposté plusieurs fois = vendeur motivé ou agence déguisée)
pigeAdminRouter.get('/republications', async (req, res) => {
  const min = Number(req.query.min || 1);
  const repubs = await prisma.pigeAnnonce.findMany({
    where: { nbRepubs: { gte: min } },
    include: { contact: true },
    orderBy: { nbRepubs: 'desc' },
    take: 50,
  });
  res.json(repubs);
});

// Baisses de prix récentes (opportunités)
pigeAdminRouter.get('/baisses-prix', async (req, res) => {
  const jours = Number(req.query.jours || 14);
  const evts = await prisma.pigeEvenement.findMany({
    where: { type: 'baisse_prix', createdAt: { gte: new Date(Date.now() - jours * 864e5) } },
    include: { annonce: { include: { contact: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(evts);
});

// Export CSV des annonces filtrées (mêmes filtres que /annonces)
pigeAdminRouter.get('/annonces-export', async (req, res) => {
  const { cp, ville, trans, typeBien, prixMin, prixMax, surfMin, surfMax, dpe, nouveau, rechercheId, q, statut, favori, repub } = req.query;
  const where = {
    ...(cp ? { cp: { startsWith: String(cp).slice(0, 2) } } : {}),
    ...(ville ? { ville: { contains: String(ville) } } : {}),
    ...(trans ? { trans } : {}),
    ...(typeBien ? { typeBien: { contains: String(typeBien) } } : {}),
    ...(dpe ? { dpe: { in: String(dpe).split(',') } } : {}),
    ...(nouveau === '1' ? { estNouveau: true } : {}),
    ...(rechercheId ? { rechercheId: Number(rechercheId) } : {}),
    ...(statut ? { statut: String(statut) } : {}),
    ...(favori === '1' ? { estFavori: true } : {}),
    ...(repub === '1' ? { nbRepubs: { gte: 1 } } : {}),
    ...(prixMin || prixMax ? { prix: { ...(prixMin ? { gte: Number(prixMin) } : {}), ...(prixMax ? { lte: Number(prixMax) } : {}) } } : {}),
    ...(surfMin || surfMax ? { surface: { ...(surfMin ? { gte: Number(surfMin) } : {}), ...(surfMax ? { lte: Number(surfMax) } : {}) } } : {}),
    ...(q ? { OR: [{ titre: { contains: String(q) } }, { texte: { contains: String(q) } }, { ville: { contains: String(q) } }] } : {}),
  };
  const rows = await prisma.pigeAnnonce.findMany({
    where, include: { contact: true }, orderBy: { dateParution: 'desc' }, take: 5000,
  });
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [
    ['id', 'source', 'titre', 'ville', 'cp', 'type', 'transaction', 'prix', 'surface', 'pieces', 'chambres', 'dpe', 'statut', 'republications', 'vendeur', 'telephone', 'parution', 'url']
      .join(';'),
    ...rows.map((a) => [
      a.id, a.source, a.titre, a.ville, a.cp, a.typeBien, a.trans, a.prix, a.surface, a.pieces, a.chambres,
      a.dpe, a.statut, a.nbRepubs, a.contact?.nom, a.contact?.telephone,
      a.dateParution ? new Date(a.dateParution).toISOString().slice(0, 10) : '', a.url,
    ].map(esc).join(';')),
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="pige-annonces.csv"');
  res.send('\uFEFF' + csv);
});

/* ---------- Suivi CRM ---------- */

const STATUTS = ['nouveau', 'a_contacter', 'contacte', 'interesse', 'negocie', 'archive'];

pigeAdminRouter.patch('/annonces/:id/statut', async (req, res) => {
  const { statut, noteMemo, estFavori, rappelAt } = req.body ?? {};
  if (statut !== undefined && !STATUTS.includes(statut)) {
    return res.status(400).json({ error: `statut doit être : ${STATUTS.join(', ')}` });
  }
  const annonce = await prisma.pigeAnnonce.update({
    where: { id: Number(req.params.id) },
    data: {
      ...(statut !== undefined ? { statut } : {}),
      ...(noteMemo !== undefined ? { noteMemo } : {}),
      ...(estFavori !== undefined ? { estFavori } : {}),
      ...(rappelAt !== undefined ? { rappelAt: rappelAt ? new Date(rappelAt) : null } : {}),
    },
  });
  if (statut !== undefined) {
    await prisma.pigeEvenement.create({
      data: { annonceId: annonce.id, type: 'statut', detail: `Statut → ${statut}` },
    });
  }
  res.json(annonce);
});

// Ajouter une note / appel au journal
pigeAdminRouter.post('/annonces/:id/evenements', async (req, res) => {
  const { type, detail } = req.body ?? {};
  if (!['appel', 'note', 'tel_obtenu'].includes(type)) {
    return res.status(400).json({ error: 'type doit être : appel, note ou tel_obtenu' });
  }
  const evt = await prisma.pigeEvenement.create({
    data: { annonceId: Number(req.params.id), type, detail: detail ?? null },
  });
  res.status(201).json(evt);
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
  const [total, avecTel, nouveaux7j, coutTotal, parStatut, nbRepubs, baisses7j] = await Promise.all([
    prisma.pigeAnnonce.count(),
    prisma.pigeContact.count({ where: { telephone: { not: null } } }),
    prisma.pigeAnnonce.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 864e5) } } }),
    prisma.pigeRun.aggregate({ _sum: { coutUsd: true } }),
    prisma.pigeAnnonce.groupBy({ by: ['statut'], _count: true }),
    prisma.pigeAnnonce.count({ where: { nbRepubs: { gte: 1 } } }),
    prisma.pigeEvenement.count({ where: { type: 'baisse_prix', createdAt: { gte: new Date(Date.now() - 7 * 864e5) } } }),
  ]);
  const statutMap = Object.fromEntries(parStatut.map((s) => [s.statut, s._count]));
  res.json({
    totalAnnonces: total,
    avecTelephone: avecTel,
    nouveaux7j,
    coutTotalUsd: coutTotal._sum.coutUsd ?? 0,
    parStatut: statutMap,
    republicees: nbRepubs,
    baisses7j,
  });
});