import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { MiniIcon, PATHS } from '../lib/icons.jsx';

const STATUTS = [
  { key: 'nouveau', label: 'Nouveau', color: '#6366f1' },
  { key: 'a_contacter', label: 'À contacter', color: '#f59e0b' },
  { key: 'contacte', label: 'Contacté', color: '#8b5cf6' },
  { key: 'interesse', label: 'Intéressé', color: '#10b981' },
  { key: 'visite', label: 'Visite', color: '#0ea5e9' },
  { key: 'offre', label: 'Offre', color: '#f97316' },
  { key: 'archive', label: 'Archivé', color: '#9ca3af' },
];
const statutInfo = (k) => STATUTS.find((s) => s.key === k) || STATUTS[0];

const fmtEur = (n) => (n != null ? Number(n).toLocaleString('fr-FR') + ' €' : '—');

const TYPE_EVT = {
  appel: ['☎', 'Appel'],
  note: ['✎', 'Note'],
  statut: ['↻', 'Statut'],
  suggestion: ['⇄', 'Bien proposé'],
};

/* ---------- Drawer prospect ---------- */
function DrawerProspect({ leadId, onClose, onChanged }) {
  const [l, setL] = useState(null);
  const [note, setNote] = useState('');
  const [budget, setBudget] = useState({ min: '', max: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/api/admin/leads`).then((all) => {
      const found = (all || []).find((x) => x.id === leadId);
      if (found) {
        setL(found);
        setNote(found.noteMemo || '');
        setBudget({ min: found.budgetMin ?? '', max: found.budgetMax ?? '' });
      } else onClose();
    });
  }, [leadId]);

  if (!l) return <div className="drawer"><div className="drawer-panel">Chargement…</div></div>;

  const info = statutInfo(l.statut);

  async function patch(payload) {
    setBusy(true);
    const d = await api.patch(`/api/admin/leads/${l.id}/crm`, payload);
    const refresh = (await api.get(`/api/admin/leads`)).find((x) => x.id === l.id);
    setL(refresh);
    setBusy(false);
    onChanged?.();
  }

  async function addEvt(type) {
    if (type === 'note' && !note.trim()) return;
    setBusy(true);
    if (type === 'note') await api.patch(`/api/admin/leads/${l.id}/crm`, { noteMemo: note });
    await api.post(`/api/admin/leads/${l.id}/evenements`, { type, detail: type === 'note' ? note : undefined });
    const refresh = (await api.get(`/api/admin/leads`)).find((x) => x.id === l.id);
    setL(refresh);
    setBusy(false);
    onChanged?.();
  }

  async function saveBudget() {
    patch({
      budgetMin: budget.min === '' ? null : Number(budget.min),
      budgetMax: budget.max === '' ? null : Number(budget.max),
    });
  }

  return (
    <div className="drawer" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer-panel">
        <button className="drawer-close" onClick={onClose}>✕</button>

        <div className="detail-head">
          <div className="prospect-avatar" style={{ background: info.color + '22', color: info.color }}>
            {l.nom.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div className="detail-head-info">
            <div className="detail-id">Prospect · {new Date(l.createdAt).toLocaleString('fr-FR')}</div>
            <h3>{l.nom}</h3>
            <div className="detail-prix">
              {l.tel && <a href={`tel:${l.tel}`} className="tel-chip">{l.tel}</a>}
              {l.email && <a href={`mailto:${l.email}`} className="tel-chip">{l.email}</a>}
            </div>
          </div>
          <button className={'btn-mini' + (l.estFavori ? ' on' : '')} disabled={busy}
            onClick={() => patch({ estFavori: !l.estFavori })}>{l.estFavori ? '★' : '☆'}</button>
        </div>

        <div className="detail-chips">
          <select value={l.statut} disabled={busy} onChange={(e) => patch({ statut: e.target.value })}>
            {STATUTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <span className="badge-statut" style={{ background: info.color + '22', color: info.color }}>{info.label}</span>
          {l.source && <span className="mini-badge">via {l.source}</span>}
        </div>

        {/* Bien concerné + prix */}
        <div className="card-sec" style={{ margin: '0 0 14px' }}>
          <h4>Bien consulté</h4>
          {l.bien ? (
            <div className="lead-bien-row">
              <div>
                <b>{l.bien.titre}</b>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  {l.bien.ville} · {l.bien.type || '—'} · {l.bien.categorie === 'neuf' ? 'Neuf' : 'Ancien'}
                  {l.bien.surface ? ` · ${l.bien.surface} m²` : ''}
                  {l.bien.pieces ? ` · ${l.bien.pieces} pièces` : ''}
                </div>
              </div>
              <div className="lead-bien-prix">{fmtEur(l.bien.prix)}</div>
            </div>
          ) : (
            <p className="muted">Demande générale (page d'accueil) — pas de bien consulté.</p>
          )}
        </div>

        {/* Budget du prospect */}
        <div className="card-sec" style={{ margin: '0 0 14px' }}>
          <h4>Budget du prospect</h4>
          <div className="budget-row">
            <input type="number" placeholder="Budget min" value={budget.min}
              onChange={(e) => setBudget({ ...budget, min: e.target.value })} />
            <span>→</span>
            <input type="number" placeholder="Budget max" value={budget.max}
              onChange={(e) => setBudget({ ...budget, max: e.target.value })} />
            <button className="btn-mini" disabled={busy} onClick={saveBudget}>Enregistrer</button>
          </div>
        </div>

        {/* Mémo + journal */}
        <div className="card-sec" style={{ marginBottom: 14 }}>
          <h4>Suivi commercial</h4>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
            placeholder="Ex : cherchait T3 Annemasse, flexible sur le quartier, fiancés pour juin…" />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button className="btn-mini" disabled={busy} onClick={() => addEvt('note')}>Enregistrer la note</button>
            <button className="btn-mini" disabled={busy} onClick={() => addEvt('appel')}>Journaliser un appel</button>
            {l.tel && <button className="btn-mini" onClick={() => window.open(`tel:${l.tel}`)}>Appeler {l.tel}</button>}
          </div>
          <div className="pige-journal" style={{ marginTop: 12 }}>
            {l.evenements.map((e) => (
              <div key={e.id} className="pige-journal-row">
                <span className="jevt">{TYPE_EVT[e.type]?.[0] || '•'}</span>
                <div>
                  <div style={{ fontSize: 13 }}><b>{TYPE_EVT[e.type]?.[1] || e.type}</b></div>
                  {e.detail && <div className="muted" style={{ fontSize: 12 }}>{e.detail}</div>}
                  <div className="muted" style={{ fontSize: 11 }}>{new Date(e.createdAt).toLocaleString('fr-FR')}</div>
                </div>
              </div>
            ))}
            {l.evenements.length === 0 && <p className="muted" style={{ padding: '4px 2px' }}>Aucun suivi pour le moment.</p>}
          </div>
        </div>

        {/* Message d'origine */}
        <div className="card-sec">
          <h4>Message d'origine</h4>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7 }}>{l.message || <em className="muted">— aucun message —</em>}</p>
        </div>
      </div>
    </div>
  );
}

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState(null);
  const [filtreStatut, setFiltreStatut] = useState('');
  const [seulementFavoris, setSeulementFavoris] = useState(false);

  async function load() {
    setLoading(true);
    const data = await api.get('/api/admin/leads');
    setLeads(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function supprimer(e, id) {
    e.stopPropagation();
    if (!confirm('Supprimer cette demande définitivement ?')) return;
    await api.delete(`/api/admin/leads/${id}`);
    load();
  }

  const liste = leads.filter((l) => {
    if (filtreStatut && l.statut !== filtreStatut) return false;
    if (seulementFavoris && !l.estFavori) return false;
    return true;
  });

  return (
    <div>
      <h1>Demandes reçues</h1>

      <div className="pige-pipeline">
        {STATUTS.map((s) => (
          <button key={s.key} className={'pige-pipe-btn' + (filtreStatut === s.key ? ' active' : '')}
            onClick={() => setFiltreStatut(filtreStatut === s.key ? '' : s.key)}
            style={{ borderColor: filtreStatut === s.key ? s.color : undefined }}>
            <span className="dot" style={{ background: s.color }}></span>
            {s.label} <b>{leads.filter((l) => l.statut === s.key).length}</b>
          </button>
        ))}
        <label className="pige-pipe-btn" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={seulementFavoris} onChange={(e) => setSeulementFavoris(e.target.checked)} style={{ width: 'auto' }} />
          Favoris <b>{leads.filter((l) => l.estFavori).length}</b>
        </label>
      </div>

      {loading ? (
        <p>Chargement…</p>
      ) : liste.length === 0 ? (
        <p>{leads.length ? 'Aucune demande pour ce filtre.' : 'Aucune demande pour le moment.'}</p>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th></th><th>Prospect</th><th>Contact</th><th>Bien + Prix</th><th>Budget</th><th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {liste.map((l) => {
                const info = statutInfo(l.statut);
                return (
                  <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => setDetailId(l.id)}>
                    <td>
                      <div className="prospect-avatar sm" style={{ background: info.color + '22', color: info.color }}>
                        {l.nom.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                    </td>
                    <td>
                      {l.estFavori ? <span style={{ color: '#f59e0b' }}>★</span> : ''}
                      <b>{l.nom}</b><br />
                      <small className="muted">{new Date(l.createdAt).toLocaleString('fr-FR')}</small>
                    </td>
                    <td>
                      {l.email && <div>{l.email}</div>}
                      {l.tel && <div><b>{l.tel}</b></div>}
                    </td>
                    <td>
                      {l.bien ? (
                        <>
                          <b>{l.bien.titre}</b>
                          <div className="muted" style={{ fontWeight: 700 }}>{fmtEur(l.bien.prix)}</div>
                        </>
                      ) : <em className="muted">Général (accueil)</em>}
                      {l.message && <div className="muted" style={{ fontSize: 12, maxWidth: 220 }}>{l.message.slice(0, 50)}{l.message.length > 50 ? '…' : ''}</div>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {l.budgetMin || l.budgetMax ? (
                        <b>{l.budgetMin ? fmtEur(l.budgetMin) : '—'} → {l.budgetMax ? fmtEur(l.budgetMax) : '∞'}</b>
                      ) : <em className="muted">— non renseigné —</em>}
                    </td>
                    <td>
                      <span className="badge-statut" style={{ background: info.color + '22', color: info.color }}>{info.label}</span>
                    </td>
                    <td className="actions" onClick={(e) => e.stopPropagation()}>
                      <a href={l.tel ? `tel:${l.tel}` : `mailto:${l.email}`}><button type="button">{l.tel ? 'Appeler' : 'Email'}</button></a>
                      <button type="button" onClick={() => setDetailId(l.id)}>Ouvrir</button>
                      <button className="danger" onClick={(e) => supprimer(e, l.id)}>Supprimer</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detailId && <DrawerProspect leadId={detailId} onClose={() => { setDetailId(null); load(); }} onChanged={load} />}
    </div>
  );
}