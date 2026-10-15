import { prisma } from '../db.js';
import { ApifyClient } from 'apify-client';

// Acteur d'enrichissement photo (0,8 $/1000 annonces) : renvoie images + détails
const ENRICHER = 'silentflow/leboncoin-scraper-ppr';

/**
 * Compte à rebours photos manquantes : récupère les annonces sans image
 * et les enrichit via l'acteur d'enrichissement (par URLs d'annonces).
 */
export async function backfillPhotosManquantes(limit = 100) {
  const rows = await prisma.pigeAnnonce.findMany({
    where: { photoUrl: null, enleve: false },
    select: { id: true, url: true },
    orderBy: { dateParution: 'desc' },
    take: limit,
  });
  const urls = rows.map((r) => r.url).filter(Boolean);
  if (!urls.length) return { maj: 0, enrichis: 0 };

  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN manquant dans .env');

  const client = new ApifyClient({ token });
  const run = await client.actor(ENRICHER).call({ adIds: urls, browseMode: true }, { maxItems: urls.length });
  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  let maj = 0;
  for (const raw of items) {
    const imgs = raw?.images;
    if (!raw?.url || !Array.isArray(imgs) || !imgs.length) continue;
    const annonce = await prisma.pigeAnnonce.findUnique({
      where: { source_url: { source: 'leboncoin', url: String(raw.url) } },
    });
    if (annonce && !annonce.photoUrl) {
      await prisma.pigeAnnonce.update({
        where: { id: annonce.id },
        data: { photoUrl: imgs[0], photosJson: imgs },
      });
      maj++;
    }
  }
  return { maj, enrichis: items.length };
}