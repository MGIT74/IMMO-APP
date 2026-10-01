import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

function IconRun() { return <span>▶</span>; }

export default function Pige() {
  const [annonces, setAnnonces] = useState([]);
  const [recherches, setRecherches] = useState([]);
  const [stats, setStats] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyRun, setBusyRun] = useState(null);
  const [filtres, setFiltres] = useState({ q: '', cp: '', prixMax: '', surfMin: '', trans: '', avecTel: false });
  const [nouvelleRech, setNouvelleRech] = useState({ nom: '', location: 'Saint-Julien-en-Genevois 74160', adLimit: 100 });

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtres.q) params.set('q', filtres.q);
    if (filtres.cp) params.set('cp', filtres.cp);
    if (filtres.prixMax) params.set('prixMax', filtres.prixMax);
    if (filtres.surfMin) params.set('surfMin', filtres.surfMin);
    if (filtres.trans) params.set('trans', filtres.trans);
    const data = await api.get(`/api/admin/pige/annonces?${params.toString()}&perPage=50`);
    setAnnonces((data && data.annonces) || []);
    const [r, s, runsData] = await Promise.all([
      api.get('/api/admin/pige/recherches'),
      api.get('/api/admin/pige/stats'),
      api.get('/api/admin/pige/runs'),
    ]);
    setRecherches(r || []);
    setStats(s);
    setRuns((runsData || []).slice(0, 8));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function lancerRecherche(id) {
    setBusyRun(id);
    try {
      await api.post(`/api/admin/pige/recherches/${id}/run`);
      await load();
    } catch (e) {
      alert(`Erreur : ${e.message}`);
    }
    setBusyRun(null);
  }

  async function creerRecherche(e) {
    e.preventDefault();
    await api.post('/api/admin/pige/recherches', {
      nom: nouvelleRech.nom,
      source: 'leboncoin',
      apifyInput: {
        immobilierCategory: '9',
        location: nouvelleRech.location,
        seller_type: 'private',
        includePhone: true,
        includeSeller: false,
        adLimit: Number(nouvelleRech.adLimit) || 100,
      },
    });
    setNouvelleRech({ nom: '', location: 'Saint-Julien-en-Genevois 74160', adLimit: 100 });
    load();
  }

  return (
    <div>
      <div className="page-header">
        <h1>Pige — annonces particuliers (Leboncoin)</h1>
      </div>

      {stats && (
        <div className="pige-stats">
          <div className="pige-stat"><b>{stats.totalAnnonces}</b><span>annonces</span></div>
          <div className="pige-stat"><b>{stats.avecTelephone}</b><span>avec téléphone</span></div>
          <div className="pige-stat"><b>{stats.nouveaux7j}</b><span>nouvelles (7j)</span></div>
          <div className="pige-stat"><b>${Number(stats.coutTotalUsd).toFixed(2)}</b><span>coût Apify cumulé</span></div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 8px' }}>Recherches programmées (cron n8n 3x/jour)</h3>
        {recherches.length === 0 ? (
          <p>Aucune recherche — crée-en une ci-dessous.</p>
        ) : (
          <table className="table">
            <thead><tr><th>Nom</th><th>Source</th><th>Annonces</th><th>Dernière run</th><th>Actions</th></tr></thead>
            <tbody>
              {recherches.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.nom}</b> {r.active ? '' : <em>(inactive)</em>}</td>
                  <td>{r.source}</td>
                  <td>{r.nbAnnonces}</td>
                  <td>{r.derniereRun ? new Date(r.derniereRun).toLocaleString('fr-FR') : '—'}</td>
                  <td>
                    <button className="small" disabled={busyRun === r.id} onClick={() => lancerRecherche(r.id)}>
                      {busyRun === r.id ? 'En cours…' : (<><IconRun /> Lancer</>)}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form onSubmit={creerRecherche} style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <input placeholder="Nom (ex: Genevois ventes)" value={nouvelleRech.nom} required
            onChange={(e) => setNouvelleRech({ ...nouvelleRech, nom: e.target.value })} style={{ flex: '1 1 160px' }} />
          <input placeholder="Zone (ex: Ville 74160)" value={nouvelleRech.location} required
            onChange={(e) => setNouvelleRech({ ...nouvelleRech, location: e.target.value })} style={{ flex: '2 1 220px' }} />
          <input type="number" min="10" max="500" placeholder="100" value={nouvelleRech.adLimit}
            onChange={(e) => setNouvelleRech({ ...nouvelleRech, adLimit: e.target.value })} style={{ width: 80 }} />
          <button type="submit">+ Créer</button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Recherche (titre/ville)" value={filtres.q}
          onChange={(e) => setFiltres({ ...filtres, q: e.target.value })} style={{ flex: '1 1 180px' }} />
        <input placeholder="CP (ex 74)" value={filtres.cp} size="6"
          onChange={(e) => setFiltres({ ...filtres, cp: e.target.value })} />
        <input placeholder="Prix max" type="number" value={filtres.prixMax} size="9"
          onChange={(e) => setFiltres({ ...filtres, prixMax: e.target.value })} />
        <input placeholder="Surface min" type="number" value={filtres.surfMin} size="7"
          onChange={(e) => setFiltres({ ...filtres, surfMin: e.target.value })} />
        <select value={filtres.trans} onChange={(e) => setFiltres({ ...filtres, trans: e.target.value })}>
          <option value="">Vente & Location</option>
          <option value="V">Vente</option>
          <option value="L">Location</option>
        </select>
        <button onClick={load}>Filtrer</button>
      </div>

      {loading ? (
        <p>Chargement…</p>
      ) : annonces.length === 0 ? (
        <div className="card">
          <p>Aucune annonce pour ces critères.</p>
          <p style={{ color: 'var(--muted, #888)' }}>
            Vérifie qu'une recherche existe ci-dessus et lance-la une fois (ou attends le cron n8n 3x/jour).
          </p>
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr><th></th><th>Bien</th><th>Prix</th><th>Surface</th><th>Pièces</th><th>Contact</th><th>Publié le</th><th>Lien</th></tr>
            </thead>
            <tbody>
              {annonces.map((a) => (
                <tr key={a.id}>
                  <td>{a.photoUrl ? <img src={a.photoUrl} alt="" style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 6 }} /> : ''}</td>
                  <td>
                    <b>{a.titre || a.typeBien || 'Annonce'}</b><br />
                    <small>{a.ville} {a.cp} · {a.trans === 'L' ? 'Location' : 'Vente'}</small>
                  </td>
                  <td>{a.prix ? `${Number(a.prix).toLocaleString('fr-FR')} €` : '—'}</td>
                  <td>{a.surface ? `${a.surface} m²` : '—'}</td>
                  <td>{a.pieces || '—'}</td>
                  <td>
                    {a.contact?.telephone ? (
                      <a href={`tel:${a.contact.telephone}`}><b>{a.contact.telephone}</b></a>
                    ) : (
                      <em style={{ color: 'var(--muted, #999)' }}>{a.contact?.telStatut === 'indisponible' ? 'Tél indisponible' : '—'}</em>
                    )}
                    {a.contact?.nom ? <><br /><small>{a.contact.nom}</small></> : null}
                  </td>
                  <td>{a.dateParution ? new Date(a.dateParution).toLocaleDateString('fr-FR') : '—'}</td>
                  <td>
                    <a href={a.url} target="_blank" rel="noreferrer">Voir ↗</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {runs.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ margin: '0 0 8px' }}>Dernières collectes</h3>
          <table className="table">
            <thead><tr><th>Date</th><th>Recherche</th><th>Statut</th><th>Reçues</th><th>Nouvelles</th><th>Coût</th><th>Erreur</th></tr></thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.startedAt).toLocaleString('fr-FR')}</td>
                  <td>{r.recherche?.nom || '—'}</td>
                  <td>{r.statut === 'ok' ? '✅' : r.statut === 'error' ? '❌' : '⏳'}</td>
                  <td>{r.annoncesRecues}</td>
                  <td>{r.annoncesNouvelles}</td>
                  <td>{r.coutUsd != null ? `$${Number(r.coutUsd).toFixed(2)}` : '—'}</td>
                  <td style={{ color: '#c00' }}>{r.erreur ? r.erreur.slice(0, 60) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}