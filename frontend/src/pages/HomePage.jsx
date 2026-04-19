import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Server, Database, Activity, ArrowRight, CheckCircle, XCircle, Loader } from 'lucide-react'
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

function HealthRow({ label, ok, loading }) {
  return (
    <div className={styles.healthRow}>
      <span className={styles.healthLabel}>{label}</span>
      {loading
        ? <Loader size={14} className={styles.spin} />
        : ok
          ? <CheckCircle size={14} style={{ color: 'var(--success)' }} />
          : <XCircle    size={14} style={{ color: 'var(--danger)'  }} />
      }
      <span className={`${styles.healthStatus} ${ok ? styles.ok : loading ? '' : styles.down}`}>
        {loading ? 'Checking…' : ok ? 'Online' : 'Offline'}
      </span>
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const { data: health, isLoading: healthLoading } = useHealth()
  const { data: servers = [] } = useServerCount()

  const readyCount = servers.filter(s => s.status === 'READY').length

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerBadge}>Dashboard</div>
        <h1 className={styles.title}>Welcome to DBShift</h1>
        <p className={styles.subtitle}>
          Self-hosted database management. Your server, your data, your control.
        </p>
      </div>

      <div className={styles.grid}>
        {/* Health */}
        <div className={styles.card}>
          <div className={styles.cardHeader}><Activity size={15} /><span>System Health</span></div>
          <div className={styles.healthList}>
            <HealthRow label="API Server" ok={!healthLoading && !!health}  loading={healthLoading} />
            <HealthRow label="Database"   ok={health?.checks?.database}    loading={healthLoading} />
            <HealthRow label="Redis"      ok={health?.checks?.redis}       loading={healthLoading} />
          </div>
        </div>

        {/* Stats */}
        <div className={styles.card}>
          <div className={styles.cardHeader}><Server size={15} /><span>Infrastructure</span></div>
          <div className={styles.statsList}>
            <div className={styles.stat}>
              <span className={styles.statNum}>{servers.length}</span>
              <span className={styles.statLabel}>Servers</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNum}>{readyCount}</span>
              <span className={styles.statLabel}>Ready</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNum}>0</span>
              <span className={styles.statLabel}>Databases</span>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className={`${styles.card} ${styles.actionCard}`} onClick={() => navigate('/servers')}>
          <div className={styles.actionIcon}><Server size={20} /></div>
          <div className={styles.actionBody}>
            <div className={styles.actionTitle}>Manage Servers</div>
            <div className={styles.actionSub}>Connect a VPS and verify SSH access</div>
          </div>
          <ArrowRight size={16} className={styles.actionArrow} />
        </div>

        <div className={`${styles.card} ${styles.actionCard} ${styles.disabled}`}>
          <div className={styles.actionIcon}><Database size={20} /></div>
          <div className={styles.actionBody}>
            <div className={styles.actionTitle}>Create Database</div>
            <div className={styles.actionSub}>MongoDB, PostgreSQL, MySQL — coming in Phase 2</div>
          </div>
          <ArrowRight size={16} className={styles.actionArrow} />
        </div>
      </div>

      {/* Steps */}
      <div className={styles.stepsSection}>
        <div className={styles.stepsTitle}>Getting Started</div>
        <div className={styles.steps}>
          {[
            { n: '01', title: 'Connect a Server',    desc: 'Paste your VPS IP + SSH credentials. We verify and install Docker.' },
            { n: '02', title: 'Create a Database',   desc: 'Pick MongoDB, PostgreSQL, MySQL etc. Spun up as a Docker container.' },
            { n: '03', title: 'Get Connection String', desc: 'Copy and paste into your app. Replace Atlas/RDS URL — code unchanged.' },
          ].map(s => (
            <div key={s.n} className={styles.step}>
              <div className={styles.stepNum}>{s.n}</div>
              <div>
                <div className={styles.stepTitle}>{s.title}</div>
                <div className={styles.stepDesc}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}