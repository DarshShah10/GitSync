// The main app's Layout + HomePage already serves as the dashboard.
// This file simply redirects any legacy /dashboard links to the root route.
import { Navigate } from 'react-router-dom'

export default function DashboardPage() {
  return <Navigate to="/" replace />
}