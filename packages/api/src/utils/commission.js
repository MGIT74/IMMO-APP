import { prisma } from '../db.js';

/**
 * Retourne le taux d'honoraires applicable à un bien : son taux personnalisé
 * s'il en a un, sinon le taux général réglé dans les Réglages.
 */
export async function getTauxForBien(bien) {
  if (bien.tauxPerso !== null && bien.tauxPerso !== undefined) {
    return bien.tauxPerso;
  }
  const setting = await prisma.setting.findUnique({ where: { key: 'taux_honoraires' } });
  return setting ? parseFloat(setting.value) : 5;
}

export function calcHonoraires(prix, taux) {
  return (prix * taux) / 100;
}
