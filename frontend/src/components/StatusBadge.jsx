import styles from './StatusBadge.module.css'

const CONFIG = {
  PENDING:     { label: 'Pending',     cls: 'yellow' },
  VERIFYING:   { label: 'Verifying',   cls: 'blue',  pulse: true },
  READY:       { label: 'Ready',       cls: 'green'  },
  UNREACHABLE: { label: 'Unreachable', cls: 'red'    },
  ERROR:       { label: 'Error',       cls: 'red'    },
  CREATING:    { label: 'Creating',    cls: 'blue',  pulse: true },
  RUNNING:     { label: 'Running',     cls: 'green'  },
  STOPPED:     { label: 'Stopped',     cls: 'yellow' },
}

export default function StatusBadge({ status }) {
  const cfg = CONFIG[status] ?? { label: status, cls: 'gray' }
  return (
    <span className={`${styles.badge} ${styles[cfg.cls]}`}>
      <span className={`${styles.dot} ${cfg.pulse ? styles.pulse : ''}`} />
      {cfg.label}
    </span>
  )
}
