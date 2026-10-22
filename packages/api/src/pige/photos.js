import { prisma } from '../db.js';
import { ApifyClient } from 'apify-client';
import { idDepuisUrl } from './apify.js';
import fs from 'node:fs';
import path from 'node:path';

// Acteur d'enrichissement photo (0,8 $/1000 annonces)
// IMPORTANT : `adIds` en IDs NUMÉRIQUES + `browseMode: true` est la seule
// combinaison qui renvoie `images` (avec des URLs d'annonce, images=null).
const ENRICHER = 'silentflow/leboncoin-scraper-ppr';

// Les photos sont TÉLÉCHARGÉES sur le serveur (uploads/pige) : img.leboncoin.fr
// peut expirer/retirer ses URLs — une image locale est permanente.
const UPLOADS_DIR = path.join(process.env.UPLOADS_DIR || path.resolve('uploads'), 'pige');
const PUBLIC_BASE = (process.env.UPLOADS_PUBLIC_URL || 'https://api.ambassadeur-immo.com').replace(/\/$/, '');
const PHOTO_GALERIE_MAX = 15;

/**
 * Backfill photos manquantes : annonces sans image (les plus récentes d'abord),
 * enrichies via l'acteur, puis images téléchargées en local.
 * Photos permanentes + la fiche Bien convertie reste affichable même si
 * Leboncoin retire ses CDN.
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
    select: { id: true, sourceId: true, url: true },
    orderBy: { dateParution: 'desc' },
    take: limit,
  });

  // adIds ne parse plus les URLs complètes : on extrait l'ID numérique de l'URL
  const parId = new Map();
  const ids = [];
  for (const r of rows) {
    const id = r.sourceId && /^\d{6,}$/.test(String(r.sourceId)) ? String(r.sourceId) : idDepuisUrl(r.url);
    if (id) { ids.push(id); parId.set(id, r); }
  }
  if (!ids.length) return { maj: 0, enrichis: 0, telecharges: 0 };

  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN manquant dans .env');

  const client = new ApifyClient({ token });
  const run = await client.actor(ENRICHER).call(
    { adIds: ids, browseMode: true },
    { maxItems: ids.length },
  );
  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  // Match par ID numérique (l'item du dataset a `id` + `url`) → téléchargement
  let maj = 0;
  let telecharges = 0;
  for (const raw of items) {
    const id = String(raw?.id ?? '') || idDepuisUrl(raw?.url);
    if (!id || !parId.has(id)) continue;
    const imgs = raw?.images;
    if (!Array.isArray(imgs) || !imgs.length) continue;

    const row = parId.get(id);
    const locales = [];
    for (const [i, urlImg] of imgs.slice(0, PHOTO_GALERIE_MAX).entries()) {
      const fiche = await telechargerImage(urlImg, `${id}_${i}`);
      if (fiche) { locales.push(fiche); telecharges++; }
    }
    // photoUrl locale ; fallback URL Leboncoin si aucun téléchargement n'a réussi
    const photoUrl = locales[0] ?? imgs[0];
    if (photoUrl === imgs[0] && locales.length === 0 && !imgs[0]) continue;

    const annonce = await prisma.pigeAnnonce.findUnique({
      where: { id: row.id },
      select: { photoUrl: true },
    });
    if (annonce && !annonce.photoUrl) {
      await prisma.pigeAnnonce.update({
        where: { id: row.id },
        data: { photoUrl, photosJson: locales.length ? locales : imgs },
      });
      maj++;
    }
  }
  return { maj, enrichis: items.length, telecharges };
}

/** Télécharge une image dans uploads/pige → renvoie l'URL publique, ou null */
async function telechargerImage(url, nomBase) {
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ImmoApp/1.0)' },
    });
    if (!r.ok || !String(r.headers.get('content-type') || '').startsWith('image/')) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 500) return null;

    const ext = (String(url).match(/\.(jpe?g|png|webp)(?=\?|$)/)?.[1] || 'jpg').toLowerCase();
    const nom = `${nomBase}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, nom), buf);
    return `${PUBLIC_BASE}/uploads/pige/${nom}`;
  } catch {
    return null;
  }
}