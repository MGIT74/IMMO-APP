import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const STATUTS = [
  { key: 'nouveau', label: 'Nouveau', color: '#3b82f6' },
  { key: 'a_contacter', label: 'À contacter', color: '#f59e0b' },
  { key: 'contacte', label: 'Contacté', color: '#8b5cf6' },
  { key: 'interesse', label: 'Intéressé', color: '#10b981' },
  { key: 'negocie', label: 'Négociation', color: '#f97316' },
  { key: 'archive', label: 'Archivé', color: '#9ca3af' },
];
const statutInfo = (k) => STATUTS.find((s) => s.key === k) || STATUTS[0];

function fmtEur(n) {
  return n != null ? Number(n).toLocaleString('fr-FR') + ' €' : '—';
}

/* ---------- Graphique d'évolution des prix (SVG pur, sans lib) ---------- */
function GraphePrix({ historique, prixInitial }) {
  const points = [
    ...(prixInitial && historique.length && historique[0].prix !== prixInitial
      ? [{ prix: prixInitial, date: null }]
      : []),
    ...historique.map((h) => ({ prix: h.prix, date: h.date })),
  ];
  if (points.length < 2) {
    return (
      <div className="graphe-vide">
        <p style={{ color: 'var(--muted, #888)', fontSize: 13, margin: 0 }}>
          {points.length === 1 ? 'Un seul relevé de prix pour le moment — le graphe apparaîtra au prochain changement de prix.' : 'Pas encore de relevé de prix.'}
        </p>
      </div>
    );
  }
  const W = 560, H = 160, P = { l: 56, r: 12, t: 12, b: 22 };
  const prixMin = Math.min(...points.map((p) => p.prix));
  const prixMax = Math.max(...points.map((p) => p.prix));
  const span = Math.max(prixMax - prixMin, prixMax * 0.02, 1);
  const yMin = prixMin - span * 0.08;
  const yMax = prixMax + span * 0.08;
  const x = (i) => P.l + (i * (W - P.l - P.r)) / (points.length - 1);
  const y = (v) => P.t + (1 - (v - yMin) / (yMax - yMin)) * (H - P.t - P.b);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.prix).toFixed(1)}`).join(' ');
  const area = `${path} L${x(points.length - 1).toFixed(1)},${H - P.b} L${x(0).toFixed(1)},${H - P.b} Z`;
  const baisse = points[points.length - 1].prix < points[0].prix;
  const couleur = baisse ? '#10b981' : '#ef4444';
  return (
    <div className="graphe-prix">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        <defs>
          <linearGradient id="gpGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={couleur} stopOpacity="0.18" />
            <stop offset="100%" stopColor={couleur} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={P.l} x2={W - P.r} y1={P.t + f * (H - P.t - P.b)} y2={P.t + f * (H - P.t - P.b)}
            stroke="#e5e7eb" strokeDasharray="3,3" />
        ))}
        <text x={4} y={y(yMax) + 4} fontSize="10" fill="#9ca3af">{(yMax / 1000).toFixed(0)}k</text>
        <text x={4} y={y(yMin) + 4} fontSize="10" fill="#9ca3af">{(yMin / 1000).toFixed(0)}k</text>
        <path d={area} fill="url(#gpGrad)" />
        <path d={path} fill="none" stroke={couleur} strokeWidth="2" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.prix)} r="3.2" fill="#fff" stroke={couleur} strokeWidth="2" />
            <title>{`${fmtEur(p.prix)}${p.date ? ' · ' + new Date(p.date).toLocaleDateString('fr-FR') : ' (initial)'}`}</title>
          </g>
        ))}
        <text x={x(0)} y={H - 6} fontSize="10" fill="#9ca3af">début</text>
        <text x={W - P.r} y={H - 6} fontSize="10" fill="#9ca3af" textAnchor="end">maintenant</text>
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 2 }}>
        <span>Prix initial : <b>{fmtEur(points[0].prix)}</b></span>
        <span style={{ color: couleur, fontWeight: 700 }}>
          {baisse ? '▼' : '▲'} {fmtEur(Math.abs(points[points.length - 1].prix - points[0].prix))}
          {' '}({(((points[points.length - 1].prix - points[0].prix) / points[0].prix) * 100).toFixed(1)} %)
        </span>
      </div>
    </div>
  );
}

const TYPE_EVT_LABEL = {
  creation: ['📥', 'Collectée'],
  republication: ['🔁', 'Republiée'],
  baisse_prix: ['📉', 'Baisse de prix'],
  hausse_prix: ['📈', 'Hausse de prix'],
  tel_obtenu: ['📞', 'Téléphone obtenu'],
  appel: ['☎️', 'Appel'],
  note: ['📝', 'Note'],
  statut: ['🔄', 'Statut'],
};

/* ---------- Drawer détail annonce ---------- */
function DetailAnnonce({ annonceId, onClose, onChanged }) {
  const [a, setA] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/api/admin/pige/annonces/${annonceId}`).then((d) => {
      setA(d);
      setNote(d.noteMemo || '');
    });
  }, [annonceId]);

  if (!a) return <div className="drawer">Chargement…</div>;

  const info = statutInfo(a.statut);

  async function majStatut(statut) {
    setBusy(true);
    const d = await api.patch(`/api/admin/pige/annonces/${annonceId}/statut`, { statut });
    setA({ ...a, ...d });
    setBusy(false);
    onChanged?.();
  }

  async function saveNote() {
    if (!note.trim()) return;
    setBusy(true);
    await api.patch(`/api/admin/pige/annonces/${annonceId}/statut`, { noteMemo: note });
    await api.post(`/api/admin/pige/annonces/${annonceId}/evenements`, { type: 'note', detail: note });
    const d = await api.get(`/api/admin/pige/annonces/${annonceId}`);
    setA(d);
    setBusy(false);
    onChanged?.();
  }

  async function journaliserAppel() {
    setBusy(true);
    await api.post(`/api/admin/pige/annonces/${annonceId}/evenements`, { type: 'appel', detail: note || 'Appel téléphonique' });
    const d = await api.get(`/api/admin/pige/annonces/${annonceId}`);
    setA(d);
    setBusy(false);
    onChanged?.();
  }

  async function toggleFavori() {
    const d = await api.patch(`/api/admin/pige/annonces/${annonceId}/statut`, { estFavori: !a.estFavori });
    setA({ ...a, ...d });
    onChanged?.();
  }

  return (
    <div className="drawer" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer-panel">
        <button className="drawer-close" onClick={onClose}>✕</button>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          {a.photoUrl && <img src={a.photoUrl} alt="" style={{ width: 128, height: 96, objectFit: 'cover', borderRadius: 8 }} />}
          <div>
            <h3 style={{ margin: '0 0 4px' }}>{a.titre || a.typeBien || 'Annonce'}</h3>
            <div className="muted" style={{ fontSize: 13 }}>
              {a.ville} {a.cp} · {a.trans === 'L' ? 'Location' : 'Vente'} · {a.typeBien || '—'}
              <br />{a.surface ? `${a.surface} m²` : '—'} · {a.pieces || '—'} pièces {a.chambres ? `· ${a.chambres} ch.` : ''}
            </div>
            <div style={{ marginTop: 6 }}>
              <b style={{ fontSize: 18 }}>{fmtEur(a.prix)}</b>
              {a.prixInitial != null && a.prix != null && a.prix !== a.prixInitial && (
                <span style={{ marginLeft: 8, color: a.prix < a.prixInitial ? '#10b981' : '#ef4444', fontWeight: 700, fontSize: 13 }}>
                  {a.prix < a.prixInitial ? '▼' : '▲'} vs initial {fmtEur(a.prixInitial)}
                </span>
              )}
            </div>
            {a.nbRepubs > 0 && <span className="badge-repub">🔁 Republiée {a.nbRepubs}x</span>}
          </div>
        </div>

        {/* Statut + favori */}
        <div className="pige-crm-row">
          <select value={a.statut} disabled={busy} onChange={(e) => majStatut(e.target.value)}>
            {STATUTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <button className={a.estFavori ? 'btn-favori-on' : ''} onClick={toggleFavori}>{a.estFavori ? '★ Favori' : '☆ Favori'}</button>
        </div>
        <span className="badge-statut" style={{ background: info.color + '22', color: info.color }}>{info.label}</span>

        {/* Contact */}
        <div className="card" style={{ margin: '12px 0', padding: 10 }}>
          <h4 style={{ margin: '0 0 6px' }}>Vendeur</h4>
          {a.contact?.telephone ? (
            <a href={`tel:${a.contact.telephone}`} style={{ fontWeight: 700, fontSize: 15 }}>{a.contact.telephone}</a>
          ) : <em style={{ color: '#999' }}>Téléphone non disponible</em>}
          {a.contact?.nom && <div className="muted" style={{ fontSize: 13 }}>{a.contact.nom}</div>}
        </div>

        {/* Graphique prix */}
        <div className="card" style={{ padding: 10, marginBottom: 12 }}>
          <h4 style={{ margin: '0 0 6px' }}>Évolution du prix</h4>
          <GraphePrix historique={a.prixHistorique} prixInitial={a.prixInitial} />
        </div>

        {/* Mémo */}
        <div style={{ marginBottom: 12 }}>
          <h4 style={{ margin: '0 0 6px' }}>Mémo</h4>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
            placeholder="Ex : a appelé le 5/10, rappeler le 12 — veut vendre vite…" style={{ width: '100%' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button disabled={busy} onClick={saveNote}>💾 Enregistrer la note</button>
            <button disabled={busy} onClick={journaliserAppel}>☎️ Journaliser un appel</button>
          </div>
        </div>

        {/* Journal */}
        <div>
          <h4 style={{ margin: '0 0 6px' }}>Journal ({a.evenements.length})</h4>
          <div className="pige-journal">
            {a.evenements.map((e) => (
              <div key={e.id} className="pige-journal-row">
                <span>{TYPE_EVT_LABEL[e.type]?.[0] || '•'}</span>
                <div>
                  <div style={{ fontSize: 13 }}><b>{TYPE_EVT_LABEL[e.type]?.[1] || e.type}</b>{e.valeur != null ? ` : ${fmtEur(e.valeur)}` : ''}</div>
                  {e.detail && <div className="muted" style={{ fontSize: 12 }}>{e.detail}</div>}
                  <div className="muted" style={{ fontSize: 11 }}>{new Date(e.createdAt).toLocaleString('fr-FR')}</div>
                </div>
              </div>
            ))}
            {a.evenements.length === 0 && <p className="muted">Aucun événement.</p>}
          </div>
        </div>

        <a href={a.url} target="_blank" rel="noreferrer" className="pige-lien-source">Voir l'annonce sur {a.source} ↗</a>
      </div>
    </div>
  );
}

function IconRun() { return <span>▶</span>; }

export default function Pige() {
  const [annonces, setAnnonces] = useState([]);
  const [recherches, setRecherches] = useState([]);
  const [stats, setStats] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyRun, setBusyRun] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [filtres, setFiltres] = useState({ q: '', cp: '', prixMax: '', surfMin: '', trans: '', statut: '', avecTel: false, repub: false, favori: false });
  const [nouvelleRech, setNouvelleRech] = useState({ nom: '', location: 'Saint-Julien-en-Genevois 74160', adLimit: 100 });

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtres.q) params.set('q', filtres.q);
    if (filtres.cp) params.set('cp', filtres.cp);
    if (filtres.prixMax) params.set('prixMax', filtres.prixMax);
    if (filtres.surfMin) params.set('surfMin', filtres.surfMin);
    if (filtres.trans) params.set('trans', filtres.trans);
    if (filtres.statut) params.set('statut', filtres.statut);
    if (filtres.avecTel) params.set('avecTel', '1');
    if (filtres.repub) params.set('repub', '1');
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

  async function majStatutRapide(id, statut) {
    await api.patch(`/api/admin/pige/annonces/${id}/statut`, { statut });
    load();
  }

  return (
    <div>
      <div className="page-header">
        <h1>Pige — annonces particuliers (CRM)</h1>
      </div>

      {stats && (
        <div className="pige-stats">
          <div className="pige-stat"><b>{stats.totalAnnonces}</b><span>annonces</span></div>
          <div className="pige-stat"><b>{stats.avecTelephone}</b><span>avec téléphone</span></div>
          <div className="pige-stat"><b>{stats.nouveaux7j}</b><span>nouvelles (7j)</span></div>
          <div className="pige-stat"><b>{stats.republicees}</b><span>republiées</span></div>
          <div className="pige-stat"><b>{stats.baisses7j}</b><span>baisses prix 7j</span></div>
          <div className="pige-stat"><b>${Number(stats.coutTotalUsd).toFixed(2)}</b><span>coût Apify</span></div>
        </div>
      )}

      {/* Pipeline par statut */}
      {stats?.parStatut && (
        <div className="pige-pipeline">
          {STATUTS.map((s) => (
            <button key={s.key} className={'pige-pipe-btn' + (filtres.statut === s.key ? ' active' : '')}
              onClick={() => { setFiltres({ ...filtres, statut: filtres.statut === s.key ? '' : s.key }); setTimeout(load, 0); }}
              style={{ borderColor: stats.parStatut[s.key] ? s.color : undefined }}>
              <span className="dot" style={{ background: s.color }}></span>
              {s.label}
              <b>{stats.parStatut[s.key] || 0}</b>
            </button>
          ))}
          {filtres.statut && <button className="pige-pipe-btn clear" onClick={() => { setFiltres({ ...filtres, statut: '' }); setTimeout(load, 0); }}>✕ Tout</button>}
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
        <label style={{ fontSize: 13 }}><input type="checkbox" checked={filtres.avecTel} onChange={(e) => setFiltres({ ...filtres, avecTel: e.target.checked })} /> Avec tél.</label>
        <label style={{ fontSize: 13 }}><input type="checkbox" checked={filtres.repub} onChange={(e) => setFiltres({ ...filtres, repub: e.target.checked })} /> Republiées</label>
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
              <tr><th></th><th>Bien</th><th>Prix</th><th>Surface</th><th>Statut</th><th>Contact</th><th>Publié le</th><th>Lien</th></tr>
            </thead>
            <tbody>
              {annonces.map((a) => {
                const info = statutInfo(a.statut);
                return (
                  <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => setDetailId(a.id)}>
                    <td>{a.photoUrl ? <img src={a.photoUrl} alt="" style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 6 }} /> : ''}</td>
                    <td>
                      <b>{a.estFavori ? '★ ' : ''}{a.titre || a.typeBien || 'Annonce'}</b>
                      {a.nbRepubs > 0 && <span className="badge-repub" title="Annonce republicée">🔁 {a.nbRepubs}</span>}
                      {a.prixHistorique?.length > 0 && <span className="badge-prix" title="Le prix a changé">📉</span>}
                      <br />
                      <small>{a.ville} {a.cp} · {a.trans === 'L' ? 'Location' : 'Vente'}</small>
                    </td>
                    <td>{fmtEur(a.prix)}</td>
                    <td>{a.surface ? `${a.surface} m²` : '—'}</td>
                    <td>
                      <span className="badge-statut" style={{ background: info.color + '22', color: info.color }}>{info.label}</span>
                    </td>
                    <td>
                      {a.contact?.telephone ? (
                        <a href={`tel:${a.contact.telephone}`} onClick={(e) => e.stopPropagation()}><b>{a.contact.telephone}</b></a>
                      ) : (
                        <em style={{ color: 'var(--muted, #999)' }}>{a.contact?.telStatut === 'indisponible' ? 'Tél indisponible' : '—'}</em>
                      )}
                      {a.contact?.nom ? <><br /><small>{a.contact.nom}</small></> : null}
                    </td>
                    <td>{a.dateParution ? new Date(a.dateParution).toLocaleDateString('fr-FR') : '—'}</td>
                    <td>
                      <a href={a.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Voir ↗</a>
                    </td>
                  </tr>
                );
              })}
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

      {detailId && <DetailAnnonce annonceId={detailId} onClose={() => { setDetailId(null); load(); }} onChanged={load} />}
    </div>
  );
}