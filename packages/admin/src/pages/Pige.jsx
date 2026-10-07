import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';

const STATUTS = [
  { key: 'nouveau', label: 'Nouveau', color: '#6366f1' },
  { key: 'a_contacter', label: 'À contacter', color: '#f59e0b' },
  { key: 'contacte', label: 'Contacté', color: '#8b5cf6' },
  { key: 'interesse', label: 'Intéressé', color: '#10b981' },
  { key: 'negocie', label: 'Négociation', color: '#f97316' },
  { key: 'archive', label: 'Archivé', color: '#9ca3af' },
];
const statutInfo = (k) => STATUTS.find((s) => s.key === k) || STATUTS[0];

const fmtEur = (n) => (n != null ? Number(n).toLocaleString('fr-FR').replace(/,/g, ' ') + ' €' : '—');
const fmtNum = (n) => (n != null ? Number(n).toLocaleString('fr-FR').replace(/,/g, ' ') : '—');

/* ---------- Sparkline prix (style Dribbble : mini courbe + badge variation) ---------- */
function SparkPrix({ points, h = 44 }) {
  if (!points || points.length < 2) return <span className="spark-flat">— stable</span>;
  const W = 110;
  const vals = points.map((p) => p.prix);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = Math.max(max - min, max * 0.02, 1);
  const x = (i) => (i * W) / (points.length - 1);
  const y = (v) => 4 + (1 - (v - min) / span) * (h - 8);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.prix).toFixed(1)}`).join(' ');
  const area = `${d} L${x(points.length - 1).toFixed(1)},${h} L0,${h} Z`;
  const last = points[points.length - 1].prix, first = points[0].prix;
  const diff = ((last - first) / first) * 100;
  const down = last < first;
  return (
    <div className="spark-wrap">
      <div className="spark-badge" style={down ? { background: '#e8f7ef', color: '#0e9f6e' } : { background: '#fdeeec', color: '#e02d3c' }}>
        {down ? '↓' : '↑'} {Math.abs(diff).toFixed(1)}%
      </div>
      <svg width={W} height={h} viewBox={`0 0 ${W} ${h}`}>
        <defs>
          <linearGradient id={`sg${points.length}${Math.round(first)}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={down ? '#14ca8c' : '#ff6b7a'} stopOpacity="0.25" />
            <stop offset="100%" stopColor={down ? '#14ca8c' : '#ff6b7a'} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#sg${points.length}${Math.round(first)})`} />
        <path d={d} fill="none" stroke={down ? '#14ca8c' : '#ff6b7a'} strokeWidth="1.8" strokeLinejoin="round" />
        <circle cx={x(points.length - 1)} cy={y(last)} r="2.6" fill="#fff" stroke={down ? '#14ca8c' : '#ff6b7a'} strokeWidth="1.6" />
      </svg>
    </div>
  );
}

