import { prisma } from '../db.js';
import { runActor, estimateCost } from './apify.js';

/* ---------- Helpers ---------- */

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Clé de zone normalisée : minuscule, sans accents (ex "Évian-les-Bains 74500" → "evian-les-bains") */
export function normaliserZone(s) {
  const base = String(s ?? '').replace(/\s*\d{5}.*$/, '').trim();
  if (!base) return null;
  return base
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Fingerprint : même bien reposté = même type+cp+ville+surface±3 + prix±2%.
 * Pas parfait, mais arrête 90 % des doublons Leboncoin.
 */
function fingerprint(a) {
  if (!a.cp || !a.surface || !a.prix) return null;
  const binsurf = Math.round(a.surface / 3);
  const binprix = Math.round(a.prix / (a.prix * 0.02 || 1));
  return [a.typeBien, a.cp, String(a.ville || '').toLowerCase(), binsurf, binprix].join('|');
}

/* ---------- Mappers par source ---------- */

// Sortie de l'actor clearpath/leboncoin-immobilier (README Apify)
// ET de l'actor mostafa-ennadi/leboncoin-immobilier-phone-leads-scraper (champs différents) — les deux sont gérés
function mapLeboncoin(item) {
  const firstPub = item.first_publication_date ? new Date(item.first_publication_date) : null;
  // furnished : "1"/true → meublé ; "2"/false/""/null → pas d'info fiable (Boolean seulement)
  let meuble = null;
  if (typeof item.furnished === 'boolean') meuble = item.furnished;
  else if (typeof item.furnished === 'string') {
    const f = item.furnished.trim().toLowerCase();
    if (f === '1' || f === 'true') meuble = true;
    else if (f === '2' || f === 'false') meuble = false;
  }
  const dpeClean = item.energy_rate ? String(item.energy_rate).toUpperCase().trim().slice(0, 2) : null;
  const gesClean = item.ges ? String(item.ges).toUpperCase().trim().slice(0, 2) : null;
  return {
    source: 'leboncoin',
    sourceId: item.list_id != null ? String(item.list_id) : null,
    url: item.url,
    titre: item.subject ?? item.title ?? null,
    texte: item.description ?? item.body ?? null,
    trans: /locat/i.test(String(item.category_name ?? (typeof item.location === 'string' ? item.location : ''))) ? 'L' : 'V',
    typeBien: item.real_estate_type ?? null,
    prix: num(typeof item.price === 'object' && item.price !== null ? (item.price['price[0]'] ?? item.price.price ?? Object.values(item.price)[0]) : item.price),
    surface: num(item.square),
    pieces: item.rooms != null ? Number(item.rooms) : null,
    chambres: item.bedrooms != null ? Number(item.bedrooms) : null,
    dpe: dpeClean,
    ges: gesClean,
    exterieur: (Array.isArray(item.outdoor) ? item.outdoor.join(',') : null)
      ?? (Array.isArray(item.outside_access) ? String(item.outside_access).slice(0, 250) : null),
    etage: item.floor_property ?? null,
    meuble,
    cp: item.zipcode ?? (item.location && item.location.zipcode) ?? null,
    ville: item.city ?? (item.location && item.location.city) ?? null,
    dept: item.department_name ?? null,
    latitude: num(item.latitude),
    longitude: num(item.longitude),
    photoUrl: (Array.isArray(item.images) && item.images[0]) || item.images?.thumb_url || item.images?.large_url || null,
    photosJson: item.images ?? null,
    dateParution: firstPub,
    zone: item._zone ?? null, // transmis par le workflow n8n (ville de la zone scannée)
    // Contact
    _contact: {
      nom: item.seller_name ?? item.owner?.name ?? item.owner_name ?? null,
      telephone: (item.phone ?? item.phonenumber) || null,
      // has_phone = le numéro existe sur Leboncoin mais n'a pas pu être révélé
      // (quota de révélations du compte LBC épuisé, 2FA...) → réessayable au prochain run
      telStatut: (item.phone ?? item.phonenumber) ? 'disponible' : (item.has_phone ? 'non_revele' : 'indisponible'),
    },
  };
}

// Sortie de l'actor lexis-solutions/seloger-scraper — champs approximatifs,
// à ajuster après le premier run (inspecter 1 item du dataset via /pige/debug)
function mapSeloger(item) {
  const m = item;
  return {
    source: 'seloger',
    sourceId: m.id != null ? String(m.id) : null,
    url: m.url ?? (m.id ? `https://www.seloger.com/annonces/${m.id}.htm` : null),
    titre: m.title ?? null,
    texte: m.description ?? null,
    trans: /location/i.test(m.transaction ?? m.url ?? '') ? 'L' : 'V',
    typeBien: m.property_type ?? m.type ?? null,
    prix: num(m.price ?? m.prix),
    surface: num(m.surface ?? m.area),
    pieces: m.rooms != null ? Number(m.rooms) : null,
    chambres: m.bedrooms != null ? Number(m.bedrooms) : null,
    dpe: m.energy_rate ?? m.dpe ?? null,
    ges: m.ges ?? null,
    cp: m.zipcode ?? m.zip_code ?? m.postalCode ?? null,
    ville: m.city ?? m.city_label ?? null,
    dept: m.department ?? null,
    latitude: num(m.latitude),
    longitude: num(m.longitude),
    photoUrl: (Array.isArray(m.photos) && m.photos[0]) || m.photo || null,
    photosJson: Array.isArray(m.photos) ? m.photos : null,
    dateParution: m.first_publication_date ? new Date(m.first_publication_date) : null,
    _contact: {
      nom: m.seller_name ?? m.owner_name ?? null,
      telephone: m.phone ?? null,
      telStatut: m.phone ? 'disponible' : 'inconnu',
    },
  };
}

/* ---------- Ingestion (upsert + dédoublonnage) ---------- */

export async function ingestItems(recherche, items) {
  const mapper = recherche.source === 'leboncoin' ? mapLeboncoin : mapSeloger;
  let nouveaux = 0;
  let maj = 0;
  let telephones = 0;

  // Zone du scan : clé normalisée (pour détecter les disparitions par zone)
  const zone = normaliserZone(recherche._zone ?? null);
  // Ensemble des annonces vues DANS ce scan (pour la détection d'enlèvement)
  const vusIds = new Set();
  let plusVieilleParutionVue = null;

  for (const raw of items) {
    const mapped = mapper(raw);
    if (!mapped.url) continue;

    // On ne garde que les particuliers (sécurité double selon actor)
    const sellerType = raw.seller_type ?? raw.seller?.type ?? null;
    if (sellerType && !/private|particul/i.test(String(sellerType))) continue;

    mapped.zone = zone;
    if (mapped.sourceId) vusIds.add(mapped.sourceId);
    if (mapped.dateParution && (!plusVieilleParutionVue || mapped.dateParution < plusVieilleParutionVue)) {
      plusVieilleParutionVue = mapped.dateParution;
    }
    mapped.fingerprint = fingerprint(mapped);

    const existing = await prisma.pigeAnnonce.findUnique({
      where: { source_url: { source: mapped.source, url: mapped.url } },
    });

    let annonce;
    if (existing) {
      // Prix changé → historique + événement
      const prixChanged = mapped.prix && existing.prix && mapped.prix !== existing.prix;
      annonce = await prisma.pigeAnnonce.update({
        where: { id: existing.id },
        data: {
          prix: mapped.prix ?? existing.prix,
          titre: mapped.titre ?? existing.titre,
          dateDernierScan: new Date(),
          estNouveau: false,
          rechercheId: existing.rechercheId ?? recherche.id,
          // Une annonce revue ne peut pas être enlevée : réactivons si besoin
          ...(zone && (existing.zone !== zone || existing.enleve) ? { zone, enleve: false, scansManques: 0 } : {}),
        },
      });
      // Contact réessayé à chaque scan : si le numéro apparaît maintenant, on le stocke
      if (mapped._contact) {
        const prev = await prisma.pigeContact.findUnique({ where: { annonceId: existing.id } });
        if (mapped._contact.telephone && !prev?.telephone) {
          await prisma.pigeEvenement.create({
            data: { annonceId: annonce.id, type: 'tel_obtenu', detail: `Numéro révélé : ${mapped._contact.telephone}` },
          });
        }
      }
      if (prixChanged) {
        await prisma.pigeHistoriquePrix.create({
          data: { annonceId: annonce.id, prix: mapped.prix },
        });
        await prisma.pigeEvenement.create({
          data: {
            annonceId: annonce.id,
            type: mapped.prix < existing.prix ? 'baisse_prix' : 'hausse_prix',
            valeur: mapped.prix,
            detail: `Prix ${mapped.prix < existing.prix ? 'baissé' : 'augmenté'} de ${existing.prix} → ${mapped.prix}`,
          },
        });
      }
      maj++;
    } else {
      // Doublon par fingerprint ? (même bien reposté sous nouvelle URL)
      let dup = null;
      if (mapped.fingerprint) {
        dup = await prisma.pigeAnnonce.findFirst({
          where: { fingerprint: mapped.fingerprint, source: mapped.source },
          orderBy: { createdAt: 'desc' },
        });
      }
      const dupId = dup?.id ?? null;
      annonce = await prisma.pigeAnnonce.create({
        data: {
          ...mapped,
          _contact: undefined,
          rechercheId: recherche.id,
          // Hérite le suivi CRM du doublon (même bien reposté) : statut/mémo/favori conservés
          ...(dupId ? {
            prixInitial: undefined,
          } : {}),
        },
      });
      // Prix initial pour les graphes d'évolution
      if (mapped.prix && !annonce.prixInitial) {
        await prisma.pigeAnnonce.update({ where: { id: annonce.id }, data: { prixInitial: mapped.prix } });
      }
      if (dupId) {
        // Même bien reposté → le retrait précédent n'était PAS une vente :
        // on requalifie (republiee), réactive, incrémente le compteur et journalise
        await prisma.pigeAnnonce.update({
          where: { id: dupId },
          data: {
            nbRepubs: { increment: 1 },
            sort: 'republiee',
            ...(dup.enleve ? { enleve: false, dateEnlevement: undefined } : {}),
          },
        });
        await prisma.pigeEvenement.create({
          data: {
            annonceId: dupId,
            type: 'republication',
            detail: dup.enleve
              ? `Retrait n'était PAS une vente : republissé sous nouvelle URL ${mapped.url ?? ''} (fiche id ${annonce.id})`
              : `Reposté sous une nouvelle URL : ${mapped.url ?? '(url inconnue)'} (nouvelle annonce id ${annonce.id})`,
          },
        });
      }
      await prisma.pigeEvenement.create({
        data: { annonceId: annonce.id, type: 'creation', detail: `Annonce collectée sur ${mapped.source}` },
      });
      nouveaux++;
    }

    // Contact (téléphone etc.) — ne jamais écraser un numéro déjà obtenu par null
    if (mapped._contact) {
      const prev = await prisma.pigeContact.findUnique({ where: { annonceId: annonce.id } });
      const tel = (mapped._contact.telephone ?? prev?.telephone) || null;
      const data = {
        nom: mapped._contact.nom ?? prev?.nom,
        telephone: tel,
        telStatut: tel ? 'disponible' : mapped._contact.telStatut,
      };
      if (tel && !prev?.telephone) telephones++;
      await prisma.pigeContact.upsert({
        where: { annonceId: annonce.id },
        update: data,
        create: { ...data, annonceId: annonce.id },
      });
    }
  }

  // ---------- Détection d'enlèvement (vitesse de vente) ----------
  if (zone && vusIds.size > 0) {
    const absentes = await prisma.pigeAnnonce.findMany({
      where: { zone, enleve: false, sourceId: { notIn: [...vusIds] } },
      select: { id: true, dateParution: true, scansManques: true, createdAt: true, fingerprint: true },
    });
    for (const c of absentes) {
      // Garde-fou pagination : l'actor renvoie les annonces triées du plus récent au plus ancien.
      // Une annonce PLUS VIEILLE que la plus ancienne de ce scan peut simplement être page 2+ → on ne compte pas.
      const debut = c.dateParution || c.createdAt;
      if (plusVieilleParutionVue && debut < plusVieilleParutionVue) continue;
      const manques = c.scansManques + 1;
      if (manques >= 3) {
        // Un retrait ≠ une vente : le vendeur peut avoir retiré pour republicer (nouvelle URL).
        // Si une autre annonce active existe déjà avec le même fingerprint → c'est une republication.
        let repu = null;
        if (c.fingerprint) {
          repu = await prisma.pigeAnnonce.findFirst({
            where: { fingerprint: c.fingerprint, enleve: false, id: { not: c.id } },
            orderBy: { createdAt: 'desc' },
          });
        }
        await prisma.pigeAnnonce.update({
          where: { id: c.id },
          data: { enleve: true, dateEnlevement: new Date(), scansManques: manques, sort: repu ? 'republiee' : 'en_attente' },
        });
        const jours = Math.max(1, Math.round((Date.now() - debut) / 864e5));
        await prisma.pigeEvenement.create({
          data: {
            annonceId: c.id,
            type: 'enlevement',
            detail: repu
              ? `Annonce retirée puis republiée sous une autre fiche (id ${repu.id}) — probablement repositionnement de prix`
              : `Annonce enlevée du site (3 scans consécutifs sans elle) — en ligne ~${jours} j`,
          },
        });
      } else {
        await prisma.pigeAnnonce.update({ where: { id: c.id }, data: { scansManques: manques } });
      }
    }
    // Les vues repartent à zéro
    await prisma.pigeAnnonce.updateMany({
      where: { zone, sourceId: { in: [...vusIds] }, scansManques: { not: 0 } },
      data: { scansManques: 0 },
    });

    // Qualification différée : les "en attente" enlevées depuis >= 14 j sans apparition d'une
    // fiche au même fingerprint deviennent "vente_probable" (les republications auraient déjà
    // re-déclenché le fingerprint). Aucun re-tri brouillon : règle stricte de patience.
    const enAttente = await prisma.pigeAnnonce.findMany({
      where: { enleve: true, sort: 'en_attente', dateEnlevement: { lt: new Date(Date.now() - 14 * 864e5) } },
      select: { id: true, fingerprint: true },
    });
    for (const e of enAttente) {
      const repuTardive = e.fingerprint
        ? await prisma.pigeAnnonce.findFirst({
            where: { fingerprint: e.fingerprint, enleve: false, id: { not: e.id } },
          })
        : null;
      if (repuTardive) {
        await prisma.pigeAnnonce.update({ where: { id: e.id }, data: { sort: 'republiee' } });
      } else {
        await prisma.pigeAnnonce.update({ where: { id: e.id }, data: { sort: 'vente_probable' } });
        await prisma.pigeEvenement.create({
          data: { annonceId: e.id, type: 'sortie', detail: 'Sortie définitive : jamais reparue dans les 14 j après retrait → vente probable' },
        });
      }
    }
  }

  return { nouveaux, maj, telephones };
}

/**
 * Ingest "libre" venant de n8n / webhook externe : on ne connaît pas la
 * recherche à l'avance, on ingest tout dans la base globale (rechercheId null).
 * Retourne les stats agrégées.
 */
export async function ingestParSource(source, items, zoneRaw = null) {
  const fakeRecherche = { id: null, source, apifyInput: {}, _zone: zoneRaw };
  return ingestItems(fakeRecherche, items);
}

/* ---------- Exécution complète d'une recherche ---------- */

export async function executerRecherche(rechercheId) {
  const recherche = await prisma.pigeRecherche.findUnique({ where: { id: rechercheId } });
  if (!recherche) throw new Error('Recherche introuvable');

  const runRow = await prisma.pigeRun.create({
    data: { rechercheId, statut: 'running' },
  });

  try {
    const { apifyRunId, items, usageTotalUsd } = await runActor(recherche);
    // Zone pour la détection d'enlèvement : la "location" de la recherche (ex "Annemasse 74100")
    const rechercheAvecZone = { ...recherche, _zone: recherche.apifyInput?.location ?? recherche.nom };
    const stats = await ingestItems(rechercheAvecZone, items);

    await prisma.pigeRun.update({
      where: { id: runRow.id },
      data: {
        statut: 'ok',
        apifyRunId,
        annoncesRecues: items.length,
        annoncesNouvelles: stats.nouveaux,
        annoncesMaj: stats.maj,
        coutUsd: usageTotalUsd ?? estimateCost(recherche, { annonces: items.length, telephones: stats.telephones }),
        finishedAt: new Date(),
      },
    });
    await prisma.pigeRecherche.update({
      where: { id: rechercheId },
      data: { derniereRun: new Date() },
    });
    return { runId: runRow.id, ...stats, total: items.length };
  } catch (err) {
    await prisma.pigeRun.update({
      where: { id: runRow.id },
      data: { statut: 'error', erreur: String(err.message ?? err), finishedAt: new Date() },
    });
    throw err;
  }
}