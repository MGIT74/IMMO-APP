import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { getToken, api } from './lib/api.js';
import { useEffect, useState } from 'react';
import Login from './pages/Login.jsx';
import Biens from './pages/Biens.jsx';
import BienForm from './pages/BienForm.jsx';
import Leads from './pages/Leads.jsx';
import Settings from './pages/Settings.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Pige from './pages/Pige.jsx';
import Agenda from './pages/Agenda.jsx';

function ProtectedRoute({ children, menu = null }) {
  const [account, setAccount] = useState(undefined);
  useEffect(() => {
    if (!getToken()) { setAccount(null); return; }
    api.get('/api/auth/me').then(setAccount).catch(() => setAccount(null));
  }, []);
  if (!getToken() || account === null) return <Navigate to="/login" replace />;
  if (account === undefined) return <div style={{ padding: 32 }}>Chargement du compte…</div>;
  if (menu && !account.menus?.includes(menu)) return <Navigate to={account.menus?.includes('pige') ? '/pige' : account.menus?.includes('agenda') ? '/agenda' : account.menus?.includes('biens') ? '/' : account.menus?.includes('demandes') ? '/leads' : account.menus?.includes('dashboard') ? '/dashboard' : '/no-access'} replace />;
  return typeof children === 'function' ? children(account) : children;
}

function IconBiens() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11 12 4l8 7" /><path d="M6 10v9h12v-9" /><path d="M10 19v-5h4v5" />
    </svg>
  );
}
function IconDashboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}
function IconDemandes() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" />
    </svg>
  );
}
function IconReglages() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}
function IconAgenda() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 15h3"/></svg>; }
function IconLogout() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
    </svg>
  );
}

function Shell({ children, account }) {
  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="sidebar-title">Immo Admin</div>
        {account.menus?.includes('biens') && <NavLink to="/" end><IconBiens /><span>Biens</span></NavLink>}
        {account.menus?.includes('dashboard') && <NavLink to="/dashboard"><IconDashboard /><span>Tableau de bord</span></NavLink>}
        {account.menus?.includes('demandes') && <NavLink to="/leads"><IconDemandes /><span>Demandes</span></NavLink>}
        {account.menus?.includes('pige') && <NavLink to="/pige"><IconDemandes /><span>Pige</span></NavLink>}
        {account.menus?.includes('agenda') && <NavLink to="/agenda"><IconAgenda /><span>Agenda</span></NavLink>}
        {account.menus?.includes('settings') && <NavLink to="/settings"><IconReglages /><span>Réglages</span></NavLink>}
        <button
          className="logout-btn"
          onClick={() => {
            localStorage.removeItem('immo_admin_token');
            window.location.href = '/login';
          }}
        >
          <IconLogout /><span>Déconnexion</span>
        </button>
      </nav>
      <main className="content">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/no-access" element={<div style={{ padding: 32 }}>Aucun menu attribué. Contactez votre administrateur.</div>} />
        <Route
          path="/"
          element={
            <ProtectedRoute menu="biens">{account => <Shell account={account}><Biens /></Shell>}</ProtectedRoute>
          }
        />
        <Route
          path="/biens/new"
          element={
            <ProtectedRoute menu="biens">{account => <Shell account={account}><BienForm /></Shell>}</ProtectedRoute>
          }
        />
        <Route
          path="/biens/:id/edit"
          element={
            <ProtectedRoute menu="biens">{account => <Shell account={account}><BienForm /></Shell>}</ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute menu="dashboard">{account => <Shell account={account}><Dashboard /></Shell>}</ProtectedRoute>
          }
        />
        <Route
          path="/leads"
          element={
            <ProtectedRoute menu="demandes">{account => <Shell account={account}><Leads /></Shell>}</ProtectedRoute>
          }
        />
        <Route
          path="/pige"
          element={
            <ProtectedRoute menu="pige">{account => <Shell account={account}><Pige /></Shell>}</ProtectedRoute>
          }
        />
        <Route path="/agenda" element={<ProtectedRoute menu="agenda">{account => <Shell account={account}><Agenda /></Shell>}</ProtectedRoute>} />
        <Route
          path="/settings"
          element={
            <ProtectedRoute menu="settings">{account => <Shell account={account}><Settings /></Shell>}</ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
