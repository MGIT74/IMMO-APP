import { ApifyClient } from 'apify-client';

// Clients Apify — APIFY_TOKEN défini dans packages/api/.env
function getClient() {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN manquant dans .env (console.apify.com → Settings → API & Integrations)');
  return new ApifyClient({ token });
}

// Actors du Store Apify (pay-per-event, voir README pige pour les tarifs)
export const ACTORS = {
  leboncoin: 'clearpath/leboncoin-immobilier',
  seloger: 'lexis-solutions/seloger-scraper',
};

/**
 * Construit l'input d'actor selon la source.
 * recherche.apifyInput contient les critères bruts (déjà au format actor).
 * On force toujours : particuliers uniquement / téléphones si possible.
 */
export function buildActorInput(recherche) {
  const base = { ...(recherche.apifyInput || {}) };

  if (recherche.source === 'leboncoin') {
    // seller_type=private → particuliers ; includePhone → numéros (+$9.99/1k)
    return {
      immobilierCategory: '9',
      includeSeller: false,
      seller_type: 'private',
      includePhone: true,
      adLimit: 200,
      ...base,
    };
  }

  if (recherche.source === 'seloger') {
    // actor SeLoger : le champ exact dépend du build courant — voir .md de l'actor.
    // On garde apifyInput maître, on n'écrase que le strict nécessaire.
    return { ...base, adLimit: 200, ...(base.maxItems ? {} : { maxItems: 200 }) };
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

  // maxItems plafonne la facturation pay-per-result côté Apify
  const callOptions = { maxItems: input.adLimit || 200 };

  const run = await client.actor(actorId).call(input, callOptions);

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