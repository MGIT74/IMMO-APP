import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export default function Settings() {
  const [taux, setTaux] = useState(5);
  const [saved, setSaved] = useState(false);
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try { setUsers(await api.get('/api/admin/users')); }
    catch (e) { setError(e.message); }
  };
  useEffect(() => {
    api.getSettings().then(data => setTaux(data.tauxHonoraires)).catch(e => setError(e.message));
    refresh();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    try {
      await api.updateSettings({ tauxHonoraires: Number(taux) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { setError(e.message); }
  }
  async function createUser(e) {
    e.preventDefault(); setError(''); setMessage(''); setBusy(true);
    try {
      await api.post('/api/admin/users', { email, password });
      setEmail(''); setPassword('');
      setMessage('Compte prospecteur créé.');
      await refresh();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function toggleUser(user) {
    setError(''); setMessage('');
    if (!window.confirm(user.active ? 'Désactiver ce prospecteur ?' : 'Réactiver ce prospecteur ?')) return;
    try {
      await api.patch('/api/admin/users/' + user.id, { active: !user.active });
      await refresh();
    } catch (e) { setError(e.message); }
  }

  return (
    <div style={{ maxWidth: 980 }}>
      <h1>Réglages</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="success" role="status">{message}</p>}
      <form onSubmit={handleSave} className="card" style={{ maxWidth: 480, marginBottom: 24 }}>
        <h2>Taux d'honoraires par défaut</h2>
        <p className="muted">Utilisé pour calculer les honoraires estimés sur les biens sans taux personnalisé.</p>
        <label>Taux (%)</label>
        <input type="number" step="0.1" min="0" max="100" value={taux} onChange={e => setTaux(e.target.value)} />
        <button type="submit">Enregistrer</button>
        {saved && <p className="success">Enregistré !</p>}
      </form>
      <section className="card" style={{ padding: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ marginBottom: 6 }}>Utilisateurs et prospecteurs</h2>
          <p className="muted">Les prospecteurs ont accès uniquement à la Pige et à l'Agenda. Les autres modules et réglages leur sont interdits.</p>
        </div>
        <form onSubmit={createUser} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', marginBottom: 26 }}>
          <label style={{ flex: '1 1 230px' }}>Adresse e-mail
            <input type="email" required autoComplete="off" placeholder="prospecteur@exemple.fr" value={email} onChange={e => setEmail(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 6 }} />
          </label>
          <label style={{ flex: '1 1 230px' }}>Mot de passe initial (12 caractères minimum)
            <input type="password" minLength={12} maxLength={128} required autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 6 }} />
          </label>
          <button type="submit" disabled={busy}>{busy ? 'Création…' : '+ Ajouter un prospecteur'}</button>
        </form>
        <h3>Comptes existants</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          {users.map(user => (
            <div key={user.id} style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap', padding: '14px 16px', border: '1px solid #e5e7eb', borderRadius: 12 }}>
              <div>
                <strong>{user.email}</strong>
                <div className="muted" style={{ marginTop: 4 }}>{user.role === 'admin' ? 'Administrateur' : 'Prospecteur'} · {user.active ? 'Actif' : 'Désactivé'}</div>
              </div>
              {user.role === 'prospecteur' && <button type="button" onClick={() => toggleUser(user)}>{user.active ? 'Désactiver' : 'Réactiver'}</button>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
