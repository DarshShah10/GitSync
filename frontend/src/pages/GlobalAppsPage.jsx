import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Layers, Plus, Trash2, Edit2, Play, Square, Globe } from 'lucide-react'
import api from '../services/api.js'
import styles from './GlobalAppsPage.module.css'
import toast from 'react-hot-toast'

export default function GlobalAppsPage() {
  const [showAdd, setShowAdd] = useState(false)

  // Fetch from the backend '/api/projects' as the apps equivalent
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
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Applications</h2>
          <p className={styles.subtitle}>
            Showing {projects.length} application{projects.length !== 1 ? 's' : ''} across all servers.
          </p>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.addBtn} onClick={() => setShowAdd(true)}>
            <Plus size={18} /> Deploy New App
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.state}>
          <div className={styles.spinner} />
          <p style={{ color: 'var(--text-secondary)' }}>Loading apps…</p>
        </div>
      ) : projects.length === 0 ? (
        <div className={styles.state}>
          <div className={styles.emptyIcon}><Layers size={32} /></div>
          <div className={styles.emptyTitle}>No apps deployed</div>
          <div className={styles.emptySub}>Deploy your code via GitHub or Docker image.</div>
          <button className={styles.addBtn} onClick={() => setShowAdd(true)}>
            <Plus size={18} /> Deploy First App
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {projects.map(proj => (
            <div key={proj.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardTitle}>
                  <div className={styles.appIcon}>
                    <Layers size={24} />
                  </div>
                  <div>
                    <h3 className={styles.appName}>{proj.name}</h3>
                    <p className={styles.appDesc}>{proj.description || 'No description provided'}</p>
                  </div>
                </div>
              </div>

              <div className={styles.metaGrid}>
                <div className={styles.metaRow}>
                  <Globe size={14}/>
                  <span className={styles.metaValue}>Waiting for deploy...</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Environments:</span>
                  <span className={styles.metaValue}>{proj._count?.environments || 0}</span>
                </div>
              </div>

              <div className={styles.actions}>
                <button className={styles.actionBtn}>
                  <Edit2 size={14} /> Edit
                </button>
                <div style={{ flex: 1 }} />
                <button
                  onClick={() => handleDelete(proj.id)}
                  className={`${styles.actionBtn} ${styles.danger}`}
                >
                  <Trash2 size={14} color="var(--danger)" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mock Deployment Modal */}
      {showAdd && (
        <div style={{
          position: 'fixed', inset: 0, 
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div style={{
            background: 'var(--bg-surface)', padding: 32, borderRadius: 'var(--radius-xl)', 
            width: 500, border: '1px solid var(--border-ghost)'
          }}>
            <h3 style={{fontSize: '1.25rem', marginBottom: 16}}>Deploy App Wizard</h3>
            <p style={{color: 'var(--text-secondary)', marginBottom: 24}}>
              App deployment from Git is currently being rolled out in the backend. 
              <br/><br/>
              Check back soon for fully automated CI/CD pipelines!
            </p>
            <button 
              onClick={() => setShowAdd(false)}
              className={styles.addBtn}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
