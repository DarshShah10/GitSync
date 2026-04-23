import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AuthPage from './pages/AuthPage'
import Layout from './components/Layout.jsx'
import HomePage from './pages/HomePage.jsx'
import ServersPage from './pages/ServersPage.jsx'
import ComingSoonPage from './pages/ComingSoonPage.jsx'
import NewResourcePage from './pages/NewResourcePage.jsx'
// Global Pages
import GlobalDatabasesPage from './pages/GlobalDatabasesPage.jsx'
import GlobalAppsPage from './pages/GlobalAppsPage.jsx'
import DatabaseDetailPage from './pages/DatabaseDetailPage.jsx'
// Sources
import SourcesPage from './pages/SourcesPage.jsx'
// Server Workspace
import ServerWorkspaceLayout from './pages/server/ServerWorkspaceLayout.jsx'
import ServerOverview from './pages/server/ServerOverview.jsx'
import ServerApps from './pages/server/ServerApps.jsx'
import ServerDatabases from './pages/server/ServerDatabases.jsx'
// import { NewResourcePage } from './pages/NewResourcePage.jsx'
import PublicRepoDeployPage from './pages/PublicRepoDeployPage.jsx'
import PrivateRepoDeployPage from './pages/PrivateRepoDeployPage.jsx'
import ServiceConfigurationPage from './pages/ServiceConfigurationPage.jsx'

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
          <Route path="apps/resource" element={<NewResourcePage/>} />
          <Route path="databases" element={<GlobalDatabasesPage />} />
          <Route path="databases/:id" element={<DatabaseDetailPage />} />
          <Route path="/apps/new/git/public-repo" element={<PublicRepoDeployPage />} />
          <Route path="/apps/new/git/github-app" element={<PrivateRepoDeployPage />} />
          <Route path="/apps/:serviceId" element={<ServiceConfigurationPage />} />

          {/* Settings, Monitoring, Backups, Logs currently mocked to Coming Soon */}
          <Route path="monitoring" element={<ComingSoonPage />} />
          <Route path="settings"   element={<ComingSoonPage />} />
          <Route path="sources"    element={<SourcesPage />} />

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