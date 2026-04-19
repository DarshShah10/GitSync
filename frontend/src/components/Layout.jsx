import { Outlet, NavLink } from 'react-router-dom'
import { Server, Database, LayoutDashboard, Settings, Zap } from 'lucide-react'
import styles from './Layout.module.css'

const NAV = [
  { to: '/',          icon: LayoutDashboard, label: 'Overview'  },
  { to: '/servers',   icon: Server,          label: 'Servers'   },
  { to: '/databases', icon: Database,        label: 'Databases' },
  { to: '/settings',  icon: Settings,        label: 'Settings'  },
]

export default function Layout() {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <div className={styles.logoMark}><Zap size={14} /></div>
          <span className={styles.logoText}>DBShift</span>
        </div>

        <nav className={styles.nav}>
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
            >
              <Icon size={16} strokeWidth={1.75} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <span className={styles.version}>v1.0.0 — Phase 1</span>
        </div>
      </aside>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
