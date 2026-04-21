import { NavLink, Outlet, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { serversApi } from '../../services/servers.js'

const TabIcons = {
  Overview:  () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  Apps:      () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
  Databases: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>,
  Monitoring:() => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  Backups:   () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  Terminal:  () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>,
  Settings:  () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
}

const TABS = [
  { name: 'Overview',   to: '',           end: true  },
  { name: 'Apps',       to: 'apps',       end: false },
  { name: 'Databases',  to: 'databases',  end: false },
  { name: 'Monitoring', to: 'monitoring', end: false },
  { name: 'Backups',    to: 'backups',    end: false },
  { name: 'Terminal',   to: 'terminal',   end: false },
  { name: 'Settings',   to: 'settings',   end: false },
]

export default function ServerWorkspaceLayout() {
  const { id } = useParams()

  const { data: servers = [] } = useQuery({
    queryKey: ['servers', 'list'],
    queryFn: serversApi.list,
  })

  const server = servers.find(s => s.id === id) || { name: 'Loading…', status: '…', ip: '…', port: '22' }
  const isOnline = server.status === 'CONNECTED' || server.status === 'READY'

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#52525b', marginBottom: 20 }}>
          <span style={{ color: '#ba9eff', cursor: 'pointer' }}>Servers</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          <span style={{ color: '#adaaad' }}>{server.name}</span>
        </div>

        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: '#131315', border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#34b5fa', boxShadow: '0 0 20px rgba(52,181,250,0.08)',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/>
              <circle cx="6" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="6" cy="18" r="1" fill="currentColor" stroke="none"/>
            </svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: '#f9f5f8', margin: 0 }}>
                {server.name}
              </h2>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 999,
                background: isOnline ? 'rgba(52,181,250,0.1)' : 'rgba(118,117,119,0.1)',
                border: `1px solid ${isOnline ? 'rgba(52,181,250,0.2)' : 'rgba(118,117,119,0.2)'}`,
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: isOnline ? '#34b5fa' : '#767577',
                  boxShadow: isOnline ? '0 0 6px #34b5fa' : 'none',
                  animation: isOnline ? 'pulse 2s infinite' : 'none',
                }} />
                <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: isOnline ? '#34b5fa' : '#767577' }}>
                  {server.status}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 6, color: '#71717a', fontSize: 13 }}>
              <span>{server.ip}</span>
              <span>·</span>
              <span>Ubuntu 22.04 LTS</span>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <button style={ghostBtnStyle}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
              SSH Console
            </button>
            <button style={primaryBtnStyle}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Deploy App
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex', gap: 0,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          {TABS.map(tab => {
            const Icon = TabIcons[tab.name]
            return (
              <NavLink
                key={tab.name}
                to={tab.to}
                end={tab.end}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '10px 16px',
                  fontSize: 14, fontWeight: 600,
                  textDecoration: 'none',
                  borderBottom: `2px solid ${isActive ? '#ba9eff' : 'transparent'}`,
                  marginBottom: -1,
                  color: isActive ? '#ba9eff' : '#52525b',
                  transition: 'color 0.15s',
                })}
              >
                <Icon />
                {tab.name}
              </NavLink>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <Outlet />
    </div>
  )
}

const ghostBtnStyle = {
  display: 'flex', alignItems: 'center', gap: 7,
  padding: '8px 16px', borderRadius: 10,
  background: '#131315', border: '1px solid rgba(255,255,255,0.08)',
  color: '#adaaad', fontSize: 12, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.08em',
  cursor: 'pointer', transition: 'all 0.15s',
}

const primaryBtnStyle = {
  display: 'flex', alignItems: 'center', gap: 7,
  padding: '8px 16px', borderRadius: 10,
  background: 'linear-gradient(135deg, #ba9eff, #8455ef)',
  border: 'none', color: '#000',
  fontSize: 12, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.08em',
  cursor: 'pointer', transition: 'all 0.15s',
  boxShadow: '0 0 16px rgba(186,158,255,0.25)',
}