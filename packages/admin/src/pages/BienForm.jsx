import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { ICON_LABELS, formatEquip, hasValueField } from '../lib/equipements.js';

const emptyBien = {
  titre: '', type: 'Appartement', prix: '', ville: '', codePostal: '',
  surface: '', pieces: '', chambres: '',
  etatTexte: '', etatCouleur: '#43a047', etatAnim: 'none', livraison: '',
  tauxPerso: '', boutonTexte: '', boutonUrl: '', luxe: false, description: '',
  dpeLettre: '', dpeValeur: '', gesLettre: '', gesValeur: '',
  chargesAnnuelles: '', numCopropriete: '', quotePart: '', syndicatActif: false,
  syndicProcedureInfo: '', taxeFonciere: '', chargeType: 'copropriete',
};

export default function BienForm() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();

  const [bien, setBien] = useState(emptyBien);
  const [equipements, setEquipements] = useState([{ icone: 'salle_bain', valeur: '', texte: formatEquip('salle_bain', '') }]);
  const [photos, setPhotos] = useState([]);
  const [plans, setPlans] = useState([]);
  const [planLabel, setPlanLabel] = useState('');
  const [uploadingPlan, setUploadingPlan] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!isNew) {
      api.getBien(id).then((data) => {
        setBien({
          titre: data.titre || '', type: data.type || '', prix: data.prix ?? '',
          ville: data.ville || '', codePostal: data.codePostal || '',
          surface: data.surface ?? '', pieces: data.pieces ?? '', chambres: data.chambres ?? '',
          etatTexte: data.etatTexte || '', etatCouleur: data.etatCouleur || '#43a047',
          etatAnim: data.etatAnim || 'none', livraison: data.livraison || '',
          tauxPerso: data.tauxPerso ?? '', boutonTexte: data.boutonTexte || '', boutonUrl: data.boutonUrl || '',
          luxe: !!data.luxe, description: data.description || '',
          dpeLettre: data.dpeLettre || '', dpeValeur: data.dpeValeur ?? '',
          gesLettre: data.gesLettre || '', gesValeur: data.gesValeur ?? '',
          chargesAnnuelles: data.chargesAnnuelles ?? '', numCopropriete: data.numCopropriete ?? '',
          quotePart: data.quotePart ?? '', syndicatActif: !!data.syndicatActif,
          syndicProcedureInfo: data.syndicProcedureInfo || '', taxeFonciere: data.taxeFonciere ?? '',
          chargeType: data.chargeType || 'copropriete',
        });
        setEquipements(
          data.equipements?.length
            ? data.equipements.map((eq) => ({ icone: eq.icone, valeur: '', texte: eq.texte }))
            : []
        );
        setPhotos(data.photos || []);
        setPlans(data.plans || []);
      });
    }
  }, [id, isNew]);

  function updateField(key, value) {
    setBien((b) => ({ ...b, [key]: value }));
  }

  function updateEquipIcon(index, icone) {
    setEquipements((rows) =>
      rows.map((row, i) => (i === index ? { icone, valeur: '', texte: formatEquip(icone, '') } : row))
    );
  }

  function updateEquipValeur(index, valeur) {
    setEquipements((rows) =>
      rows.map((row, i) => (i === index ? { ...row, valeur, texte: formatEquip(row.icone, valeur) } : row))
    );
  }

  function addEquipRow() {
    setEquipements((rows) => [...rows, { icone: 'salle_bain', valeur: '', texte: formatEquip('salle_bain', '') }]);
  }

  function removeEquipRow(index) {
    setEquipements((rows) => rows.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);

    const payload = {
      ...bien,
      prix: Number(bien.prix) || 0,
      surface: bien.surface !== '' ? Number(bien.surface) : null,
      pieces: bien.pieces !== '' ? Number(bien.pieces) : null,
      chambres: bien.chambres !== '' ? Number(bien.chambres) : null,
      tauxPerso: bien.tauxPerso !== '' ? Number(bien.tauxPerso) : null,
      luxe: !!bien.luxe,
      description: bien.description || null,
      dpeLettre: bien.dpeLettre || null,
      dpeValeur: bien.dpeValeur !== '' ? Number(bien.dpeValeur) : null,
      gesLettre: bien.gesLettre || null,
      gesValeur: bien.gesValeur !== '' ? Number(bien.gesValeur) : null,
      chargesAnnuelles: bien.chargesAnnuelles !== '' ? Number(bien.chargesAnnuelles) : null,
      numCopropriete: bien.numCopropriete !== '' ? Number(bien.numCopropriete) : null,
      quotePart: bien.quotePart !== '' ? Number(bien.quotePart) : null,
      syndicatActif: !!bien.syndicatActif,
      syndicProcedureInfo: bien.syndicProcedureInfo || null,
      taxeFonciere: bien.taxeFonciere !== '' ? Number(bien.taxeFonciere) : null,
      chargeType: bien.chargeType || null,
      equipements: equipements
        .filter((eq) => eq.texte.trim() !== '')
        .map((eq) => ({ icone: eq.icone, texte: eq.texte })),
    };

    if (isNew) {
      const created = await api.createBien(payload);
      setSaving(false);
      navigate(`/biens/${created.id}/edit`);
    } else {
      await api.updateBien(id, payload);
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const photo = await api.uploadPhoto(id, file);
    setPhotos((p) => [...p, photo]);
    setUploading(false);
    e.target.value = '';
  }

  async function handleDeletePhoto(photoId) {
    await api.deletePhoto(photoId);
    setPhotos((p) => p.filter((ph) => ph.id !== photoId));
  }

  async function movePhoto(index, direction) {
    const newPhotos = [...photos];
    const target = index + direction;
    if (target < 0 || target >= newPhotos.length) return;
    [newPhotos[index], newPhotos[target]] = [newPhotos[target], newPhotos[index]];
    setPhotos(newPhotos);
    await api.reorderPhotos(id, newPhotos.map((p) => p.id));
  }

  async function handleUploadPlan(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPlan(true);
    const plan = await api.uploadPlan(id, file, planLabel);
    setPlans((p) => [...p, plan]);
    setPlanLabel('');
    setUploadingPlan(false);
    e.target.value = '';
  }

  async function handleDeletePlan(planId) {
    await api.deletePlan(planId);
    setPlans((p) => p.filter((pl) => pl.id !== planId));
  }

  return (
    <div>
      <div className="page-header">
        <h1>{isNew ? 'Ajouter un bien' : `Modifier : ${bien.titre || '...'}`}</h1>
        <Link to="/">← Retour à la liste</Link>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <h2>Détails du bien</h2>
          <div className="form-grid">
            <input placeholder="Titre / nom de la résidence" value={bien.titre} onChange={(e) => updateField('titre', e.target.value)} required />
            <select value={bien.type} onChange={(e) => updateField('type', e.target.value)}>
              <option>Appartement</option>
              <option>Maison</option>
              <option>Studio</option>
              <option>Terrain</option>
              <option>Local commercial</option>
              <option>Parking</option>
            </select>
            <input type="number" placeholder="Prix (€)" value={bien.prix} onChange={(e) => updateField('prix', e.target.value)} required />
            <input placeholder="Ville" value={bien.ville} onChange={(e) => updateField('ville', e.target.value)} />
            <input placeholder="Code postal" value={bien.codePostal} onChange={(e) => updateField('codePostal', e.target.value)} />
            <input type="number" placeholder="Surface (m²)" value={bien.surface} onChange={(e) => updateField('surface', e.target.value)} />
            <input type="number" placeholder="Pièces" value={bien.pieces} onChange={(e) => updateField('pieces', e.target.value)} />
            <input type="number" placeholder="Chambres" value={bien.chambres} onChange={(e) => updateField('chambres', e.target.value)} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
            <input type="checkbox" checked={bien.luxe} onChange={(e) => updateField('luxe', e.target.checked)} style={{ width: 'auto' }} />
            ✨ Bien de luxe (apparaît dans la section "Luxury" du site, design noir)
          </label>
          {bien.luxe && (
            <textarea
              placeholder="Texte éditorial affiché sur la page Luxury (ex : « Une villa qui transcende...»)"
              value={bien.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={3}
              style={{ width: '100%', marginTop: 10, padding: 10, border: '1px solid #e2e2e2', borderRadius: 8 }}
            />
          )}
        </div>

        <div className="card">
          <h2>État du bien</h2>
          <div className="form-grid">
            <input placeholder="Texte de l'état (ex : Livrée)" value={bien.etatTexte} onChange={(e) => updateField('etatTexte', e.target.value)} />
            <input type="color" value={bien.etatCouleur} onChange={(e) => updateField('etatCouleur', e.target.value)} title="Couleur du point" />
            <select value={bien.etatAnim} onChange={(e) => updateField('etatAnim', e.target.value)}>
              <option value="none">Aucune animation</option>
              <option value="blink">Clignote</option>
              <option value="pulse">Onde autour du point</option>
            </select>
            <input placeholder="Texte de livraison (ex : Livraison T3 2026)" value={bien.livraison} onChange={(e) => updateField('livraison', e.target.value)} />
          </div>
        </div>

        <div className="card">
          <h2>Énergie & diagnostics (DPE / GES)</h2>
          <p className="muted" style={{ marginTop: -8 }}>
            Mention obligatoire pour toute annonce en France (arrêté du 31 mars 2021). Fais remplir le diagnostic par le diagnostiqueur.
          </p>
          <div className="form-grid">
            <select value={bien.dpeLettre} onChange={(e) => updateField('dpeLettre', e.target.value)}>
              <option value="">— DPE (lettre) —</option>
              {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((l) => <option key={l}>{l}</option>)}
            </select>
            <input type="number" placeholder="DPE valeur (kWh/m²/an)" value={bien.dpeValeur} onChange={(e) => updateField('dpeValeur', e.target.value)} />
            <select value={bien.gesLettre} onChange={(e) => updateField('gesLettre', e.target.value)}>
              <option value="">— GES (lettre) —</option>
              {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((l) => <option key={l}>{l}</option>)}
            </select>
            <input type="number" placeholder="GES valeur (kg CO₂/m²/an)" value={bien.gesValeur} onChange={(e) => updateField('gesValeur', e.target.value)} />
          </div>
        </div>

        <div className="card">
          <h2>Charges & copropriété</h2>
          <div className="form-grid">
            <select value={bien.chargeType} onChange={(e) => updateField('chargeType', e.target.value)}>
              <option value="copropriete">En copropriété</option>
              <option value="individuel">Bien individuel (maison)</option>
            </select>
            <input type="number" step="0.01" placeholder="Charges annuelles (€)" value={bien.chargesAnnuelles} onChange={(e) => updateField('chargesAnnuelles', e.target.value)} />
            {bien.chargeType !== 'individuel' && (
              <>
                <input type="number" placeholder="Nombre de lots (copropriété)" value={bien.numCopropriete} onChange={(e) => updateField('numCopropriete', e.target.value)} />
                <input type="number" step="0.01" placeholder="Quote-part (%)" value={bien.quotePart} onChange={(e) => updateField('quotePart', e.target.value)} />
              </>
            )}
            <input type="number" step="0.01" placeholder="Taxe foncière annuelle (€)" value={bien.taxeFonciere} onChange={(e) => updateField('taxeFonciere', e.target.value)} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
            <input type="checkbox" checked={bien.syndicatActif} onChange={(e) => updateField('syndicatActif', e.target.checked)} style={{ width: 'auto' }} />
            ⚖️ Procédure en cours contre le syndicat de copropriété (art. 13 loi ALUR — mention obligatoire)
          </label>
          {bien.syndicatActif && (
            <input
              type="text"
              placeholder="Détail de la procédure (ex : contentieux sur travaux)"
              value={bien.syndicProcedureInfo}
              onChange={(e) => updateField('syndicProcedureInfo', e.target.value)}
              style={{ width: '100%', marginTop: 10, padding: 10, border: '1px solid #e2e2e2', borderRadius: 8 }}
            />
          )}
        </div>

        <div className="card">
          <h2>Équipements</h2>
          {equipements.map((row, i) => (
            <div key={i} className="equip-row">
              <select value={row.icone} onChange={(e) => updateEquipIcon(i, e.target.value)}>
                {Object.entries(ICON_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              {hasValueField(row.icone) && (
                <input
                  placeholder="1"
                  value={row.valeur}
                  onChange={(e) => updateEquipValeur(i, e.target.value)}
                  style={{ width: 70 }}
                />
              )}
              <span className="muted">{row.texte}</span>
              <button type="button" className="danger" onClick={() => removeEquipRow(i)}>✕</button>
            </div>
          ))}
          <button type="button" onClick={addEquipRow}>+ Ajouter un équipement</button>
        </div>

        <div className="card">
          <h2>Bouton lien externe (optionnel)</h2>
          <div className="form-grid">
            <input placeholder="Texte du bouton" value={bien.boutonTexte} onChange={(e) => updateField('boutonTexte', e.target.value)} />
            <input placeholder="URL" value={bien.boutonUrl} onChange={(e) => updateField('boutonUrl', e.target.value)} />
          </div>
        </div>

        <div className="card">
          <h2>Taux d'honoraires personnalisé (optionnel)</h2>
          <input
            type="number" step="0.1" min="0" max="100" placeholder="Laisser vide pour utiliser le taux général"
            value={bien.tauxPerso} onChange={(e) => updateField('tauxPerso', e.target.value)}
            style={{ width: 260 }}
          />
        </div>

        <button type="submit" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
        {saved && <span className="success" style={{ marginLeft: 12 }}>Enregistré !</span>}
      </form>

      <div className="card">
        <h2>Photos</h2>
        {isNew ? (
          <p className="muted">Enregistrez d'abord le bien pour pouvoir ajouter des photos.</p>
        ) : (
          <>
            <div className="photo-grid">
              {photos.map((photo, i) => (
                <div key={photo.id} className="photo-thumb">
                  <img src={photo.url.startsWith('http') ? photo.url : `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}${photo.url}`} alt="" />
                  <div className="photo-thumb-actions">
                    <button type="button" onClick={() => movePhoto(i, -1)} disabled={i === 0}>←</button>
                    <button type="button" onClick={() => movePhoto(i, 1)} disabled={i === photos.length - 1}>→</button>
                    <button type="button" className="danger" onClick={() => handleDeletePhoto(photo.id)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
            <label className="upload-label">
              {uploading ? 'Envoi...' : '+ Ajouter une photo'}
              <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} style={{ display: 'none' }} />
            </label>
          </>
        )}
      </div>

      <div className="card">
        <h2>Plans (PDF)</h2>
        {isNew ? (
          <p className="muted">Enregistrez d'abord le bien pour pouvoir ajouter des plans.</p>
        ) : (
          <>
            {plans.length > 0 && (
              <div className="plan-list">
                {plans.map((plan) => (
                  <div key={plan.id} className="plan-row">
                    <span>📄 {plan.label}</span>
                    <div className="actions">
                      <a href={plan.url.startsWith('http') ? plan.url : `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}${plan.url}`} target="_blank" rel="noopener noreferrer">
                        <button type="button">Voir</button>
                      </a>
                      <button type="button" className="danger" onClick={() => handleDeletePlan(plan.id)}>Supprimer</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Nom du plan (ex : Rez-de-chaussée)"
                value={planLabel}
                onChange={(e) => setPlanLabel(e.target.value)}
                style={{ flex: 1, minWidth: 200 }}
              />
              <label className="upload-label">
                {uploadingPlan ? 'Envoi...' : '+ Ajouter un plan PDF'}
                <input type="file" accept="application/pdf" onChange={handleUploadPlan} disabled={uploadingPlan} style={{ display: 'none' }} />
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
