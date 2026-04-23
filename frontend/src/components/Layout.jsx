import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLogout } from '../hooks/useLogout'

// ── Nav icon SVGs (thin-stroke, no lucide dependency) ─────────────────
const Icons = {
  Home: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  Server: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/>
      <circle cx="6" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="6" cy="18" r="1" fill="currentColor" stroke="none"/>
    </svg>
  ),
  Apps: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  Database: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
      <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>
    </svg>
  ),
  Activity: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  Settings: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  Plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Search: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  Bell: () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  Terminal: () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
    </svg>
  ),
  Git: () => (
    <svg width="20" height="20" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="m6.793 1.207.353.354zM1.207 6.793l-.353-.354zm0 1.414.354-.353zm5.586 5.586-.354.353zm1.414 0-.353-.354zm5.586-5.586.353.354zm0-1.414-.354.353zM8.207 1.207l.354-.353zM6.44.854.854 6.439l.707.707 5.585-5.585zM.854 8.56l5.585 5.585.707-.707-5.585-5.585zm7.707 5.585 5.585-5.585-.707-.707-5.585 5.585zm5.585-7.707L8.561.854l-.707.707 5.585 5.585zm0 2.122a1.5 1.5 0 0 0 0-2.122l-.707.707a.5.5 0 0 1 0 .708zM6.44 14.146a1.5 1.5 0 0 0 2.122 0l-.707-.707a.5.5 0 0 1-.708 0zM.854 6.44a1.5 1.5 0 0 0 0 2.122l.707-.707a.5.5 0 0 1 0-.708zm6.292-4.878a.5.5 0 0 1 .708 0L8.56.854a1.5 1.5 0 0 0-2.122 0zm-2 1.293 1 1 .708-.708-1-1zM7.5 5a.5.5 0 0 1-.5-.5H6A1.5 1.5 0 0 0 7.5 6zm.5-.5a.5.5 0 0 1-.5.5v1A1.5 1.5 0 0 0 9 4.5zM7.5 4a.5.5 0 0 1 .5.5h1A1.5 1.5 0 0 0 7.5 3zm0-1A1.5 1.5 0 0 0 6 4.5h1a.5.5 0 0 1 .5-.5zm.646 2.854 1.5 1.5.707-.708-1.5-1.5zM10.5 8a.5.5 0 0 1-.5-.5H9A1.5 1.5 0 0 0 10.5 9zm.5-.5a.5.5 0 0 1-.5.5v1A1.5 1.5 0 0 0 12 7.5zm-.5-.5a.5.5 0 0 1 .5.5h1A1.5 1.5 0 0 0 10.5 6zm0-1A1.5 1.5 0 0 0 9 7.5h1a.5.5 0 0 1 .5-.5zM7 5.5v4h1v-4zm.5 5.5a.5.5 0 0 1-.5-.5H6A1.5 1.5 0 0 0 7.5 12zm.5-.5a.5.5 0 0 1-.5.5v1A1.5 1.5 0 0 0 9 10.5zm-.5-.5a.5.5 0 0 1 .5.5h1A1.5 1.5 0 0 0 7.5 9zm0-1A1.5 1.5 0 0 0 6 10.5h1a.5.5 0 0 1 .5-.5z" fill="#000"/>
    </svg>
  ),
  Logo: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3a2 2 0 0 0-2 2"/><path d="M19 3a2 2 0 0 1 2 2"/><path d="M21 19a2 2 0 0 1-2 2"/><path d="M5 21a2 2 0 0 1-2-2"/>
      <path d="M9 3h1"/><path d="M9 21h1"/><path d="M14 3h1"/><path d="M14 21h1"/><path d="M3 9v1"/><path d="M21 9v1"/>
      <path d="M3 14v1"/><path d="M21 14v1"/><rect x="7" y="7" width="10" height="10" rx="1"/>
    </svg>
  ),
  Logout: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
}

const NAV_ITEMS = [
  { to: '/',           label: 'Dashboard',    Icon: Icons.Home     },
  { to: '/servers',    label: 'Servers',      Icon: Icons.Server   },
  { to: '/apps',       label: 'Applications', Icon: Icons.Apps     },
  { to: '/databases',  label: 'Databases',    Icon: Icons.Database },
  { to: '/monitoring', label: 'Monitoring',   Icon: Icons.Activity },
  { to: '/sources', label: 'Sources',   Icon: Icons.Git },
  { to: '/settings',   label: 'Settings',     Icon: Icons.Settings },
]

