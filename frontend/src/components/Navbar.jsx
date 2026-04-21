import { useAuth } from "../context/AuthContext";
import { useLogout } from "../hooks/useLogout";

export default function Navbar() {
  const { user }     = useAuth();
  const handleLogout = useLogout();

  return (
    <header className="h-14 border-b border-slate-200 bg-white flex items-center px-6 justify-between">
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="2" width="7" height="7" rx="2" fill="white" fillOpacity="0.9"/>
            <rect x="11" y="2" width="7" height="7" rx="2" fill="white" fillOpacity="0.5"/>
            <rect x="2" y="11" width="7" height="7" rx="2" fill="white" fillOpacity="0.5"/>
            <rect x="11" y="11" width="7" height="7" rx="2" fill="white" fillOpacity="0.9"/>
          </svg>
        </div>
        <span className="font-semibold text-slate-900 text-sm">DBShift</span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Avatar + name */}
        <div className="flex items-center gap-2.5">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-7 h-7 rounded-full object-cover"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
              <span className="text-xs font-semibold text-indigo-700">
                {user?.name?.[0]?.toUpperCase()}
              </span>
            </div>
          )}
          <span className="text-sm text-slate-700 hidden sm:block">{user?.name}</span>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-slate-200" />

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600
                     transition-colors duration-150 font-medium"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign out
        </button>
      </div>
    </header>
  );
}