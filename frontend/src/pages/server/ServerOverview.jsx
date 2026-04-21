import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { serversApi } from '../../services/servers.js'

export default function ServerOverview() {
  const { id } = useParams()

  const { data: servers = [] } = useQuery({
    queryKey: ['servers', 'list'],
    queryFn: serversApi.list,
  })

  const server = servers.find(s => s.id === id) || { id, name: '…', ip: '…', port: '…', status: '…', authType: '…' }
  const metrics = { cpu: 42, mem: 64, disk: 45, net: 15 }

  const metricCards = [
    { title: 'CPU Load',        value: `${metrics.cpu}%`,  accent: '#ba9eff', width: `${metrics.cpu}%`  },
    { title: 'RAM Usage',       value: `${metrics.mem}%`,  accent: '#34b5fa', width: `${metrics.mem}%`  },
    { title: 'Disk Usage',      value: `${metrics.disk}%`, accent: '#4ade80', width: `${metrics.disk}%` },
    { title: 'Network Traffic', value: `${metrics.net} MB/s`, accent: '#f59e0b', width: `${metrics.net}%` },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {metricCards.map(m => (
          <div key={m.title} style={{
            background: '#131315', borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.06)',
            padding: 24, position: 'relative', overflow: 'hidden',
          }}>
            {/* Ghost icon */}
            <div style={{ position: 'absolute', top: 12, right: 12, opacity: 0.06, fontSize: 48, lineHeight: 1 }}>⬡</div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#52525b', margin: '0 0 8px' }}>
              {m.title}
            </p>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#f9f5f8', marginBottom: 16 }}>{m.value}</div>
            <div style={{ width: '100%', height: 3, background: '#1f1f22', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 999,
                background: m.accent, boxShadow: `0 0 8px ${m.accent}`,
                width: m.width, transition: 'width 0.8s ease',
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Info Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>

        {/* System Info */}
        <div style={{ background: '#131315', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f9f5f8', margin: '0 0 24px' }}>System Information</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { key: 'Operating System', val: 'Ubuntu 22.04 LTS x86_64' },
              { key: 'IP Address',       val: server.ip                  },
              { key: 'SSH Port',         val: server.port                },
              { key: 'Auth Type',        val: server.authType            },
              { key: 'Docker Version',   val: server.dockerVersion || '24.0.5' },
              { key: 'Health Status',    val: 'Healthy', valColor: '#4ade80' },
            ].map(({ key, val, valColor }, i, arr) => (
              <div key={key} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 0',
                borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}>
                <span style={{ color: '#71717a', fontSize: 13 }}>{key}</span>
                <code style={{ fontFamily: 'monospace', fontSize: 13, color: valColor ?? '#f9f5f8', fontWeight: 600 }}>{val}</code>
              </div>
            ))}
          </div>
        </div>

        {/* Active Resources */}
        <div style={{ background: '#131315', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f9f5f8', margin: '0 0 24px' }}>Active Resources</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { emoji: '⬡', label: 'Running Apps', count: 6,  color: '#34b5fa' },
              { emoji: '🗄', label: 'Databases',    count: 2,  color: '#ff97b2' },
              { emoji: '⏱', label: 'Cron Jobs',    count: 3,  color: '#f59e0b' },
            ].map(({ emoji, label, count, color }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 10,
                background: '#19191c', border: '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: '#1f1f22', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, color,
                }}>
                  {emoji}
                </div>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#adaaad' }}>{label}</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 15, color: '#ba9eff' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}