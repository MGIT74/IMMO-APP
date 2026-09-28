import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const emptyForm = { titre: '', type: 'Appartement', prix: '', ville: '', codePostal: '', surface: '', pieces: '', chambres: '' };

export default function Biens() {
  const [biens, setBiens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    setLoading(true);
    const data = await api.getBiens();
    setBiens(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleToggleVendu(id) {
    await api.toggleVendu(id);
    load();
  }

  async function handleTogglePublie(id) {
    await api.togglePublie(id);
    load();
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer ce bien définitivement ?')) return;
    await api.deleteBien(id);
    load();
  }

  async function handleCreate(e) {
    e.preventDefault();
    await api.createBien({
      ...form,
      prix: Number(form.prix) || 0,
      surface: form.surface ? Number(form.surface) : null,
      pieces: form.pieces ? Number(form.pieces) : null,
      chambres: form.chambres ? Number(form.chambres) : null,
    });
    setForm(emptyForm);
    setShowForm(false);
    load();
  }

  const totalHonoraires = biens.reduce((sum, b) => sum + (b.vendu ? b.honoraires : 0), 0);

  return (
    <div>
      <div className="page-header">
        <h1>Biens immobiliers</h1>
        <button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Annuler' : '+ Ajouter un bien'}</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card form-grid">
          <input placeholder="Titre / nom de la résidence" value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} required />
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option>Appartement</option>
            <option>Maison</option>
            <option>Studio</option>
            <option>Terrain</option>
          </select>
          <input type="number" placeholder="Prix (€)" value={form.prix} onChange={(e) => setForm({ ...form, prix: e.target.value })} required />
          <input placeholder="Ville" value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} />
          <input placeholder="Code postal" value={form.codePostal} onChange={(e) => setForm({ ...form, codePostal: e.target.value })} />
          <input type="number" placeholder="Surface (m²)" value={form.surface} onChange={(e) => setForm({ ...form, surface: e.target.value })} />
          <input type="number" placeholder="Pièces" value={form.pieces} onChange={(e) => setForm({ ...form, pieces: e.target.value })} />
          <input type="number" placeholder="Chambres" value={form.chambres} onChange={(e) => setForm({ ...form, chambres: e.target.value })} />
          <button type="submit">Créer le bien</button>
        </form>
      )}

      {loading ? (
        <p>Chargement...</p>
      ) : biens.length === 0 ? (
        <p>Aucun bien pour le moment.</p>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Bien</th>
                <th>Prix</th>
                <th>Honoraires</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {biens.map((bien) => (
                <tr key={bien.id}>
                  <td>
                    <strong>{bien.titre}</strong>
                    <div className="muted">{bien.ville}{bien.type ? ` · ${bien.type}` : ''}</div>
                  </td>
                  <td>{Number(bien.prix).toLocaleString('fr-FR')} €</td>
                  <td>
                    {Number(bien.honoraires).toLocaleString('fr-FR')} €
                    {bien.tauxPerso != null && <div className="muted">{bien.taux}% perso</div>}
                  </td>
                  <td>
                    {bien.vendu && <span className="badge badge-red">Vendu</span>}
                    {!bien.publie && <span className="badge badge-grey">Masqué</span>}
                    {!bien.vendu && bien.publie && <span className="badge badge-grey">—</span>}
                  </td>
                  <td className="actions">
                    <button onClick={() => handleToggleVendu(bien.id)}>{bien.vendu ? '✓ Vendu' : 'Marquer vendu'}</button>
                    <button onClick={() => handleTogglePublie(bien.id)}>{bien.publie ? 'Masquer' : 'Afficher'}</button>
                    <button className="danger" onClick={() => handleDelete(bien.id)}>Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ marginTop: 16 }}>
            Honoraires réalisés (biens vendus) : <strong>{totalHonoraires.toLocaleString('fr-FR')} €</strong>
          </p>
        </div>
      )}
    </div>
  );
}
