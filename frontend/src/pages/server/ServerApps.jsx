import { useState } from 'react'
import { useParams } from 'react-router-dom'

export default function ServerApps() {
  const { id } = useParams()
  const [showAdd, setShowAdd] = useState(false)

  const mockApps = [
    { id: 'mock-1', name: 'Frontend Application', description: 'Next.js App Router UI', framework: 'Next.js', status: 'RUNNING', domain: 'app.example.com', cpu: '2%', ram: '120 MB', version: 'v1.4.2' },
    { id: 'mock-2', name: 'Backend API', description: 'Express.js Core Service', framework: 'Node.js', status: 'RUNNING', domain: 'api.example.com', cpu: '1%', ram: '86 MB', version: 'v2.0.1' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', color: '#f9f5f8', margin: 0 }}>Applications</h2>
          <p style={{ color: '#71717a', fontSize: 13, margin: '6px 0 0' }}>Apps running on this server</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={primaryBtn}>
          + Deploy App
        </button>
      </div>

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 20 }}>
        {mockApps.map(app => (
          <div key={app.id} style={cardStyle}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
          >
            {/* Card Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={iconBox('#34b5fa')}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#f9f5f8', marginBottom: 2 }}>{app.name}</div>
                  <div style={{ fontSize: 12, color: '#71717a' }}>{app.framework} · {app.version}</div>
                </div>
              </div>
              <StatusPill color="#34b5fa" label="RUNNING" />
            </div>

            {/* Meta */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: '#71717a', display: 'flex', alignItems: 'center', gap: 6 }}>
                🌐
                <a href={`https://${app.domain}`} target="_blank" rel="noreferrer"
                  style={{ color: '#ba9eff', textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
                  {app.domain}
                </a>
              </div>
              <div style={{ fontSize: 13, color: '#71717a' }}>
                Usage: <span style={{ color: '#f9f5f8', fontWeight: 600 }}>{app.cpu} CPU / {app.ram}</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              <button style={ghostBtn}>↺ Restart</button>
              <button style={ghostBtn}>⚙ Settings</button>
            </div>
          </div>
        ))}

        {/* Deploy new card */}
        <div
          onClick={() => setShowAdd(true)}
          style={{
            background: 'linear-gradient(135deg, rgba(186,158,255,0.05), transparent)',
            borderRadius: 16, border: '2px dashed rgba(186,158,255,0.2)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            minHeight: 260, cursor: 'pointer', padding: 32, transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(186,158,255,0.4)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(186,158,255,0.2)'}
        >
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: 'rgba(186,158,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, marginBottom: 16, color: '#ba9eff',
          }}>+</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#f9f5f8', marginBottom: 6 }}>Deploy New App</div>
          <div style={{ fontSize: 13, color: '#71717a', textAlign: 'center', maxWidth: 200 }}>
            Connect a repository or deploy a container.
          </div>
        </div>
      </div>

      {/* Modal */}
      {showAdd && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#f9f5f8', margin: '0 0 12px' }}>Deploy App</h3>
            <p style={{ color: '#71717a', fontSize: 14, lineHeight: 1.65, margin: '0 0 24px' }}>
              Configure GitHub integration, build commands, and domain mappings here.
              <br /><br />
              API endpoints are currently in development.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowAdd(false)} style={{ ...ghostBtn, flex: 1, justifyContent: 'center', padding: '10px' }}>Cancel</button>
              <button onClick={() => setShowAdd(false)} style={{ ...primaryBtn, flex: 1, justifyContent: 'center', border: 'none' }}>Connect GitHub</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────

function StatusPill({ color, label }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 999,
      background: `${color}18`, border: `1px solid ${color}33`,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, animation: 'pulse 2s infinite' }} />
      <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color }}>{label}</span>
    </div>
  )
}

function iconBox(color) {
  return {
    width: 46, height: 46, borderRadius: 12, flexShrink: 0,
    background: '#1f1f22', border: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color,
  }
}

const cardStyle = {
  background: '#131315', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column',
  transition: 'transform 0.15s, border-color 0.15s',
}

const ghostBtn = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', borderRadius: 8,
  background: '#1f1f22', border: '1px solid rgba(255,255,255,0.06)',
  color: '#adaaad', fontSize: 12, fontWeight: 600, cursor: 'pointer',
}

const primaryBtn = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '8px 18px', borderRadius: 10,
  background: 'linear-gradient(135deg, #ba9eff, #8455ef)',
  color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer',
  boxShadow: '0 0 16px rgba(186,158,255,0.2)',
}

const modalOverlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
  backdropFilter: 'blur(10px)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', zIndex: 100,
}

const modalBox = {
  background: '#19191c', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 18, padding: 32, width: 480, maxWidth: '90vw',
}