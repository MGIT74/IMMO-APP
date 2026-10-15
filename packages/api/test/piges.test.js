import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ??= 'mysql://placeholder:placeholder@localhost:3306/pige_test';

const { zonesPourRecherche, buildActorInput, idDepuisUrl } = await import('../src/pige/apify.js');
const { normaliserZone } = await import('../src/pige/ingest.js');

test('zonesPourRecherche : communes du rayon (sans CP)', () => {
  const r = {
    source: 'leboncoin',
    nom: 'Genevois SJU',
    apifyInput: {
      city: 'Saint-Julien-en-Genevois 74160',
      communes: [
        { nom: 'Saint-Julien-en-Genevois', codesPostaux: ['74160'] },
        { nom: 'Neydens', codesPostaux: ['74160'] },
        'Archamps 74160',
      ],
    },
  };
  assert.deepEqual(zonesPourRecherche(r), ['Saint-Julien-en-Genevois', 'Neydens', 'Archamps']);
});

test('zonesPourRecherche : sans communes → city/centre/location', () => {
  assert.deepEqual(zonesPourRecherche({ source: 'leboncoin', nom: 'X', apifyInput: { city: 'Annemasse 74100' } }), ['Annemasse 74100']);
  assert.deepEqual(zonesPourRecherche({ source: 'leboncoin', nom: 'Ma recherche', apifyInput: {} }), ['Ma recherche']);
  // seloger : pas de zone par commune
  assert.deepEqual(zonesPourRecherche({ source: 'seloger', nom: 'X', apifyInput: { communes: [{ nom: 'Paris' }] } }), [null]);
});

test('buildActorInput : commune courante prioritaire + valeurs par défaut', () => {
  const r = { source: 'leboncoin', apifyInput: { city: 'Annemasse 74100', adLimit: 50 } };
  const i = buildActorInput(r, 'Neydens');
  assert.equal(i.city, 'Neydens');
  assert.equal(i.owner_type, 'private');
  assert.equal(i.only_with_phone, false);
  assert.equal(i.max_items, 50);

  const sansCommune = buildActorInput({ source: 'leboncoin', apifyInput: { city: 'Annemasse 74100' } });
  assert.equal(sansCommune.city, 'Annemasse 74100');
});

test('idDepuisUrl : id numérique depuis URL Leboncoin', () => {
  assert.equal(idDepuisUrl('https://www.leboncoin.fr/ad/ventes_immobilieres/3288286508'), '3288286508');
  assert.equal(idDepuisUrl('https://www.leboncoin.fr/ad/ventes_immobilieres/3288286508?rule=x'), '3288286508');
  assert.equal(idDepuisUrl(null), null);
  assert.equal(idDepuisUrl('https://exemple.com/page'), null);
});

test('normaliserZone : minuscule sans accents ni CP', () => {
  assert.equal(normaliserZone('Évian-les-Bains 74500'), 'evian-les-bains');
  assert.equal(normaliserZone('Saint-Julien-en-Genevois 74160 France'), 'saint-julien-en-genevois');
  assert.equal(normaliserZone(null), null);
});