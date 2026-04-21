import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../services/api.js'
import { serversApi } from '../services/servers.js'

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

// ── SVG Icons ────────────────────────────────────────────────────────
const ServerIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/>
    <circle cx="6" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="6" cy="18" r="1" fill="currentColor" stroke="none"/>
  </svg>
)
const LayersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
  </svg>
)
const DatabaseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>
  </svg>
)
const BackupIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
)
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const ArrowRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
)
const ActivityIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
)

export default function HomePage() {
  const navigate = useNavigate()
  const { data: health, isLoading: healthLoading } = useHealth()
  const { data: servers = [] } = useServerCount()

  const allHealthy     = health?.checks?.database && health?.checks?.redis
  const activeServers  = servers.length
  const runningApps    = 7
  const totalDatabases = 4
  const scheduledBackups = 2

  const servicesOffer = [
    { name: 'Deploy Next.js App', desc: 'React Framework',  icon: <LayersIcon />,   color: '#ba9eff', to: '/coming-soon' },
    { name: 'Deploy Node.js API', desc: 'Express Backend',  icon: <ActivityIcon />, color: '#34b5fa', to: '/coming-soon' },
    { name: 'Create PostgreSQL',  desc: 'Relational DB',    icon: <DatabaseIcon />, color: '#ff97b2', to: '/coming-soon' },
    { name: 'Add New Server',     desc: 'Connect VPS',      icon: <PlusIcon />,     color: '#4ade80', to: '/servers'    },
  ]

  const stats = [
    { label: 'Active Servers',    value: activeServers,    sub: '+1 new', icon: <ServerIcon />,   color: '#ba9eff' },
    { label: 'Running Apps',      value: runningApps,      sub: null,     icon: <LayersIcon />,   color: '#34b5fa' },
    { label: 'Databases',         value: totalDatabases,   sub: null,     icon: <DatabaseIcon />, color: '#ff97b2' },
    { label: 'Scheduled Backups', value: scheduledBackups, sub: null,     icon: <BackupIcon />,   color: '#767577' },
  ]

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }}>
        <div>
          <h2 style={{ fontSize: 56, fontWeight: 800, letterSpacing: '-0.04em', color: '#f9f5f8', margin: 0, lineHeight: 1 }}>
            Overview
          </h2>
          <p style={{ color: '#adaaad', fontSize: 14, fontWeight: 500, margin: '10px 0 0' }}>
            System metrics and active infrastructure across all regions.
          </p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 16px', background: '#131315',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 999,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: (!allHealthy && !healthLoading) ? '#ff6e84' : '#4ade80',
            boxShadow: `0 0 8px ${(!allHealthy && !healthLoading) ? '#ff6e84' : '#4ade80'}`,
          }} />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#f9f5f8' }}>
            {healthLoading ? 'Checking…' : (allHealthy ? 'All Systems Healthy' : 'System Degraded')}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 48 }}>
        {stats.map(({ label, value, sub, icon, color }) => (
          <div key={label} style={{
            background: '#131315', borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.06)',
            padding: 24, position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#71717a' }}>
                {label}
              </span>
              <span style={{ color }}>{icon}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: '#f9f5f8', lineHeight: 1 }}>{value}</span>
              {sub && <span style={{ fontSize: 12, fontWeight: 600, color: '#4ade80' }}>{sub}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: '#f9f5f8', margin: 0 }}>
          Quick Deploy
        </h3>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 48 }}>
        {servicesOffer.map((srv, i) => (
          <button
            key={i}
            onClick={() => navigate(srv.to)}
            style={{
              background: '#131315', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 14, padding: '18px 20px',
              display: 'flex', alignItems: 'center', gap: 14,
              textAlign: 'left', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(186,158,255,0.25)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: '#1f1f22', border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: srv.color,
            }}>
              {srv.icon}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f9f5f8', marginBottom: 2 }}>{srv.name}</div>
              <div style={{ fontSize: 11, color: '#71717a' }}>{srv.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Active Infrastructure */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: '#f9f5f8', margin: 0 }}>
          Active Infrastructure
        </h3>
      </div>

      {servers.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: 240, background: '#131315', borderRadius: 16,
          border: '1px dashed rgba(255,255,255,0.08)', color: '#52525b', fontSize: 14,
        }}>
          No servers connected. Click "Add New Server" above to get started.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 24 }}>
          {servers.map(server => (
            <div key={server.id} style={{
              background: '#131315', borderRadius: 16, padding: 4,
              border: '1px solid rgba(255,255,255,0.06)',
              transition: 'transform 0.15s, border-color 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'rgba(52,181,250,0.2)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
            >
              <div style={{
                background: '#19191c', borderRadius: 13,
                border: '1px solid rgba(255,255,255,0.04)',
                padding: 24,
              }}>
                {/* Server Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: '#1f1f22', border: '1px solid rgba(255,255,255,0.06)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#34b5fa',
                    }}>
                      <ServerIcon />
                    </div>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: '#f9f5f8', marginBottom: 4 }}>{server.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#71717a' }}>
                        <ActivityIcon /> {server.ip} ({server.port})
                      </div>
                    </div>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '4px 10px', borderRadius: 999,
                    background: 'rgba(52,181,250,0.1)', border: '1px solid rgba(52,181,250,0.2)',
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34b5fa', boxShadow: '0 0 6px #34b5fa', animation: 'pulse 2s infinite' }} />
                    <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#34b5fa' }}>
                      {server.status}
                    </span>
                  </div>
                </div>

                {/* Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                  {[
                    { label: 'CPU Load', value: '32%', color: '#34b5fa', width: '32%' },
                    { label: 'Memory',   value: '61%', color: '#ff97b2', width: '61%' },
                  ].map(m => (
                    <div key={m.label} style={{
                      background: '#131315', padding: 12, borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.04)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#52525b', marginBottom: 8 }}>
                        <span>{m.label}</span>
                        <span style={{ color: m.color }}>{m.value}</span>
                      </div>
                      <div style={{ width: '100%', height: 3, background: '#1f1f22', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 999, background: m.color, boxShadow: `0 0 8px ${m.color}`, width: m.width }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div style={{ paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <span style={{ fontSize: 12, color: '#71717a', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <LayersIcon /> 6 Apps
                    </span>
                    <span style={{ fontSize: 12, color: '#71717a', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <DatabaseIcon /> 2 DBs
                    </span>
                  </div>
                  <button
                    onClick={() => navigate(`/servers/${server.id}`)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                      color: '#ba9eff', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    Open Console <ArrowRight />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}