import { useState } from 'react'
import toast from 'react-hot-toast'
import { useDomains } from '../hooks/useDomains.js'


// ── Shared styles (same as your ServersPage) ──────────────────────────
const ghostBtn = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', borderRadius: 8,
  background: '#1f1f22', border: '1px solid rgba(255,255,255,0.06)',
  color: '#adaaad', fontSize: 12, fontWeight: 600,
  cursor: 'pointer',
}

const dangerBtn = {
  ...ghostBtn,
  color: '#ff6e84',
  borderColor: 'rgba(255,110,132,0.25)',
  background: 'rgba(255,110,132,0.08)',
}

const rawBase = import.meta.env.VITE_BASE_DOMAIN || ''

const cleanBaseDomain = rawBase
  .replace(/^https?:\/\//, '') // remove http:// or https://
  .replace(/\/$/, '')          // remove trailing slash if any


// ── Domain Row Component ──────────────────────────────────────────────
function DomainRow({ domain, onUpdate, onDelete }) {
  const [ip, setIp] = useState(domain.ip || '')
  const [ipv6, setIpv6] = useState(domain.ipv6 || '')
  const [confirmDel, setConfirmDel] = useState(false)

  function updateIP() {
    onUpdate({
      id: domain._id,
      data: { ip }
    })
  }

  function updateIPv6() {
    onUpdate({
      id: domain._id,
      data: { ipv6 }
    })
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr 1fr auto',
      alignItems: 'center',
      padding: '16px 20px',
      borderBottom: '1px solid rgba(255,255,255,0.06)'
    }}>
      {/* Domain */}
      <div style={{ color: '#f9f5f8', fontWeight: 600 }}>
        {domain.subdomain}
      </div>

      {/* IPv4 */}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={ip}
          onChange={e => setIp(e.target.value)}
          placeholder="IPv4"
          style={inputStyle}
        />
        <button style={ghostBtn} onClick={updateIP}>
          update ip
        </button>
      </div>

      {/* IPv6 */}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={ipv6}
          onChange={e => setIpv6(e.target.value)}
          placeholder="IPv6"
          style={inputStyle}
        />
        <button style={ghostBtn} onClick={updateIPv6}>
          update ipv6
        </button>
      </div>

      {/* Changed */}
      <div style={{ color: '#71717a', fontSize: 12 }}>
        {domain.lastUpdatedAt
          ? new Date(domain.lastUpdatedAt).toLocaleString()
          : '—'}
      </div>

      {/* Delete */}
      {!confirmDel ? (
        <button style={dangerBtn} onClick={() => setConfirmDel(true)}>
          delete
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            style={dangerBtn}
            onClick={() => {
              onDelete(domain._id)
              setConfirmDel(false)
            }}
          >
            yes
          </button>
          <button style={ghostBtn} onClick={() => setConfirmDel(false)}>
            no
          </button>
        </div>
      )}
    </div>
  )
}


// ── Main Page ─────────────────────────────────────────────────────────
export default function DomainPage() {
  const [subdomain, setSubdomain] = useState('')

  const {
    domains,
    isLoading,
    isCreating,
    refetch,
    createDomain,
    updateDomain,
    deleteDomain,
  } = useDomains()


  function handleCreate() {
    if (!subdomain) {
        toast.error('Enter subdomain')
        return
    }

    const cleaned = subdomain.trim().toLowerCase()
    console.log('[create] sending subdomain:', cleaned)  // ← debug

    createDomain(
        { subdomain: cleaned },
        {
        onSuccess: () => {
            toast.success('Domain created')
            setSubdomain('')
        },
        onError: (err) => {
            toast.error(err.message)
        }
        }
    )
  }


  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 30
      }}>
        <h2 style={{
          fontSize: 36,
          fontWeight: 800,
          color: '#f9f5f8'
        }}>
          Domains
        </h2>
      </div>


      {/* Add Domain */}
      <div style={{
        display: 'flex',
        gap: 10,
        marginBottom: 20
      }}>
        <span style={prefixStyle}>http://</span>

        <input
          value={subdomain}
          onChange={e => setSubdomain(e.target.value)}
          placeholder="abc"
          style={inputStyle}
        />

        <span style={suffixStyle}>
          .{cleanBaseDomain}
        </span>

        <button
            style={{
                ...primaryBtnStyle,
                opacity: isCreating ? 0.5 : 1,
                cursor: isCreating ? 'not-allowed' : 'pointer',
            }}
            onClick={handleCreate}
            disabled={isCreating}   // ← prevents double-click
            >
            {isCreating ? 'adding...' : 'add domain'}
        </button>
      </div>


      {/* Table Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 1fr auto',
        padding: '10px 20px',
        color: '#71717a',
        fontSize: 12,
        borderBottom: '1px solid rgba(255,255,255,0.06)'
      }}>
        <div>domain</div>
        <div>current ip</div>
        <div>ipv6</div>
        <div>changed</div>
        <div></div>
      </div>


      {/* List */}
      {isLoading ? (
        <div style={{ padding: 20 }}>Loading...</div>
      ) : domains.length === 0 ? (
        <div style={{ padding: 20, color: '#71717a' }}>
          No domains yet.
        </div>
      ) : (
        domains.map(d => (
          <DomainRow
            key={d._id}
            domain={d}
            onUpdate={({ id, data }) =>
                updateDomain(
                    { id, ...data },
                    {
                    onSuccess: () => toast.success('Updated')
                    }
                )
            }
            onDelete={(id) =>
                deleteDomain(id, {
                    onSuccess: () => toast.success('Deleted')
                })
            }
          />
        ))
      )}
    </div>
  )
}


// ── Styles ────────────────────────────────────────────────────────────

const inputStyle = {
  padding: '6px 10px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.1)',
  background: '#131315',
  color: '#fff',
  fontSize: 12,
  outline: 'none',
}

const prefixStyle = {
  display: 'flex',
  alignItems: 'center',
  padding: '0 10px',
  background: '#1f1f22',
  borderRadius: 6,
  color: '#71717a',
}

const suffixStyle = {
  display: 'flex',
  alignItems: 'center',
  padding: '0 10px',
  background: '#1f1f22',
  borderRadius: 6,
  color: '#71717a',
}

const primaryBtnStyle = {
  padding: '0 16px',
  borderRadius: 8,
  background: '#22c55e',
  border: 'none',
  color: '#000',
  fontWeight: 600,
  cursor: 'pointer',
}