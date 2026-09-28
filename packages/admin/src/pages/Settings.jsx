import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export default function Settings() {
  const [taux, setTaux] = useState(5);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getSettings().then((data) => setTaux(data.tauxHonoraires));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    await api.updateSettings({ tauxHonoraires: Number(taux) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <h1>Réglages</h1>
      <form onSubmit={handleSave} className="card" style={{ maxWidth: 420 }}>
        <h2>Taux d'honoraires par défaut</h2>
        <p className="muted">
          Utilisé pour calculer les honoraires estimés sur chaque bien qui n'a pas de taux personnalisé.
        </p>
        <label>Taux (%)</label>
        <input type="number" step="0.1" min="0" max="100" value={taux} onChange={(e) => setTaux(e.target.value)} />
        <button type="submit">Enregistrer</button>
        {saved && <p className="success">Enregistré !</p>}
      </form>
    </div>
  );
}
