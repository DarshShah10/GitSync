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
  useBackupConfigs,
  useCreateBackupConfig,
  useDeleteBackupConfig,
  useTriggerBackup,
  useBackupExecutions,
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
  { label: 'Every hour', cron: '0 * * * *'   },
  { label: 'Every 6h',   cron: '0 */6 * * *' },
  { label: 'Daily 2am',  cron: '0 2 * * *'   },
  { label: 'Weekly',     cron: '0 2 * * 0'   },
]

const BLANK_FORM = {
  s3Endpoint: '', s3Bucket: '', s3AccessKey: '',
  s3SecretKey: '', s3Region: 'us-east-1', s3Path: '',
  schedule: '', triggerNow: true,
}

// ── Backup execution history panel (per config) ───────────────────────────────

function ExecutionHistory({ configId, onClose }) {
  const { data, isLoading } = useBackupExecutions(configId, true)
  const executions = data?.data ?? []

  return (
    <div className={styles.executionPanel}>
      <div className={styles.executionPanelHeader}>
        <span>Execution History</span>
        <button className={styles.closeHistoryBtn} onClick={onClose}>✕</button>
      </div>
      {isLoading ? (
        <div className={styles.executionLoading}>Loading…</div>
      ) : executions.length === 0 ? (
        <div className={styles.executionEmpty}>No runs yet.</div>
      ) : (
        <div className={styles.executionList}>
          {executions.map(ex => (
            <div key={ex.id} className={styles.executionRow}>
              <span className={`${styles.execStatus} ${styles[ex.status.toLowerCase()]}`}>
                {ex.status}
              </span>
              <span className={styles.execKey} title={ex.s3Key ?? ''}>
                {ex.s3Key ? ex.s3Key.split('/').pop() : '—'}
              </span>
              <span className={styles.execSize}>
                {ex.sizeBytes ? `${(Number(ex.sizeBytes) / 1024 / 1024).toFixed(1)} MB` : ''}
              </span>
              <span className={styles.execDate}>
                {ex.completedAt
                  ? new Date(ex.completedAt).toLocaleString()
                  : ex.startedAt
                    ? `Started ${new Date(ex.startedAt).toLocaleString()}`
                    : new Date(ex.createdAt).toLocaleString()}
              </span>
              {ex.errorMessage && (
                <span className={styles.execError} title={ex.errorMessage}>
                  {ex.errorMessage.slice(0, 80)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Per-config card ───────────────────────────────────────────────────────────

function BackupConfigCard({ config, databaseId, dbRunning }) {
  const [showHistory, setShowHistory] = useState(false)
  const trigger    = useTriggerBackup()
  const deleteConf = useDeleteBackupConfig()

  const latestExec       = config.executions?.[0]
  const executionCount   = config._count?.executions ?? 0

  async function handleRun() {
    try {
      await trigger.mutateAsync(config.id)
      toast.success('Backup started')
    } catch (err) {
      toast.error(err?.response?.data?.error ?? 'Failed to trigger backup')
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this backup configuration and all its execution history?')) return
    try {
      await deleteConf.mutateAsync({ configId: config.id, databaseId })
      toast.success('Backup config deleted')
    } catch (err) {
      toast.error(err?.response?.data?.error ?? 'Failed to delete backup config')
    }
  }

  return (
    <div className={styles.configCard}>
      <div className={styles.configCardHeader}>
        <div className={styles.configInfo}>
          <span className={styles.configBucket}>
            {config.s3Endpoint
              ? new URL(config.s3Endpoint).hostname
              : 'AWS S3'} / {config.s3Bucket}
          </span>
          <span className={styles.configPath}>
            s3://{config.s3Bucket}/{config.s3Path}/
          </span>
          {config.schedule && (
            <span className={styles.configSchedule}>⏰ {config.schedule}</span>
          )}
        </div>

        <div className={styles.configActions}>
          {dbRunning && (
            <button
              className={styles.runBtn}
              onClick={handleRun}
              disabled={trigger.isPending}
            >
              {trigger.isPending ? '…' : '▶ Run Now'}
            </button>
          )}
          <button
            className={styles.historyBtn}
            onClick={() => setShowHistory(v => !v)}
          >
            📋 {executionCount} run{executionCount !== 1 ? 's' : ''}
          </button>
          <button
            className={styles.deleteConfigBtn}
            onClick={handleDelete}
            disabled={deleteConf.isPending}
            title="Delete config"
          >
            🗑
          </button>
        </div>
      </div>

      {latestExec && (
        <div className={styles.latestExec}>
          <span className={styles.latestLabel}>Last run:</span>
          <span className={`${styles.execStatus} ${styles[latestExec.status.toLowerCase()]}`}>
            {latestExec.status}
          </span>
          {latestExec.sizeBytes && (
            <span className={styles.execSize}>
              {(Number(latestExec.sizeBytes) / 1024 / 1024).toFixed(1)} MB
            </span>
          )}
          {latestExec.completedAt && (
            <span className={styles.execDate}>
              {new Date(latestExec.completedAt).toLocaleString()}
            </span>
          )}
        </div>
      )}

      {showHistory && (
        <ExecutionHistory configId={config.id} onClose={() => setShowHistory(false)} />
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DatabaseDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab]   = useState('overview')
  const [copied, setCopied]         = useState(null)
  const [showBackupForm, setShowBackupForm] = useState(false)
  const [backupForm, setBackupForm] = useState(BLANK_FORM)

  const { data, isLoading }                       = useDatabase(id)
  const { data: statsData }                       = useDatabaseStats(id, activeTab === 'overview')
  const { data: logsData, refetch: refetchLogs }  = useDatabaseLogs(id, 100, activeTab === 'logs')
  const { data: configsData }                     = useBackupConfigs(id)

  const startDb     = useStartDatabase()
  const stopDb      = useStopDatabase()
  const restart     = useRestartDatabase()
  const deleteDb    = useDeleteDatabase()
  const createConf  = useCreateBackupConfig()
  const testS3Mut   = useTestS3()

  const db      = data?.data
  const stats   = statsData?.data
  const logs    = logsData?.data?.logs ?? ''
  const configs = configsData?.data ?? []

  function copy(text, key) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    toast.success('Copied!')
    setTimeout(() => setCopied(null), 2000)
  }

  async function handleAction(action) {
    const confirmed = action === 'delete'
      ? window.confirm(`Delete "${db.name}"? The container and all data will be permanently removed.`)
      : true
    if (!confirmed) return

    try {
      if (action === 'start')   { await startDb.mutateAsync(id);  toast.success('Started') }
      if (action === 'stop')    { await stopDb.mutateAsync(id);   toast.success('Stopped') }
      if (action === 'restart') { await restart.mutateAsync(id);  toast.success('Restarted') }
      if (action === 'delete')  {
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
      const res = await testS3Mut.mutateAsync({ databaseId: id, ...backupForm })
      if (res.success) toast.success('S3 connection successful ✓')
      else toast.error(res.message)
    } catch (err) {
      toast.error(err?.response?.data?.error ?? 'S3 test failed')
    }
  }

  async function handleCreateBackupConfig() {
    try {
      await createConf.mutateAsync({ databaseId: id, ...backupForm })
      toast.success(backupForm.triggerNow ? 'Backup config saved and run started!' : 'Backup config saved!')
      setShowBackupForm(false)
      setBackupForm(BLANK_FORM)
    } catch (err) {
      toast.error(err?.response?.data?.error ?? 'Failed to save backup config')
    }
  }

  if (isLoading) return <div className={styles.loading}>Loading…</div>
  if (!db)       return <div className={styles.loading}>Database not found.</div>

  const extConn = db.connectionString
  const intConn = db.connectionString?.replace(db.server?.ip, 'localhost')
  const dbRunning = db.status === 'RUNNING'

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
          {dbRunning && (
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
            {tab === 'backups' && configs.length > 0 && (
              <span className={styles.tabBadge}>{configs.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className={styles.tabContent}>
          <div className={styles.statsGrid}>
            {[
              { label: 'CPU',        value: stats?.cpuPercent },
              { label: 'Memory',     value: stats?.memUsage   },
              { label: 'Mem %',      value: stats?.memPercent },
              { label: 'Network I/O',value: stats?.netIO      },
              { label: 'Block I/O',  value: stats?.blockIO    },
              { label: 'PIDs',       value: stats?.pids       },
            ].map(({ label, value }) => (
              <div key={label} className={styles.statCard}>
                <div className={styles.statLabel}>{label}</div>
                <div className={styles.statValue}>{value ?? '—'}</div>
              </div>
            ))}
          </div>

          <div className={styles.infoTable}>
            {[
              { label: 'Container ID',   value: db.containerId   },
              { label: 'Container Name', value: db.containerName },
              { label: 'Volume Name',    value: db.volumeName    },
              { label: 'Internal Port',  value: db.internalPort  },
              { label: 'Public Port',    value: db.publicPort    },
              { label: 'Database Name',  value: db.dbName        },
              { label: 'Database User',  value: db.dbUser        },
            ].map(({ label, value }) => (
              <div key={label} className={styles.infoRow}>
                <span>{label}</span>
                <code>{value ?? '—'}</code>
              </div>
            ))}
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
            <span className={styles.sectionTitle}>Backup Configurations</span>
            <button
              className={styles.addBackupBtn}
              onClick={() => setShowBackupForm(v => !v)}
            >
              {showBackupForm ? 'Cancel' : '+ Add Backup'}
            </button>
          </div>

          {/* New backup config form */}
          {showBackupForm && (
            <div className={styles.backupForm}>
              <h3>New Backup Configuration</h3>
              <p className={styles.backupNote}>
                Compatible with AWS S3, Google Cloud Storage, Cloudflare R2, MinIO, and any S3-compatible storage.
              </p>

              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label>S3 Endpoint URL <span className={styles.optional}>(leave blank for AWS)</span></label>
                  <input
                    placeholder="https://storage.googleapis.com"
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
                  <label>Region <span className={styles.optional}>(default: us-east-1)</span></label>
                  <input
                    placeholder="us-east-1"
                    value={backupForm.s3Region}
                    onChange={e => setBackupForm(f => ({ ...f, s3Region: e.target.value }))}
                  />
                </div>
                <div className={styles.field}>
                  <label>Path Prefix <span className={styles.optional}>(folder in bucket)</span></label>
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
                      onClick={() => setBackupForm(f => ({ ...f, schedule: f.schedule === p.cron ? '' : p.cron }))}
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
                Run a backup immediately after saving
              </label>

              <div className={styles.backupActions}>
                <button
                  className={styles.testBtn}
                  onClick={handleTestS3}
                  disabled={testS3Mut.isPending}
                >
                  {testS3Mut.isPending ? 'Testing…' : '🔍 Test S3 Connection'}
                </button>
                <button
                  className={styles.saveBtn}
                  onClick={handleCreateBackupConfig}
                  disabled={createConf.isPending}
                >
                  {createConf.isPending ? 'Saving…' : '💾 Save Configuration'}
                </button>
              </div>
            </div>
          )}

          {/* Existing backup configs */}
          {configs.length === 0 ? (
            <div className={styles.noBackups}>
              No backup configurations yet. Click "+ Add Backup" to set one up.
            </div>
          ) : (
            <div className={styles.configsList}>
              {configs.map(cfg => (
                <BackupConfigCard
                  key={cfg.id}
                  config={cfg}
                  databaseId={id}
                  dbRunning={dbRunning}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
