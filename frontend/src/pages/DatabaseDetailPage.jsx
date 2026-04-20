import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  useDatabase,
  useDatabaseStats,
  useDatabaseLogs,
  useStartDatabase,
  useStopDatabase,
  useRestartDatabase,
  useDeleteDatabase,
  useBackups,
  useCreateBackup,
  useTriggerBackup,
  useTestS3,
} from '../hooks/useDatabases.js'
import StatusBadge from '../components/StatusBadge.jsx'
import toast from 'react-hot-toast'
import styles from './DatabaseDetailPage.module.css'

const DB_ICONS = {
  MONGODB: '🍃', POSTGRESQL: '🐘', MYSQL: '🐬', MARIADB: '🦭',
  REDIS: '⚡', KEYDB: '🔑', DRAGONFLY: '🐉', CLICKHOUSE: '📊',
}

const BACKUP_PRESETS = [
  { label: 'Every hour',   cron: '0 * * * *' },
  { label: 'Every 6h',    cron: '0 */6 * * *' },
  { label: 'Daily 2am',   cron: '0 2 * * *' },
  { label: 'Weekly',      cron: '0 2 * * 0' },
]

export default function DatabaseDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [copied, setCopied] = useState(null)
  const [showBackupForm, setShowBackupForm] = useState(false)
  const [backupForm, setBackupForm] = useState({
    s3Endpoint: '',
    s3Bucket: '',
    s3AccessKey: '',
    s3SecretKey: '',
    s3Region: 'auto',
    s3Path: '',
    schedule: '',
    triggerNow: true,
  })

  const { data, isLoading } = useDatabase(id)
  const { data: statsData } = useDatabaseStats(id, activeTab === 'overview')
  const { data: logsData, refetch: refetchLogs } = useDatabaseLogs(id, 100, activeTab === 'logs')
  const { data: backupsData } = useBackups(id)

  const startDb   = useStartDatabase()
  const stopDb    = useStopDatabase()
  const restart   = useRestartDatabase()
  const deleteDb  = useDeleteDatabase()
  const createBkp = useCreateBackup()
  const triggerBkp = useTriggerBackup()
  const testS3    = useTestS3()

  const db      = data?.data
  const stats   = statsData?.data
  const logs    = logsData?.data?.logs ?? ''
  const backups = backupsData?.data ?? []

  function copy(text, key) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    toast.success('Copied!')
    setTimeout(() => setCopied(null), 2000)
  }

  async function handleAction(action) {
    const confirmed = action === 'delete'
      ? window.confirm(`Delete "${db.name}"? All data will be destroyed.`)
      : true
    if (!confirmed) return

    try {
      if (action === 'start')  { await startDb.mutateAsync(id); toast.success('Started') }
      if (action === 'stop')   { await stopDb.mutateAsync(id);  toast.success('Stopped') }
      if (action === 'restart'){ await restart.mutateAsync(id); toast.success('Restarted') }
      if (action === 'delete') {
        await deleteDb.mutateAsync(id)
        toast.success('Deleted')
        navigate('/databases')
      }
    } catch (err) {
      toast.error(err?.response?.data?.error ?? `Failed to ${action}`)
    }
  }

  async function handleTestS3() {
    try {
      const res = await testS3.mutateAsync({ databaseId: id, ...backupForm })
      if (res.success) toast.success('S3 connection successful ✓')
      else toast.error(res.message)
    } catch (err) {
      toast.error(err?.response?.data?.error ?? 'S3 test failed')
    }
  }

  async function handleCreateBackup() {
    try {
      await createBkp.mutateAsync({ databaseId: id, ...backupForm })
      toast.success('Backup started!')
      setShowBackupForm(false)
    } catch (err) {
      toast.error(err?.response?.data?.error ?? 'Failed to create backup')
    }
  }

  if (isLoading) return <div className={styles.loading}>Loading…</div>
  if (!db) return <div className={styles.loading}>Database not found.</div>

  // Build both connection strings
  const extConn = db.connectionString
  const intConn = db.connectionString?.replace(db.server?.ip, 'localhost')

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.back} onClick={() => navigate('/databases')}>← Databases</button>
        <div className={styles.titleRow}>
          <span className={styles.dbIcon}>{DB_ICONS[db.type] ?? '🗄️'}</span>
          <div>
            <h1 className={styles.title}>{db.name}</h1>
            <p className={styles.subtitle}>{db.type} on {db.server?.name} ({db.server?.ip})</p>
          </div>
          <StatusBadge status={db.status} />
        </div>

        <div className={styles.actions}>
          {db.status === 'STOPPED' && (
            <button className={`${styles.action} ${styles.start}`} onClick={() => handleAction('start')}>▶ Start</button>
          )}
          {db.status === 'RUNNING' && (
            <>
              <button className={`${styles.action} ${styles.stop}`} onClick={() => handleAction('stop')}>■ Stop</button>
              <button className={styles.action} onClick={() => handleAction('restart')}>↺ Restart</button>
            </>
          )}
          <button className={`${styles.action} ${styles.danger}`} onClick={() => handleAction('delete')}>🗑 Delete</button>
        </div>
      </div>

      {/* Connection strings */}
      <div className={styles.connSection}>
        <h2 className={styles.sectionTitle}>Connection Strings</h2>
        <div className={styles.connGrid}>
          <div className={styles.connCard}>
            <div className={styles.connLabel}>External (from your app)</div>
            <div className={styles.connRow}>
              <code className={styles.connCode}>{extConn ?? 'Provisioning…'}</code>
              {extConn && (
                <button className={styles.copyBtn} onClick={() => copy(extConn, 'ext')}>
                  {copied === 'ext' ? '✓' : '📋'}
                </button>
              )}
            </div>
          </div>
          <div className={styles.connCard}>
            <div className={styles.connLabel}>Internal (from same server)</div>
            <div className={styles.connRow}>
              <code className={styles.connCode}>{intConn ?? 'Provisioning…'}</code>
              {intConn && (
                <button className={styles.copyBtn} onClick={() => copy(intConn, 'int')}>
                  {copied === 'int' ? '✓' : '📋'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {['overview', 'logs', 'backups'].map(tab => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className={styles.tabContent}>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>CPU</div>
              <div className={styles.statValue}>{stats?.cpuPercent ?? '—'}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Memory</div>
              <div className={styles.statValue}>{stats?.memUsage ?? '—'}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Mem %</div>
              <div className={styles.statValue}>{stats?.memPercent ?? '—'}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Network I/O</div>
              <div className={styles.statValue}>{stats?.netIO ?? '—'}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Block I/O</div>
              <div className={styles.statValue}>{stats?.blockIO ?? '—'}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>PIDs</div>
              <div className={styles.statValue}>{stats?.pids ?? '—'}</div>
            </div>
          </div>

          <div className={styles.infoTable}>
            <div className={styles.infoRow}>
              <span>Container ID</span>
              <code>{db.containerId ?? '—'}</code>
            </div>
            <div className={styles.infoRow}>
              <span>Container Name</span>
              <code>{db.containerName ?? '—'}</code>
            </div>
            <div className={styles.infoRow}>
              <span>Internal Port</span>
              <code>{db.internalPort ?? '—'}</code>
            </div>
            <div className={styles.infoRow}>
              <span>Public Port</span>
              <code>{db.publicPort ?? '—'}</code>
            </div>
            <div className={styles.infoRow}>
              <span>Database Name</span>
              <code>{db.dbName ?? '—'}</code>
            </div>
            <div className={styles.infoRow}>
              <span>Database User</span>
              <code>{db.dbUser ?? '—'}</code>
            </div>
            <div className={styles.infoRow}>
              <span>Created</span>
              <span>{new Date(db.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Logs tab */}
      {activeTab === 'logs' && (
        <div className={styles.tabContent}>
          <div className={styles.logsHeader}>
            <span className={styles.sectionTitle}>Container Logs</span>
            <button className={styles.refreshBtn} onClick={() => refetchLogs()}>↻ Refresh</button>
          </div>
          <pre className={styles.logs}>{logs || 'No logs available.'}</pre>
        </div>
      )}

      {/* Backups tab */}
      {activeTab === 'backups' && (
        <div className={styles.tabContent}>
          <div className={styles.backupsHeader}>
            <span className={styles.sectionTitle}>Backups</span>
            <button className={styles.addBackupBtn} onClick={() => setShowBackupForm(v => !v)}>
              {showBackupForm ? 'Cancel' : '+ Configure Backup'}
            </button>
          </div>

          {showBackupForm && (
            <div className={styles.backupForm}>
              <h3>Backup Configuration</h3>
              <p className={styles.backupNote}>
                Works with any S3-compatible storage: AWS S3, Google Cloud Storage (GCS), Cloudflare R2, MinIO, etc.
              </p>

              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label>S3 Endpoint URL <span className={styles.optional}>(leave blank for AWS)</span></label>
                  <input
                    placeholder="https://storage.googleapis.com (GCS) or https://xxx.r2.cloudflarestorage.com"
                    value={backupForm.s3Endpoint}
                    onChange={e => setBackupForm(f => ({ ...f, s3Endpoint: e.target.value }))}
                  />
                </div>
                <div className={styles.field}>
                  <label>Bucket Name</label>
                  <input
                    placeholder="my-backups"
                    value={backupForm.s3Bucket}
                    onChange={e => setBackupForm(f => ({ ...f, s3Bucket: e.target.value }))}
                  />
                </div>
                <div className={styles.field}>
                  <label>Access Key</label>
                  <input
                    type="password"
                    value={backupForm.s3AccessKey}
                    onChange={e => setBackupForm(f => ({ ...f, s3AccessKey: e.target.value }))}
                  />
                </div>
                <div className={styles.field}>
                  <label>Secret Key</label>
                  <input
                    type="password"
                    value={backupForm.s3SecretKey}
                    onChange={e => setBackupForm(f => ({ ...f, s3SecretKey: e.target.value }))}
                  />
                </div>
                <div className={styles.field}>
                  <label>Region <span className={styles.optional}>(default: auto)</span></label>
                  <input
                    placeholder="us-east-1"
                    value={backupForm.s3Region}
                    onChange={e => setBackupForm(f => ({ ...f, s3Region: e.target.value }))}
                  />
                </div>
                <div className={styles.field}>
                  <label>Path Prefix <span className={styles.optional}>(optional)</span></label>
                  <input
                    placeholder={db.name}
                    value={backupForm.s3Path}
                    onChange={e => setBackupForm(f => ({ ...f, s3Path: e.target.value }))}
                  />
                </div>
              </div>

              <div className={styles.scheduleRow}>
                <label>Schedule <span className={styles.optional}>(cron, optional)</span></label>
                <div className={styles.presets}>
                  {BACKUP_PRESETS.map(p => (
                    <button
                      key={p.cron}
                      className={`${styles.preset} ${backupForm.schedule === p.cron ? styles.activePreset : ''}`}
                      onClick={() => setBackupForm(f => ({ ...f, schedule: p.cron }))}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <input
                  placeholder="0 2 * * * (cron expression)"
                  value={backupForm.schedule}
                  onChange={e => setBackupForm(f => ({ ...f, schedule: e.target.value }))}
                />
              </div>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={backupForm.triggerNow}
                  onChange={e => setBackupForm(f => ({ ...f, triggerNow: e.target.checked }))}
                />
                Run backup immediately
              </label>

              <div className={styles.backupActions}>
                <button className={styles.testBtn} onClick={handleTestS3} disabled={testS3.isPending}>
                  {testS3.isPending ? 'Testing…' : '🔍 Test Connection'}
                </button>
                <button className={styles.saveBtn} onClick={handleCreateBackup} disabled={createBkp.isPending}>
                  {createBkp.isPending ? 'Saving…' : '💾 Save & Run'}
                </button>
              </div>
            </div>
          )}

          {backups.length === 0 ? (
            <div className={styles.noBackups}>No backups yet. Configure one above.</div>
          ) : (
            <div className={styles.backupsList}>
              {backups.map(bkp => (
                <div key={bkp.id} className={styles.backupRow}>
                  <div className={styles.backupInfo}>
                    <span className={`${styles.backupStatus} ${styles[bkp.status.toLowerCase()]}`}>
                      {bkp.status}
                    </span>
                    <span className={styles.backupPath}>{bkp.s3Path ?? '—'}</span>
                    <span className={styles.backupSize}>
                      {bkp.sizeBytes ? `${(Number(bkp.sizeBytes) / 1024 / 1024).toFixed(1)} MB` : ''}
                    </span>
                    <span className={styles.backupDate}>
                      {new Date(bkp.updatedAt).toLocaleString()}
                    </span>
                  </div>
                  <button
                    className={styles.runBackupBtn}
                    onClick={() => triggerBkp.mutateAsync(bkp.id).then(() => toast.success('Backup started'))}
                  >
                    ▶ Run
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}