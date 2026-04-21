import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Layers, Plus, Trash2, Edit2, Globe } from 'lucide-react'
import api from '../services/api.js'
import toast from 'react-hot-toast'

export default function GlobalAppsPage() {
  const [showAdd, setShowAdd] = useState(false)

  const { data: res, isLoading, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/api/projects').then(res => res.data)
  })

  const projects = res?.data ?? []

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this app?')) return
    try {
      await api.delete(`/api/projects/${id}`)
      toast.success('App deleted')
      refetch()
    } catch (err) {
      toast.error('Failed to delete app')
    }
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
            Showing {projects.length} application{projects.length !== 1 ? 's' : ''} across all servers.
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <button
            className="flex items-center gap-2 px-5 h-10 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dim)] text-white font-bold text-sm transition-all hover:opacity-90 hover:shadow-[0_0_15px_rgba(132,85,239,0.5)]"
            onClick={() => setShowAdd(true)}
          >
            <Plus size={18} /> Deploy New App
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-[400px] bg-[var(--bg-elevated)] rounded-[var(--radius-xl)] border border-dashed border-[var(--border-ghost)]">
          <div className="w-8 h-8 border-[3px] border-[var(--border-ghost)] border-t-[var(--primary)] rounded-full animate-spin mb-4" />
          <p className="text-[var(--text-secondary)]">Loading apps…</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[400px] bg-[var(--bg-elevated)] rounded-[var(--radius-xl)] border border-dashed border-[var(--border-ghost)]">
          <div className="w-16 h-16 rounded-full bg-[var(--bg-highest)] flex items-center justify-center text-[var(--text-muted)] mb-6">
            <Layers size={32} />
          </div>
          <div className="text-2xl font-bold mb-2">No apps deployed</div>
          <div className="text-[var(--text-secondary)] mb-6">Deploy your code via GitHub or Docker image.</div>
          <button
            className="flex items-center gap-2 px-5 h-10 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dim)] text-white font-bold text-sm transition-all hover:opacity-90 hover:shadow-[0_0_15px_rgba(132,85,239,0.5)]"
            onClick={() => setShowAdd(true)}
          >
            <Plus size={18} /> Deploy First App
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {projects.map(proj => (
            <div
              key={proj.id}
              className="bg-[var(--bg-elevated)] border border-[var(--border-ghost)] rounded-[var(--radius-xl)] p-6 flex flex-col transition-all hover:-translate-y-1 hover:border-[var(--border-light)] hover:shadow-[0_10px_40px_rgba(0,0,0,0.2)]"
            >
              {/* Card Header */}
              <div className="flex justify-between items-start mb-6">
                <div className="flex gap-4 items-center">
                  <div className="w-12 h-12 rounded-[var(--radius-lg)] bg-[var(--bg-highest)] flex items-center justify-center border border-[var(--border-ghost)] text-[var(--secondary)]">
                    <Layers size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[var(--text-primary)] mb-0.5">{proj.name}</h3>
                    <p className="text-[0.75rem] text-[var(--text-secondary)]">
                      {proj.description || 'No description provided'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Meta Grid */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <Globe size={14} />
                  <span className="text-[var(--text-primary)] font-semibold">Waiting for deploy...</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <span>Environments:</span>
                  <span className="text-[var(--text-primary)] font-semibold">
                    {proj._count?.environments || 0}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-auto border-t border-[var(--border-light)] pt-5">
                <button className="flex items-center gap-1.5 px-4 py-2 bg-[var(--bg-highest)] border border-[var(--border-ghost)] rounded-[var(--radius-md)] text-[var(--text-secondary)] text-[0.75rem] font-semibold transition-all hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
                  <Edit2 size={14} /> Edit
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => handleDelete(proj.id)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[var(--bg-highest)] border border-[var(--border-ghost)] rounded-[var(--radius-md)] text-[var(--text-secondary)] text-[0.75rem] font-semibold transition-all hover:text-[var(--danger)] hover:border-[var(--danger)] hover:bg-[rgba(255,110,132,0.1)]"
                >
                  <Trash2 size={14} color="var(--danger)" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Deploy Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-[10px] flex items-center justify-center z-[100]">
          <div className="bg-[var(--bg-surface)] p-8 rounded-[var(--radius-xl)] w-[500px] border border-[var(--border-ghost)]">
            <h3 className="text-xl mb-4">Deploy App Wizard</h3>
            <p className="text-[var(--text-secondary)] mb-6">
              App deployment from Git is currently being rolled out in the backend.
              <br /><br />
              Check back soon for fully automated CI/CD pipelines!
            </p>
            <button
              onClick={() => setShowAdd(false)}
              className="flex items-center justify-center gap-2 px-5 h-10 w-full rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dim)] text-white font-bold text-sm transition-all hover:opacity-90 hover:shadow-[0_0_15px_rgba(132,85,239,0.5)]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}