/* ---------- Graphe détaillé du drawer ---------- */
function GraphePrix({ historique, prixInitial }) {
  const points = [
    ...(prixInitial != null && (!historique.length || historique[0].prix !== prixInitial)
      ? [{ prix: prixInitial, date: null }] : []),
    ...historique.map((h) => ({ prix: h.prix, date: h.date })),
  ];
  if (points.length < 2) {
    return (
      <div className="graphe-vide">
        Prix initial : <b>{fmtEur(prixInitial || historique[0]?.prix)}</b> — le graphe apparaîtra au premier changement de prix.
      </div>
    );
  }
  const W = 560, H = 170, P = { l: 56, r: 14, t: 14, b: 24 };
  const vals = points.map((p) => p.prix);
  const prixMin = Math.min(...vals), prixMax = Math.max(...vals);
  const span = Math.max(prixMax - prixMin, prixMax * 0.02, 1);
  const yMin = prixMin - span * 0.1, yMax = prixMax + span * 0.1;
  const x = (i) => P.l + (i * (W - P.l - P.r)) / (points.length - 1);
  const y = (v) => P.t + (1 - (v - yMin) / (yMax - yMin)) * (H - P.t - P.b);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.prix).toFixed(1)}`).join(' ');
  const area = `${path} L${x(points.length - 1)},${H - P.b} L${x(0)},${H - P.b} Z`;
  const baisse = vals[vals.length - 1] < vals[0];
  const couleur = baisse ? '#10b981' : '#ef4444';
  const diff = ((vals[vals.length - 1] - vals[0]) / vals[0]) * 100;
  return (
    <div className="graphe-prix">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        <defs>
          <linearGradient id="gpGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={couleur} stopOpacity="0.2" />
            <stop offset="100%" stopColor={couleur} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={P.l} x2={W - P.r} y1={P.t + f * (H - P.t - P.b)} y2={P.t + f * (H - P.t - P.b)}
            stroke="#ebeef3" strokeDasharray="4,4" />
        ))}
        <text x={6} y={y(yMax) + 4} fontSize="10" fill="#9aa3b2">{(yMax / 1000).toFixed(0)}k €</text>
        <text x={6} y={y(yMin) + 4} fontSize="10" fill="#9aa3b2">{(yMin / 1000).toFixed(0)}k €</text>
        <path d={area} fill="url(#gpGrad)" />
        <path d={path} fill="none" stroke={couleur} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.prix)} r="3.4" fill="#fff" stroke={couleur} strokeWidth="2" />
            <title>{`${fmtEur(p.prix)}${p.date ? ' · ' + new Date(p.date).toLocaleDateString('fr-FR') : ' (référence)'}`}</title>
          </g>
        ))}
      </svg>
      <div className="graphe-foot">
        <span>Référence : <b>{fmtEur(vals[0])}</b></span>
        <span style={{ color: couleur, fontWeight: 700 }}>
          {baisse ? '▼' : '▲'} {Math.abs(diff).toFixed(1)} % · {fmtEur(Math.abs(vals[vals.length - 1] - vals[0]))}
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

/* ---------- Carte annonce (style Dribbble) ---------- */
function CarteAnnonce({ a, onOpen, onFavori }) {
  const info = statutInfo(a.statut);
  const hist = a.prixHistorique || [];
  const points = a.prixInitial && (!hist.length || hist[0].prix !== a.prixInitial)
    ? [{ prix: a.prixInitial, date: null }, ...hist.map((h) => ({ prix: h.prix, date: h.date }))] : hist;
  const jourDepuisScan = a.dateDernierScan ? Math.floor((Date.now() - new Date(a.dateDernierScan)) / 864e5) : null;

  return (
    <div className="annonce-card" onClick={() => onOpen(a.id)}>
      {a.estFavori && <span className="ribbon ribbon-fav">★</span>}
      <span className={'ribbon ' + (a.estNouveau ? 'ribbon-new' : 'ribbon-publi')}
        style={a.estNouveau ? { background: '#6366f1' } : info.color !== '#9ca3af' ? { background: info.color, opacity: .85 } : { background: '#cbd5e1' }}>
        {a.estNouveau ? 'Nouveau' : info.label}
      </span>
      <div className="annonce-photo">
        {a.photoUrl ? <img src={a.photoUrl} alt="" loading="lazy" /> : <div className="no-photo">🏠</div>}
        {a.photosJson?.length > 1 && <span className="photo-nb">📷 {a.photosJson.length}</span>}
      </div>

      <div className="annonce-main">
        <div className="annonce-head">
          <span className="annonce-id">{a.sourceId || a.id}</span>
          {a.nbRepubs > 0 && <span className="mini-badge repub" title="Republiée plusieurs fois">🔁 {a.nbRepubs}</span>}
          {a.dpe && <span className="mini-badge dpe">{a.dpe}</span>}
          {a.meuble && <span className="mini-badge">Meublé</span>}
        </div>
        <div className="annonce-titre" title={a.titre}>{a.titre || a.typeBien || 'Annonce'}</div>
        <div className="annonce-adresse">
          {a.ville} {a.cp && `· ${a.cp}`}
        </div>
        <div className="annonce-prix">{fmtEur(a.prix)}
          {a.surface ? <span className="m2">{Math.round(a.prix / a.surface).toLocaleString('fr-FR')} €/m²</span> : null}
        </div>
        <div className="annonce-meta">
          {a.surface && <span>▦ {a.surface} m²</span>}
          {a.pieces && <span>⌂ {a.pieces} p.</span>}
          {a.chambres && <span>🛏 {a.chambres}</span>}
          {a.typeBien && <span className="type-chip">{a.typeBien}</span>}
        </div>
        {points.length >= 2 ? (
          <SparkPrix points={points} />
        ) : (
          <div className="annonce-scan muted">
            Collectée le {new Date(a.createdAt).toLocaleDateString('fr-FR')}
            {jourDepuisScan === 0 ? ' · aujourd’hui' : jourDepuisScan != null ? ` · vue il y a ${jourDepuisScan}j` : ''}
          </div>
        )}
      </div>

      <div className="annonce-side">
        <div className="annonce-statuts">
          <span className="pt" style={{ color: info.color }}>● {info.label}</span>
        </div>
        <div className="annonce-contact">
          {a.contact?.telephone ? (
            <a href={`tel:${a.contact.telephone}`} onClick={(e) => e.stopPropagation()}><b>{a.contact.telephone}</b></a>
          ) : <span className="muted">{a.contact?.telStatut === 'non_revele' ? 'Tél non révélé (retry auto)' : 'Tél indisponible'}</span>}
          {a.contact?.nom && <div className="muted" style={{ fontSize: 12 }}>{a.contact.nom}</div>}
        </div>
        <div className="annonce-actions" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => onFavori(a)} className={a.estFavori ? 'btn-mini on' : 'btn-mini'} title="Favori">{a.estFavori ? '★' : '☆'}</button>
          <button onClick={() => onOpen(a.id)} className="btn-mini">Détail</button>
          <a href={a.url} target="_blank" rel="noreferrer" className="btn-mini" title="Voir sur Leboncoin">↗</a>
        </div>
      </div>

      <div className="annonce-foot">
        <span>Créée : {new Date(a.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
        <span>Vu : {a.dateDernierScan ? new Date(a.dateDernierScan).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
        <span className="foot-right">
          {a.parutionJours != null && <>{a.parutionJours}j en ligne ·</>}
          <span className="stat-inline">{a.contact?.telephone ? '📞 OK' : '📵 —'}</span>
          <span className="stat-inline">🔁 {a.nbRepubs || 0}</span>
          <span className="stat-inline">📉 {a.prixHistorique?.length || 0}</span>
        </span>
      </div>
    </div>
  );
}

/* ---------- Drawer détail ---------- */
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

  if (!a) return <div className="drawer"><div className="drawer-panel">Chargement…</div></div>;

  const info = statutInfo(a.statut);

  async function patchStatut(payload) {
    setBusy(true);
    const d = await api.patch(`/api/admin/pige/annonces/${a.id}/statut`, payload);
    const refresh = await api.get(`/api/admin/pige/annonces/${a.id}`);
    setA(refresh);
    setBusy(false);
    onChanged?.();
  }

  async function saveNote() {
    if (!note.trim()) return;
    setBusy(true);
    await api.patch(`/api/admin/pige/annonces/${a.id}/statut`, { noteMemo: note });
    await api.post(`/api/admin/pige/annonces/${a.id}/evenements`, { type: 'note', detail: note });
    setA(await api.get(`/api/admin/pige/annonces/${a.id}`));
    setBusy(false);
    onChanged?.();
  }

  async function journaliserAppel() {
    setBusy(true);
    await api.post(`/api/admin/pige/annonces/${a.id}/evenements`, { type: 'appel', detail: note || 'Appel téléphonique' });
    setA(await api.get(`/api/admin/pige/annonces/${a.id}`));
    setBusy(false);
    onChanged?.();
  }

  return (
    <div className="drawer" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer-panel">
        <button className="drawer-close" onClick={onClose}>✕</button>

        <div className="detail-head">
          {a.photoUrl && <img src={a.photoUrl} alt="" />}
          <div className="detail-head-info">
            <div className="detail-id">{a.sourceId || a.id} · {a.source}</div>
            <h3>{a.titre || a.typeBien || 'Annonce'}</h3>
            <div className="muted">{a.ville} {a.cp} · {a.trans === 'L' ? 'Location' : 'Vente'} · {a.typeBien || '—'}</div>
            <div className="detail-prix">
              <b>{fmtEur(a.prix)}</b>
              {a.surface ? <span>{Math.round(a.prix / a.surface).toLocaleString('fr-FR')} €/m²</span> : null}
              {a.prixInitial != null && a.prix != null && a.prix !== a.prixInitial && (
                <span style={{ color: a.prix < a.prixInitial ? '#10b981' : '#ef4444' }}>
                  {a.prix < a.prixInitial ? '▼' : '▲'} vs {fmtEur(a.prixInitial)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="detail-chips">
          <select value={a.statut} disabled={busy} onChange={(e) => patchStatut({ statut: e.target.value })}>
            {STATUTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <button className={a.estFavori ? 'btn-mini on' : 'btn-mini'} onClick={() => patchStatut({ estFavori: !a.estFavori })}>
            {a.estFavori ? '★ Favori' : '☆ Favori'}
          </button>
          <span className="badge-repub">🔁 Republications : {a.nbRepubs}</span>
          {a.dpe && <span className="mini-badge dpe">DPE {a.dpe}</span>}
        </div>

        <div className="detail-cols">
          <div className="card-sec">
            <h4>Vendeur</h4>
            {a.contact?.telephone ? (
              <a href={`tel:${a.contact.telephone}`} className="tel-big">{a.contact.telephone}</a>
            ) : <em className="muted">Non disponible{a.contact?.telStatut === 'non_revele' ? ' (retry au prochain scan)' : ''}</em>}
            {a.contact?.nom && <div className="muted" style={{ fontSize: 13 }}>{a.contact.nom}</div>}
          </div>
          <div className="card-sec">
            <h4>Descriptif</h4>
            <div className="detail-specs">
              <div><span>Surface</span><b>{a.surface ? a.surface + ' m²' : '—'}</b></div>
              <div><span>Pièces</span><b>{a.pieces || '—'}</b></div>
              <div><span>Chambres</span><b>{a.chambres || '—'}</b></div>
              <div><span>Étage</span><b>{a.etage || '—'}</b></div>
              <div><span>DPE / GES</span><b>{a.dpe || '—'} / {a.ges || '—'}</b></div>
              <div><span>Parution</span><b>{a.dateParution ? new Date(a.dateParution).toLocaleDateString('fr-FR') : '—'}</b></div>
            </div>
          </div>
        </div>

        <div className="card-sec" style={{ margin: '14px 0' }}>
          <h4>Évolution du prix</h4>
          <GraphePrix historique={a.prixHistorique || []} prixInitial={a.prixInitial} />
        </div>

        <div className="card-sec" style={{ marginBottom: 14 }}>
          <h4>Mémo commercial</h4>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
            placeholder="Ex : appelé le 5/10, rappeler le 12 — vendeur pressé, discutable à -5%…" />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button className="btn-mini" disabled={busy} onClick={saveNote}>💾 Enregistrer la note</button>
            <button className="btn-mini" disabled={busy} onClick={journaliserAppel}>☎️ Journaliser un appel</button>
            {a.contact?.telephone && (
              <button className="btn-mini" disabled={busy} onClick={() => patchStatut({ statut: 'contacte' })}>
                ✅ Marquer contacté
              </button>
            )}
          </div>
        </div>

        <div className="card-sec">
          <h4>Journal ({a.evenements.length})</h4>
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

/* ---------- Toast / pop-up élégant ---------- */
function Toast({ toast, onClose }) {
  if (!toast) return null;
  const isError = toast.type === 'error';
  return (
    <div className="toast-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'toast-box' + (isError ? ' toast-err' : ' toast-ok')} role="alert">
        <div className="toast-icon">{isError ? '⚠️' : '✅'}</div>
        <div className="toast-body">
          <b>{isError ? 'Une erreur est survenue' : 'Succès'}</b>
          <p>{toast.msg}</p>
        </div>
        <button className="toast-btn" onClick={onClose}>OK</button>
      </div>
    </div>
  );
}

export default function Pige() {
  const [annonces, setAnnonces] = useState([]);
  const [recherches, setRecherches] = useState([]);
  const [stats, setStats] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyRun, setBusyRun] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [toast, setToast] = useState(null);
  const [tri, setTri] = useState('dateParution');
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filtres, setFiltres] = useState({ q: '', cp: '', prixMax: '', surfMin: '', trans: '', statut: '', avecTel: false, repub: false });
  const [nouvelleRech, setNouvelleRech] = useState({ nom: '', location: 'Saint-Julien-en-Genevois', rayonKm: 20, adLimit: 100 });
  const [zoneCommunes, setZoneCommunes] = useState([]);
  const [zoneSelection, setZoneSelection] = useState([]);
  const [zoneLoading, setZoneLoading] = useState(false);

  async function load(pageArgs = page) {
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
    params.set('page', String(pageArgs));
    params.set('perPage', String(perPage));
    const data = await api.get(`/api/admin/pige/annonces?${params.toString()}`);
    setAnnonces((data && data.annonces) || []);
    setTotal(data?.total || 0);
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

  useEffect(() => { load(page); }, [page, perPage]);

  function changerPerPage(n) {
    setPerPage(n);
    setPage(1);
  }

  const nbPages = Math.max(1, Math.ceil(total / perPage));

  const listeTriee = useMemo(() => {
    const arr = [...annonces];
    const cmp = {
      prix: (a, b) => (a.prix || 0) - (b.prix || 0),
      prixDesc: (a, b) => (b.prix || 0) - (a.prix || 0),
      surface: (a, b) => (b.surface || 0) - (a.surface || 0),
      repub: (a, b) => (b.nbRepubs || 0) - (a.nbRepubs || 0),
      dateParution: (a, b) => new Date(b.dateParution || 0) - new Date(a.dateParution || 0),
      createdAt: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    }[tri];
    return cmp ? arr.sort(cmp) : arr;
  }, [annonces, tri]);

  async function appliquerFiltres() {
    setPage(1);
    await load(1);
  }

  function allerPage(p) {
    if (p < 1 || p > nbPages || p === page) return;
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function lancerRecherche(id) {
    setBusyRun(id);
    setToast(null);
    try {
      const result = await api.post(`/api/admin/pige/recherches/${id}/run`);
      setToast({
        type: 'ok',
        msg: `Collecte terminée : ${result?.total ?? 0} annonce(s) traitée(s), ${result?.nouveaux ?? 0} nouvelle(s), ${result?.maj ?? 0} mise(s) à jour, ${result?.telephones ?? 0} numéro(s) obtenu(s).`,
      });
      await load();
    } catch (e) {
      setToast({ type: 'error', msg: e.message });
    }
    setBusyRun(null);
  }

  async function chargerZone() {
    if (!nouvelleRech.location.trim()) return;
    setZoneLoading(true);
    try {
      const d = await api.get('/api/admin/pige/zone-communes?nom=' + encodeURIComponent(nouvelleRech.location) + '&rayonKm=' + Number(nouvelleRech.rayonKm || 20));
      setZoneCommunes(d.communes || []);
      setZoneSelection((d.communes || []).map((c) => c.code));
      if (!nouvelleRech.nom) setNouvelleRech((x) => ({ ...x, nom: (d.centre?.nom || x.location) + ' +' + d.rayonKm + ' km' }));
    } catch (err) {
      setToast({ type: 'error', msg: err.message });
    }
    setZoneLoading(false);
  }

  function toggleCommune(code) {
    setZoneSelection((s) => s.includes(code) ? s.filter((x) => x !== code) : [...s, code]);
  }

  async function creerRecherche(e) {
    e.preventDefault();
    try {
      await api.post('/api/admin/pige/recherches', {
        nom: nouvelleRech.nom,
        source: 'leboncoin',
        apifyInput: {
          city: nouvelleRech.location,
          owner_type: 'private',
          only_with_phone: true,
          max_items: Number(nouvelleRech.adLimit) || 100,
          centre: nouvelleRech.location,
          rayonKm: Number(nouvelleRech.rayonKm) || 20,
          communes: zoneCommunes.filter((c) => zoneSelection.includes(c.code)).map((c) => ({ code: c.code, nom: c.nom, codesPostaux: c.codesPostaux, distanceKm: c.distanceKm })),
          codesPostaux: [...new Set(zoneCommunes.filter((c) => zoneSelection.includes(c.code)).flatMap((c) => c.codesPostaux || []))],
        },
      });
      setToast({ type: 'ok', msg: `Recherche « ${nouvelleRech.nom} » créée. Elle sera exécutée par le cron n8n 3x/jour.` });
      setNouvelleRech({ nom: '', location: 'Saint-Julien-en-Genevois', rayonKm: 20, adLimit: 100 });
      setZoneCommunes([]);
      setZoneSelection([]);
      load();
    } catch (err) {
      setToast({ type: 'error', msg: err.message });
    }
  }

  async function toggleFavori(a) {
    const d = await api.patch(`/api/admin/pige/annonces/${a.id}/statut`, { estFavori: !a.estFavori });
    setAnnonces(annonces.map((x) => (x.id === a.id ? { ...x, estFavori: d.estFavori } : x)));
  }

  return (
    <div>
      <div className="page-header pige-header">
        <h1>Propriétés surveillées</h1>
        <div className="pige-header-actions">
          <input className="pige-search" placeholder="Rechercher par ville, titre…" value={filtres.q}
            onChange={(e) => setFiltres({ ...filtres, q: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && load()} />
          <button className="btn-light" onClick={load}>⌕Filtrer</button>
          <button className="btn-light" onClick={() => window.open('/api/admin/pige/annonces-export?' + new URLSearchParams(
            Object.entries({ ...filtres }).filter(([k, v]) => v && k !== 'avecTel').map(([k, v]) => [k, v === false ? '' : v])
          ).toString(), '_blank')}>⬇ Export CSV</button>
          <button className="btn-primary-c" onClick={load}>＋ Actualiser</button>
        </div>
      </div>

      {/* Top stats style Dribbble : 3 cartes avec mini-barres */}
      {stats && (
        <div className="stat-cards pige-top">
          <div className="stat-card top-card">
            <div className="top-card-head"><span>Annonces suivies</span><b>{stats.totalAnnonces}</b></div>
            <div className="top-card-body">
              <MiniBarres data={[
                { label: 'Favoris', v: stats.parStatut ? Object.values(stats.parStatut).reduce((s, x) => s + x, 0) : 0, color: '#6366f1' },
                { label: 'Avec tél.', v: stats.avecTelephone, color: '#10b981' },
                { label: 'Republiées', v: stats.republicees, color: '#f59e0b' },
              ]} />
              <div className="top-list">
                {STATUTS.map((st) => (
                  <div key={st.key} className="top-list-row" style={{ cursor: 'pointer' }}
                    onClick={() => setFiltres({ ...filtres, statut: filtres.statut === st.key ? '' : st.key })}>
                    <span className="dot" style={{ background: st.color }}></span>
                    {st.label} <b style={{ marginLeft: 'auto' }}>{stats.parStatut?.[st.key] || 0}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="stat-card top-card">
            <div className="top-card-head"><span>Opportunités</span><b>{(stats.baisses7j || 0) + (stats.republicees || 0)}</b></div>
            <div className="top-card-body">
              <MiniBarres data={[
                { label: 'Baisses prix (7j)', v: stats.baisses7j || 0, color: '#10b981' },
                { label: 'Republiées', v: stats.republicees || 0, color: '#f59e0b' },
                { label: 'Nouvelles (7j)', v: stats.nouveaux7j || 0, color: '#6366f1' },
              ]} />
              <div className="top-list">
                <div className="top-list-row"><span className="dot" style={{ background: '#10b981' }}></span>Baisse de prix 7j <b style={{ marginLeft: 'auto' }}>{stats.baisses7j || 0}</b></div>
                <div className="top-list-row"><span className="dot" style={{ background: '#f59e0b' }}></span>Annonces republiées <b style={{ marginLeft: 'auto' }}>{stats.republicees || 0}</b></div>
                <div className="top-list-row"><span className="dot" style={{ background: '#6366f1' }}></span>Nouvelles 7j <b style={{ marginLeft: 'auto' }}>{stats.nouveaux7j || 0}</b></div>
              </div>
            </div>
          </div>
          <div className="stat-card top-card">
            <div className="top-card-head"><span>Téléphones & coûts</span><b>{stats.avecTelephone}</b></div>
            <div className="top-card-body">
              <MiniBarres data={[
                { label: 'Téléphones', v: stats.avecTelephone, color: '#10b981' },
                { label: 'Sans tél', v: (stats.totalAnnonces || 0) - (stats.avecTelephone || 0), color: '#e5e7eb' },
                { label: 'Runs', v: (runs && runs.length) || 0, color: '#8b5cf6' },
              ]} />
              <div className="top-list">
                <div className="top-list-row"><span className="dot" style={{ background: '#10b981' }}></span>Avec téléphone <b style={{ marginLeft: 'auto' }}>{stats.avecTelephone}</b></div>
                <div className="top-list-row"><span className="dot" style={{ background: '#9aa3b2' }}></span>Coût Apify <b style={{ marginLeft: 'auto' }}>${Number(stats.coutTotalUsd).toFixed(2)}</b></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline cliquable */}
      {stats?.parStatut && (
        <div className="pige-pipeline">
          {STATUTS.map((s) => (
            <button key={s.key} className={'pige-pipe-btn' + (filtres.statut === s.key ? ' active' : '')}
              onClick={() => setFiltres({ ...filtres, statut: filtres.statut === s.key ? '' : s.key })}
              style={{ borderColor: filtres.statut === s.key ? s.color : undefined }}>
              <span className="dot" style={{ background: s.color }}></span>
              {s.label} <b>{stats.parStatut[s.key] || 0}</b>
            </button>
          ))}
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
        <form onSubmit={creerRecherche} style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input placeholder="Nom (ex: Genevois ventes)" value={nouvelleRech.nom} required
              onChange={(e) => setNouvelleRech({ ...nouvelleRech, nom: e.target.value })} style={{ flex: '1 1 160px' }} />
            <input placeholder="Commune centrale" value={nouvelleRech.location} required
              onChange={(e) => setNouvelleRech({ ...nouvelleRech, location: e.target.value })} style={{ flex: '2 1 220px' }} />
            <label style={{ fontSize: 13 }}>Rayon
              <select value={nouvelleRech.rayonKm} onChange={(e) => setNouvelleRech({ ...nouvelleRech, rayonKm: Number(e.target.value) })} style={{ marginLeft: 6 }}>
                {[10, 15, 20, 25, 30, 40].map((n) => <option key={n} value={n}>{n} km</option>)}
              </select>
            </label>
            <button type="button" onClick={chargerZone} disabled={zoneLoading}>{zoneLoading ? 'Recherche…' : '📍 Trouver les communes'}</button>
            <input type="number" min="10" max="500" placeholder="100" value={nouvelleRech.adLimit}
              onChange={(e) => setNouvelleRech({ ...nouvelleRech, adLimit: e.target.value })} style={{ width: 80 }} title="Nombre maximum d'annonces" />
            <button type="submit" disabled={zoneCommunes.length > 0 && zoneSelection.length === 0}>+ Créer</button>
          </div>
          {zoneCommunes.length > 0 && (
            <div style={{ marginTop: 12, padding: 12, border: '1px solid #e5e7eb', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <b>{zoneSelection.length} commune(s) sélectionnée(s)</b>
                <span className="muted">{[...new Set(zoneCommunes.filter((c) => zoneSelection.includes(c.code)).flatMap((c) => c.codesPostaux || []))].length} code(s) postal(aux)</span>
              </div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', maxHeight: 180, overflow: 'auto' }}>
                {zoneCommunes.map((c) => (
                  <label key={c.code} className="btn-mini" style={{ cursor: 'pointer', display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                    <input type="checkbox" checked={zoneSelection.includes(c.code)} onChange={() => toggleCommune(c.code)} />
                    {c.nom} {c.codesPostaux?.[0] || ''} <span className="muted">· {c.distanceKm} km</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>

      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="CP (ex 74)" value={filtres.cp} size="6" onChange={(e) => setFiltres({ ...filtres, cp: e.target.value })} />
        <input placeholder="Prix max" type="number" value={filtres.prixMax} size="9" onChange={(e) => setFiltres({ ...filtres, prixMax: e.target.value })} />
        <input placeholder="Surface min" type="number" value={filtres.surfMin} size="7" onChange={(e) => setFiltres({ ...filtres, surfMin: e.target.value })} />
        <select value={filtres.trans} onChange={(e) => setFiltres({ ...filtres, trans: e.target.value })}>
          <option value="">Vente & Location</option>
          <option value="V">Vente</option>
          <option value="L">Location</option>
        </select>
        <select value={tri} onChange={(e) => setTri(e.target.value)}>
          <option value="createdAt">Plus récentes collectées</option>
          <option value="dateParution">Plus récentes publiées</option>
          <option value="prix">Prix croissant</option>
          <option value="prixDesc">Prix décroissant</option>
          <option value="surface">Plus grandes surfaces</option>
          <option value="repub">Plus republicées</option>
        </select>
        <select value={perPage} onChange={(e) => changerPerPage(Number(e.target.value))} title="Lignes par page">
          {[5, 10, 15, 20, 25, 50].map((n) => <option key={n} value={n}>{n} / page</option>)}
        </select>
        <label style={{ fontSize: 13 }}><input type="checkbox" checked={filtres.avecTel} onChange={(e) => setFiltres({ ...filtres, avecTel: e.target.checked })} /> Avec tél.</label>
        <label style={{ fontSize: 13 }}><input type="checkbox" checked={filtres.repub} onChange={(e) => setFiltres({ ...filtres, repub: e.target.checked })} /> Republiées</label>
        <button onClick={appliquerFiltres}>Appliquer</button>
      </div>

      {loading ? (
        <p>Chargement…</p>
      ) : listeTriee.length === 0 ? (
        <div className="card">
          <p>Aucune annonce pour ces critères.</p>
          <p style={{ color: 'var(--muted, #888)' }}>Lance une recherche ou attends le cron n8n 3x/jour.</p>
        </div>
      ) : (
        <>
          <div className="annonces-list">
            {listeTriee.map((a) => (
              <CarteAnnonce key={a.id} a={a} onOpen={setDetailId} onFavori={toggleFavori} />
            ))}
          </div>

          {nbPages > 1 && (
            <div className="pagination">
              <button className="pg-btn" disabled={page === 1} onClick={() => allerPage(page - 1)}>← Précédent</button>
              <div className="pg-pages">
                {Array.from({ length: nbPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === nbPages || Math.abs(p - page) <= 1)
                  .map((p, idx, arr) => (
                    <span key={p} style={{ display: 'inline-flex', alignItems: 'center' }}>
                      {idx > 0 && arr[idx - 1] < p - 1 && <span className="pg-ellipsis">…</span>}
                      <button className={'pg-btn pg-num' + (p === page ? ' current' : '')} onClick={() => allerPage(p)}>{p}</button>
                    </span>
                  ))}
              </div>
              <button className="pg-btn" disabled={page === nbPages} onClick={() => allerPage(page + 1)}>Suivant →</button>
            </div>
          )}
          <div className="pagination-info muted">
            {total} annonce{total > 1 ? 's' : ''} · page {page}/{nbPages}
          </div>
        </>
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
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

/* ---------- Mini barres verticales colorées (style Dribbble top cards) ---------- */
function MiniBarres({ data }) {
  const max = Math.max(...data.map((d) => d.v), 1);
  return (
    <div className="minibars">
      {data.map((d, i) => (
        <div key={i} className="minibar-col">
          <div className="minibar" style={{ height: `${8 + (d.v / max) * 44}px`, background: d.v ? d.color : '#eef1f6' }} title={`${d.label} : ${d.v}`}></div>
        </div>
      ))}
    </div>
  );
}