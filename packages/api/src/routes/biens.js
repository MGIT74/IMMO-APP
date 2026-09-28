import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { getTauxForBien, calcHonoraires } from '../utils/commission.js';

export const biensPublicRouter = Router();
export const biensAdminRouter = Router();

const includeRelations = {
  photos: { orderBy: { ordre: 'asc' } },
  equipements: { orderBy: { ordre: 'asc' } },
  _count: { select: { likes: true } },
};

// --- PUBLIC : liste des biens publiés (pour le site vitrine Astro) ---
biensPublicRouter.get('/', async (req, res) => {
  const biens = await prisma.bien.findMany({
    where: { publie: true },
    include: includeRelations,
    orderBy: { createdAt: 'desc' },
  });
  res.json(biens.map(formatPublicBien));
});

biensPublicRouter.get('/:id', async (req, res) => {
  const bien = await prisma.bien.findFirst({
    where: { id: Number(req.params.id), publie: true },
    include: includeRelations,
  });
  if (!bien) return res.status(404).json({ error: 'Bien introuvable.' });
  res.json(formatPublicBien(bien));
});

function formatPublicBien(bien) {
  // On ne renvoie jamais le taux d'honoraires ni les infos internes au public.
  const { tauxPerso, ...rest } = bien;
  return { ...rest, likes: bien._count.likes };
}

// --- ADMIN : CRUD complet + infos de gestion (honoraires, statut) ---
biensAdminRouter.use(requireAuth);

biensAdminRouter.get('/', async (req, res) => {
  const biens = await prisma.bien.findMany({
    include: includeRelations,
    orderBy: { createdAt: 'desc' },
  });

  const withHonoraires = await Promise.all(
    biens.map(async (bien) => {
      const taux = await getTauxForBien(bien);
      return {
        ...bien,
        likes: bien._count.likes,
        taux,
        honoraires: calcHonoraires(bien.prix, taux),
      };
    })
  );

  res.json(withHonoraires);
});

biensAdminRouter.post('/', async (req, res) => {
  const data = pickBienFields(req.body);
  const bien = await prisma.bien.create({ data });
  res.status(201).json(bien);
});

biensAdminRouter.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = pickBienFields(req.body);
  const bien = await prisma.bien.update({ where: { id }, data });
  res.json(bien);
});

biensAdminRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  await prisma.bien.delete({ where: { id } });
  res.status(204).end();
});

// Bascule "vendu" en un clic (Vue CRM).
biensAdminRouter.patch('/:id/vendu', async (req, res) => {
  const id = Number(req.params.id);
  const current = await prisma.bien.findUnique({ where: { id } });
  if (!current) return res.status(404).json({ error: 'Bien introuvable.' });

  const bien = await prisma.bien.update({
    where: { id },
    data: { vendu: !current.vendu },
  });
  res.json({ vendu: bien.vendu });
});

// Bascule "publié / masqué" en un clic (Vue CRM).
biensAdminRouter.patch('/:id/publie', async (req, res) => {
  const id = Number(req.params.id);
  const current = await prisma.bien.findUnique({ where: { id } });
  if (!current) return res.status(404).json({ error: 'Bien introuvable.' });

  const bien = await prisma.bien.update({
    where: { id },
    data: { publie: !current.publie },
  });
  res.json({ publie: bien.publie });
});

function pickBienFields(body) {
  const allowed = [
    'titre', 'type', 'prix', 'ville', 'codePostal', 'surface', 'pieces', 'chambres',
    'etatTexte', 'etatCouleur', 'etatAnim', 'livraison', 'vendu', 'publie',
    'tauxPerso', 'boutonTexte', 'boutonUrl',
  ];
  const data = {};
  for (const key of allowed) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  return data;
}
