export const ICON_LABELS = {
  salle_bain: 'Salle de bain',
  salle_eau: "Salle d'eau",
  toilettes: 'Toilettes',
  balcon: 'Balcon',
  terrasse: 'Terrasse',
  rdc: 'Rez de chaussée',
  etage: 'Étage',
  exposition: 'Exposition',
  cave: 'Cave',
  parking: 'Parking',
  garage: 'Garage',
  piscine: 'Piscine',
  jardin: 'Jardin',
  ascenseur: 'Ascenseur',
  generic: 'Autre',
};

export const EQUIP_TEMPLATES = {
  salle_bain: '%s Salle de bain',
  salle_eau: "%s Salle d'eau",
  toilettes: '%s Toilettes',
  balcon: '%s Balcon',
  terrasse: '%s Terrasse',
  rdc: 'Rez de chaussée',
  etage: '%sème étage',
  exposition: 'Exposition %s',
  cave: 'Cave',
  parking: '%s Parking',
  garage: '%s Garage',
  piscine: 'Piscine',
  jardin: 'Jardin',
  ascenseur: 'Ascenseur',
  generic: '%s',
};

export const EQUIP_DEFAULTS = {
  salle_bain: '1', salle_eau: '1', toilettes: '1', balcon: '1', terrasse: '1',
  etage: '2', exposition: 'Sud', parking: '1', garage: '1',
};

export function formatEquip(icone, valeur) {
  const tpl = EQUIP_TEMPLATES[icone] || '%s';
  if (!tpl.includes('%s')) return tpl;
  const v = (valeur || '').trim() || EQUIP_DEFAULTS[icone] || '';
  return tpl.replace('%s', v).trim();
}

export function hasValueField(icone) {
  return (EQUIP_TEMPLATES[icone] || '%s').includes('%s');
}
