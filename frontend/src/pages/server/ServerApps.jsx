import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Layers, Plus, Globe, Settings, ExternalLink, Play, Square, RotateCcw } from 'lucide-react'
import styles from '../GlobalAppsPage.module.css'

export default function ServerApps() {
  const { id } = useParams()
  const [showAdd, setShowAdd] = useState(false)

  // This is a mocked UI since the backend doesn't support server-level apps yet.
  const mockApps = [
    {
      id: 'mock-1',
      name: 'Frontend Application',
      description: 'Next.js App Router UI',
      framework: 'Next.js',
      status: 'RUNNING',
      domain: 'app.example.com',
      cpu: '2%',
      ram: '120MB',
      version: 'v1.4.2'
    },
    {
      id: 'mock-2',
      name: 'Backend API',
      description: 'Express.js Core Service',
      framework: 'Node.js',
      status: 'RUNNING',
      domain: 'api.example.com',
      cpu: '1%',
      ram: '86MB',
      version: 'v2.0.1'
    }
  ]

  return (
    <div className={styles.page} style={{ paddingTop: 0 }}>
      <div className={styles.header} style={{ marginBottom: 24 }}>
        <div>
          <h2 className={styles.title} style={{ fontSize: '1.5rem', marginBottom: 4 }}>Applications</h2>
          <p className={styles.subtitle}>Apps running on this server</p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Deploy App
        </button>
      </div>

      <div className={styles.grid}>
        {mockApps.map(app => (
          <div key={app.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>
                <div className={styles.appIcon}>
                  <Layers size={24} />
                </div>
                <div>
                  <h3 className={styles.appName}>{app.name}</h3>
                  <p className={styles.appDesc}>{app.framework} • {app.version}</p>
                </div>
              </div>
              
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', 
                borderRadius: 9999, background: 'rgba(52, 181, 250, 0.1)', 
                border: '1px solid rgba(52, 181, 250, 0.2)', fontSize: '0.625rem',
                color: 'var(--secondary)', fontWeight: 700, letterSpacing: '0.1em'
              }}>
                <div style={{width: 6, height: 6, borderRadius: '50%', background: 'var(--secondary)'}}></div>
                {app.status}
              </div>
            </div>

            <div className={styles.metaGrid}>
              <div className={styles.metaRow}>
                <Globe size={14}/>
                <a href={`https://${app.domain}`} target="_blank" rel="noreferrer" className={styles.metaValue} style={{color: 'var(--primary)', textDecoration: 'none'}}>
                  {app.domain} <ExternalLink size={10}/>
                </a>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Usage:</span>
                <span className={styles.metaValue}>{app.cpu} CPU / {app.ram}</span>
              </div>
            </div>

            <div className={styles.actions}>
              <button className={styles.actionBtn}>
                <RotateCcw size={14} /> Restart
              </button>
              <button className={styles.actionBtn}>
                <Settings size={14} /> Settings
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Deploy App Wizard Modal */}
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
              Configure GitHub integration, Build Commands, and Domain mappings here.
              <br/><br/>
              (Visual Mockup: API endpoints in development)
            </p>
            <div style={{display: 'flex', gap: 12}}>
              <button 
                onClick={() => setShowAdd(false)}
                className={styles.actionBtn}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Cancel
              </button>
              <button 
                onClick={() => setShowAdd(false)}
                className={styles.addBtn}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Connect GitHub
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
