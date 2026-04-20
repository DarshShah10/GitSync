import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { 
  Server, Database, Layers, CheckCircle, XCircle, 
  Search, Filter, ArrowRight, Activity, Plus, TerminalSquare, DatabaseBackup
} from 'lucide-react'
import api from '../services/api.js'
import { serversApi } from '../services/servers.js'
import styles from './HomePage.module.css'

function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => api.get('/health/ready').then(r => r.data),
    refetchInterval: 30000,
    retry: false,
  })
}

function useServerCount() {
  return useQuery({
    queryKey: ['servers', 'list'],
    queryFn: serversApi.list,
  })
}

export default function HomePage() {
  const navigate = useNavigate()
  const { data: health, isLoading: healthLoading } = useHealth()
  const { data: servers = [] } = useServerCount()

  const allHealthy = health?.checks?.database && health?.checks?.redis
  const activeServers = servers.length
  
  // Dummy values for unimplemented features matching the design
  const runningApps = 7
  const totalDatabases = 4
  const scheduledBackups = 2

  const servicesOffer = [
    { name: 'Deploy Next.js App', desc: 'React Framework', icon: <Layers size={20}/>, to: '/coming-soon' },
    { name: 'Deploy Node.js API', desc: 'Express Backend', icon: <TerminalSquare size={20}/>, to: '/coming-soon' },
    { name: 'Create PostgreSQL', desc: 'Relational DB', icon: <Database size={20}/>, to: '/coming-soon' },
    { name: 'Add New Server', desc: 'Connect VPS', icon: <Plus size={20}/>, to: '/servers' },
  ]

  return (
    <div className={styles.page}>
      {/* Page Header */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Overview</h2>
          <p className={styles.subtitle}>System metrics and active infrastructure across all regions.</p>
        </div>
        
        <div className={styles.systemHealth}>
          <div className={`${styles.healthDot} ${!allHealthy && !healthLoading ? styles.error : ''}`}></div>
          <span className={styles.healthText}>
            {healthLoading ? 'CHECKING...' : (allHealthy ? 'All Systems Healthy' : 'System Degraded')}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Active Servers</span>
            <Server className={styles.statIcon} size={18} />
          </div>
          <div className={styles.statValue}>
            <span className={styles.statNum}>{activeServers}</span>
            <span className={styles.statSub}>+1 new</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Running Apps</span>
            <Layers className={styles.statIcon} size={18} style={{color: 'var(--secondary)'}} />
          </div>
          <div className={styles.statValue}>
            <span className={styles.statNum}>{runningApps}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Databases</span>
            <Database className={styles.statIcon} size={18} style={{color: 'var(--tertiary)'}} />
          </div>
          <div className={styles.statValue}>
            <span className={styles.statNum}>{totalDatabases}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Scheduled Backups</span>
            <DatabaseBackup className={styles.statIcon} size={18} style={{color: 'var(--text-muted)'}} />
          </div>
          <div className={styles.statValue}>
            <span className={styles.statNum}>{scheduledBackups}</span>
          </div>
        </div>
      </div>

      {/* Quick Services Offer */}
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Services We Offer</h3>
      </div>
      <div className={styles.servicesGrid}>
        {servicesOffer.map((srv, i) => (
          <button key={i} className={styles.serviceCard} onClick={() => navigate(srv.to)}>
            <div className={styles.serviceIconWrap}>
              {srv.icon}
            </div>
            <div className={styles.serviceInfo}>
              <span className={styles.serviceName}>{srv.name}</span>
              <span className={styles.serviceDesc}>{srv.desc}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Active Servers Grid */}
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Active Infrastructure</h3>
        <div className={styles.sectionActions}>
          <button className={styles.actionBtn}><Filter size={16} /></button>
          <button className={styles.actionBtn}><Search size={16} /></button>
        </div>
      </div>

      <div className={styles.serversGrid}>
        {/* Placeholder cards for servers if none, or real ones */}
        {servers.length > 0 ? (
          servers.map(server => (
            <div key={server.id} className={styles.serverCardWrapper}>
              <div className={styles.serverCard}>
                <div className={styles.serverHeader}>
                  <div className={styles.serverHeaderLeft}>
                    <div className={styles.serverIcon}>
                      <TerminalSquare size={24} />
                    </div>
                    <div>
                      <h4 className={styles.serverName}>{server.name}</h4>
                      <div className={styles.serverMeta}>
                        <Activity size={12} /> {server.ip} ({server.port})
                      </div>
                    </div>
                  </div>
                  <div className={styles.statusBadge}>
                    <div className={styles.statusDot}></div>
                    <span className={styles.statusText}>{server.status}</span>
                  </div>
                </div>

                <div className={styles.metricsGrid}>
                  <div className={styles.metricBox}>
                    <div className={styles.metricTop}>
                      <span>CPU Load</span>
                      <span className={styles.valCpu}>32%</span>
                    </div>
                    <div className={styles.barTrack}>
                      <div className={styles.barFillCpu} style={{width: '32%'}}></div>
                    </div>
                  </div>
                  <div className={styles.metricBox}>
                    <div className={styles.metricTop}>
                      <span>Memory</span>
                      <span className={styles.valMem}>61%</span>
                    </div>
                    <div className={styles.barTrack}>
                      <div className={styles.barFillMem} style={{width: '61%'}}></div>
                    </div>
                  </div>
                </div>

                <div className={styles.serverFooter}>
                  <div className={styles.serverTally}>
                    <div className={styles.tallyItem}>
                      <Layers size={14} /> 6 Apps
                    </div>
                    <div className={styles.tallyItem}>
                      <Database size={14} /> 2 DBs
                    </div>
                  </div>
                  <button className={styles.consoleBtn} onClick={() => navigate(`/servers/${server.id}`)}>
                    Open Console <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ color: 'var(--text-secondary)' }}>
            No servers currently connected. Click "Add New Server" above to get started.
          </div>
        )}
      </div>

    </div>
  )
}