import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const MODULES = [
  ['biens', 'Biens', 'Catalogue immobilier et fiches des biens'],
  ['dashboard', 'Tableau de bord', 'Statistiques générales'],
  ['demandes', 'Demandes', 'Prospects entrants et CRM'],
  ['pige', 'Pige', 'Annonces et prospection'],
  ['agenda', 'Agenda', 'Suivi des rendez-vous et rappels'],
];
const ROLES = [
  ['agent_commercial', 'Agent commercial'],
  ['prospecteur', 'Prospecteur'],
  ['employe', 'Employé'],
];
const PRESETS = { agent_commercial: ['biens', 'demandes', 'agenda'], prospecteur: ['pige', 'agenda'], employe: ['agenda'] };
const empty = { email: '', password: '', role: 'agent_commercial', menus: PRESETS.agent_commercial };
const field = { display: 'grid', gap: 7, fontWeight: 600, fontSize: 13, color: '#374151' };
const input = { width: '100%', padding: '12px 14px', border: '1px solid #d9dee7', borderRadius: 10, background: '#fff', color: '#111827', boxSizing: 'border-box' };
const panel = { background: '#fff', border: '1px solid #e6e9ef', borderRadius: 16, padding: 24, boxShadow: '0 4px 16px rgba(15,23,42,.025)' };

export default function Settings() {
  const [taux, setTaux] = useState(5);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = async () => setUsers(await api.get('/api/admin/users'));
  useEffect(() => { api.getSettings().then(d => setTaux(d.tauxHonoraires)).catch(e => setError(e.message)); refresh().catch(e => setError(e.message)); }, []);
  const update = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const toggle = key => setForm(f => ({ ...f, menus: f.menus.includes(key) ? f.menus.filter(m => m !== key) : [...f.menus, key] }));
  const reset = () => { setEditing(null); setForm(empty); };
  async function save(e) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (editing) {
        const payload = { role: form.role, menus: form.menus };
        if (form.password) payload.password = form.password;
        await api.patch('/api/admin/users/' + editing, payload);
        setNotice('Permissions de l’utilisateur mises à jour.');
      } else {
        await api.post('/api/admin/users', form);
        setNotice('Nouvel utilisateur créé.');
      }
      reset(); await refresh();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function toggleActive(user) {
    if (!window.confirm(user.active ? 'Désactiver ce compte ?' : 'Réactiver ce compte ?')) return;
    try { await api.patch('/api/admin/users/' + user.id, { active: !user.active }); await refresh(); setNotice('Statut du compte modifié.'); }
    catch (e) { setError(e.message); }
  }
  return <div style={{ maxWidth: 1160, paddingBottom: 60 }}>
    <div style={{ marginBottom: 26 }}>
      <h1 style={{ marginBottom: 6 }}>Réglages</h1>
      <p className="muted" style={{ margin: 0 }}>Paramètres de l’application et gestion des accès de votre équipe.</p>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="success" role="status">{notice}</p>}
    <section style={{ ...panel, marginBottom: 22 }}>
      <h2 style={{ marginTop: 0, fontSize: 19 }}>Paramètres généraux</h2>
      <form onSubmit={async e => { e.preventDefault(); try { await api.updateSettings({ tauxHonoraires: Number(taux) }); setNotice('Taux enregistré.'); } catch (err) { setError(err.message); } }} style={{ display: 'flex', alignItems: 'end', gap: 14, flexWrap: 'wrap' }}>
        <label style={{ ...field, width: 210 }}>Honoraires par défaut (%)
          <input style={input} type="number" step=".1" min="0" max="100" value={taux} onChange={e => setTaux(e.target.value)} />
        </label>
        <button type="submit">Enregistrer</button>
      </form>
    </section>
    <section style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div><h2 style={{ margin: '0 0 6px', fontSize: 21 }}>Gestion des utilisateurs</h2><p className="muted" style={{ margin: 0 }}>Choisissez un rôle et attribuez précisément les menus accessibles.</p></div>
        <span style={{ borderRadius: 99, padding: '8px 12px', background: '#f3f4f6', fontSize: 13 }}>{users.length} compte(s)</span>
      </div>
      <div style={{ border: '1px solid #e6e9ef', borderRadius: 14, padding: 22, marginBottom: 28, background: '#fafbfc' }}>
        <h3 style={{ marginTop: 0 }}>{editing ? 'Modifier les accès' : 'Ajouter un collaborateur'}</h3>
        <form onSubmit={save}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginBottom: 20 }}>
            <label style={field}>Adresse e-mail
              <input style={input} type="email" required disabled={Boolean(editing)} value={form.email} onChange={e => update('email', e.target.value)} placeholder="nom@entreprise.fr" />
            </label>
            <label style={field}>{editing ? 'Nouveau mot de passe (facultatif)' : 'Mot de passe initial'}
              <input style={input} type="password" autoComplete="new-password" minLength={12} maxLength={128} required={!editing} value={form.password} onChange={e => update('password', e.target.value)} placeholder="12 caractères minimum" />
            </label>
            <label style={field}>Rôle
              <select style={input} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value, menus: PRESETS[e.target.value] }))}>
                {ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <div style={{ marginBottom: 12, fontWeight: 700 }}>Menus autorisés <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>— personnalisables pour chaque employé</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))', gap: 10, marginBottom: 20 }}>
            {MODULES.map(([key, label, desc]) => <label key={key} style={{ display: 'flex', gap: 12, alignItems: 'start', border: '1px solid ' + (form.menus.includes(key) ? '#b9c5ff' : '#e5e7eb'), background: form.menus.includes(key) ? '#f1f4ff' : '#fff', padding: 14, borderRadius: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.menus.includes(key)} onChange={() => toggle(key)} style={{ marginTop: 3, accentColor: '#5558e8' }} />
              <span><strong style={{ display: 'block', fontSize: 14 }}>{label}</strong><span className="muted" style={{ fontSize: 12 }}>{desc}</span></span>
            </label>)}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="submit" disabled={busy}>{busy ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : 'Créer le compte'}</button>
            {editing && <button type="button" onClick={reset} style={{ background: '#edf0f4', color: '#222' }}>Annuler</button>}
          </div>
        </form>
      </div>
      <h3 style={{ marginBottom: 14 }}>Membres de l’équipe</h3>
      <div style={{ display: 'grid', gap: 10 }}>
        {users.map(u => <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', padding: '16px 18px', border: '1px solid #e6e9ef', borderRadius: 12 }}>
          <div><strong style={{ fontSize: 14 }}>{u.email}</strong>
            <div className="muted" style={{ fontSize: 12, marginTop: 5 }}>{u.role === 'admin' ? 'Administrateur' : ROLES.find(r => r[0] === u.role)?.[1] || u.role} · {u.active ? 'Actif' : 'Désactivé'} · {u.role === 'admin' ? 'Tous les modules' : (u.menus || []).map(m => MODULES.find(x => x[0] === m)?.[1]).filter(Boolean).join(', ') || 'Aucun menu'}</div>
          </div>
          {u.role !== 'admin' && <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => { setEditing(u.id); setForm({ email: u.email, password: '', role: u.role, menus: u.menus || [] }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ background: '#eef0f5', color: '#1f2937' }}>Modifier</button>
            <button type="button" onClick={() => toggleActive(u)} style={{ background: u.active ? '#fff1f1' : '#e9f8ef', color: u.active ? '#a33' : '#176a38' }}>{u.active ? 'Désactiver' : 'Réactiver'}</button>
          </div>}
        </div>)}
      </div>
    </section>
  </div>;
}
