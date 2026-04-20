import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useDatabases,
  useStartDatabase,
  useStopDatabase,
  useRestartDatabase,
  useDeleteDatabase,
} from '../hooks/useDatabases.js'
import { useQuery } from '@tanstack/react-query'
import { getServers } from '../services/servers.js'
import AddDatabaseModal from '../components/AddDatabaseModal.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import toast from 'react-hot-toast'
import styles from './DatabasesPage.module.css'

const DB_ICONS = {
  MONGODB:    '🍃',
  POSTGRESQL: '🐘',
  MYSQL:      '🐬',
  MARIADB:    '🦭',
  REDIS:      '⚡',
  KEYDB:      '🔑',
  DRAGONFLY:  '🐉',
  CLICKHOUSE: '📊',
}

export default function DatabasesPage() {
  const [showAdd, setShowAdd] = useState(false)
  const [filterServer, setFilterServer] = useState('')
  const [copiedId, setCopiedId] = useState(null)

  const { data: dbData, isLoading } = useDatabases(filterServer || undefined)
  const { data: serverData } = useQuery({ queryKey: ['servers'], queryFn: getServers })

  const startDb  = useStartDatabase()
  const stopDb   = useStopDatabase()
  const restart  = useRestartDatabase()
  const deleteDb = useDeleteDatabase()

  const databases = dbData?.data ?? []
  const servers   = serverData?.data ?? []

  function copyConnectionString(db) {
    if (!db.connectionString) return
    navigator.clipboard.writeText(db.connectionString)
    setCopiedId(db.id)
    toast.success('Connection string copied!')
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function handleAction(action, db) {
    const confirmed = action === 'delete'
      ? window.confirm(`Delete database "${db.name}"? This will destroy all data.`)
      : true

    if (!confirmed) return

    try {
      if (action === 'start')   await startDb.mutateAsync(db.id)
      if (action === 'stop')    await stopDb.mutateAsync(db.id)
      if (action === 'restart') await restart.mutateAsync(db.id)
      if (action === 'delete')  await deleteDb.mutateAsync(db.id)
      toast.success(`Database ${action}ed`)
    } catch (err) {
      toast.error(err?.response?.data?.error ?? `Failed to ${action} database`)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h1>Databases</h1>
          <span className={styles.count}>{databases.length}</span>
        </div>
        <div className={styles.toolbarRight}>
          <select
            className={styles.filter}
            value={filterServer}
            onChange={e => setFilterServer(e.target.value)}
          >
            <option value="">All Servers</option>
            {servers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button className={styles.addBtn} onClick={() => setShowAdd(true)}>
            + New Database
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.empty}>Loading…</div>
      ) : databases.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyIcon}>🗄️</p>
          <p>No databases yet.</p>
          <p className={styles.emptyHint}>Click "New Database" to provision your first database.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {databases.map(db => (
            <div key={db.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardTitle}>
                  <span className={styles.dbIcon}>{DB_ICONS[db.type] ?? '🗄️'}</span>
                  <div>
                    <Link to={`/databases/${db.id}`} className={styles.dbName}>
                      {db.name}
                    </Link>
                    <p className={styles.dbType}>{db.type}</p>
                  </div>
                </div>
                <StatusBadge status={db.status} />
              </div>

              <div className={styles.cardMeta}>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Server</span>
                  <span className={styles.metaValue}>{db.server?.name ?? '—'}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Port</span>
                  <span className={styles.metaValue}>{db.publicPort ?? '—'}</span>
                </div>
                {db._count?.backups !== undefined && (
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Backups</span>
                    <span className={styles.metaValue}>{db._count.backups}</span>
                  </div>
                )}
              </div>

              {db.connectionString && (
                <button
                  className={`${styles.connString} ${copiedId === db.id ? styles.copied : ''}`}
                  onClick={() => copyConnectionString(db)}
                  title="Click to copy connection string"
                >
                  <span className={styles.connIcon}>{copiedId === db.id ? '✓' : '📋'}</span>
                  <code className={styles.connText}>
                    {db.connectionString.replace(/:[^@]+@/, ':****@')}
                  </code>
                </button>
              )}

              {db.status === 'CREATING' && (
                <div className={styles.creating}>
                  <span className={styles.spinner} /> Provisioning database…
                </div>
              )}

              <div className={styles.cardActions}>
                {db.status === 'STOPPED' && (
                  <button onClick={() => handleAction('start', db)} className={styles.actionBtn}>▶ Start</button>
                )}
                {db.status === 'RUNNING' && (
                  <>
                    <button onClick={() => handleAction('stop', db)} className={`${styles.actionBtn} ${styles.stop}`}>■ Stop</button>
                    <button onClick={() => handleAction('restart', db)} className={styles.actionBtn}>↺ Restart</button>
                    <Link to={`/databases/${db.id}`} className={styles.actionBtn}>📊 Monitor</Link>
                  </>
                )}
                <button
                  onClick={() => handleAction('delete', db)}
                  className={`${styles.actionBtn} ${styles.danger}`}
                >
                  🗑 Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddDatabaseModal
          servers={servers}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  )
}