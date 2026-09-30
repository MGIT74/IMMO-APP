import cron from 'node-cron';
import { prisma } from '../db.js';
import { executerRecherche } from './ingest.js';

/**
 * Pige automatique : 5 exécutions/jour (7h00, 10h30, 13h30, 17h00, 20h30).
 * L'API Apify est payée à la course : seules les annonces réellement scrapées
 * sont facturées — les runs sans nouvelle annonce restent bon marché.
 *
 * Désactivable avec PIGE_CRON=false dans .env.
 */
export function demarrerCronPige() {
  if ((process.env.PIGE_CRON ?? 'true') === 'false') return;

  // Lancer chaque recherche active ; les runs sont séquentiels pour éviter
  // de dépasser la concurrence du plan Apify gratuit (1 run simultané).
  async function runAll() {
    const actives = await prisma.pigeRecherche.findMany({ where: { active: true } });
    for (const rech of actives) {
      try {
        const r = await executerRecherche(rech.id);
        console.log(`[pige] ${rech.source}/${rech.nom} → ${r.nouveaux} nouvelles, ${r.maj} mises à jour`);
      } catch (err) {
        console.error(`[pige] ${rech.source}/${rech.nom} échec :`, err.message);
      }
    }
  }

  cron.schedule('0 7,10,13,17,20 * * *', () => {
    runAll().catch((e) => console.error('[pige] erreur cron:', e));
  });
  console.log('[pige] cron 5x/jour armé (7h/10h30/13h30/17h/20h30)');
}