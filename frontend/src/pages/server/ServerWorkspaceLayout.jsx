import { NavLink, Outlet, useParams } from 'react-router-dom'
import { TerminalSquare, LayoutDashboard, Layers, Database, Activity, DatabaseBackup, Settings, Cpu, HardDrive } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { serversApi } from '../../services/servers.js'
import styles from './ServerWorkspaceLayout.module.css'

export default function ServerWorkspaceLayout() {
  const { id } = useParams()
  
  // We fetch the server data to populate the header
  const { data: servers = [], isLoading } = useQuery({
    queryKey: ['servers', 'list'],
    queryFn: serversApi.list,
  })

  const server = servers.find(s => s.id === id) || { name: 'Loading...', status: '...', ip: '...', port: '22' }

  const TABS = [
    { name: 'Overview',   to: '',           icon: LayoutDashboard, end: true },
    { name: 'Apps',       to: 'apps',       icon: Layers,          end: false },
    { name: 'Databases',  to: 'databases',  icon: Database,        end: false },
    { name: 'Monitoring', to: 'monitoring', icon: Activity,        end: false },
    { name: 'Backups',    to: 'backups',    icon: DatabaseBackup,  end: false },
    { name: 'Terminal',   to: 'terminal',   icon: TerminalSquare,  end: false },
    { name: 'Settings',   to: 'settings',   icon: Settings,        end: false },
  ]

  return (
    <div className={styles.layout}>
      <div className={styles.header}>
        
        <div className={styles.topRow}>
          <div className={styles.serverIcon}>
            <TerminalSquare size={28} />
          </div>
          <div className={styles.titleArea}>
            <div className={styles.serverName}>
              {server.name}
              <div className={styles.statusBadge}>
                {server.status === 'CONNECTED' || server.status === 'READY' ? (
                  <><div className={styles.statusDot}></div> {server.status}</>
                ) : (
                  <>{server.status}</>
                )}
              </div>
            </div>
            
            <div className={styles.serverMeta}>
              <div className={styles.metaItem}>
                <HardDrive size={14} /> {server.ip}
              </div>
              <div className={styles.metaItem}>
                <Cpu size={14} /> Ubuntu 22.04 LTS
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabs}>
          {TABS.map(tab => (
            <NavLink
              key={tab.name}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => `${styles.tab} ${isActive ? styles.active : ''}`}
            >
              <tab.icon size={16} />
              {tab.name}
            </NavLink>
          ))}
        </div>
      </div>

      <div className={styles.content}>
        <Outlet />
      </div>
    </div>
  )
}
