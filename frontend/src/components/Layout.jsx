import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { TerminalSquare, LayoutDashboard, Server, Layers, Database, Activity, Settings, Plus, Search, Command, Bell } from 'lucide-react'
import styles from './Layout.module.css'

const NAV_ITEMS = [
  { to: '/',          label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/servers',   label: 'Servers',      icon: Server },
  { to: '/apps',      label: 'Applications', icon: Layers },
  { to: '/databases', label: 'Databases',    icon: Database },
  { to: '/monitoring',label: 'Monitoring',   icon: Activity },
  { to: '/settings',  label: 'Settings',     icon: Settings },
]

export default function Layout() {
  const location = useLocation()
  
  // Format current path for breadcrumb
  const currentPath = location.pathname === '/' 
    ? 'Dashboard' 
    : location.pathname.substring(1).charAt(0).toUpperCase() + location.pathname.substring(2).split('/')[0]

  return (
    <div className={styles.layout}>
      {/* Side Navigation */}
      <nav className={styles.sidebar}>
        <div className={styles.sidebarInner}>
          {/* Brand */}
          <div className={styles.brand}>
            <div className={styles.brandTop}>
              <TerminalSquare className={styles.brandIcon} size={24} />
              <h1 className={styles.brandName}>Sovereign</h1>
            </div>
            <div className={styles.brandSub}>Cloud OS</div>
          </div>

          {/* Nav Links */}
          <div className={styles.nav}>
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `${styles.navItem} ${isActive ? styles.active : ''}`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {/* Sidebar Footer */}
          <div className={styles.sidebarFooter}>
            <button className={styles.newInstanceBtn}>
              <Plus size={18} strokeWidth={2.5} />
              New Instance
            </button>
            <div className={styles.userProfile}>
              <img 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuD2k5d_6MnCTTYgGQjPGVN0StJ8QaxdKNdCNq8zTNLnLcHp9Ieb4RZxFvIVEZT_t9pzAuFD9Fhuv8JDYdLbCZ_bjEQxKPJV1Eo9f6v7m85kEhY2mJngymCzNxIjS9NW3rmIOCQpncP5oTgHd6TonXfavJom_f-hDCW9qan5bB3H95hBUMIXpIX3VPHZV_JGtK5F-JHyurj8-GKynbdq6XwH8lq7-IFD_xwR5hU3TomrGUy-K5iUebx_91khDT2XcUbltws5dEAqLxU" 
                alt="System Administrator" 
                className={styles.userAvatar} 
              />
              <div className={styles.userInfo}>
                <span className={styles.userName}>System Admin</span>
                <span className={styles.userPlan}>Pro Plan</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className={styles.mainWrapper}>
        {/* Top App Bar */}
        <header className={styles.topBar}>
          <div className={styles.breadcrumbs}>
            <span className={styles.breadcrumbCrumb}>Kernel Console</span>
            <span className={styles.breadcrumbSep}>/</span>
            <span className={styles.breadcrumbCurrent}>{currentPath}</span>
          </div>

          <div className={styles.topActions}>
            <div className={styles.searchBar}>
              <Search size={18} color="var(--text-secondary)" />
              <input type="text" placeholder="Search resources..." className={styles.searchInput} />
              <div className={styles.shortcut}>
                <Command size={10} /> K
              </div>
            </div>
            
            <button className={styles.iconBtn}>
              <Bell size={20} />
            </button>
            <button className={styles.iconBtn}>
              <TerminalSquare size={20} />
            </button>
            
            <div className={styles.topAvatarWrap}>
              <img 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuACYJ7_c5AoJl1eCEG48nRKVwDcoY7sXp008evJKUPxmJuMQYFpJneBcHOrsONP2xlkomBs1d5lIOVolPWLq2mdnPzy86-V7NSXuRwM43bkXa_l2o2GDTBrWthzbD3KJuj4e2gnhOltf7vePRf7_BOTFAlGddCJX9vKj9YhD__o_gIXxkkpD0MXfWqmrlK4FNSi_wmYdHfv4WLvCx-YmKn6oNe7nwzbUSMfrwerG9-DyizzQ5LvsYQ-32jiIKO5sAoFW5_OgVjn2WU" 
                alt="Avatar" 
                className={styles.userAvatar}
              />
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className={styles.mainContent}>
          <div className={styles.mainInner}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}