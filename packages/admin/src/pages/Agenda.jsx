import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import './Agenda.css';

const pad = n => String(n).padStart(2, '0');
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const display = d => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
export default function Agenda() {
  const [items, setItems] = useState([]);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(dateKey(new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  async function refresh() {
    setBusy(true); setError('');
    try { const data = await api.get('/api/admin/pige/agenda'); if (!Array.isArray(data)) throw new Error('Réponse API invalide'); setItems(data); }
    catch(e) { setError('Impossible de charger les rappels. Vérifiez que packages/api est bien redéployé sur xCloud (route /api/admin/pige/agenda). Détail : ' + (e.message || 'Erreur réseau')); }
    finally { setBusy(false); }
  }
  useEffect(() => { refresh(); }, []);
  const today = dateKey(new Date());
  const count = items.filter(x => x.rappelAt && dateKey(new Date(x.rappelAt)) === today).length;
  const late = items.filter(x => x.rappelAt && dateKey(new Date(x.rappelAt)) < today).length;
  const upcoming = items.filter(x => x.rappelAt && dateKey(new Date(x.rappelAt)) > today).length;
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (start.getDay() + 6) % 7;
  const days = Array.from({length: 42}, (_,i) => new Date(month.getFullYear(),month.getMonth(),i-offset+1));
  const byDay = useMemo(() => items.reduce((a,x) => { const k = dateKey(new Date(x.rappelAt)); (a[k] ||= []).push(x); return a; },{}), [items]);
  const dayItems = byDay[selected] || [];
  async function save() {
    if (!editing || !date || !time) return;
    setBusy(true);
    try {
      const dt = new Date(`${date}T${time}:00`);
      if (Number.isNaN(dt.getTime())) throw Error('Date invalide');
      await api.patch('/api/admin/pige/annonces/' + editing.id + '/statut', { rappelAt: dt.toISOString() });
      setEditing(null); await refresh();
    } catch(e) { setError(e.message); } finally { setBusy(false); }
  }
  async function clear(x) {
    if (!window.confirm('Marquer ce rappel comme terminé ?')) return;
    setBusy(true);
    try { await api.patch('/api/admin/pige/annonces/' + x.id + '/statut', { rappelAt: null }); await refresh(); }
    catch(e) { setError(e.message); } finally { setBusy(false); }
  }
  function edit(x) { const d = new Date(x.rappelAt); setEditing(x); setDate(dateKey(d)); setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`); }
  return <div className="agenda-page">
    <div className="agenda-heading"><div><span className="agenda-eyebrow">PROSPECTION IMMOBILIÈRE</span><h1>Agenda des rappels</h1><p>Organisez vos prochains appels et ne manquez aucun suivi vendeur.</p></div><button className="agenda-refresh" onClick={refresh} disabled={busy}>↻ Actualiser</button></div>
    <div className="agenda-stats"><div><span>À rappeler aujourd'hui</span><strong>{count}</strong><small>Appels planifiés</small></div><div><span>Rappels en retard</span><strong>{late}</strong><small>À traiter en priorité</small></div><div><span>Rappels à venir</span><strong>{upcoming}</strong><small>Suivis programmés</small></div></div>
    {error && <div className="agenda-error">{error}</div>}
    <div className="agenda-layout">
      <section className="agenda-calendar"><div className="agenda-month"><h2>{month.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}</h2><div><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}>‹</button><button onClick={()=>{const d=new Date();setMonth(new Date(d.getFullYear(),d.getMonth(),1));setSelected(dateKey(d));}}>Aujourd'hui</button><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}>›</button></div></div><div className="agenda-days">{['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(x=><span key={x}>{x}</span>)}{days.map((d,i)=>{const k=dateKey(d),n=(byDay[k]||[]).length;return <button key={i} className={['agenda-day',d.getMonth()!==month.getMonth()?'muted':'',k===today?'today':'',k===selected?'selected':''].join(' ')} onClick={()=>setSelected(k)}><span>{d.getDate()}</span>{n>0&&<small>{n} appel{n>1?'s':''}</small>}</button>})}</div></section>
      <section className="agenda-side"><div className="agenda-side-title"><span>Rappels du {new Date(selected+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long'})}</span><strong>{dayItems.length}</strong></div>{dayItems.length===0?<div className="agenda-empty"><span>☏</span><h3>Aucun appel prévu</h3><p>Les rappels ajoutés depuis les annonces Pige apparaîtront ici.</p></div>:<div className="agenda-calls">{dayItems.map(x=><article key={x.id} className="agenda-call"><div className="agenda-call-time">{display(x.rappelAt)}</div><h3>{x.contact?.nom||'Contact vendeur'}</h3><p>{x.titre||'Annonce immobilière'} · {x.ville||'Ville inconnue'}</p>{x.noteMemo&&<p className="agenda-note">{x.noteMemo}</p>}<div className="agenda-actions">{x.contact?.telephone&&<a href={'tel:'+x.contact.telephone}>☎ Appeler</a>}<Link to={'/pige?annonce='+x.id}>Voir la pige</Link><button onClick={()=>edit(x)}>Reporter</button><button onClick={()=>clear(x)}>Terminé</button></div></article>)}</div>}</section>
    </div>
    {editing&&<div className="agenda-overlay" onClick={()=>setEditing(null)}><div className="agenda-modal" onClick={e=>e.stopPropagation()}><h2>Reporter le rappel</h2><p>{editing.titre}</p><label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Heure<input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label><div className="agenda-modal-actions"><button onClick={()=>setEditing(null)}>Annuler</button><button onClick={save} disabled={busy}>Enregistrer</button></div></div></div>}
  </div>;
}
