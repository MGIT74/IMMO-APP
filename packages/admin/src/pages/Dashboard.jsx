import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export default function Dashboard() {
  const [biens, setBiens] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getBiens(), api.getLeads()]).then(([b, l]) => {
      setBiens(b || []);
      setLeads(l || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <p>Chargement...</p>;

  const total = biens.length;
  const vendus = biens.filter((b) => b.vendu).length;
  const tauxVente = total ? Math.round((vendus / total) * 100) : 0;
  const valeurTotale = biens.reduce((s, b) => s + b.prix, 0);
  const valeurDisponible = biens.filter((b) => !b.vendu).reduce((s, b) => s + b.prix, 0);
  const honorairesRealises = biens.filter((b) => b.vendu).reduce((s, b) => s + b.honoraires, 0);
  const honorairesPotentiels = biens.filter((b) => !b.vendu).reduce((s, b) => s + b.honoraires, 0);

  const now = new Date();
  const leadsCeMois = leads.filter((l) => {
    const d = new Date(l.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  // Répartition par état (Vendu prioritaire, sinon etatTexte)
  const etats = {};
  biens.forEach((b) => {
    const label = b.vendu ? 'Vendu' : (b.etatTexte || 'Non renseigné');
    etats[label] = (etats[label] || 0) + 1;
  });

  const fmt = (n) => Number(n).toLocaleString('fr-FR') + ' €';

  return (
    <div>
      <h1>Tableau de bord</h1>

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-label">Biens en ligne</div>
          <div className="stat-value">{total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Biens vendus</div>
          <div className="stat-value">{vendus}</div>
          <div className="muted">{tauxVente}% du portefeuille</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Valeur du portefeuille</div>
          <div className="stat-value">{fmt(valeurTotale)}</div>
          <div className="muted">dont {fmt(valeurDisponible)} disponible</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Honoraires réalisés</div>
          <div className="stat-value">{fmt(honorairesRealises)}</div>
          <div className="muted">+ {fmt(honorairesPotentiels)} potentiels</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Demandes reçues</div>
          <div className="stat-value">{leads.length}</div>
          <div className="muted">{leadsCeMois} ce mois-ci</div>
        </div>
      </div>

      <div className="card">
        <h2>Répartition par état</h2>
        {Object.entries(etats).map(([label, count]) => (
          <div key={label} className="hbar-row">
            <div className="hbar-label">{label}</div>
            <div className="hbar-track"><div className="hbar-fill" style={{ width: `${(count / total) * 100}%` }}></div></div>
            <div className="hbar-count">{count}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Dernières demandes</h2>
        {leads.slice(0, 8).map((lead) => (
          <div key={lead.id} className="lead-row">
            <div>
              <strong>{lead.nom}</strong>
              <div className="muted">{lead.email} {lead.tel}</div>
            </div>
            <div className="muted">{lead.bien?.titre || '—'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
