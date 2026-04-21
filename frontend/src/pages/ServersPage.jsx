import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useServers, useDeleteServer, useReverifyServer, useServerStatus, useTestConnection } from '../hooks/useServers.js'
import AddServerModal from '../components/AddServerModal.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import toast from 'react-hot-toast'

// ── Shared button styles ──────────────────────────────────────────────
const ghostBtn = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', borderRadius: 8,
  background: '#1f1f22', border: '1px solid rgba(255,255,255,0.06)',
  color: '#adaaad', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', transition: 'all 0.15s',
}

const dangerBtn = {
  ...ghostBtn, color: '#ff6e84',
  borderColor: 'rgba(255,110,132,0.25)',
  background: 'rgba(255,110,132,0.08)',
}

function ServerCard({ server, onDelete, onReverify }) {
  const navigate = useNavigate()
  const isLive = server.status === 'PENDING' || server.status === 'VERIFYING'
  const { data: live } = useServerStatus(server.id, isLive)
  const { mutate: testConn, isPending: testing } = useTestConnection()
  const [confirmDel, setConfirmDel] = useState(false)

  const status       = live?.status       ?? server.status
  const errorMessage = live?.errorMessage ?? server.errorMessage
  const dockerVer    = live?.dockerVersion ?? server.dockerVersion

  function handleTest() {
    testConn(server.id, {
      onSuccess: (data) => {
        if (data.reachable) toast.success(`Reachable — ${data.latencyMs}ms`)
        else toast.error(`Unreachable: ${data.error}`)
      }
    })
  }

  return (
    <div style={{
      background: '#131315', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 16, padding: 24,
      display: 'flex', flexDirection: 'column',
      transition: 'transform 0.15s, border-color 0.15s',
      position: 'relative', overflow: 'hidden',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
    >
      {/* Top */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: '#1f1f22', border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#34b5fa',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/>
              <circle cx="6" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="6" cy="18" r="1" fill="currentColor" stroke="none"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#f9f5f8', marginBottom: 4 }}>{server.name}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 12, color: '#71717a' }}>
              <span>{server.ip}:{server.port}</span>
              <span style={{ color: '#3f3f46' }}>·</span>
              <span>{server.username}</span>
              <span style={{ color: '#3f3f46' }}>·</span>
              <span>{server.authType === 'PASSWORD' ? '🔒 password' : '🔑 key'}</span>
              {dockerVer && <><span style={{ color: '#3f3f46' }}>·</span><span>Docker {dockerVer}</span></>}
            </div>
            {errorMessage && (
              <div style={{
                marginTop: 8, display: 'flex', alignItems: 'center', gap: 6,
                color: '#ff6e84', fontSize: 12,
                background: 'rgba(255,110,132,0.08)', padding: '6px 10px', borderRadius: 6,
              }}>
                ⚠ {errorMessage}
              </div>
            )}
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <button style={ghostBtn} onClick={() => navigate(`/servers/${server.id}`)}>
          Console →
        </button>
        <button style={{ ...ghostBtn, opacity: testing ? 0.5 : 1 }} onClick={handleTest} disabled={testing}>
          {testing ? 'Testing…' : '⚡ Ping'}
        </button>
        {(status === 'ERROR' || status === 'UNREACHABLE') && (
          <button style={ghostBtn} onClick={() => onReverify(server.id)}>
            ↺ Reverify
          </button>
        )}
        <div style={{ flex: 1 }} />
        {!confirmDel ? (
          <button style={dangerBtn} onClick={() => setConfirmDel(true)}>
            🗑 Delete
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#71717a' }}>
            <span>Are you sure?</span>
            <button style={dangerBtn} onClick={() => { onDelete(server.id); setConfirmDel(false) }}>Yes</button>
            <button style={ghostBtn} onClick={() => setConfirmDel(false)}>No</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ServersPage() {
  const [modal, setModal] = useState(false)
  const { data: servers = [], isLoading, isError, refetch } = useServers()
  const { mutate: del }      = useDeleteServer()
  const { mutate: reverify } = useReverifyServer()

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }}>
        <div>
          <h2 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.04em', color: '#f9f5f8', margin: 0 }}>Servers</h2>
          <p style={{ color: '#71717a', fontSize: 14, margin: '8px 0 0' }}>
            {servers.length === 0 ? 'No servers connected yet.' : 'Manage your connected virtual machines and bare metal servers.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => refetch()}
            style={{
              width: 40, height: 40, borderRadius: 10,
              background: '#131315', border: '1px solid rgba(255,255,255,0.06)',
              color: '#71717a', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 16, transition: 'all 0.15s',
            }}
            title="Refresh"
          >↻</button>
          <button
            onClick={() => setModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '0 20px', height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #ba9eff, #8455ef)',
              border: 'none', color: '#000', fontWeight: 700, fontSize: 13,
              cursor: 'pointer', boxShadow: '0 0 16px rgba(186,158,255,0.2)',
            }}
          >
            + New Server
          </button>
        </div>
      </div>

      {/* States */}
      {isLoading && <EmptyShell><Spinner />Loading servers…</EmptyShell>}
      {isError && (
        <EmptyShell>
          <div style={{ color: '#ff6e84', fontSize: 32, marginBottom: 16 }}>⚠</div>
          <p style={{ color: '#71717a', marginBottom: 16 }}>Failed to load servers</p>
          <button onClick={() => refetch()} style={primaryBtnStyle}>Retry</button>
        </EmptyShell>
      )}
      {!isLoading && !isError && servers.length === 0 && (
        <EmptyShell>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#1f1f22', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, fontSize: 28 }}>🖥</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f9f5f8', marginBottom: 8 }}>No servers yet</div>
          <div style={{ color: '#71717a', marginBottom: 24 }}>Connect a VPS and deploy your instances.</div>
          <button onClick={() => setModal(true)} style={primaryBtnStyle}>+ Connect First Server</button>
        </EmptyShell>
      )}

      {/* Grid */}
      {!isLoading && servers.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 20 }}>
          {servers.map(s => <ServerCard key={s.id} server={s} onDelete={del} onReverify={reverify} />)}
        </div>
      )}

      {modal && <AddServerModal onClose={() => setModal(false)} onCreated={() => refetch()} />}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────

function EmptyShell({ children }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: 400, background: '#131315', borderRadius: 16,
      border: '1px dashed rgba(255,255,255,0.07)',
    }}>
      {children}
    </div>
  )
}

function Spinner() {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%',
      border: '3px solid rgba(255,255,255,0.06)',
      borderTopColor: '#ba9eff',
      animation: 'spin 0.8s linear infinite',
      marginBottom: 16,
    }} />
  )
}

const primaryBtnStyle = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '8px 20px', borderRadius: 10,
  background: 'linear-gradient(135deg, #ba9eff, #8455ef)',
  border: 'none', color: '#000', fontWeight: 700, fontSize: 13,
  cursor: 'pointer',
}