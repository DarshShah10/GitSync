import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  useDatabases,
  useStartDatabase,
  useStopDatabase,
  useRestartDatabase,
  useDeleteDatabase,
} from '../../hooks/useDatabases.js'
import { useQuery } from '@tanstack/react-query'
import { getServers } from '../../services/servers.js'
import AddDatabaseModal from '../../components/AddDatabaseModal.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import toast from 'react-hot-toast'
import { Server, Trash2, Play, Square, RotateCcw, Copy, Check, Database as DbIcon, Plus } from 'lucide-react'
import styles from '../GlobalDatabasesPage.module.css'

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

export default function ServerDatabases() {
  const { id } = useParams()
  const [showAdd, setShowAdd] = useState(false)
  const [copiedId, setCopiedId] = useState(null)

  const { data: dbData, isLoading } = useDatabases(id)
  
  // Need server data to pass to AddDatabaseModal so it selects this server by default
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
    <div className={styles.page} style={{ paddingTop: 0 }}>
      <div className={styles.header} style={{ marginBottom: 24 }}>
        <div>
          <h2 className={styles.title} style={{ fontSize: '1.5rem', marginBottom: 4 }}>Databases</h2>
          <p className={styles.subtitle}>
            Showing {databases.length} database{databases.length !== 1 ? 's' : ''} running on this server.
          </p>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.addBtn} onClick={() => setShowAdd(true)}>
            <Plus size={18} /> Deploy Database
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.state}>
          <div className={styles.spinner} />
          <p style={{ color: 'var(--text-secondary)' }}>Loading databases…</p>
        </div>
      ) : databases.length === 0 ? (
        <div className={styles.state}>
          <div className={styles.emptyIcon}><DbIcon size={32} /></div>
          <div className={styles.emptyTitle}>No databases deployed</div>
          <div className={styles.emptySub}>Deploy your first database to this server.</div>
          <button className={styles.addBtn} onClick={() => setShowAdd(true)}>
            <Plus size={18} /> Provision Database
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {databases.map(db => (
            <div key={db.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardTitle}>
                  <div className={styles.dbIcon}>
                    {DB_ICONS[db.type] ?? <DbIcon size={24} />}
                  </div>
                  <div>
                    <Link to={`/databases/${db.id}`} className={styles.dbName}>
                      {db.name}
                    </Link>
                    <p className={styles.dbType}>{db.type}</p>
                  </div>
                </div>
                <StatusBadge status={db.status} />
              </div>

              {db.connectionString && (
                <div 
                  className={styles.connectionString} 
                  onClick={() => copyConnectionString(db)}
                  title="Click to copy connection string"
                >
                  <code className={styles.connText}>
                    {db.connectionString.replace(/:[^@]+@/, ':****@')}
                  </code>
                  {copiedId === db.id ? <Check className={styles.connIcon} size={16} color="var(--success)"/> : <Copy className={styles.connIcon} size={16}/>}
                </div>
              )}

              <div className={styles.metaGrid}>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Backup Policy</span>
                  <span className={styles.metaValue}>{db._count?.backupConfigs > 0 ? `${db._count.backupConfigs} active` : 'None'}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Public Port</span>
                  <span className={styles.metaValue}>{db.publicPort ?? '—'}</span>
                </div>
              </div>

              {db.status === 'CREATING' && (
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '16px' }}>
                  <span className={styles.spinner} style={{width: 16, height: 16, display: 'inline-block', verticalAlign: 'middle'}}/> Provisioning...
                </div>
              )}

              <div className={styles.actions}>
                {db.status === 'STOPPED' && (
                  <button onClick={() => handleAction('start', db)} className={styles.actionBtn}>
                    <Play size={14} /> Start
                  </button>
                )}
                {db.status === 'RUNNING' && (
                  <>
                    <button onClick={() => handleAction('stop', db)} className={styles.actionBtn}>
                      <Square size={14} /> Stop
                    </button>
                    <button onClick={() => handleAction('restart', db)} className={styles.actionBtn}>
                      <RotateCcw size={14} /> Restart
                    </button>
                  </>
                )}
                
                <div style={{ flex: 1 }} />
                
                <button
                  onClick={() => handleAction('delete', db)}
                  className={`${styles.actionBtn} ${styles.danger}`}
                >
                  <Trash2 size={14} color="var(--danger)" />
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
