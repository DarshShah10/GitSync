import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
import { Server, Trash2, Play, Square, RotateCcw, Copy, Check, Database as DbIcon, Plus } from 'lucide-react'

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

export default function GlobalDatabasesPage() {
  const [showAdd, setShowAdd] = useState(false)
  const [filterServer, setFilterServer] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const navigate = useNavigate()

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
    <div className="animate-[fadeIn_0.3s_ease-out]">
      {/* Header */}
      <div className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-[2.5rem] font-extrabold tracking-[-0.04em] text-[var(--text-primary)] mb-2">
            Databases
          </h2>
          <p className="text-[var(--text-secondary)] text-sm">
            Showing {databases.length} database{databases.length !== 1 ? 's' : ''} across all servers.
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <select
            className="bg-[var(--bg-elevated)] border border-[var(--border-ghost)] text-[var(--text-primary)] rounded-[var(--radius-md)] px-4 h-10 text-sm outline-none"
            value={filterServer}
            onChange={e => setFilterServer(e.target.value)}
          >
            <option value="">All Servers</option>
            {servers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            className="flex items-center gap-2 px-5 h-10 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dim)] text-white font-bold text-sm transition-all hover:opacity-90 hover:shadow-[0_0_15px_rgba(132,85,239,0.5)]"
            onClick={() => setShowAdd(true)}
          >
            <Plus size={18} /> New Database
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-[400px] bg-[var(--bg-elevated)] rounded-[var(--radius-xl)] border border-dashed border-[var(--border-ghost)]">
          <div className="w-8 h-8 border-[3px] border-[var(--border-ghost)] border-t-[var(--primary)] rounded-full animate-spin mb-4" />
          <p className="text-[var(--text-secondary)]">Loading databases…</p>
        </div>
      ) : databases.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[400px] bg-[var(--bg-elevated)] rounded-[var(--radius-xl)] border border-dashed border-[var(--border-ghost)]">
          <div className="w-16 h-16 rounded-full bg-[var(--bg-highest)] flex items-center justify-center text-[var(--text-muted)] mb-6">
            <DbIcon size={32} />
          </div>
          <div className="text-2xl font-bold mb-2">No databases yet</div>
          <div className="text-[var(--text-secondary)] mb-6">Click "New Database" to provision your first database.</div>
          <button
            className="flex items-center gap-2 px-5 h-10 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dim)] text-white font-bold text-sm transition-all hover:opacity-90 hover:shadow-[0_0_15px_rgba(132,85,239,0.5)]"
            onClick={() => setShowAdd(true)}
          >
            <Plus size={18} /> Connect First Database
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {databases.map(db => (
            <div
              key={db.id}
              className="bg-[var(--bg-elevated)] border border-[var(--border-ghost)] rounded-[var(--radius-xl)] p-6 flex flex-col transition-all hover:-translate-y-1 hover:border-[var(--border-light)] hover:shadow-[0_10px_40px_rgba(0,0,0,0.2)]"
            >
              {/* Card Header */}
              <div className="flex justify-between items-start mb-6">
                <div className="flex gap-4 items-center">
                  <div className="w-12 h-12 rounded-[var(--radius-lg)] bg-[var(--bg-highest)] flex items-center justify-center border border-[var(--border-ghost)] text-[1.5rem]">
                    {DB_ICONS[db.type] ?? <DbIcon size={24} />}
                  </div>
                  <div>
                    <Link
                      to={`/databases/${db.id}`}
                      className="text-xl font-bold text-[var(--text-primary)] mb-0.5 block no-underline hover:underline"
                    >
                      {db.name}
                    </Link>
                    <p className="text-[0.75rem] text-[var(--text-secondary)] font-semibold tracking-[0.05em] m-0">
                      {db.type}
                    </p>
                  </div>
                </div>
                <StatusBadge status={db.status} />
              </div>

              {/* Connection String */}
              {db.connectionString && (
                <div
                  className="mb-6 flex items-center justify-between bg-[var(--bg-base)] px-4 py-3 rounded-[var(--radius-md)] border border-[var(--border-light)] cursor-pointer transition-all hover:border-[var(--primary)]"
                  onClick={() => copyConnectionString(db)}
                  title="Click to copy connection string"
                >
                  <code className="font-mono text-[0.75rem] text-[var(--secondary)] whitespace-nowrap overflow-hidden text-ellipsis max-w-[80%]">
                    {db.connectionString.replace(/:[^@]+@/, ':****@')}
                  </code>
                  {copiedId === db.id
                    ? <Check className="text-[var(--text-muted)]" size={16} color="var(--success)" />
                    : <Copy className="text-[var(--text-muted)]" size={16} />
                  }
                </div>
              )}

              {/* Meta Grid */}
              <div className="grid grid-cols-2 gap-3 mb-6 bg-[var(--bg-base)] p-4 rounded-[var(--radius-md)] border border-[var(--border-ghost)]">
                <div className="flex flex-col">
                  <span className="text-[0.65rem] uppercase text-[var(--text-secondary)] font-bold tracking-[0.1em] mb-1">
                    Server
                  </span>
                  <span className="text-sm text-[var(--text-primary)] font-semibold flex items-center gap-1.5">
                    <Server size={14} color="var(--text-muted)" /> {db.server?.name ?? '—'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[0.65rem] uppercase text-[var(--text-secondary)] font-bold tracking-[0.1em] mb-1">
                    Port
                  </span>
                  <span className="text-sm text-[var(--text-primary)] font-semibold">
                    {db.publicPort ?? '—'}
                  </span>
                </div>
              </div>

              {/* Creating state */}
              {db.status === 'CREATING' && (
                <div className="text-[var(--text-secondary)] text-sm mb-4">
                  <span className="inline-block w-4 h-4 border-2 border-[var(--border-ghost)] border-t-[var(--primary)] rounded-full animate-spin align-middle" /> Provisioning...
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 mt-auto border-t border-[var(--border-light)] pt-5">
                {db.status === 'STOPPED' && (
                  <button
                    onClick={() => handleAction('start', db)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[var(--bg-highest)] border border-[var(--border-ghost)] rounded-[var(--radius-md)] text-[var(--text-secondary)] text-[0.75rem] font-semibold transition-all hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                  >
                    <Play size={14} /> Start
                  </button>
                )}
                {db.status === 'RUNNING' && (
                  <>
                    <button
                      onClick={() => handleAction('stop', db)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[var(--bg-highest)] border border-[var(--border-ghost)] rounded-[var(--radius-md)] text-[var(--text-secondary)] text-[0.75rem] font-semibold transition-all hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                    >
                      <Square size={14} /> Stop
                    </button>
                    <button
                      onClick={() => handleAction('restart', db)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[var(--bg-highest)] border border-[var(--border-ghost)] rounded-[var(--radius-md)] text-[var(--text-secondary)] text-[0.75rem] font-semibold transition-all hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                    >
                      <RotateCcw size={14} /> Restart
                    </button>
                  </>
                )}
                <div className="flex-1" />
                <button
                  onClick={() => handleAction('delete', db)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[var(--bg-highest)] border border-[var(--border-ghost)] rounded-[var(--radius-md)] text-[var(--text-secondary)] text-[0.75rem] font-semibold transition-all hover:text-[var(--danger)] hover:border-[var(--danger)] hover:bg-[rgba(255,110,132,0.1)]"
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