import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  useSources,
  useCreateSource,
  useDeleteSource,
  useInitiateAutomated,
} from '../hooks/useSources.js'
import toast from 'react-hot-toast'

// ── Shared styles ────────────────────────────────────────────────────
const ghostBtn = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', borderRadius: 8,
  background: '#1f1f22', border: '1px solid rgba(255,255,255,0.06)',
  color: '#adaaad', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', transition: 'all 0.15s',
}
const dangerBtn = {
  ...ghostBtn, color: '#ff6e84',
  borderColor: 'rgba(255,110,132,0.25)',
  background: 'rgba(255,110,132,0.08)',
}
const primaryBtn = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '0 20px', height: 40, borderRadius: 10,
  background: 'linear-gradient(135deg, #ba9eff, #8455ef)',
  border: 'none', color: '#000', fontWeight: 700, fontSize: 13,
  cursor: 'pointer', boxShadow: '0 0 16px rgba(186,158,255,0.2)',
}
const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  background: '#0e0e10', border: '1px solid rgba(255,255,255,0.08)',
  color: '#f9f5f8', fontSize: 13, outline: 'none', boxSizing: 'border-box',
}
const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.1em',
  color: '#71717a', marginBottom: 6,
}
const fieldStyle = { marginBottom: 16 }

// ── GitHub icon ──────────────────────────────────────────────────────
function GithubIcon({ size = 24, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
    </svg>
  )
}

function XCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  )
}

