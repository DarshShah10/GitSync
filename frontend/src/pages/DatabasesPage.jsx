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
    <div className="px-8 py-6 max-w-[1200px]">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-[var(--text-primary)] m-0">Databases</h1>
          <span className="bg-[var(--border)] text-[var(--text-secondary)] text-[0.75rem] font-semibold px-2 py-0.5 rounded-full">
            {databases.length}
          </span>
        </div>
        <div className="flex gap-3 items-center">
          <select
            className="py-2 px-3 bg-[var(--surface)] border border-[var(--border)] rounded-[6px] text-[var(--text-primary)] text-[0.8rem] outline-none"
            value={filterServer}
            onChange={e => setFilterServer(e.target.value)}
          >
            <option value="">All Servers</option>
            {servers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            className="px-4 py-2 bg-[var(--accent)] border-none rounded-[6px] text-white text-[0.85rem] font-medium cursor-pointer transition-opacity hover:opacity-85"
            onClick={() => setShowAdd(true)}
          >
            + New Database
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-[var(--text-muted)] p-8">Loading…</div>
      ) : databases.length === 0 ? (
        <div className="text-center py-16 px-8 text-[var(--text-secondary)]">
          <p className="text-[3rem] mb-2">🗄️</p>
          <p>No databases yet.</p>
          <p className="text-[0.85rem] text-[var(--text-muted)]">Click "New Database" to provision your first database.</p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
          {databases.map(db => (
            <div
              key={db.id}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4 flex flex-col gap-3 transition-colors hover:border-[var(--accent)]"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-[1.75rem] leading-none">{DB_ICONS[db.type] ?? '🗄️'}</span>
                  <div>
                    <Link
                      to={`/databases/${db.id}`}
                      className="text-[0.95rem] font-semibold text-[var(--text-primary)] no-underline hover:underline"
                    >
                      {db.name}
                    </Link>
                    <p className="text-[0.7rem] text-[var(--text-muted)] m-0 uppercase tracking-[0.05em]">
                      {db.type}
                    </p>
                  </div>
                </div>
                <StatusBadge status={db.status} />
              </div>

              {/* Meta */}
              <div className="flex flex-col gap-[0.3rem]">
                <div className="flex items-center justify-between text-[0.8rem]">
                  <span className="text-[var(--text-muted)]">Server</span>
                  <span className="text-[var(--text-secondary)] font-medium">{db.server?.name ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between text-[0.8rem]">
                  <span className="text-[var(--text-muted)]">Port</span>
                  <span className="text-[var(--text-secondary)] font-medium">{db.publicPort ?? '—'}</span>
                </div>
                {db._count?.backupConfigs !== undefined && (
                  <div className="flex items-center justify-between text-[0.8rem]">
                    <span className="text-[var(--text-muted)]">Backups</span>
                    <span className="text-[var(--text-secondary)] font-medium">{db._count.backupConfigs}</span>
                  </div>
                )}
              </div>

              {/* Connection String */}
              {db.connectionString && (
                <button
                  className={`flex items-center gap-2 px-3 py-2 bg-[var(--bg)] border rounded-[6px] cursor-pointer text-left w-full overflow-hidden transition-colors ${
                    copiedId === db.id
                      ? 'border-[#22c55e]'
                      : 'border-[var(--border)] hover:border-[var(--accent)]'
                  }`}
                  onClick={() => copyConnectionString(db)}
                  title="Click to copy connection string"
                >
                  <span className="text-[0.85rem] shrink-0">
                    {copiedId === db.id ? '✓' : '📋'}
                  </span>
                  <code className="text-[0.7rem] text-[var(--text-secondary)] font-['Courier_New',monospace] whitespace-nowrap overflow-hidden text-ellipsis">
                    {db.connectionString.replace(/:[^@]+@/, ':****@')}
                  </code>
                </button>
              )}

              {/* Creating state */}
              {db.status === 'CREATING' && (
                <div className="flex items-center gap-2 text-[0.8rem] text-[var(--text-muted)]">
                  <span className="inline-block w-3 h-3 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
                  Provisioning database…
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 flex-wrap mt-auto">
                {db.status === 'STOPPED' && (
                  <button
                    onClick={() => handleAction('start', db)}
                    className="px-3 py-[0.35rem] bg-[var(--bg)] border border-[var(--border)] rounded-[5px] text-[var(--text-secondary)] text-[0.75rem] cursor-pointer transition-colors hover:bg-[var(--border)] hover:text-[var(--text-primary)]"
                  >
                    ▶ Start
                  </button>
                )}
                {db.status === 'RUNNING' && (
                  <>
                    <button
                      onClick={() => handleAction('stop', db)}
                      className="px-3 py-[0.35rem] bg-[var(--bg)] border border-[#f59e0b] rounded-[5px] text-[#f59e0b] text-[0.75rem] cursor-pointer transition-colors hover:bg-[var(--border)]"
                    >
                      ■ Stop
                    </button>
                    <button
                      onClick={() => handleAction('restart', db)}
                      className="px-3 py-[0.35rem] bg-[var(--bg)] border border-[var(--border)] rounded-[5px] text-[var(--text-secondary)] text-[0.75rem] cursor-pointer transition-colors hover:bg-[var(--border)] hover:text-[var(--text-primary)]"
                    >
                      ↺ Restart
                    </button>
                    <Link
                      to={`/databases/${db.id}`}
                      className="px-3 py-[0.35rem] bg-[var(--bg)] border border-[var(--border)] rounded-[5px] text-[var(--text-secondary)] text-[0.75rem] no-underline transition-colors hover:bg-[var(--border)] hover:text-[var(--text-primary)]"
                    >
                      📊 Monitor
                    </Link>
                  </>
                )}
                <button
                  onClick={() => handleAction('delete', db)}
                  className="px-3 py-[0.35rem] bg-[var(--bg)] border border-[#ef4444] rounded-[5px] text-[#ef4444] text-[0.75rem] cursor-pointer transition-colors hover:bg-[rgba(239,68,68,0.1)]"
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
