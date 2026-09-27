import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import ThreatIntel from './pages/ThreatIntel.jsx'
import SubmitIoc from './pages/SubmitIoc.jsx'
import Users from './pages/Users.jsx'
import Operations from './pages/Operations.jsx'
import { getCurrentUser, getToken } from './api.js'
import { canAccessModule } from './permissions.js'

function ProtectedRoute({ moduleKey, children }) {
  const location = useLocation()
  const token = getToken()

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  const currentUser = getCurrentUser()
  const role = currentUser?.role || 'Viewer'

  // If this route is restricted to specific roles, check permissions
  if (moduleKey && !canAccessModule(role, moduleKey)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />

      {/* Everyone (Admin, Analyst, Viewer) */}
      <Route path="/dashboard" element={<ProtectedRoute moduleKey="dashboard"><Dashboard /></ProtectedRoute>} />
      <Route path="/threat-intel" element={<ProtectedRoute moduleKey="threat-intel"><ThreatIntel /></ProtectedRoute>} />
      <Route path="/search" element={<ProtectedRoute moduleKey="search"><Operations module="search" /></ProtectedRoute>} />

      {/* Analyst and Admin only */}
      <Route path="/submit-ioc" element={<ProtectedRoute moduleKey="submit-ioc"><SubmitIoc /></ProtectedRoute>} />
      <Route path="/alerts" element={<ProtectedRoute moduleKey="alerts"><Operations module="alerts" /></ProtectedRoute>} />

      {/* Admin only */}
      <Route path="/reports" element={<ProtectedRoute moduleKey="reports"><Operations module="reports" /></ProtectedRoute>} />
      <Route path="/activity" element={<ProtectedRoute moduleKey="activity"><Operations module="activity" /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute moduleKey="users"><Users /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute moduleKey="settings"><Operations module="settings" /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
