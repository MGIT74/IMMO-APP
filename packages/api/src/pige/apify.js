import { ApifyClient } from 'apify-client';

// Clients Apify — APIFY_TOKEN défini dans packages/api/.env
function getClient() {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN manquant dans .env (console.apify.com → Settings → API & Integrations)');
  return new ApifyClient({ token });
}

// Actors du Store Apify (pay-per-event, voir README pige pour les tarifs)
// leboncoin → mostafa-ennadi : révèle les numéros de téléphone sans compte Leboncoin
// (input : city, owner_type, only_with_phone, max_pages, max_items)
export const ACTORS = {
  leboncoin: 'mostafa-ennadi/leboncoin-immobilier-phone-leads-scraper',
  seloger: 'lexis-solutions/seloger-scraper',
};

/** Extrait l'ID numérique d'une URL Leboncoin (…/ad/ventes_immobilieres/3288286508 → "3288286508") */
export function idDepuisUrl(url) {
  const m = String(url ?? '').match(/\/(\d{6,})(?:[/?]|$)/);
  return m ? m[1] : null;
}

/**
 * Zones à scanner pour une recherche : les communes du rayon si elles existent
 * (cfg.communes, alimenté par /zone-communes), sinon la ville/city de la config.
 * Une sortie par élément → le suivi d'enlèvement est fait PAR COMMUNE
 * (l'ancien workflow n8n scannait aussi chaque commune, on garde la même couverture).
 * null = pas de notion de zone (seloger) : un seul run.
 */
export function zonesPourRecherche(recherche) {
  const cfg = recherche.apifyInput || {};
  if (recherche.source === 'seloger') return [null];

  const communes = Array.isArray(cfg.communes) && cfg.communes.length ? cfg.communes : null;
  const noms = (communes ?? [])
    .map((c) => (typeof c === 'string' ? c : c?.nom) ?? '')
    .map((n) => n.replace(/\s*\d{5}.*$/, '').trim())
    .filter(Boolean);
  if (noms.length) return noms;
  return [cfg.city ?? cfg.centre ?? cfg.location ?? recherche.nom].filter(Boolean);
}

/**
 * Construit l'input d'actor selon la source.
 * recherche.apifyInput contient les critères bruts — les anciens formats
 * (clearpath : location/adLimit/communes) sont traduits vers le schéma de l'actor.
 * `ville` = commune courante du scan (voir zonesPourRecherche).
 */
export function buildActorInput(recherche, ville = null) {
  const cfg = recherche.apifyInput || {};

  if (recherche.source === 'leboncoin') {
    return {
      city: ville ?? cfg.city ?? cfg.centre ?? cfg.location ?? 'Paris',
      owner_type: 'private',
      // only_with_phone FALSE : on garde TOUTES les annonces (CRM complet) ;
      // les numéros trouvés sont révélés de toute façon — sinon le tracking
      // d'enlèvement serait faussé (annonce sans numéro = absente du scan à tort)
      only_with_phone: false,
      max_pages: Number(cfg.max_pages) || 1,
      max_items: Number(cfg.max_items ?? cfg.adLimit) || 50,
    };
  }

  if (recherche.source === 'seloger') {
    // actor SeLoger : le champ exact dépend du build courant — voir .md de l'actor.
    return { ...cfg, maxItems: Number(cfg.maxItems || cfg.adLimit) || 200 };
  }

  throw new Error(`Source inconnue : ${recherche.source}`);
}

/**
 * Lance l'actor Apify et attend la fin du run, puis renvoie le dataset.
 */
export async function runActor(recherche, ville = null) {
  const client = getClient();
  const actorId = ACTORS[recherche.source];
  const input = buildActorInput(recherche, ville);

  const run = await client.actor(actorId).call(input, { maxItems: input.max_items || 200 });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return { apifyRunId: run.id, items, usageTotalUsd: run.usageTotalUsd ?? null };
}

/**
 * Coût estimé d'un run (annonces + téléphones trouvés) — approx. tarifs Store.
 */
export function estimateCost(recherche, { annonces, telephones }) {
  const isPaidPlan = false; // plan gratuit : tarifs forts
  const perAd = recherche.source === 'leboncoin' ? (isPaidPlan ? 0.99 : 1.49) : 0.5;
  const perTel = 0.00999; // 9.99 $/1000
  return perAd * annonces + perTel * telephones;
}