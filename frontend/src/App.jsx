import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import HomePage from './pages/HomePage.jsx'
import ServersPage from './pages/ServersPage.jsx'
import DatabasesPage from './pages/DatabasesPage.jsx'
import DatabaseDetailPage from './pages/DatabaseDetailPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="servers" element={<ServersPage />} />
        <Route path="databases" element={<DatabasesPage />} />
        <Route path="databases/:id" element={<DatabaseDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}