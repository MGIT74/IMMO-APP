import { prisma } from '../db.js';
import { ApifyClient } from 'apify-client';

// Acteur d'enrichissement photo (0,8 $/1000 annonces) : renvoie images + détails
const ENRICHER = 'silentflow/leboncoin-scraper-ppr';

/**
 * Backfill photos manquantes : les annonces sans image sont enrichies via
 * l'acteur d'enrichissement en MODE RÉSUMÉ PAR VILLE.
 * (Le mode `adIds` ne renvoie plus `images` — le seul mode qui sort les URLs
 * img.leboncoin.fr est le mode recherche : searchQueries + categorie 9.)
 *
 * Debounce simple : si un backfill est déjà en route (les 4 recherches lancées
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
    select: { id: true, url: true, ville: true },
    orderBy: { dateParution: 'desc' },
    take: limit,
  });
  if (!rows.length) return { maj: 0, enrichis: 0 };

  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN manquant dans .env');

  const villes = [...new Set(
    rows
      .map((r) => String(r.ville ?? '').replace(/\s*\d{5}.*$/, '').trim())
      .filter(Boolean)
  )].slice(0, 10);
  if (!villes.length) return { maj: 0, enrichis: 0 };

  const client = new ApifyClient({ token });
  const run = await client.actor(ENRICHER).call(
    { searchQueries: villes, category: '9', maxItems: limit, browseMode: false },
    { maxItems: limit },
  );
  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  // Match par URL (identique des deux côtés : www.leboncoin.fr/ad/ventes_immobilieres/<id>)
  const parUrl = new Map(items.filter((i) => i?.url).map((i) => [String(i.url).split('?')[0], i]));
  let maj = 0;
  for (const row of rows) {
    if (row.ville == null || !row.url) continue;
    const imgs = (parUrl.get(String(row.url).split('?')[0]) ?? {}).images;
    if (!Array.isArray(imgs) || !imgs.length) continue;
    const annonce = await prisma.pigeAnnonce.findUnique({
      where: { id: row.id }, select: { photoUrl: true },
    });
    if (annonce && !annonce.photoUrl) {
      await prisma.pigeAnnonce.update({
        where: { id: row.id },
        data: { photoUrl: imgs[0], photosJson: imgs },
      });
      maj++;
    }
  }
  return { maj, enrichis: items.length };
}