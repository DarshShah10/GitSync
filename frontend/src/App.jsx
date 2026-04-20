import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import HomePage from './pages/HomePage.jsx'
import ServersPage from './pages/ServersPage.jsx'
import ComingSoonPage from './pages/ComingSoonPage.jsx'

// Global Pages
import GlobalDatabasesPage from './pages/GlobalDatabasesPage.jsx'
import GlobalAppsPage from './pages/GlobalAppsPage.jsx'

// Server Workspace
import ServerWorkspaceLayout from './pages/server/ServerWorkspaceLayout.jsx'
import ServerOverview from './pages/server/ServerOverview.jsx'
import ServerApps from './pages/server/ServerApps.jsx'
import ServerDatabases from './pages/server/ServerDatabases.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        
        {/* Global Pages */}
        <Route path="servers" element={<ServersPage />} />
        <Route path="apps" element={<GlobalAppsPage />} />
        <Route path="databases" element={<GlobalDatabasesPage />} />
        
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
    </Routes>
  )
}