export default function Layout() {
  const location     = useLocation()
  const { user }     = useAuth()
  const handleLogout = useLogout()

  const crumb = location.pathname === '/'
    ? 'Dashboard'
    : location.pathname.substring(1).split('/')[0].charAt(0).toUpperCase() +
      location.pathname.substring(1).split('/')[0].slice(1)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-surface)' }}>

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside style={{
        width: 256,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#131315',
        boxShadow: '1px 0 0 0 rgba(255,255,255,0.05), 10px 0 30px rgba(132,85,239,0.04)',
        position: 'relative',
        zIndex: 50,
        padding: '24px 0',
      }}>

        {/* Brand */}
        <div style={{ padding: '0 24px', marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'linear-gradient(135deg, #ba9eff, #8455ef)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(186,158,255,0.25)',
              color: '#000',
            }}>
              <Icons.Logo />
            </div>
            <div>
              <div style={{
                fontSize: 18, fontWeight: 900, letterSpacing: '-0.04em',
                textTransform: 'uppercase', color: '#fff',
                background: 'linear-gradient(135deg, #ba9eff, #a27cff)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>Sovereign</div>
              <div style={{ fontSize: 10, color: '#4b4a4d', fontFamily: 'monospace', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 1 }}>
                Kernel v1.0.4
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                borderRadius: 8,
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 600,
                transition: 'all 0.15s',
                borderLeft: isActive ? '2px solid #8455ef' : '2px solid transparent',
                borderTopLeftRadius: isActive ? 0 : 8,
                borderBottomLeftRadius: isActive ? 0 : 8,
                background: isActive ? 'linear-gradient(90deg, rgba(124,58,237,0.18), transparent)' : 'transparent',
                color: isActive ? '#ba9eff' : '#71717a',
                marginLeft: isActive ? -2 : 0,
              })}
            >
              {({ isActive }) => (
                <>
                  <span style={{ color: isActive ? '#ba9eff' : '#52525b', transition: 'color 0.15s' }}>
                    <Icon />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ marginTop: 'auto', padding: '20px 16px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {/* Deploy CTA */}
          <button
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '10px 0',
              background: 'linear-gradient(135deg, #ba9eff, #8455ef)',
              color: '#000',
              fontWeight: 700, fontSize: 11,
              textTransform: 'uppercase', letterSpacing: '0.12em',
              borderRadius: 10, border: 'none', cursor: 'pointer',
              marginBottom: 16,
              boxShadow: '0 0 20px rgba(186,158,255,0.2)',
              transition: 'box-shadow 0.15s, opacity 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 28px rgba(186,158,255,0.4)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 20px rgba(186,158,255,0.2)'}
          >
            <Icons.Plus />
            Deploy Instance
          </button>

          {/* User */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(186,158,255,0.3)', flexShrink: 0 }}
              />
            ) : (
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(186,158,255,0.12)', border: '1px solid rgba(186,158,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#ba9eff',
              }}>
                {user?.name?.[0]?.toUpperCase() ?? 'S'}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name ?? 'System Admin'}
              </div>
              <button
                onClick={handleLogout}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontSize: 11, color: '#52525b', display: 'flex', alignItems: 'center', gap: 4,
                  marginTop: 2, transition: 'color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#ff6e84'}
                onMouseLeave={e => e.currentTarget.style.color = '#52525b'}
              >
                <Icons.Logout />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Area ───────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0e0e10' }}>

        {/* Top Bar */}
        <header style={{
          height: 64, flexShrink: 0,
          background: 'rgba(14,14,16,0.85)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 32px', zIndex: 40,
        }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#ba9eff' }}>
              Kernel Console
            </span>
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 14 }}>/</span>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#f9f5f8' }}>
              {crumb}
            </span>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Search */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#000', border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 999, padding: '6px 14px', marginRight: 8,
            }}>
              <span style={{ color: '#52525b' }}><Icons.Search /></span>
              <input
                type="text"
                placeholder="CMD + K TO SEARCH..."
                style={{
                  background: 'none', border: 'none', outline: 'none',
                  color: '#d4d4d8', fontSize: 11, width: 160,
                  fontFamily: 'monospace', letterSpacing: '0.05em',
                }}
              />
              <div style={{
                display: 'flex', alignItems: 'center', gap: 3,
                background: '#1c1c21', border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 4, padding: '2px 6px',
                fontSize: 10, color: '#52525b', fontFamily: 'monospace', fontWeight: 700,
              }}>
                ⌘K
              </div>
            </div>

            <button style={iconBtnStyle}><Icons.Bell /></button>
            <button style={iconBtnStyle}><Icons.Terminal /></button>

            <div style={{ marginLeft: 12, paddingLeft: 12, borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name}
                  style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(186,158,255,0.25)' }} />
              ) : (
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'rgba(186,158,255,0.12)', border: '1px solid rgba(186,158,255,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: '#ba9eff',
                }}>
                  {user?.name?.[0]?.toUpperCase() ?? 'S'}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

const iconBtnStyle = {
  width: 34, height: 34, borderRadius: '50%', border: 'none',
  background: 'transparent', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: '#52525b', transition: 'color 0.15s, background 0.15s',
}