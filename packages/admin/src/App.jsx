import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { getToken } from './lib/api.js';
import Login from './pages/Login.jsx';
import Biens from './pages/Biens.jsx';
import BienForm from './pages/BienForm.jsx';
import Leads from './pages/Leads.jsx';
import Settings from './pages/Settings.jsx';
import Dashboard from './pages/Dashboard.jsx';

function ProtectedRoute({ children }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return children;
}

function Shell({ children }) {
  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="sidebar-title">Immo Admin</div>
        <NavLink to="/" end>Biens</NavLink>
        <NavLink to="/dashboard">Tableau de bord</NavLink>
        <NavLink to="/leads">Demandes</NavLink>
        <NavLink to="/settings">Réglages</NavLink>
        <button
          className="logout-btn"
          onClick={() => {
            localStorage.removeItem('immo_admin_token');
            window.location.href = '/login';
          }}
        >
          Déconnexion
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
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Shell><Biens /></Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/biens/new"
          element={
            <ProtectedRoute>
              <Shell><BienForm /></Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/biens/:id/edit"
          element={
            <ProtectedRoute>
              <Shell><BienForm /></Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Shell><Dashboard /></Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/leads"
          element={
            <ProtectedRoute>
              <Shell><Leads /></Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Shell><Settings /></Shell>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
