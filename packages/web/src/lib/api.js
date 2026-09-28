const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:4000';

export async function getBiens() {
  const res = await fetch(`${API_URL}/api/biens`);
  if (!res.ok) return [];
  return res.json();
}

export async function getBien(id) {
  const res = await fetch(`${API_URL}/api/biens/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function envoyerDemande(payload) {
  const res = await fetch(`${API_URL}/api/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function toggleLike(bienId, visitorId) {
  const res = await fetch(`${API_URL}/api/likes/${bienId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId }),
  });
  return res.json();
}

export { API_URL };
