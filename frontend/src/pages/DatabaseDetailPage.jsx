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

// Status badge colors for backup execution status
const execStatusClass = {
  pending: 'bg-[rgba(99,102,241,0.15)] text-[#818cf8]',
  running: 'bg-[rgba(245,158,11,0.15)] text-[#f59e0b]',
  success: 'bg-[rgba(34,197,94,0.15)] text-[#22c55e]',
  failed:  'bg-[rgba(239,68,68,0.15)] text-[#ef4444]',
}

// ── Execution History Panel ───────────────────────────────────────────────────

function ExecutionHistory({ configId, onClose }) {
  const { data, isLoading } = useBackupExecutions(configId, true)
  const executions = data?.data ?? []

  return (
    <div className="mt-3 border border-[var(--border)] rounded-[6px] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--bg)] border-b border-[var(--border)] text-[0.8rem] font-semibold text-[var(--text-secondary)]">
        <span>Execution History</span>
        <button
          className="bg-none border-none text-[var(--text-muted)] cursor-pointer text-[0.75rem] px-1 py-0.5 rounded-sm transition-colors hover:text-[var(--text-primary)]"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      {isLoading ? (
        <div className="p-4 text-[0.8rem] text-[var(--text-muted)] text-center">Loading…</div>
      ) : executions.length === 0 ? (
        <div className="p-4 text-[0.8rem] text-[var(--text-muted)] text-center">No runs yet.</div>
      ) : (
        <div className="flex flex-col">
          {executions.map(ex => (
            <div
              key={ex.id}
              className="flex items-center gap-1.5 px-3 py-[0.55rem] border-b border-[var(--border)] last:border-b-0 text-[0.78rem] flex-wrap"
            >
              <span className={`px-[0.45rem] py-[0.1rem] rounded-[4px] text-[0.67rem] font-bold uppercase tracking-[0.02em] ${execStatusClass[ex.status.toLowerCase()] ?? ''}`}>
                {ex.status}
              </span>
              <span className="text-[0.75rem] font-mono text-[var(--text-secondary)] max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap" title={ex.s3Key ?? ''}>
                {ex.s3Key ? ex.s3Key.split('/').pop() : '—'}
              </span>
              <span className="text-[0.75rem] text-[var(--text-muted)]">
                {ex.sizeBytes ? `${(Number(ex.sizeBytes) / 1024 / 1024).toFixed(1)} MB` : ''}
              </span>
              <span className="text-[0.75rem] text-[var(--text-muted)] ml-auto">
                {ex.completedAt
                  ? new Date(ex.completedAt).toLocaleString()
                  : ex.startedAt
                    ? `Started ${new Date(ex.startedAt).toLocaleString()}`
                    : new Date(ex.createdAt).toLocaleString()}
              </span>
              {ex.errorMessage && (
                <span className="text-[0.72rem] text-[#ef4444] w-full mt-0.5 font-mono word-break-all" title={ex.errorMessage}>
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

// ── Backup Config Card ────────────────────────────────────────────────────────

function BackupConfigCard({ config, databaseId, dbRunning }) {
  const [showHistory, setShowHistory] = useState(false)
  const trigger    = useTriggerBackup()
  const deleteConf = useDeleteBackupConfig()

  const latestExec     = config.executions?.[0]
  const executionCount = config._count?.executions ?? 0

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
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[8px] px-4 py-[0.9rem]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-[0.2rem] min-w-0">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {config.s3Endpoint ? new URL(config.s3Endpoint).hostname : 'AWS S3'} / {config.s3Bucket}
          </span>
          <span className="text-[0.75rem] font-mono text-[var(--text-muted)] break-all">
            s3://{config.s3Bucket}/{config.s3Path}/
          </span>
          {config.schedule && (
            <span className="text-[0.75rem] text-[var(--text-secondary)]">⏰ {config.schedule}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {dbRunning && (
            <button
              className="px-[0.7rem] py-[0.3rem] bg-[var(--accent)] border-none rounded-[5px] text-white text-[0.75rem] cursor-pointer transition-opacity hover:opacity-85 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleRun}
              disabled={trigger.isPending}
            >
              {trigger.isPending ? '…' : '▶ Run Now'}
            </button>
          )}
          <button
            className="px-[0.7rem] py-[0.3rem] bg-[var(--bg)] border border-[var(--border)] rounded-[5px] text-[var(--text-secondary)] text-[0.75rem] cursor-pointer transition-colors hover:bg-[var(--border)]"
            onClick={() => setShowHistory(v => !v)}
          >
            📋 {executionCount} run{executionCount !== 1 ? 's' : ''}
          </button>
          <button
            className="px-[0.5rem] py-[0.3rem] bg-none border border-transparent rounded-[5px] text-[var(--text-muted)] text-[0.8rem] cursor-pointer transition-all hover:border-[#ef4444] hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.08)] disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleDelete}
            disabled={deleteConf.isPending}
            title="Delete config"
          >
            🗑
          </button>
        </div>
      </div>

      {latestExec && (
        <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-[var(--border)] text-[0.78rem] flex-wrap">
          <span className="text-[var(--text-muted)]">Last run:</span>
          <span className={`px-[0.45rem] py-[0.1rem] rounded-[4px] text-[0.67rem] font-bold uppercase ${execStatusClass[latestExec.status.toLowerCase()] ?? ''}`}>
            {latestExec.status}
          </span>
          {latestExec.sizeBytes && (
            <span className="text-[0.75rem] text-[var(--text-muted)]">
              {(Number(latestExec.sizeBytes) / 1024 / 1024).toFixed(1)} MB
            </span>
          )}
          {latestExec.completedAt && (
            <span className="text-[0.75rem] text-[var(--text-muted)]">
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DatabaseDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab]   = useState('overview')
  const [copied, setCopied]         = useState(null)
  const [showBackupForm, setShowBackupForm] = useState(false)
  const [backupForm, setBackupForm] = useState(BLANK_FORM)

  const { data, isLoading }                      = useDatabase(id)
  const { data: statsData }                      = useDatabaseStats(id, activeTab === 'overview')
  const { data: logsData, refetch: refetchLogs } = useDatabaseLogs(id, 100, activeTab === 'logs')
  const { data: configsData }                    = useBackupConfigs(id)

  const startDb    = useStartDatabase()
  const stopDb     = useStopDatabase()
  const restart    = useRestartDatabase()
  const deleteDb   = useDeleteDatabase()
  const createConf = useCreateBackupConfig()
  const testS3Mut  = useTestS3()

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

  if (isLoading) return <div className="p-8 text-[var(--text-muted)]">Loading…</div>
  if (!db)       return <div className="p-8 text-[var(--text-muted)]">Database not found.</div>

  const extConn  = db.connectionString
  const intConn  = db.connectionString?.replace(db.server?.ip, 'localhost')
  const dbRunning = db.status === 'RUNNING'

  // shared input class
  const inputCls = "w-full px-[0.7rem] py-2 bg-[var(--bg)] border border-[var(--border)] rounded-[5px] text-[var(--text-primary)] text-[0.82rem] outline-none focus:border-[var(--accent)]"

  return (
    <div className="px-8 py-6 max-w-[1100px]">
      {/* Header */}
      <div className="mb-6">
        <button
          className="bg-none border-none text-[var(--text-muted)] text-[0.8rem] cursor-pointer p-0 mb-3 transition-colors hover:text-[var(--text-primary)]"
          onClick={() => navigate('/databases')}
        >
          ← Databases
        </button>

        <div className="flex items-center gap-3 flex-wrap mb-4">
          <span className="text-[2rem]">{DB_ICONS[db.type] ?? '🗄️'}</span>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] m-0">{db.name}</h1>
            <p className="text-[0.8rem] text-[var(--text-muted)] m-0">
              {db.type} on {db.server?.name} ({db.server?.ip})
            </p>
          </div>
          <StatusBadge status={db.status} />
        </div>

        <div className="flex gap-2 flex-wrap">
          {db.status === 'STOPPED' && (
            <button
              className="px-[0.9rem] py-[0.4rem] bg-[var(--surface)] border border-[#22c55e] rounded-[6px] text-[#22c55e] text-[0.8rem] cursor-pointer transition-colors hover:bg-[var(--border)]"
              onClick={() => handleAction('start')}
            >
              ▶ Start
            </button>
          )}
          {dbRunning && (
            <>
              <button
                className="px-[0.9rem] py-[0.4rem] bg-[var(--surface)] border border-[#f59e0b] rounded-[6px] text-[#f59e0b] text-[0.8rem] cursor-pointer transition-colors hover:bg-[var(--border)]"
                onClick={() => handleAction('stop')}
              >
                ■ Stop
              </button>
              <button
                className="px-[0.9rem] py-[0.4rem] bg-[var(--surface)] border border-[var(--border)] rounded-[6px] text-[var(--text-secondary)] text-[0.8rem] cursor-pointer transition-colors hover:bg-[var(--border)]"
                onClick={() => handleAction('restart')}
              >
                ↺ Restart
              </button>
            </>
          )}
          <button
            className="px-[0.9rem] py-[0.4rem] bg-[var(--surface)] border border-[#ef4444] rounded-[6px] text-[#ef4444] text-[0.8rem] cursor-pointer transition-colors hover:bg-[rgba(239,68,68,0.1)]"
            onClick={() => handleAction('delete')}
          >
            🗑 Delete
          </button>
        </div>
      </div>

      {/* Connection Strings */}
      <div className="mb-6">
        <span className="block text-[0.85rem] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.05em] mb-3">
          Connection Strings
        </span>
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          {[
            { key: 'ext', label: 'External (from your app)', value: extConn },
            { key: 'int', label: 'Internal (from same server)', value: intConn },
          ].map(({ key, label, value }) => (
            <div key={key} className="bg-[var(--surface)] border border-[var(--border)] rounded-[8px] px-4 py-3">
              <div className="text-[0.7rem] text-[var(--text-muted)] uppercase tracking-[0.05em] mb-1">{label}</div>
              <div className="flex items-center gap-2">
                <code className="text-[0.72rem] font-['Courier_New',monospace] text-[var(--text-secondary)] break-all flex-1">
                  {value ?? 'Provisioning…'}
                </code>
                {value && (
                  <button
                    className="bg-[var(--bg)] border border-[var(--border)] rounded-[4px] px-2 py-1 text-[0.75rem] cursor-pointer shrink-0 transition-colors hover:bg-[var(--border)]"
                    onClick={() => copy(value, key)}
                  >
                    {copied === key ? '✓' : '📋'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] mb-5">
        {['overview', 'logs', 'backups'].map(tab => (
          <button
            key={tab}
            className={`px-5 py-[0.6rem] bg-none border-none border-b-2 text-[0.85rem] cursor-pointer mb-[-1px] transition-colors ${
              activeTab === tab
                ? 'text-[var(--accent)] border-b-[var(--accent)] font-medium border-b-2'
                : 'text-[var(--text-muted)] border-b-transparent hover:text-[var(--text-secondary)]'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'backups' && configs.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-[0.3rem] ml-[0.4rem] bg-[var(--accent)] text-white rounded-full text-[0.65rem] font-bold leading-none align-middle">
                {configs.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 mb-6">
            {[
              { label: 'CPU',         value: stats?.cpuPercent },
              { label: 'Memory',      value: stats?.memUsage   },
              { label: 'Mem %',       value: stats?.memPercent },
              { label: 'Network I/O', value: stats?.netIO      },
              { label: 'Block I/O',   value: stats?.blockIO    },
              { label: 'PIDs',        value: stats?.pids       },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[var(--surface)] border border-[var(--border)] rounded-[8px] px-4 py-3">
                <div className="text-[0.7rem] text-[var(--text-muted)] uppercase tracking-[0.05em] mb-[0.35rem]">{label}</div>
                <div className="text-[0.95rem] font-semibold text-[var(--text-primary)] font-mono">{value ?? '—'}</div>
              </div>
            ))}
          </div>

          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[8px] overflow-hidden">
            {[
              { label: 'Container ID',   value: db.containerId   },
              { label: 'Container Name', value: db.containerName },
              { label: 'Volume Name',    value: db.volumeName    },
              { label: 'Internal Port',  value: db.internalPort  },
              { label: 'Public Port',    value: db.publicPort    },
              { label: 'Database Name',  value: db.dbName        },
              { label: 'Database User',  value: db.dbUser        },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-4 py-[0.6rem] border-b border-[var(--border)] last:border-b-0 text-[0.82rem]">
                <span className="text-[var(--text-muted)]">{label}</span>
                <code className="font-['Courier_New',monospace] text-[var(--text-secondary)] text-[0.78rem]">{value ?? '—'}</code>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-[0.6rem] text-[0.82rem]">
              <span className="text-[var(--text-muted)]">Created</span>
              <span className="text-[var(--text-secondary)]">{new Date(db.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[0.85rem] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.05em]">
              Container Logs
            </span>
            <button
              className="bg-[var(--surface)] border border-[var(--border)] rounded-[5px] px-3 py-[0.3rem] text-[0.78rem] text-[var(--text-secondary)] cursor-pointer transition-colors hover:bg-[var(--border)]"
              onClick={() => refetchLogs()}
            >
              ↻ Refresh
            </button>
          </div>
          <pre className="bg-[#0d0d0d] border border-[var(--border)] rounded-[8px] p-4 font-['Courier_New',monospace] text-[0.72rem] text-[#a3e635] leading-relaxed max-h-[500px] overflow-y-auto whitespace-pre-wrap break-all">
            {logs || 'No logs available.'}
          </pre>
        </div>
      )}

      {/* Backups Tab */}
      {activeTab === 'backups' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[0.85rem] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.05em]">
              Backup Configurations
            </span>
            <button
              className="px-[0.9rem] py-[0.4rem] bg-[var(--accent)] border-none rounded-[6px] text-white text-[0.8rem] cursor-pointer transition-opacity hover:opacity-85"
              onClick={() => setShowBackupForm(v => !v)}
            >
              {showBackupForm ? 'Cancel' : '+ Add Backup'}
            </button>
          </div>

          {/* New Backup Form */}
          {showBackupForm && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[8px] p-5 mb-5">
              <h3 className="text-[0.95rem] font-semibold m-0 mb-1 text-[var(--text-primary)]">
                New Backup Configuration
              </h3>
              <p className="text-[0.78rem] text-[var(--text-muted)] m-0 mb-4">
                Compatible with AWS S3, Google Cloud Storage, Cloudflare R2, MinIO, and any S3-compatible storage.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-3 max-sm:grid-cols-1">
                {[
                  { key: 's3Endpoint',  label: 'S3 Endpoint URL', opt: '(leave blank for AWS)', placeholder: 'https://storage.googleapis.com', type: 'text' },
                  { key: 's3Bucket',    label: 'Bucket Name',     opt: null,                    placeholder: 'my-backups', type: 'text' },
                  { key: 's3AccessKey', label: 'Access Key',      opt: null,                    placeholder: '',           type: 'password' },
                  { key: 's3SecretKey', label: 'Secret Key',      opt: null,                    placeholder: '',           type: 'password' },
                  { key: 's3Region',    label: 'Region',          opt: '(default: us-east-1)',  placeholder: 'us-east-1',  type: 'text' },
                  { key: 's3Path',      label: 'Path Prefix',     opt: '(folder in bucket)',    placeholder: db.name,      type: 'text' },
                ].map(f => (
                  <div key={f.key} className="flex flex-col gap-[0.3rem]">
                    <label className="text-[0.72rem] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">
                      {f.label} {f.opt && <span className="normal-case tracking-normal font-normal text-[var(--text-muted)]">{f.opt}</span>}
                    </label>
                    <input
                      className={inputCls}
                      type={f.type}
                      placeholder={f.placeholder}
                      value={backupForm[f.key]}
                      onChange={e => setBackupForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>

              {/* Schedule */}
              <div className="flex flex-col gap-1.5 mb-3">
                <label className="text-[0.72rem] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">
                  Schedule <span className="normal-case tracking-normal font-normal">(cron, optional)</span>
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {BACKUP_PRESETS.map(p => (
                    <button
                      key={p.cron}
                      className={`px-[0.6rem] py-[0.25rem] border rounded-[4px] text-[var(--text-secondary)] text-[0.73rem] cursor-pointer transition-all hover:border-[var(--accent)] hover:text-[var(--accent)] ${
                        backupForm.schedule === p.cron
                          ? 'border-[var(--accent)] text-[var(--accent)] bg-[rgba(99,102,241,0.1)]'
                          : 'bg-[var(--bg)] border-[var(--border)]'
                      }`}
                      onClick={() => setBackupForm(f => ({ ...f, schedule: f.schedule === p.cron ? '' : p.cron }))}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <input
                  className={inputCls}
                  placeholder="0 2 * * * (cron expression)"
                  value={backupForm.schedule}
                  onChange={e => setBackupForm(f => ({ ...f, schedule: e.target.value }))}
                />
              </div>

              {/* Trigger Now Checkbox */}
              <label className="flex items-center gap-2 text-[0.82rem] text-[var(--text-secondary)] cursor-pointer mb-4">
                <input
                  type="checkbox"
                  checked={backupForm.triggerNow}
                  onChange={e => setBackupForm(f => ({ ...f, triggerNow: e.target.checked }))}
                />
                Run a backup immediately after saving
              </label>

              {/* Backup Actions */}
              <div className="flex gap-3">
                <button
                  className="px-4 py-[0.45rem] bg-[var(--bg)] border border-[var(--border)] rounded-[6px] text-[var(--text-secondary)] text-[0.8rem] cursor-pointer transition-colors hover:bg-[var(--border)] disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleTestS3}
                  disabled={testS3Mut.isPending}
                >
                  {testS3Mut.isPending ? 'Testing…' : '🔍 Test S3 Connection'}
                </button>
                <button
                  className="px-[1.1rem] py-[0.45rem] bg-[var(--accent)] border-none rounded-[6px] text-white text-[0.8rem] cursor-pointer transition-opacity hover:opacity-85 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleCreateBackupConfig}
                  disabled={createConf.isPending}
                >
                  {createConf.isPending ? 'Saving…' : '💾 Save Configuration'}
                </button>
              </div>
            </div>
          )}

          {/* Existing Configs */}
          {configs.length === 0 ? (
            <div className="text-[var(--text-muted)] text-[0.85rem] py-6 text-center bg-[var(--surface)] border border-[var(--border)] rounded-[8px]">
              No backup configurations yet. Click "+ Add Backup" to set one up.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
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