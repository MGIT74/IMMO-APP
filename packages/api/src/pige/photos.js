import { prisma } from '../db.js';
import { ApifyClient } from 'apify-client';
import { idDepuisUrl } from './apify.js';

// Acteur d'enrichissement photo (0,8 $/1000 annonces)
// IMPORTANT : `adIds` en IDs NUMÉRIQUES + `browseMode: true` est la seule
// combinaison qui renvoie `images` (avec des URLs d'annonce, images=null).
const ENRICHER = 'silentflow/leboncoin-scraper-ppr';

/**
 * Backfill photos manquantes : prend les annonces sans image (les plus
 * récentes d'abord) et les enrichit via l'acteur (mode browse par ad IDs).
 *
 * Debounce simple : si un backfill est déjà en route (les recherches lancées
 * d'affilée par le cron n8n déclenchent chacune le sien), on renvoie le même
 * résultat plutôt que de multiplier les runs Apify.
 */
let enCours = null;

export function backfillPhotosManquantes(limit = 100) {
  if (enCours) return enCours;
  enCours = _backfill(limit).finally(() => { enCours = null; });
  return enCours;
}

async function _backfill(limit = 100) {
  const rows = await prisma.pigeAnnonce.findMany({
    where: { photoUrl: null, enleve: false },
    select: { id: true, url: true },
    orderBy: { dateParution: 'desc' },
    take: limit,
  });

  // adIds ne parse plus les URLs complètes : on extrait l'ID numérique de l'URL
  const parId = new Map();
  const ids = [];
  for (const r of rows) {
    const id = idDepuisUrl(r.url);
    if (id) { ids.push(id); parId.set(id, r); }
  }
  if (!ids.length) return { maj: 0, enrichis: 0 };

  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN manquant dans .env');

  const client = new ApifyClient({ token });
  const run = await client.actor(ENRICHER).call(
    { adIds: ids, browseMode: true },
    { maxItems: ids.length },
  );
  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  // Match par ID numérique (l'item du dataset a `id` + `url`)
  let maj = 0;
  for (const raw of items) {
    const id = String(raw?.id ?? '') || idDepuisUrl(raw?.url);
    if (!id || !parId.has(id)) continue;
    const imgs = raw?.images;
    if (!Array.isArray(imgs) || !imgs.length) continue;
    const annonce = await prisma.pigeAnnonce.findUnique({
      where: { id: parId.get(id).id },
      select: { photoUrl: true },
    });
    if (annonce && !annonce.photoUrl) {
      await prisma.pigeAnnonce.update({
        where: { id: parId.get(id).id },
        data: { photoUrl: imgs[0], photosJson: imgs },
      });
      maj++;
    }
  }
  return { maj, enrichis: items.length };
}