import { useState } from 'react'
import { Plus, RefreshCw, Trash2, RotateCcw, Server, AlertCircle, ChevronRight, Wifi } from 'lucide-react'
import { useServers, useDeleteServer, useReverifyServer, useServerStatus, useTestConnection } from '../hooks/useServers.js'
import AddServerModal from '../components/AddServerModal.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import styles from './ServersPage.module.css'
import toast from 'react-hot-toast'

function ServerCard({ server, onDelete, onReverify }) {
  const isLive = server.status === 'PENDING' || server.status === 'VERIFYING'
  const { data: live } = useServerStatus(server.id, isLive)
  const { mutate: testConn, isPending: testing } = useTestConnection()

  const status       = live?.status       ?? server.status
  const errorMessage = live?.errorMessage ?? server.errorMessage
  const dockerVer    = live?.dockerVersion ?? server.dockerVersion

  const [confirmDel, setConfirmDel] = useState(false)

  function handleTest() {
    testConn(server.id, {
      onSuccess: (data) => {
        if (data.reachable) toast.success(`Reachable — ${data.latencyMs}ms`)
        else toast.error(`Unreachable: ${data.error}`)
      }
    })
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.serverIconWrap}>
          <Server size={17} strokeWidth={1.5} />
        </div>

        <div className={styles.info}>
          <div className={styles.name}>{server.name}</div>
          <div className={styles.meta}>
            <span className={styles.ip}>{server.ip}</span>
            <span className={styles.sep}>:</span>
            <span className={styles.ip}>{server.port}</span>
            <span className={styles.metaDot} />
            <span>{server.username}</span>
            <span className={styles.metaDot} />
            <span>{server.authType === 'PASSWORD' ? '🔒 password' : '🔑 key'}</span>
            {dockerVer && <><span className={styles.metaDot} /><span>Docker {dockerVer}</span></>}
          </div>
          {errorMessage && (
            <div className={styles.errorMsg}>
              <AlertCircle size={11} /> {errorMessage}
            </div>
          )}
        </div>

        <div className={styles.cardRight}>
          <StatusBadge status={status} />
        </div>
      </div>

      <div className={styles.cardActions}>
        <button className={styles.actionBtn} onClick={handleTest} disabled={testing}>
          <Wifi size={13} />
          {testing ? 'Testing…' : 'Ping'}
        </button>

        {(status === 'ERROR' || status === 'UNREACHABLE') && (
          <button className={styles.actionBtn} onClick={() => onReverify(server.id)}>
            <RotateCcw size={13} /> Reverify
          </button>
        )}

        <div className={styles.spacer} />

        {!confirmDel ? (
          <button className={`${styles.actionBtn} ${styles.danger}`} onClick={() => setConfirmDel(true)}>
            <Trash2 size={13} /> Delete
          </button>
        ) : (
          <div className={styles.confirmRow}>
            <span>Sure?</span>
            <button className={`${styles.actionBtn} ${styles.danger}`}
              onClick={() => { onDelete(server.id); setConfirmDel(false) }}>Yes</button>
            <button className={styles.actionBtn} onClick={() => setConfirmDel(false)}>No</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ServersPage() {
  const [modal, setModal] = useState(false)
  const { data: servers = [], isLoading, isError, refetch } = useServers()
  const { mutate: del }      = useDeleteServer()
  const { mutate: reverify } = useReverifyServer()

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.breadcrumb}>
            <ChevronRight size={13} /> Servers
          </div>
          <h1 className={styles.title}>Servers</h1>
          <p className={styles.subtitle}>
            {servers.length === 0
              ? 'No servers connected yet.'
              : `${servers.length} server${servers.length !== 1 ? 's' : ''} — ${servers.filter(s => s.status === 'READY').length} ready`}
          </p>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.iconBtn} onClick={() => refetch()} title="Refresh">
            <RefreshCw size={15} />
          </button>
          <button className={styles.addBtn} onClick={() => setModal(true)}>
            <Plus size={15} /> Add Server
          </button>
        </div>
      </div>

      {isLoading && (
        <div className={styles.state}>
          <div className={styles.spinner} />
          <p>Loading servers…</p>
        </div>
      )}

      {isError && (
        <div className={styles.state}>
          <AlertCircle size={28} style={{ color: 'var(--danger)' }} />
          <p>Failed to load servers</p>
          <button className={styles.addBtn} onClick={() => refetch()}>Retry</button>
        </div>
      )}

      {!isLoading && !isError && servers.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}><Server size={26} strokeWidth={1.25} /></div>
          <div className={styles.emptyTitle}>No servers yet</div>
          <div className={styles.emptySub}>Connect a VPS and we'll handle Docker setup automatically.</div>
          <button className={styles.addBtn} onClick={() => setModal(true)}>
            <Plus size={15} /> Connect First Server
          </button>
        </div>
      )}

      {!isLoading && servers.length > 0 && (
        <div className={styles.list}>
          {servers.map(s => (
            <ServerCard key={s.id} server={s} onDelete={del} onReverify={reverify} />
          ))}
        </div>
      )}

      {modal && (
        <AddServerModal onClose={() => setModal(false)} onCreated={() => refetch()} />
      )}
    </div>
  )
}
