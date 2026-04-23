import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Layers, Plus, Globe, GitBranch, Server,
  Activity, Clock, ExternalLink, RefreshCw, Trash2
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import api from '../services/api.js'

const STATUS_CONFIG = {
  RUNNING:   { color: '#50fa7b', bg: 'rgba(80,250,123,0.12)',  label: 'Running'   },
  BUILDING:  { color: '#f1fa8c', bg: 'rgba(241,250,140,0.12)', label: 'Building'  },
  DEPLOYING: { color: '#8be9fd', bg: 'rgba(139,233,253,0.12)', label: 'Deploying' },
  STOPPED:   { color: '#6272a4', bg: 'rgba(98,114,164,0.12)',  label: 'Stopped'   },
  ERROR:     { color: '#ff5555', bg: 'rgba(255,85,85,0.12)',   label: 'Error'     },
  QUEUED:    { color: '#ffb86c', bg: 'rgba(255,184,108,0.12)', label: 'Queued'    },
}

function getStatus(status) {
  return STATUS_CONFIG[status?.toUpperCase()] ?? STATUS_CONFIG.STOPPED
}

function timeAgo(date) {
  if (!date) return 'Never'
  const diff  = Date.now() - new Date(date).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  < 1)  return 'Just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export default function GlobalAppsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false)

  const { data: res, isLoading, refetch } = useQuery({
    queryKey: ['services'],
    queryFn:  () => api.get('/api/services').then(r => r.data),
    refetchInterval: 10000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/api/services/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] })
    },
  })

  const deleteAllMutation = useMutation({
    mutationFn: (ids) => Promise.all(ids.map(id => api.delete(`/api/services/${id}`))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] })
      setConfirmingDeleteAll(false)
    },
  })

  const services = Array.isArray(res) ? res : (res?.data ?? [])

  function handleDeleteAll() {
    const ids = services.map(s => s._id)
    deleteAllMutation.mutate(ids)
  }

  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">

      {/* Header */}
      <div className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-[2.5rem] font-extrabold tracking-[-0.04em] text-[var(--text-primary)] mb-2">
            Applications
          </h2>
          <p className="text-[var(--text-secondary)] text-sm">
            {isLoading
              ? 'Loading…'
              : `${services.length} application${services.length !== 1 ? 's' : ''} across all servers.`
            }
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            title="Refresh"
            className="h-10 w-10 flex items-center justify-center
                       rounded-[var(--radius-md)] border border-[var(--border-ghost)]
                       text-[var(--text-muted)] hover:text-[var(--text-primary)]
                       hover:border-[var(--primary)] transition-all"
          >
            <RefreshCw size={15} />
          </button>

          {/* Delete All button — only shown when there are services */}
          {services.length > 0 && !confirmingDeleteAll && (
            <button
              onClick={() => setConfirmingDeleteAll(true)}
              title="Delete all apps"
              className="flex items-center gap-2 px-4 h-10 rounded-[var(--radius-md)]
                         border border-[rgba(255,85,85,0.3)]
                         text-[#ff5555] font-bold text-sm
                         hover:bg-[rgba(255,85,85,0.08)] hover:border-[rgba(255,85,85,0.6)]
                         transition-all"
            >
              <Trash2 size={15} /> Delete All
            </button>
          )}

          {/* Delete All inline confirmation */}
          {confirmingDeleteAll && (
            <div className="flex items-center gap-2 px-3 h-10
                            rounded-[var(--radius-md)]
                            border border-[rgba(255,85,85,0.4)]
                            bg-[rgba(255,85,85,0.06)]">
              <span className="text-[0.75rem] text-[#ff5555] font-semibold whitespace-nowrap">
                Delete all {services.length} apps?
              </span>
              <button
                onClick={() => setConfirmingDeleteAll(false)}
                disabled={deleteAllMutation.isPending}
                className="px-3 h-6 rounded text-[0.7rem] font-semibold
                           border border-[var(--border-ghost)] text-[var(--text-secondary)]
                           hover:text-[var(--text-primary)] hover:border-[var(--border-light)]
                           transition-all disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={deleteAllMutation.isPending}
                className="px-3 h-6 rounded text-[0.7rem] font-bold
                           bg-[#ff5555] text-white
                           hover:bg-[#ff3333] hover:shadow-[0_0_10px_rgba(255,85,85,0.4)]
                           transition-all disabled:opacity-50 disabled:cursor-not-allowed
                           flex items-center gap-1.5"
              >
                {deleteAllMutation.isPending
                  ? <><div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Deleting…</>
                  : 'Yes, Delete All'
                }
              </button>
            </div>
          )}

          <button
            onClick={() => navigate('/apps/resource')}
            className="flex items-center gap-2 px-5 h-10 rounded-[var(--radius-md)]
                       bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dim)]
                       text-white font-bold text-sm transition-all
                       hover:opacity-90 hover:shadow-[0_0_15px_rgba(132,85,239,0.5)]"
          >
            <Plus size={18} /> Deploy New App
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <EmptyShell>
          <div className="w-8 h-8 border-[3px] border-[var(--border-ghost)] border-t-[var(--primary)] rounded-full animate-spin mb-4" />
          <p className="text-[var(--text-secondary)]">Loading apps…</p>
        </EmptyShell>

      ) : services.length === 0 ? (
        <EmptyShell>
          <div className="w-16 h-16 rounded-full bg-[var(--bg-highest)] flex items-center justify-center text-[var(--text-muted)] mb-6">
            <Layers size={32} />
          </div>
          <div className="text-2xl font-bold mb-2">No apps deployed</div>
          <div className="text-[var(--text-secondary)] mb-6 text-sm text-center max-w-[280px]">
            Deploy your first app from a public Git repository.
          </div>
          <button
            onClick={() => navigate('/apps/resource')}
            className="flex items-center gap-2 px-5 h-10 rounded-[var(--radius-md)]
                       bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dim)]
                       text-white font-bold text-sm transition-all
                       hover:opacity-90 hover:shadow-[0_0_15px_rgba(132,85,239,0.5)]"
          >
            <Plus size={18} /> Deploy First App
          </button>
        </EmptyShell>

      ) : (
        <div className="grid grid-cols-2 gap-6">
          {services.map(svc => (
            <ServiceCard
              key={svc._id}
              svc={svc}
              onClick={() => navigate(`/apps/${svc._id}`)}
              onDelete={(id) => deleteMutation.mutate(id)}
              isDeleting={deleteMutation.isPending && deleteMutation.variables === svc._id}
              isDimmed={deleteAllMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ServiceCard({ svc, onClick, onDelete, isDeleting, isDimmed }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const status   = getStatus(svc.status)
  const domain   = svc.domain?.replace(/^https?:\/\//, '') ?? null
  const repoName = svc.config?.repoUrl?.split('/').slice(-2).join('/').replace('.git', '') ?? null
  const server   = svc.serverId

  function handleDeleteClick(e) {
    e.stopPropagation()
    setConfirmingDelete(true)
  }

  function handleConfirmDelete(e) {
    e.stopPropagation()
    onDelete(svc._id)
    setConfirmingDelete(false)
  }

  function handleCancelDelete(e) {
    e.stopPropagation()
    setConfirmingDelete(false)
  }

  return (
    <div
      onClick={!confirmingDelete ? onClick : undefined}
      className={`
        relative group
        bg-[var(--bg-elevated)] border border-[var(--border-ghost)]
        rounded-[var(--radius-xl)] p-6 flex flex-col cursor-pointer
        transition-all hover:-translate-y-1
        hover:border-[var(--border-light)]
        hover:shadow-[0_10px_40px_rgba(0,0,0,0.2)]
        ${isDimmed ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
      {/* Delete button — visible on hover */}
      {!confirmingDelete && (
        <button
          onClick={handleDeleteClick}
          title="Delete app"
          disabled={isDeleting}
          className="
            absolute top-4 right-4 z-10
            w-7 h-7 flex items-center justify-center
            rounded-[var(--radius-md)]
            opacity-0 group-hover:opacity-100
            text-[var(--text-muted)] hover:text-[#ff5555]
            hover:bg-[rgba(255,85,85,0.1)]
            border border-transparent hover:border-[rgba(255,85,85,0.25)]
            transition-all duration-150
            disabled:opacity-40 disabled:cursor-not-allowed
          "
        >
          {isDeleting
            ? <div className="w-3.5 h-3.5 border-2 border-[#ff5555] border-t-transparent rounded-full animate-spin" />
            : <Trash2 size={14} />
          }
        </button>
      )}

      {/* Confirmation overlay */}
      {confirmingDelete && (
        <div
          onClick={e => e.stopPropagation()}
          className="
            absolute inset-0 z-20 rounded-[var(--radius-xl)]
            bg-[var(--bg-elevated)]/95 backdrop-blur-sm
            flex flex-col items-center justify-center gap-4
            border border-[rgba(255,85,85,0.35)]
          "
        >
          <div className="w-10 h-10 rounded-full bg-[rgba(255,85,85,0.12)] flex items-center justify-center">
            <Trash2 size={18} className="text-[#ff5555]" />
          </div>
          <div className="text-center px-4">
            <p className="text-[var(--text-primary)] font-bold text-sm mb-1">Delete "{svc.name}"?</p>
            <p className="text-[var(--text-muted)] text-xs">This action cannot be undone.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancelDelete}
              className="px-4 h-8 rounded-[var(--radius-md)]
                         border border-[var(--border-ghost)]
                         text-[var(--text-secondary)] text-xs font-semibold
                         hover:border-[var(--border-light)] hover:text-[var(--text-primary)]
                         transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="px-4 h-8 rounded-[var(--radius-md)]
                         bg-[#ff5555] text-white text-xs font-bold
                         hover:bg-[#ff3333] hover:shadow-[0_0_12px_rgba(255,85,85,0.45)]
                         transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? 'Deleting…' : 'Yes, Delete'}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-[var(--radius-lg)]
                          bg-[var(--bg-highest)] border border-[var(--border-ghost)]
                          flex items-center justify-center text-[var(--primary)]">
            <Layers size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)] leading-tight">
              {svc.name}
            </h3>
            {repoName && (
              <p className="text-[0.72rem] text-[var(--text-muted)] mt-0.5 font-mono">
                {repoName}
              </p>
            )}
          </div>
        </div>

        {/* Status badge */}
        <span
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.68rem] font-bold flex-shrink-0"
          style={{ color: status.color, background: status.bg }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: status.color,
              boxShadow: svc.status === 'RUNNING' ? `0 0 6px ${status.color}` : 'none'
            }}
          />
          {status.label}
        </span>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-2.5 mb-5 flex-1">
        {domain ? (
          <div className="flex items-center gap-2 text-[0.78rem]">
            <Globe size={13} className="text-[var(--text-muted)] flex-shrink-0" />
            <a
              href={svc.domain}
              target="_blank"
              rel="noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-[var(--primary)] hover:underline truncate flex items-center gap-1"
            >
              {domain} <ExternalLink size={10} />
            </a>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[0.78rem] text-[var(--text-muted)]">
            <Globe size={13} className="flex-shrink-0" />
            <span>No domain configured</span>
          </div>
        )}

        {svc.config?.branch && (
          <div className="flex items-center gap-2 text-[0.78rem] text-[var(--text-secondary)]">
            <GitBranch size={13} className="text-[var(--text-muted)] flex-shrink-0" />
            <span className="font-mono">{svc.config.branch}</span>
            {svc.config?.buildPack && (
              <span className="ml-1 px-1.5 py-0.5 rounded text-[0.62rem] font-bold
                               bg-[var(--bg-highest)] text-[var(--text-muted)] uppercase tracking-wide">
                {svc.config.buildPack}
              </span>
            )}
          </div>
        )}

        {server && (
          <div className="flex items-center gap-2 text-[0.78rem] text-[var(--text-secondary)]">
            <Server size={13} className="text-[var(--text-muted)] flex-shrink-0" />
            <span>{server.name}</span>
            <span className="text-[var(--text-muted)] font-mono text-[0.68rem]">{server.ip}</span>
          </div>
        )}

        {svc.internalPort && (
          <div className="flex items-center gap-2 text-[0.78rem] text-[var(--text-secondary)]">
            <Activity size={13} className="text-[var(--text-muted)] flex-shrink-0" />
            <span>Port {svc.internalPort}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-[var(--border-ghost)]">
        <div className="flex items-center gap-1.5 text-[0.7rem] text-[var(--text-muted)]">
          <Clock size={11} />
          <span>
            {svc.lastDeployedAt
              ? `Deployed ${timeAgo(svc.lastDeployedAt)}`
              : `Created ${timeAgo(svc.createdAt)}`
            }
          </span>
        </div>
        <span className="text-[0.7rem] font-semibold text-[var(--primary)]">
          Configure →
        </span>
      </div>
    </div>
  )
}

function EmptyShell({ children }) {
  return (
    <div className="
      flex flex-col items-center justify-center h-[400px]
      bg-[var(--bg-elevated)] rounded-[var(--radius-xl)]
      border border-dashed border-[var(--border-ghost)]
    ">
      {children}
    </div>
  )
}