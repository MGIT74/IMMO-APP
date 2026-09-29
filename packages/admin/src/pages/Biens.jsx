import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function Biens() {
  const [biens, setBiens] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

  const totalHonoraires = biens.reduce((sum, b) => sum + (b.vendu ? b.honoraires : 0), 0);

  return (
    <div>
      <div className="page-header">
        <h1>Biens immobiliers</h1>
        <button onClick={() => navigate('/biens/new')}>+ Ajouter un bien</button>
      </div>

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
                <th>Likes</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {biens.map((bien) => (
                <tr key={bien.id}>
                  <td>
                    <Link to={`/biens/${bien.id}/edit`}><strong>{bien.titre}</strong></Link>
                    <div className="muted">{bien.ville}{bien.type ? ` · ${bien.type}` : ''}</div>
                  </td>
                  <td>{Number(bien.prix).toLocaleString('fr-FR')} €</td>
                  <td>
                    {Number(bien.honoraires).toLocaleString('fr-FR')} €
                    {bien.tauxPerso != null && <div className="muted">{bien.taux}% perso</div>}
                  </td>
                  <td>♥ {bien.likes}</td>
                  <td>
                    {bien.vendu && <span className="badge badge-red">Vendu</span>}
                    {!bien.publie && <span className="badge badge-grey">Masqué</span>}
                    {bien.luxe && <span className="badge badge-gold">✨ Luxe</span>}
                    {!bien.vendu && bien.publie && !bien.luxe && <span className="badge badge-grey">—</span>}
                  </td>
                  <td className="actions">
                    <button onClick={() => handleToggleVendu(bien.id)}>{bien.vendu ? '✓ Vendu' : 'Marquer vendu'}</button>
                    <button onClick={() => handleTogglePublie(bien.id)}>{bien.publie ? 'Masquer' : 'Afficher'}</button>
                    <Link to={`/biens/${bien.id}/edit`}><button type="button">Modifier</button></Link>
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
