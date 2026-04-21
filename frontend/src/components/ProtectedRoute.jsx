import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Wraps routes that require authentication.
// Shows a full-screen spinner while the /me check is in flight so
// we don't flash the login page on a hard refresh for valid sessions.

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0e0e10]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-violet-600 border-t-violet-300 rounded-full animate-spin" />
          <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold">Loading…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />
  }

  return children
}