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

/**
 * Construit l'input d'actor selon la source.
 * recherche.apifyInput contient les critères bruts — les anciens formats
 * (clearpath : location/adLimit/communes) sont traduits vers le schéma de l'actor.
 */
export function buildActorInput(recherche) {
  const cfg = recherche.apifyInput || {};

  if (recherche.source === 'leboncoin') {
    return {
      city: cfg.city ?? cfg.centre ?? cfg.location ?? 'Paris',
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
export async function runActor(recherche) {
  const client = getClient();
  const actorId = ACTORS[recherche.source];
  const input = buildActorInput(recherche);

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