import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AuthPage from './pages/AuthPage'
import Layout from './components/Layout.jsx'
import HomePage from './pages/HomePage.jsx'
import ServersPage from './pages/ServersPage.jsx'
import ComingSoonPage from './pages/ComingSoonPage.jsx'
// Global Pages
import GlobalDatabasesPage from './pages/GlobalDatabasesPage.jsx'
import GlobalAppsPage from './pages/GlobalAppsPage.jsx'
import DatabaseDetailPage from './pages/DatabaseDetailPage.jsx'
// Server Workspace
import ServerWorkspaceLayout from './pages/server/ServerWorkspaceLayout.jsx'
import ServerOverview from './pages/server/ServerOverview.jsx'
import ServerApps from './pages/server/ServerApps.jsx'
import ServerDatabases from './pages/server/ServerDatabases.jsx'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public route */}
        <Route path="/auth" element={<AuthPage />} />

        {/* All app routes are protected */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<HomePage />} />

          {/* Global Pages */}
          <Route path="servers" element={<ServersPage />} />
          <Route path="apps" element={<GlobalAppsPage />} />
          <Route path="databases" element={<GlobalDatabasesPage />} />
          <Route path="databases/:id" element={<DatabaseDetailPage />} />

          {/* Settings, Monitoring, Backups, Logs currently mocked to Coming Soon */}
          <Route path="monitoring" element={<ComingSoonPage />} />
          <Route path="settings" element={<ComingSoonPage />} />

          {/* Single Server Workspace */}
          <Route path="servers/:id" element={<ServerWorkspaceLayout />}>
            <Route index element={<ServerOverview />} />
            <Route path="apps" element={<ServerApps />} />
            <Route path="databases" element={<ServerDatabases />} />
            <Route path="monitoring" element={<ComingSoonPage />} />
            <Route path="backups" element={<ComingSoonPage />} />
            <Route path="terminal" element={<ComingSoonPage />} />
            <Route path="settings" element={<ComingSoonPage />} />
          </Route>

          <Route path="coming-soon" element={<ComingSoonPage />} />
          <Route path="*" element={<ComingSoonPage />} />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}