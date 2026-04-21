// Status badge pills — Sovereign design system
const STATUS_MAP = {
  // Server statuses
  CONNECTED:  { dot: '#34b5fa', text: '#34b5fa', bg: 'rgba(52,181,250,0.1)',  border: 'rgba(52,181,250,0.2)',  label: 'Connected'  },
  READY:      { dot: '#34b5fa', text: '#34b5fa', bg: 'rgba(52,181,250,0.1)',  border: 'rgba(52,181,250,0.2)',  label: 'Ready'      },
  PENDING:    { dot: '#f59e0b', text: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.2)',  label: 'Pending'    },
  VERIFYING:  { dot: '#f59e0b', text: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.2)',  label: 'Verifying'  },
  ERROR:      { dot: '#ff6e84', text: '#ff6e84', bg: 'rgba(255,110,132,0.1)', border: 'rgba(255,110,132,0.2)', label: 'Error'      },
  UNREACHABLE:{ dot: '#ff6e84', text: '#ff6e84', bg: 'rgba(255,110,132,0.1)', border: 'rgba(255,110,132,0.2)', label: 'Unreachable'},
  // DB statuses
  RUNNING:    { dot: '#34b5fa', text: '#34b5fa', bg: 'rgba(52,181,250,0.1)',  border: 'rgba(52,181,250,0.2)',  label: 'Running'    },
  STOPPED:    { dot: '#767577', text: '#767577', bg: 'rgba(118,117,119,0.1)', border: 'rgba(118,117,119,0.2)', label: 'Stopped'    },
  CREATING:   { dot: '#f59e0b', text: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.2)',  label: 'Creating'   },
  HEALTHY:    { dot: '#4ade80', text: '#4ade80', bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.2)',  label: 'Healthy'    },
  ONLINE:     { dot: '#34b5fa', text: '#34b5fa', bg: 'rgba(52,181,250,0.1)',  border: 'rgba(52,181,250,0.2)',  label: 'Online'     },
}

const DEFAULT = { dot: '#767577', text: '#767577', bg: 'rgba(118,117,119,0.1)', border: 'rgba(118,117,119,0.15)', label: null }

export default function StatusBadge({ status }) {
  const cfg = STATUS_MAP[status?.toUpperCase()] ?? DEFAULT
  const pulse = ['CONNECTED','READY','RUNNING','HEALTHY','ONLINE'].includes(status?.toUpperCase())

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 999,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      flexShrink: 0,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: cfg.dot,
        boxShadow: pulse ? `0 0 6px ${cfg.dot}` : 'none',
        animation: pulse ? 'pulse 2s infinite' : 'none',
        display: 'inline-block',
      }} />
      <span style={{
        fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
        letterSpacing: '0.12em', color: cfg.text,
      }}>
        {cfg.label ?? status}
      </span>
    </div>
  )
}