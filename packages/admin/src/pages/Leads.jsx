import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getLeads().then((data) => {
      setLeads(data || []);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <h1>Demandes reçues</h1>
      {loading ? (
        <p>Chargement...</p>
      ) : leads.length === 0 ? (
        <p>Aucune demande pour le moment.</p>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Nom</th>
                <th>Contact</th>
                <th>Bien concerné</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>{new Date(lead.createdAt).toLocaleString('fr-FR')}</td>
                  <td>{lead.nom}</td>
                  <td>
                    {lead.email && <div>{lead.email}</div>}
                    {lead.tel && <div>{lead.tel}</div>}
                  </td>
                  <td>{lead.bien?.titre || '—'}</td>
                  <td>{lead.message || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
