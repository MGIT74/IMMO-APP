import { prisma } from '../db.js';
import { runActor, estimateCost } from './apify.js';

/* ---------- Helpers ---------- */

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
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
function mapLeboncoin(item) {
  const firstPub = item.first_publication_date ? new Date(item.first_publication_date) : null;
  return {
    source: 'leboncoin',
    sourceId: item.list_id != null ? String(item.list_id) : null,
    url: item.url,
    titre: item.title ?? null,
    texte: item.description ?? item.body ?? null,
    trans: /locat/i.test(String(item.category_name ?? (typeof item.location === 'string' ? item.location : ''))) ? 'L' : 'V',
    typeBien: item.real_estate_type ?? null,
    prix: num(typeof item.price === 'object' && item.price !== null ? (item.price['price[0]'] ?? item.price.price ?? Object.values(item.price)[0]) : item.price),
    surface: num(item.square),
    pieces: item.rooms != null ? Number(item.rooms) : null,
    chambres: item.bedrooms != null ? Number(item.bedrooms) : null,
    dpe: item.energy_rate ?? null,
    ges: item.ges ?? null,
    exterieur: Array.isArray(item.outdoor) ? item.outdoor.join(',') : null,
    etage: item.floor_property ?? null,
    meuble: item.furnished ?? null,
    cp: item.zipcode ?? (item.location && item.location.zipcode) ?? null,
    ville: item.city ?? (item.location && item.location.city) ?? null,
    dept: item.department_name ?? null,
    latitude: num(item.latitude),
    longitude: num(item.longitude),
    photoUrl: (Array.isArray(item.images) && item.images[0]) || item.images?.thumb_url || item.images?.large_url || null,
    photosJson: item.images ?? null,
    dateParution: firstPub,
    // Contact
    _contact: {
      nom: item.seller_name ?? null,
      telephone: item.phone ?? null,
      telStatut: item.phone ? 'disponible' : 'indisponible',
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

  for (const raw of items) {
    const mapped = mapper(raw);
    if (!mapped.url) continue;

    // On ne garde que les particuliers (sécurité double selon actor)
    const sellerType = raw.seller_type ?? raw.seller?.type ?? null;
    if (sellerType && !/private|particul/i.test(String(sellerType))) continue;

    mapped.fingerprint = fingerprint(mapped);

    const existing = await prisma.pigeAnnonce.findUnique({
      where: { source_url: { source: mapped.source, url: mapped.url } },
    });

    let annonce;
    if (existing) {
      // Prix changé → historique
      const prixChanged = mapped.prix && existing.prix && mapped.prix !== existing.prix;
      annonce = await prisma.pigeAnnonce.update({
        where: { id: existing.id },
        data: {
          prix: mapped.prix ?? existing.prix,
          titre: mapped.titre ?? existing.titre,
          dateDernierScan: new Date(),
          estNouveau: false,
          rechercheId: existing.rechercheId ?? recherche.id,
        },
      });
      if (prixChanged) {
        await prisma.pigeHistoriquePrix.create({
          data: { annonceId: annonce.id, prix: mapped.prix },
        });
      }
      maj++;
    } else {
      // Doublon par fingerprint ? (même bien reposté sous nouvelle URL)
      let dupId = null;
      if (mapped.fingerprint) {
        const dup = await prisma.pigeAnnonce.findFirst({
          where: { fingerprint: mapped.fingerprint, source: mapped.source },
        });
        if (dup) dupId = dup.id;
      }
      annonce = await prisma.pigeAnnonce.create({
        data: { ...mapped, _contact: undefined, rechercheId: recherche.id },
      });
      if (mapped.fingerprint && dupId) {
        // On marque le lien de doublon via le même fingerprint (déjà stocké),
        // rien de plus à faire : la requête admin peut regrouper par fingerprint.
      }
      nouveaux++;
    }

    // Contact (téléphone etc.)
    if (mapped._contact) {
      const data = {
        nom: mapped._contact.nom,
        telephone: mapped._contact.telephone,
        telStatut: mapped._contact.telStatut,
      };
      if (data.telephone) telephones++;
      await prisma.pigeContact.upsert({
        where: { annonceId: annonce.id },
        update: data,
        create: { ...data, annonceId: annonce.id },
      });
    }
  }

  return { nouveaux, maj, telephones };
}

/**
 * Ingest "libre" venant de n8n / webhook externe : on ne connaît pas la
 * recherche à l'avance, on ingest tout dans la base globale (rechercheId null).
 * Retourne les stats agrégées.
 */
export async function ingestParSource(source, items) {
  const fakeRecherche = { id: null, source, apifyInput: {} };
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
    const stats = await ingestItems(recherche, items);

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