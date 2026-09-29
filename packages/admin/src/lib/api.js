const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function getToken() {
  return localStorage.getItem('immo_admin_token');
}

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    localStorage.removeItem('immo_admin_token');
    window.location.href = '/login';
    return null;
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Erreur inconnue.');
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  login: (email, password) =>
    fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then((r) => r.json()),

  getBiens: () => request('/api/admin/biens'),
  getBien: (id) => request(`/api/admin/biens/${id}`),
  createBien: (data) => request('/api/admin/biens', { method: 'POST', body: JSON.stringify(data) }),
  updateBien: (id, data) => request(`/api/admin/biens/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBien: (id) => request(`/api/admin/biens/${id}`, { method: 'DELETE' }),
  toggleVendu: (id) => request(`/api/admin/biens/${id}/vendu`, { method: 'PATCH' }),
  togglePublie: (id) => request(`/api/admin/biens/${id}/publie`, { method: 'PATCH' }),

  getLeads: () => request('/api/admin/leads'),

  getSettings: () => request('/api/admin/settings'),
  updateSettings: (data) => request('/api/admin/settings', { method: 'PUT', body: JSON.stringify(data) }),

  uploadPhoto: (bienId, file) => {
    const formData = new FormData();
    formData.append('photo', file);
    return fetch(`${API_URL}/api/admin/uploads/${bienId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    }).then((r) => r.json());
  },
  deletePhoto: (photoId) => request(`/api/admin/uploads/${photoId}`, { method: 'DELETE' }),
  reorderPhotos: (bienId, order) =>
    request(`/api/admin/uploads/${bienId}/order`, { method: 'PUT', body: JSON.stringify({ order }) }),

  uploadPlan: (bienId, file, label) => {
    const formData = new FormData();
    formData.append('plan', file);
    formData.append('label', label || 'Plan');
    return fetch(`${API_URL}/api/admin/uploads/${bienId}/plan`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    }).then((r) => r.json());
  },
  deletePlan: (planId) => request(`/api/admin/uploads/plan/${planId}`, { method: 'DELETE' }),
};

export { API_URL, getToken };