// ── Add Source Modal ─────────────────────────────────────────────────
function AddSourceModal({ onClose, onCreated }) {
  const [step, setStep]   = useState('method') // 'method' | 'manual' | 'automated-init'
  const [form, setForm]   = useState({
    name: '', organization: '', isSystemWide: false,
    appId: '', installationId: '', clientId: '',
    clientSecret: '', webhookSecret: '', privateKey: '',
    htmlUrl: 'https://github.com', apiUrl: 'https://api.github.com',
    gitUser: 'git', gitPort: '22',
    showEnterprise: false,
  })

  const { mutate: create,   isPending: creating }   = useCreateSource()
  const { mutate: initiate, isPending: initiating } = useInitiateAutomated()

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  function handleManualSubmit(e) {
    e.preventDefault()
    create({
      name:           form.name,
      organization:   form.organization || undefined,
      isSystemWide:   form.isSystemWide,
      appId:          form.appId || undefined,
      installationId: form.installationId || undefined,
      clientId:       form.clientId || undefined,
      clientSecret:   form.clientSecret || undefined,
      webhookSecret:  form.webhookSecret || undefined,
      privateKey:     form.privateKey || undefined,
      htmlUrl:        form.htmlUrl,
      apiUrl:         form.apiUrl,
      gitUser:        form.gitUser,
      gitPort:        Number(form.gitPort) || 22,
    }, { onSuccess: () => { onCreated(); onClose() } })
  }

  function handleAutomatedStart(e) {
    e.preventDefault()
    initiate(
      { name: form.name, organization: form.organization || undefined, isSystemWide: form.isSystemWide },
      {
        onSuccess: ({ data }) => {
          // GitHub App Manifest flow needs a POST form submission (not a GET redirect).
          // A hidden <form> is built, appended, submitted, then removed — this navigates
          // the user to GitHub's clean one-click "Create GitHub App for <user>" page.
          const formEl = document.createElement('form')
          formEl.method  = 'POST'
          formEl.action  = data.githubPostUrl   // https://github.com/settings/apps/new?state=<id>
          formEl.style.display = 'none'

          const input = document.createElement('input')
          input.type  = 'hidden'
          input.name  = 'manifest'
          input.value = data.manifestJson       // the JSON string GitHub reads

          formEl.appendChild(input)
          document.body.appendChild(formEl)
          formEl.submit()
          // no need to remove — page is navigating away
          onClose()
        },
      }
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
        background: '#131315', borderRadius: 20,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
        padding: 32,
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#f9f5f8' }}>
              {step === 'method'           ? 'Add GitHub Source'
                : step === 'manual'        ? 'Manual Installation'
                : step === 'automated-init'? 'Automated Installation'
                :                            'Finish on GitHub'}
            </h3>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#71717a' }}>
              {step === 'method' && 'Connect Sovereign to your private GitHub repositories.'}
              {step === 'manual' && 'Fill in your existing GitHub App credentials.'}
              {step === 'automated-init' && 'Sovereign will create the GitHub App for you.'}

            </p>
          </div>
          <button onClick={onClose} style={{ ...ghostBtn, padding: '6px 10px', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        {/* ── Step: Method selection ── */}
        {step === 'method' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <button
              onClick={() => setStep('automated-init')}
              style={{
                padding: 24, borderRadius: 14, textAlign: 'left', cursor: 'pointer',
                background: 'linear-gradient(135deg, rgba(186,158,255,0.08), rgba(132,85,239,0.04))',
                border: '1px solid rgba(186,158,255,0.2)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(186,158,255,0.45)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(186,158,255,0.2)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>⚡</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#ba9eff' }}>Automated Installation</span>
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 20,
                  background: 'rgba(74,222,128,0.12)', color: '#4ade80',
                  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>Recommended</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#71717a', lineHeight: 1.6 }}>
                Sovereign creates and configures the GitHub App for you via GitHub's OAuth flow. No manual setup required.
              </p>
            </button>

            <button
              onClick={() => setStep('manual')}
              style={{
                padding: 24, borderRadius: 14, textAlign: 'left', cursor: 'pointer',
                background: '#1a1a1e', border: '1px solid rgba(255,255,255,0.07)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>🔧</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#f9f5f8' }}>Manual Installation</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#71717a', lineHeight: 1.6 }}>
                You already have a GitHub App (e.g. company-managed). Paste in the credentials manually.
              </p>
            </button>
          </div>
        )}

        {/* ── Step: Automated init form ── */}
        {step === 'automated-init' && (
          <form onSubmit={handleAutomatedStart}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Source Name *</label>
              <input style={inputStyle} placeholder="e.g. my-github" value={form.name}
                onChange={e => set('name', e.target.value)} required />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Organization (optional)</label>
              <input style={inputStyle} placeholder="Leave blank for personal account" value={form.organization}
                onChange={e => set('organization', e.target.value)} />
              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#52525b' }}>
                Fill in to use a GitHub org's repos instead of your personal account.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <input type="checkbox" id="syswide-auto" checked={form.isSystemWide}
                onChange={e => set('isSystemWide', e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#8455ef' }} />
              <label htmlFor="syswide-auto" style={{ fontSize: 13, color: '#adaaad', cursor: 'pointer' }}>
                System-wide (all teams in this Sovereign instance can use this source)
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setStep('method')} style={ghostBtn}>← Back</button>
              <button type="submit" style={{ ...primaryBtn, height: 38 }} disabled={initiating}>
                {initiating ? 'Creating…' : 'Continue to GitHub →'}
              </button>
            </div>
          </form>
        )}


        {/* ── Step: Manual form ── */}
        {step === 'manual' && (
          <form onSubmit={handleManualSubmit}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Source Name *</label>
              <input style={inputStyle} placeholder="e.g. company-github" value={form.name}
                onChange={e => set('name', e.target.value)} required />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Organization (optional)</label>
              <input style={inputStyle} placeholder="Leave blank for personal account" value={form.organization}
                onChange={e => set('organization', e.target.value)} />
            </div>

            <div style={{
              height: 1, background: 'rgba(255,255,255,0.06)',
              margin: '4px 0 20px',
            }} />

            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#52525b', marginBottom: 16 }}>
              GitHub App Credentials
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>App ID</label>
                <input style={inputStyle} placeholder="123456" value={form.appId}
                  onChange={e => set('appId', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Installation ID</label>
                <input style={inputStyle} placeholder="987654" value={form.installationId}
                  onChange={e => set('installationId', e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Client ID</label>
                <input style={inputStyle} placeholder="Iv1.abc123" value={form.clientId}
                  onChange={e => set('clientId', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Client Secret</label>
                <input style={inputStyle} type="password" placeholder="••••••••" value={form.clientSecret}
                  onChange={e => set('clientSecret', e.target.value)} />
              </div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Webhook Secret</label>
              <input style={inputStyle} type="password" placeholder="••••••••" value={form.webhookSecret}
                onChange={e => set('webhookSecret', e.target.value)} />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Private Key (PEM)</label>
              <textarea
                style={{ ...inputStyle, minHeight: 120, resize: 'vertical', fontFamily: 'monospace', fontSize: 11 }}
                placeholder={'-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'}
                value={form.privateKey}
                onChange={e => set('privateKey', e.target.value)}
              />
            </div>

            {/* Enterprise toggle */}
            <button
              type="button"
              onClick={() => set('showEnterprise', !form.showEnterprise)}
              style={{ ...ghostBtn, marginBottom: 16, width: '100%', justifyContent: 'center' }}
            >
              {form.showEnterprise ? '▲' : '▼'} Self-hosted / Enterprise GitHub settings
            </button>

            {form.showEnterprise && (
              <div style={{
                background: '#0e0e10', borderRadius: 10, padding: 16,
                border: '1px solid rgba(255,255,255,0.06)', marginBottom: 16,
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={labelStyle}>HTML URL</label>
                    <input style={inputStyle} value={form.htmlUrl}
                      onChange={e => set('htmlUrl', e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>API URL</label>
                    <input style={inputStyle} value={form.apiUrl}
                      onChange={e => set('apiUrl', e.target.value)} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Git User</label>
                    <input style={inputStyle} value={form.gitUser}
                      onChange={e => set('gitUser', e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Git Port</label>
                    <input style={inputStyle} type="number" value={form.gitPort}
                      onChange={e => set('gitPort', e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <input type="checkbox" id="syswide-manual" checked={form.isSystemWide}
                onChange={e => set('isSystemWide', e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#8455ef' }} />
              <label htmlFor="syswide-manual" style={{ fontSize: 13, color: '#adaaad', cursor: 'pointer' }}>
                System-wide (all teams can use this source)
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setStep('method')} style={ghostBtn}>← Back</button>
              <button type="submit" style={{ ...primaryBtn, height: 38 }} disabled={creating}>
                {creating ? 'Saving…' : 'Save Source'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Source Card ──────────────────────────────────────────────────────
function SourceCard({ source, onDelete }) {
  const [confirmDel, setConfirmDel] = useState(false)

  const typeLabel = source.installationType === 'automated' ? 'Automated' : 'Manual'
  const typeColor = source.installationType === 'automated' ? '#ba9eff' : '#71717a'

  const orgOrUser = source.organization
    ? `@${source.organization}`
    : 'Personal account'

  return (
    <div
      style={{
        background: '#131315', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 16, padding: 24,
        transition: 'transform 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)';    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: '#1f1f22', border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <GithubIcon size={26} color="#d4d4d8" />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#f9f5f8', marginBottom: 4 }}>
              {source.name}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#52525b' }}>{orgOrUser}</span>
              <span style={{ color: '#3f3f46', fontSize: 10 }}>·</span>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 700,
                background: source.installationType === 'automated'
                  ? 'rgba(186,158,255,0.1)' : 'rgba(255,255,255,0.05)',
                color: typeColor,
              }}>{typeLabel}</span>
              {source.isSystemWide && (
                <>
                  <span style={{ color: '#3f3f46', fontSize: 10 }}>·</span>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 700,
                    background: 'rgba(52,181,250,0.1)', color: '#34b5fa',
                  }}>System-wide</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Connection badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
          background: source.isConnected ? 'rgba(74,222,128,0.1)' : 'rgba(255,110,132,0.08)',
          border: source.isConnected ? '1px solid rgba(74,222,128,0.2)' : '1px solid rgba(255,110,132,0.15)',
          color: source.isConnected ? '#4ade80' : '#ff6e84',
        }}>
          {source.isConnected ? <CheckCircleIcon /> : <XCircleIcon />}
          {source.isConnected ? 'Connected' : 'Not connected'}
        </div>
      </div>

      {/* Credential summary */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
        background: '#0e0e10', borderRadius: 10, padding: '12px 16px',
        border: '1px solid rgba(255,255,255,0.04)', marginBottom: 20,
      }}>
        {[
          ['App ID',          source.appId          || '—'],
          ['Installation ID', source.installationId || '—'],
          ['Client ID',       source.clientId       || '—'],
          ['HTML URL',        source.htmlUrl         || '—'],
        ].map(([k, v]) => (
          <div key={k}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#52525b', marginBottom: 2 }}>{k}</div>
            <div style={{ fontSize: 12, color: '#adaaad', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.04)',
      }}>
        <div style={{ flex: 1 }} />
        {!confirmDel ? (
          <button style={dangerBtn} onClick={() => setConfirmDel(true)}>🗑 Delete</button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#71717a' }}>
            <span>Delete this source?</span>
            <button style={dangerBtn} onClick={() => { onDelete(source.id); setConfirmDel(false) }}>Yes</button>
            <button style={ghostBtn}  onClick={() => setConfirmDel(false)}>No</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Empty state ──────────────────────────────────────────────────────
function EmptyShell({ children }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: 400, background: '#131315', borderRadius: 16,
      border: '1px dashed rgba(255,255,255,0.07)',
    }}>
      {children}
    </div>
  )
}

function Spinner() {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%',
      border: '3px solid rgba(255,255,255,0.06)',
      borderTopColor: '#ba9eff',
      animation: 'spin 0.8s linear infinite',
      marginBottom: 16,
    }} />
  )
}

// ── Main page ────────────────────────────────────────────────────────
export default function SourcesPage() {
  const [modal, setModal] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  const { data, isLoading, isError, refetch } = useSources()
  const { mutate: del } = useDeleteSource()

  const sources = data?.data ?? []

  // Handle GitHub OAuth callback redirect
  useEffect(() => {
    const connected  = searchParams.get('connected')
    const error      = searchParams.get('error')
    const sourceId   = searchParams.get('sourceId')

    if (connected === 'true') {
      toast.success('GitHub App connected successfully!')
      refetch()
      setSearchParams({})
    } else if (error) {
      const messages = {
        missing_state:    'OAuth state parameter missing',
        source_not_found: 'Source record not found',
        callback_failed:  'GitHub callback failed — please try again',
      }
      toast.error(messages[error] || `GitHub connection error: ${error}`)
      setSearchParams({})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }}>
        <div>
          <h2 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.04em', color: '#f9f5f8', margin: 0 }}>
            Sources
          </h2>
          <p style={{ color: '#71717a', fontSize: 14, margin: '8px 0 0' }}>
            {sources.length === 0
              ? 'Connect Sovereign to your private GitHub repositories.'
              : `${sources.length} GitHub source${sources.length !== 1 ? 's' : ''} connected.`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => refetch()}
            style={{
              width: 40, height: 40, borderRadius: 10,
              background: '#131315', border: '1px solid rgba(255,255,255,0.06)',
              color: '#71717a', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 16, transition: 'all 0.15s',
            }}
            title="Refresh"
          >↻</button>
          <button onClick={() => setModal(true)} style={primaryBtn}>
            + New Source
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div style={{
        background: 'rgba(186,158,255,0.05)', borderRadius: 12,
        border: '1px solid rgba(186,158,255,0.12)',
        padding: '14px 20px', marginBottom: 32,
        display: 'flex', gap: 14, alignItems: 'flex-start',
      }}>
        <GithubIcon size={20} color="#ba9eff" />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#ba9eff', marginBottom: 4 }}>
            What are Sources?
          </div>
          <div style={{ fontSize: 13, color: '#71717a', lineHeight: 1.7 }}>
            Sources let Sovereign authenticate with GitHub to clone private repositories, trigger auto-deploys on
            push via webhooks, and manage deployment credentials securely. Public repos don't need a source.
          </div>
        </div>
      </div>

      {/* States */}
      {isLoading && (
        <EmptyShell><Spinner /><span style={{ color: '#71717a', fontSize: 14 }}>Loading sources…</span></EmptyShell>
      )}
      {isError && (
        <EmptyShell>
          <div style={{ color: '#ff6e84', fontSize: 32, marginBottom: 16 }}>⚠</div>
          <p style={{ color: '#71717a', marginBottom: 16 }}>Failed to load sources</p>
          <button onClick={() => refetch()} style={primaryBtn}>Retry</button>
        </EmptyShell>
      )}
      {!isLoading && !isError && sources.length === 0 && (
        <EmptyShell>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: '#1f1f22', border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
          }}>
            <GithubIcon size={34} color="#52525b" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f9f5f8', marginBottom: 8 }}>No sources yet</div>
          <div style={{ color: '#71717a', marginBottom: 28, textAlign: 'center', maxWidth: 360, fontSize: 14, lineHeight: 1.7 }}>
            Add a GitHub source to deploy from private repositories and enable auto-deploy on push.
          </div>
          <button onClick={() => setModal(true)} style={primaryBtn}>+ Add First Source</button>
        </EmptyShell>
      )}

      {/* Grid */}
      {!isLoading && sources.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 20 }}>
          {sources.map(s => (
            <SourceCard key={s.id || s._id} source={s} onDelete={del} />
          ))}
        </div>
      )}

      {modal && (
        <AddSourceModal onClose={() => setModal(false)} onCreated={() => refetch()} />
      )}
    </div>
  )
}
