import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Play, RotateCcw, ChevronDown, Info, Plus, Trash2,
  Eye, EyeOff, Copy, Check, Loader2, ExternalLink,
  Terminal, BarChart2, Tag, AlertTriangle, Globe,
  HardDrive, GitBranch, Clock, Webhook, Activity,
  Shield, Settings, Server, Code, Layers, Upload,
  GitCommit, RefreshCw, CheckCircle2, XCircle, Timer, MessageSquare
} from 'lucide-react'
import api from '../services/api'

const NAV_ITEMS = [
  { id: 'general',     label: 'General',               icon: Settings },
  { id: 'advanced',    label: 'Advanced',              icon: Layers },
  { id: 'env',         label: 'Environment Variables', icon: Code },
  { id: 'storage',     label: 'Persistent Storage',    icon: HardDrive },
  { id: 'git',         label: 'Git Source',            icon: GitBranch },
  { id: 'servers',     label: 'Servers',               icon: Server },
  { id: 'scheduled',   label: 'Scheduled Tasks',       icon: Clock },
  { id: 'webhooks',    label: 'Webhooks',              icon: Webhook },
  { id: 'preview',     label: 'Preview Deployments',   icon: Eye },
  { id: 'healthcheck', label: 'Healthcheck',           icon: Activity },
  { id: 'rollback',    label: 'Rollback',              icon: RotateCcw },
  { id: 'limits',      label: 'Resource Limits',       icon: BarChart2 },
  { id: 'operations',  label: 'Resource Operations',   icon: Shield },
  { id: 'metrics',     label: 'Metrics',               icon: BarChart2 },
  { id: 'tags',        label: 'Tags',                  icon: Tag },
  { id: 'danger',      label: 'Danger Zone',           icon: AlertTriangle },
]

const TOP_TABS = ['Configuration', 'Deployments', 'Logs', 'Terminal', 'Links']
const BUILD_PACKS = ['Nixpacks', 'Dockerfile', 'Static', 'Docker Compose']
const DIRECTION_OPTIONS = ['Allow www & non-www.', 'Force www', 'Force non-www']

const logsStorageKey = (serviceId) => `deploy_logs_${serviceId}`

/** Get the JWT token from wherever the api service stores it */
function getAuthToken() {
  // First try the axios default header (most reliable if api.js sets it)
  const fromAxios = api.defaults?.headers?.common?.Authorization
  if (fromAxios) return fromAxios.replace(/^Bearer\s+/i, '')

  // Scan localStorage for any value that looks like a JWT (xxx.xxx.xxx)
  const jwtPattern = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    const val = localStorage.getItem(key) || ''
    if (jwtPattern.test(val.trim())) return val.trim()
  }

  return ''
}

function Tooltip({ text }) {
  return (
    <div className="group relative inline-flex items-center">
      <Info size={13} className="text-[var(--text-muted)] cursor-help" />
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
                      w-56 rounded-lg bg-[var(--bg-highest)] border border-[var(--border-ghost)]
                      px-3 py-2 text-[0.7rem] text-[var(--text-secondary)] leading-relaxed
                      opacity-0 group-hover:opacity-100 transition-opacity shadow-xl">
        {text}
      </div>
    </div>
  )
}

function Label({ children, tooltip }) {
  return (
    <label className="flex items-center gap-2 text-[0.75rem] font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wide">
      {children}
      {tooltip && <Tooltip text={tooltip} />}
    </label>
  )
}

function Input({ value, onChange, placeholder, className = '', readOnly, ...rest }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      readOnly={readOnly}
      className={`
        w-full h-10 px-3
        bg-[var(--bg-base)] border border-[var(--border-ghost)]
        rounded-[var(--radius-md)] text-sm text-[var(--text-primary)]
        placeholder:text-[var(--text-muted)]
        outline-none focus:border-[var(--primary)]
        focus:shadow-[0_0_0_3px_rgba(132,85,239,0.15)]
        transition-all
        ${readOnly ? 'opacity-60 cursor-default' : ''}
        ${className}
      `}
      {...rest}
    />
  )
}

function SelectField({ value, onChange, options }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="
          w-full h-10 px-3 flex items-center justify-between
          bg-[var(--bg-base)] border border-[var(--border-ghost)]
          rounded-[var(--radius-md)] text-sm text-[var(--text-primary)]
          outline-none hover:border-[var(--primary)] transition-all
        "
      >
        <span>{value}</span>
        <ChevronDown size={14} className={`text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50
                        bg-[var(--bg-highest)] border border-[var(--border-ghost)]
                        rounded-[var(--radius-md)] shadow-2xl overflow-hidden">
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setOpen(false) }}
              className={`
                w-full text-left px-3 py-2.5 text-sm transition-colors
                ${value === opt ? 'bg-[var(--primary)] text-white font-medium' : 'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'}
              `}
            >
              {value === opt && <span className="mr-2 text-xs">✓</span>}
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SaveButton({ onSave }) {
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const handle = async () => {
    setSaving(true)
    try { await onSave(); setSaved(true); setTimeout(() => setSaved(false), 2000) }
    finally { setSaving(false) }
  }
  return (
    <button
      type="button" onClick={handle} disabled={saving}
      className="h-8 px-4 text-xs font-semibold rounded-[var(--radius-md)]
                 bg-[var(--bg-elevated)] border border-[var(--border-ghost)]
                 text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]
                 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {saving ? <><Loader2 size={12} className="animate-spin" /> Saving…</>
              : saved  ? <><Check size={12} className="text-emerald-400" /> Saved</>
              : 'Save'}
    </button>
  )
}

function SectionDivider({ label }) {
  return (
    <div className="flex items-center gap-3 my-6">
      <span className="text-[0.7rem] font-bold tracking-[0.15em] uppercase text-[var(--text-muted)]">{label}</span>
      <div className="flex-1 h-px bg-[var(--border-ghost)]" />
    </div>
  )
}

function EnvVarRow({ envVar, onChange, onDelete }) {
  const [show, setShow] = useState(!envVar.isSecret)
  return (
    <div className="flex items-center gap-2">
      <Input value={envVar.key}   onChange={e => onChange({ ...envVar, key: e.target.value })}   placeholder="KEY"   className="flex-1 font-mono text-xs" />
      <Input value={envVar.value} onChange={e => onChange({ ...envVar, value: e.target.value })} placeholder="VALUE" type={show ? 'text' : 'password'} className="flex-1 font-mono text-xs" />
      <button type="button" onClick={() => setShow(s => !s)}
        className="flex-shrink-0 h-10 w-10 flex items-center justify-center
                   bg-[var(--bg-base)] border border-[var(--border-ghost)]
                   rounded-[var(--radius-md)] text-[var(--text-muted)]
                   hover:text-[var(--text-primary)] hover:border-[var(--primary)] transition-all">
        {show ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
      <button type="button" onClick={onDelete}
        className="flex-shrink-0 h-10 w-10 flex items-center justify-center
                   bg-[var(--bg-base)] border border-[var(--border-ghost)]
                   rounded-[var(--radius-md)] text-[var(--text-muted)]
                   hover:text-rose-400 hover:border-rose-400/50 transition-all">
        <Trash2 size={13} />
      </button>
    </div>
  )
}

function LogsPanel({ logs, deploying, onClear }) {
  const bottomRef = useRef(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs])
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[1.1rem] font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Terminal size={18} /> Deployment Logs
            {deploying && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400
                               bg-amber-400/10 border border-amber-400/20 rounded-full px-2.5 py-0.5">
                <Loader2 size={10} className="animate-spin" /> Live
              </span>
            )}
          </h2>
          <p className="text-[0.78rem] text-[var(--text-muted)] mt-0.5">
            Output from your most recent deployment.
          </p>
        </div>
        {logs.length > 0 && (
          <button type="button" onClick={onClear}
            className="h-8 px-3 text-xs font-medium rounded-[var(--radius-md)]
                       border border-[var(--border-ghost)] text-[var(--text-muted)]
                       hover:border-rose-400/50 hover:text-rose-400 transition-all
                       flex items-center gap-1.5">
            <Trash2 size={12} /> Clear Logs
          </button>
        )}
      </div>
      <div className="flex-1 min-h-[480px] max-h-[600px] overflow-y-auto
                      bg-[var(--bg-highest)] border border-[var(--border-ghost)]
                      rounded-[var(--radius-md)] p-4 font-mono text-xs leading-relaxed">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--text-muted)]">
            <Terminal size={32} className="opacity-20" />
            <p className="text-sm">No logs yet. Hit <span className="text-[var(--primary)] font-semibold">Deploy</span> to see output here.</p>
          </div>
        ) : (
          <>
            {logs.map((entry, i) => (
              <div key={i} className="flex gap-3 py-0.5">
                <span className="select-none text-[var(--text-muted)] opacity-40 w-7 flex-shrink-0 text-right">{i + 1}</span>
                <span className={
                  entry.startsWith('⚠') || entry.toLowerCase().includes('error') || entry.toLowerCase().includes('failed')
                    ? 'text-rose-400'
                    : entry.toLowerCase().includes('success') || entry.toLowerCase().includes('done') || entry.toLowerCase().includes('✓')
                      ? 'text-emerald-400'
                      : entry.toLowerCase().includes('warn') ? 'text-amber-400' : 'text-emerald-300'
                }>{entry}</span>
              </div>
            ))}
            {deploying && (
              <div className="flex gap-3 py-0.5 mt-1">
                <span className="select-none text-[var(--text-muted)] opacity-40 w-7 flex-shrink-0 text-right">{logs.length + 1}</span>
                <span className="text-[var(--text-muted)] animate-pulse">▌</span>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>
    </div>
  )
}

function DeploymentStatusIcon({ status }) {
  if (status === 'SUCCESS')   return <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0" />
  if (status === 'FAILED')    return <XCircle      size={15} className="text-rose-400 flex-shrink-0" />
  if (status === 'BUILDING' || status === 'DEPLOYING') return <Loader2 size={15} className="text-amber-400 animate-spin flex-shrink-0" />
  if (status === 'QUEUED')    return <Timer        size={15} className="text-[var(--text-muted)] flex-shrink-0" />
  return                              <XCircle      size={15} className="text-[var(--text-muted)] flex-shrink-0" />
}

function timeAgo(date) {
  if (!date) return '—'
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function formatDuration(start, end) {
  if (!start) return '—'
  const ms = (end ? new Date(end) : new Date()) - new Date(start)
  const secs = Math.floor(ms / 1000)
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

function DeploymentsPanel({ serviceId, onViewLogs }) {
  const [deployments, setDeployments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!serviceId) return
    api.get(`/api/services/${serviceId}/deployments`)
      .then(r => setDeployments(Array.isArray(r.data) ? r.data : (r.data?.data ?? [])))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [serviceId])

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-[var(--text-muted)]">
      <Loader2 size={20} className="animate-spin" />
    </div>
  )

  if (!deployments.length) return (
    <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
      <BarChart2 size={32} className="mb-4 opacity-20" />
      <p className="text-sm">No deployments yet.</p>
    </div>
  )

  return (
    <div>
      <h2 className="text-[1.1rem] font-bold text-[var(--text-primary)] mb-1">Deployment History</h2>
      <p className="text-[0.78rem] text-[var(--text-muted)] mb-5">Last {deployments.length} deployments.</p>
      <div className="flex flex-col gap-3">
        {deployments.map(dep => (
          <div key={dep._id}
            className="bg-[var(--bg-elevated)] border border-[var(--border-ghost)] rounded-[var(--radius-md)] px-4 py-3
                       flex items-center gap-4 hover:border-[var(--border-light)] transition-all">
            <DeploymentStatusIcon status={dep.status} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                  ${dep.status === 'SUCCESS'   ? 'bg-emerald-500/15 text-emerald-400' :
                    dep.status === 'FAILED'    ? 'bg-rose-500/15 text-rose-400' :
                    dep.status === 'BUILDING' || dep.status === 'DEPLOYING' ? 'bg-amber-500/15 text-amber-400' :
                    'bg-[var(--bg-highest)] text-[var(--text-muted)]'}`}>
                  {dep.status}
                </span>
                {dep.commitHash && (
                  <span className="flex items-center gap-1 text-[0.7rem] font-mono text-[var(--text-muted)]">
                    <GitCommit size={11} /> {dep.commitHash}
                  </span>
                )}
                {dep.trigger && (
                  <span className="text-[0.65rem] px-1.5 py-0.5 rounded bg-[var(--bg-highest)] text-[var(--text-muted)] font-medium uppercase">
                    {dep.trigger === 'WEBHOOK' ? '🔗 webhook' : dep.trigger.toLowerCase()}
                  </span>
                )}
              </div>
              {/* Commit message */}
              {dep.commitMessage && (
                <div className="flex items-center gap-1.5 text-[0.72rem] text-[var(--text-secondary)] mb-0.5 truncate max-w-[400px]">
                  <MessageSquare size={10} className="flex-shrink-0 text-[var(--text-muted)]" />
                  <span className="truncate">{dep.commitMessage}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-[0.7rem] text-[var(--text-muted)]">
                <span className="flex items-center gap-1">
                  <Clock size={10} /> Started {timeAgo(dep.startedAt || dep.createdAt)}
                </span>
                {dep.startedAt && (
                  <span className="flex items-center gap-1">
                    <Timer size={10} /> {formatDuration(dep.startedAt, dep.finishedAt)}
                  </span>
                )}
                {dep.errorMessage && (
                  <span className="text-rose-400 truncate max-w-[200px]">{dep.errorMessage}</span>
                )}
              </div>
            </div>
            <button
              onClick={() => onViewLogs(dep._id)}
              className="flex-shrink-0 h-7 px-3 text-[0.7rem] font-medium rounded-[var(--radius-md)]
                         border border-[var(--border-ghost)] text-[var(--text-muted)]
                         hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all">
              View Logs
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function WebhooksPanel({ serviceId, service }) {
  const [copied, setCopied] = useState(false)
  const backendBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
  const webhookUrl = `${backendBase}/api/services/${serviceId}/webhook`

  const copyWebhook = () => {
    navigator.clipboard?.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isDockerImage = service?.config?.buildPack === 'DOCKER_IMAGE'

  return (
    <div>
      <h2 className="text-[1.1rem] font-bold text-[var(--text-primary)] mb-1">Webhooks</h2>
      <p className="text-[0.78rem] text-[var(--text-muted)] mb-6">
        Automatically redeploy when you push to your repository.
      </p>

      {isDockerImage ? (
        <div className="flex items-start gap-3 px-4 py-4 bg-amber-500/10 border border-amber-500/20 rounded-[var(--radius-md)]">
          <Info size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-300 mb-1">Not available for Docker Image deploys</p>
            <p className="text-[0.75rem] text-amber-300/70">
              Webhook auto-redeploy is only available for Git-based deployments.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-ghost)] rounded-[var(--radius-lg)] p-5 mb-5">
            <Label>Webhook URL</Label>
            <div className="flex gap-2 mt-1">
              <input
                readOnly
                value={webhookUrl}
                className="flex-1 h-10 px-3 bg-[var(--bg-base)] border border-[var(--border-ghost)]
                           rounded-[var(--radius-md)] text-sm font-mono text-[var(--text-secondary)]
                           outline-none cursor-text select-all"
              />
              <button
                onClick={copyWebhook}
                className="flex-shrink-0 h-10 px-4 text-xs font-semibold rounded-[var(--radius-md)]
                           bg-[var(--bg-highest)] border border-[var(--border-ghost)]
                           text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]
                           transition-all flex items-center gap-1.5">
                {copied ? <><Check size={12} className="text-emerald-400" /> Copied</> : <><Copy size={12} /> Copy</>}
              </button>
            </div>
            <p className="mt-2 text-[0.72rem] text-[var(--text-muted)]">
              This URL accepts a <code className="bg-[var(--bg-highest)] px-1 rounded text-[var(--text-secondary)]">POST</code> request. GitHub will send a payload on push events.
            </p>
          </div>

          <div className="bg-[var(--bg-elevated)] border border-[var(--border-ghost)] rounded-[var(--radius-lg)] p-5">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">How to set up on GitHub</h3>
            <ol className="flex flex-col gap-2.5 text-[0.78rem] text-[var(--text-secondary)]">
              {[
                'Go to your repository on GitHub',
                'Navigate to Settings → Webhooks → Add webhook',
                <>Set <strong>Payload URL</strong> to the webhook URL above</>,
                <>Set <strong>Content type</strong> to <code className="bg-[var(--bg-highest)] px-1 rounded text-[var(--text-secondary)]">application/json</code></>,
                <>Select <strong>Just the push event</strong></>,
                'Click Add webhook — pushes will now trigger a redeploy',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--primary)]/20 text-[var(--primary)]
                                   flex items-center justify-center text-[0.65rem] font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-4 flex items-start gap-2 px-3 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border-ghost)] rounded-[var(--radius-md)]">
            <Shield size={13} className="text-[var(--primary)] mt-0.5 flex-shrink-0" />
            <p className="text-[0.72rem] text-[var(--text-muted)] leading-relaxed">
              The webhook endpoint is authenticated by your service ID and will only trigger a deployment for this specific service.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

export default function ServiceConfigurationPage() {
  const navigate = useNavigate()
  const { serviceId } = useParams()

  const [activeTab,  setActiveTab]  = useState('Configuration')
  const [activeNav,  setActiveNav]  = useState('general')
  const [deploying,  setDeploying]  = useState(false)
  const [copied,     setCopied]     = useState(false)
  const [deployError, setDeployError] = useState(null)

  const [deployLogs, setDeployLogs] = useState(() => {
    if (!serviceId) return []
    try { const s = localStorage.getItem(logsStorageKey(serviceId)); return s ? JSON.parse(s) : [] }
    catch { return [] }
  })

  const esRef        = useRef(null)
  const fileInputRef = useRef(null)
  const [importToast, setImportToast] = useState(null)

  // Form state
  const [name,          setName]          = useState('')
  const [description,   setDescription]   = useState('')
  const [buildPack,     setBuildPack]     = useState('Nixpacks')
  const [branch,        setBranch]        = useState('main')
  const [internalPort,  setInternalPort]  = useState('3000')
  const [baseDir,       setBaseDir]       = useState('/')
  const [isStatic,      setIsStatic]      = useState(false)
  const [domain,        setDomain]        = useState('')
  const [direction,     setDirection]     = useState('Allow www & non-www.')
  const [dockerImage,   setDockerImage]   = useState('')
  const [dockerTag,     setDockerTag]     = useState('')
  const [installCmd,    setInstallCmd]    = useState('')
  const [buildCmd,      setBuildCmd]      = useState('')
  const [startCmd,      setStartCmd]      = useState('')
  const [publishDir,    setPublishDir]    = useState('/')
  const [envVars,       setEnvVars]       = useState([])
  const [domainError,   setDomainError]   = useState(false)
  const [serviceStatus, setServiceStatus] = useState('stopped')
  const [serverIp,      setServerIp]      = useState('')
  const [loading,       setLoading]       = useState(true)
  const [service,       setService]       = useState(null)

  // Last deploy info shown in header
  const [lastDeploy, setLastDeploy] = useState(null)

  useEffect(() => {
    if (!serviceId) return
    try { localStorage.setItem(logsStorageKey(serviceId), JSON.stringify(deployLogs)) }
    catch {}
  }, [deployLogs, serviceId])

  const appendLog = (line) => setDeployLogs(prev => [...prev, line])

  useEffect(() => {
    if (!serviceId) return
    api.get(`/api/services/${serviceId}`)
      .then(({ data }) => {
        const svc = data.data
        setService(svc)
        setName(svc.name ?? '')
        setDomain(svc.domain ?? '')
        setInternalPort(String(svc.internalPort ?? 3000))
        setBaseDir(svc.config?.baseDir ?? '/')
        setIsStatic(svc.isStatic ?? false)
        setEnvVars(svc.envVars ?? [])
        setServiceStatus((svc.status ?? 'stopped').toLowerCase())
        setBranch(svc.config?.branch ?? 'main')
        setServerIp(svc.serverId?.ip ?? '')
        setBuildPack(
          svc.config?.buildPack
            ? svc.config.buildPack.charAt(0) + svc.config.buildPack.slice(1).toLowerCase()
            : 'Nixpacks'
        )
      })
      .catch(console.error)
      .finally(() => setLoading(false))

    api.get(`/api/services/${serviceId}/deployments`)
      .then(r => {
        const deps = Array.isArray(r.data) ? r.data : (r.data?.data ?? [])
        if (deps.length > 0) setLastDeploy(deps[0])
      })
      .catch(() => {})
  }, [serviceId])

  const parseEnvFile = (text) =>
    text.split(/\r?\n/).reduce((acc, raw) => {
      const line = raw.trim()
      if (!line || line.startsWith('#')) return acc
      const eq = line.indexOf('=')
      if (eq < 1) return acc
      const key = line.slice(0, eq).trim()
      let value = line.slice(eq + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
        value = value.slice(1, -1)
      if (key) acc.push({ id: Date.now() + Math.random(), key, value, isSecret: false })
      return acc
    }, [])

  const applyParsedEnv = (parsed) => {
    if (!parsed.length) {
      setImportToast({ msg: 'No valid KEY=VALUE pairs found', type: 'error' })
      setTimeout(() => setImportToast(null), 3000); return
    }
    setEnvVars(prev => {
      const existingKeys = new Set(prev.map(v => v.key))
      const dupes = parsed.filter(p =>  existingKeys.has(p.key))
      const fresh = parsed.filter(p => !existingKeys.has(p.key))
      const updated = prev.map(v => { const m = dupes.find(d => d.key === v.key); return m ? { ...v, value: m.value } : v })
      return [...updated, ...fresh]
    })
    setImportToast({ msg: `Imported ${parsed.length} variable${parsed.length > 1 ? 's' : ''}`, type: 'success' })
    setTimeout(() => setImportToast(null), 3000)
  }

  const handleEnvFileImport = (e) => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => applyParsedEnv(parseEnvFile(ev.target.result))
    reader.readAsText(file); e.target.value = ''
  }

  const handleSave = async () => {
    await api.patch(`/api/services/${serviceId}`, {
      domain, internalPort: Number(internalPort), envVars,
      config: { branch, baseDir, buildPack: buildPack.toUpperCase() },
    })
  }

  // Place this outside the component (top of file or above the component)
  function getPublicToken() {
    const match = document.cookie.match(/(?:^|;\s*)gitsync_token_pub=([^;]+)/)
    return match ? decodeURIComponent(match[1]) : null
  }

  const handleDeploy = async () => {
    if (!domain.trim()) {
      setDomainError(true)
      setActiveNav('general')
      setTimeout(() => setDomainError(false), 4000)
      return
    }

    if (deploying) return

    setDeployError(null)
    setDeploying(true)
    setDeployLogs([])
    setActiveTab('Logs')

    esRef.current?.close()
    esRef.current = null

    let deploymentId

    try {
      const { data } = await api.post(`/api/services/${serviceId}/deploy`)
      deploymentId = data.data.deploymentId
    } catch (err) {
      const msg = err?.message || 'Failed to start deployment'
      appendLog(`⚠ ${msg}`)
      setDeploying(false)
      return
    }

    const token = getPublicToken()
    if (!token) {
      appendLog('⚠ Session expired — please log in again.')
      setDeploying(false)
      return
    }

    const es = new EventSource(
      `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/deployments/${deploymentId}/logs?token=${encodeURIComponent(token)}`
      // no withCredentials — auth is now via ?token= query param
    )

    esRef.current = es

    es.onmessage = (e) => {
      try {
        const { output } = JSON.parse(e.data)
        appendLog(output)
      } catch {}
    }

    es.addEventListener('done', (e) => {
      try {
        const { status, url } = JSON.parse(e.data)

        appendLog(
          status === 'SUCCESS'
            ? `✓ Deployment successful — ${url ?? ''}`
            : `⚠ Deployment ended with status: ${status}`
        )

        setServiceStatus(status === 'SUCCESS' ? 'running' : 'error')

        if (url) window.open(url)
      } catch {}

      es.close()
      esRef.current = null
      setDeploying(false)
    })

    es.onerror = () => {
      if (esRef.current) {
        appendLog('⚠ Log stream disconnected. Check Deployments tab.')
        es.close()
        esRef.current = null
        setDeploying(false)
      }
    }
  }

  const handleViewDeploymentLogs = async (deploymentId) => {
    setDeployLogs([])
    setActiveTab('Logs')
    try {
      const r = await api.get(`/api/deployments/${deploymentId}/log-lines`).catch(() => null)
      if (r?.data?.data) {
        setDeployLogs(r.data.data.map(l => l.output))
      } else {
        setDeployLogs(['Log history for this deployment is not available.'])
      }
    } catch {
      setDeployLogs(['Could not load logs for this deployment.'])
    }
  }

  const copyDomain = () => { navigator.clipboard?.writeText(domain); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  const addEnvVar    = () => setEnvVars(v => [...v, { id: Date.now(), key: '', value: '', isSecret: false }])
  const updateEnvVar = (id, updated) => setEnvVars(v => v.map(e => e.id === id ? updated : e))
  const deleteEnvVar = (id) => setEnvVars(v => v.filter(e => e.id !== id))
  const clearLogs    = () => { setDeployLogs([]); try { localStorage.removeItem(logsStorageKey(serviceId)) } catch {} }

  const statusColor = {
    running:   'bg-emerald-500',
    exited:    'bg-rose-500',
    building:  'bg-amber-400',
    stopped:   'bg-[var(--text-muted)]',
    deploying: 'bg-[#8be9fd]',
    error:     'bg-rose-500',
  }[serviceStatus] ?? 'bg-[var(--text-muted)]'

  const statusLabel  = serviceStatus.charAt(0).toUpperCase() + serviceStatus.slice(1)

  const isDockerImage = service?.config?.buildPack === 'DOCKER_IMAGE'
  const hasDeployed   = serviceStatus === 'running' || serviceStatus === 'exited' || serviceStatus === 'stopped' || serviceStatus === 'error'

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">

      {domainError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5
                        bg-rose-500 text-white text-xs font-semibold rounded-[var(--radius-md)] shadow-xl animate-[fadeIn_0.2s_ease-out]">
          <AlertTriangle size={13} />
          A domain is required before deploying. Please set one in the General section and Save.
        </div>
      )}

      {deployError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5
                        bg-rose-500 text-white text-xs font-semibold rounded-[var(--radius-md)] shadow-xl animate-[fadeIn_0.2s_ease-out] max-w-lg">
          <AlertTriangle size={13} className="flex-shrink-0" />
          {deployError}
          <button onClick={() => setDeployError(null)} className="ml-2 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {importToast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 text-white text-xs font-semibold
                        rounded-[var(--radius-md)] shadow-xl animate-[fadeIn_0.2s_ease-out]
                        ${importToast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`}>
          {importToast.type === 'error' ? <AlertTriangle size={13} /> : <Check size={13} />}
          {importToast.msg}
        </div>
      )}

      {/* ── Top Bar ── */}
      <div className="border-b border-[var(--border-ghost)] bg-[var(--bg-base)]">
        <div className="max-w-[1200px] mx-auto px-6">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 pt-4 pb-3 text-xs text-[var(--text-muted)]">
            <button onClick={() => navigate('/')} className="hover:text-[var(--text-primary)] transition-colors">My first project</button>
            <span>›</span>
            <button className="hover:text-[var(--text-primary)] transition-colors">production</button>
            <span>›</span>
            <span className="text-[var(--text-secondary)] truncate max-w-[280px]">{name}</span>
            <span>›</span>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[0.68rem] font-semibold
              ${serviceStatus === 'exited' || serviceStatus === 'error' ? 'bg-rose-500/15 text-rose-400' :
                serviceStatus === 'running'   ? 'bg-emerald-500/15 text-emerald-400' :
                serviceStatus === 'deploying' ? 'bg-[#8be9fd]/15 text-[#8be9fd]' :
                'bg-amber-500/15 text-amber-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusColor} ${deploying ? 'animate-pulse' : ''}`} />
              {statusLabel}
            </span>

            {/* Last deploy info */}
            {lastDeploy && (
              <span className="ml-2 flex items-center gap-2 text-[0.68rem] text-[var(--text-muted)] border-l border-[var(--border-ghost)] pl-2">
                {lastDeploy.commitHash && (
                  <span className="flex items-center gap-1 font-mono">
                    <GitCommit size={10} /> {lastDeploy.commitHash}
                  </span>
                )}
                {lastDeploy.commitMessage && (
                  <span className="max-w-[200px] truncate" title={lastDeploy.commitMessage}>
                    "{lastDeploy.commitMessage}"
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock size={10} /> {timeAgo(lastDeploy.startedAt || lastDeploy.createdAt)}
                </span>
                {lastDeploy.status === 'SUCCESS' && <span className="text-emerald-400">✓</span>}
                {lastDeploy.status === 'FAILED'  && <span className="text-rose-400">✗</span>}
                {(lastDeploy.status === 'BUILDING' || lastDeploy.status === 'DEPLOYING') && (
                  <Loader2 size={10} className="animate-spin text-amber-400" />
                )}
              </span>
            )}
          </div>

          {/* Tabs + Deploy */}
          <div className="flex items-center justify-between">
            <nav className="flex items-center gap-1">
              {TOP_TABS.map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`relative px-4 py-2.5 text-sm font-medium transition-colors
                    ${activeTab === tab ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
                  {tab}
                  {tab === 'Logs' && activeTab !== 'Logs' && deployLogs.length > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full
                                     bg-[var(--primary)]/20 text-[var(--primary)] text-[0.6rem] font-bold">
                      {deployLogs.length > 99 ? '99+' : deployLogs.length}
                    </span>
                  )}
                  {activeTab === tab && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--primary)] rounded-t" />}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-2 pb-1">
              {/* Redeploy button */}
              {(hasDeployed || lastDeploy) && (
                <button
                  onClick={handleDeploy}
                  disabled={deploying}
                  title="Redeploy with latest config"
                  className="h-8 px-3 text-xs font-medium rounded-[var(--radius-md)]
                             border border-[var(--border-ghost)] text-[var(--text-secondary)]
                             hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all
                             flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                  <RefreshCw size={12} className={deploying ? 'animate-spin' : ''} />
                  Redeploy
                </button>
              )}

              <button
                onClick={handleDeploy}
                disabled={deploying}
                className="h-8 px-4 text-xs font-semibold rounded-[var(--radius-md)]
                           bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white
                           transition-all disabled:opacity-50 disabled:cursor-not-allowed
                           flex items-center gap-1.5 shadow-[0_2px_12px_rgba(132,85,239,0.4)]">
                {deploying
                  ? <><Loader2 size={12} className="animate-spin" /> Deploying…</>
                  : <><Play size={12} fill="white" /> Deploy</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-[1200px] mx-auto px-6 py-6">

        {activeTab === 'Logs' && (
          <LogsPanel logs={deployLogs} deploying={deploying} onClear={clearLogs} />
        )}

        {activeTab === 'Deployments' && (
          <DeploymentsPanel serviceId={serviceId} onViewLogs={handleViewDeploymentLogs} />
        )}

        {activeTab === 'Configuration' && (
          <div className="flex gap-6">
            <aside className="w-52 flex-shrink-0">
              <nav className="flex flex-col gap-0.5">
                {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => setActiveNav(id)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-md)]
                      text-sm transition-all text-left
                      ${activeNav === id ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-medium' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50'}
                      ${id === 'danger' ? 'text-rose-400 hover:text-rose-400 mt-2' : ''}`}>
                    <Icon size={14} className="flex-shrink-0" />
                    {label}
                  </button>
                ))}
              </nav>
            </aside>

            <main className="flex-1 min-w-0 animate-[fadeIn_0.2s_ease-out]">

              {/* ── General ── */}
              {activeNav === 'general' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <h2 className="text-[1.1rem] font-bold text-[var(--text-primary)]">General</h2>
                      <p className="text-[0.78rem] text-[var(--text-muted)]">General configuration for your application.</p>
                    </div>
                    <SaveButton onSave={handleSave} />
                  </div>

                  <div className="mt-5 flex flex-col gap-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Name <span className="text-rose-400 font-normal normal-case tracking-normal ml-0.5">*</span></Label>
                        <Input value={name} onChange={e => setName(e.target.value)} />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description…" />
                      </div>
                    </div>

                    {!isDockerImage && (
                      <div className="grid grid-cols-2 gap-4 items-end">
                        <div>
                          <Label>Build Pack <span className="text-rose-400 font-normal normal-case tracking-normal ml-0.5">*</span></Label>
                          <SelectField value={buildPack} onChange={setBuildPack} options={BUILD_PACKS} />
                        </div>
                        <div className="flex items-center gap-3 pb-1">
                          <button type="button" role="checkbox" aria-checked={isStatic} onClick={() => setIsStatic(s => !s)}
                            className={`relative w-4 h-4 rounded flex-shrink-0 border transition-all
                              ${isStatic ? 'bg-[var(--primary)] border-[var(--primary)]' : 'bg-[var(--bg-base)] border-[var(--border-ghost)] hover:border-[var(--primary)]'}`}>
                            {isStatic && (
                              <svg className="absolute inset-0 w-full h-full p-[2px]" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </button>
                          <span className="text-sm text-[var(--text-secondary)] flex items-center gap-2">
                            Is it a static site? <Tooltip text="Static sites served directly by Nginx." />
                          </span>
                        </div>
                      </div>
                    )}

                    {isDockerImage && service?.config?.dockerImage && (
                      <div>
                        <Label>Docker Image</Label>
                        <Input value={service.config.dockerImage} readOnly />
                        <p className="mt-1 text-[0.72rem] text-[var(--text-muted)]">Image is set at creation time. Create a new service to change it.</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label tooltip="Port your app listens on inside the container.">
                          Port <span className="text-rose-400 font-normal normal-case tracking-normal ml-0.5">*</span>
                        </Label>
                        <Input value={internalPort} onChange={e => setInternalPort(e.target.value)} placeholder="3000" type="number" min="1" max="65535" />
                      </div>
                      {!isDockerImage && (
                        <div>
                          <Label tooltip="Subdirectory of the repo to build from.">Base Directory</Label>
                          <Input value={baseDir} onChange={e => setBaseDir(e.target.value)} placeholder="/" />
                        </div>
                      )}
                    </div>

                    {/* Domain */}
                    <div>
                      <Label tooltip="The domain that will route to this service via Nginx.">
                        Domains
                        {domainError && (
                          <span className="ml-2 text-[0.68rem] font-normal normal-case tracking-normal text-rose-400">
                            Required before deploying
                          </span>
                        )}
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          value={domain}
                          onChange={e => { setDomain(e.target.value); if (e.target.value.trim()) setDomainError(false) }}
                          placeholder="https://myapp.example.com"
                          className={`flex-1 ${domainError ? '!border-rose-500 focus:!border-rose-500' : ''}`}
                        />
                        <button type="button" onClick={copyDomain}
                          className="flex-shrink-0 h-10 px-3 bg-[var(--bg-base)] border border-[var(--border-ghost)]
                                     rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text-primary)]
                                     hover:border-[var(--primary)] transition-all flex items-center gap-1.5 text-xs">
                          {copied ? <><Check size={12} className="text-emerald-400" /> Copied</> : <><Copy size={12} /> Copy</>}
                        </button>
                        <a href={domain} target="_blank" rel="noreferrer"
                          className="flex-shrink-0 h-10 px-3 bg-[var(--bg-base)] border border-[var(--border-ghost)]
                                     rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--primary)]
                                     hover:border-[var(--primary)] transition-all flex items-center gap-1.5 text-xs">
                          <ExternalLink size={12} /> Open
                        </a>
                        <button type="button"
                          onClick={() => {
                            if (!serverIp) return
                            const rand = Math.random().toString(36).slice(2, 10)
                            const generated = `http://${rand}.${serverIp.replace(/\./g, '-')}.sslip.io`
                            setDomain(generated); setDomainError(false)
                          }}
                          disabled={!serverIp}
                          className="flex-shrink-0 h-10 px-3 bg-[var(--primary)]/10 border border-[var(--primary)]/30
                                     rounded-[var(--radius-md)] text-[var(--primary)] hover:bg-[var(--primary)]/20
                                     transition-all flex items-center gap-1.5 text-xs font-medium
                                     disabled:opacity-40 disabled:cursor-not-allowed">
                          <Globe size={12} /> Generate Domain
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 items-end">
                      <div>
                        <Label>Direction <span className="text-rose-400 font-normal normal-case tracking-normal ml-0.5">*</span></Label>
                        <SelectField value={direction} onChange={setDirection} options={DIRECTION_OPTIONS} />
                      </div>
                      <button className="h-10 px-4 text-xs font-semibold rounded-[var(--radius-md)]
                                         bg-[var(--bg-elevated)] border border-[var(--border-ghost)]
                                         text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all">
                        Set Direction
                      </button>
                    </div>

                    {!isDockerImage && (
                      <>
                        <SectionDivider label="Docker Registry" />
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Docker Image</Label>
                            <Input value={dockerImage} onChange={e => setDockerImage(e.target.value)} placeholder="Empty means it won't push the image to a docker registry." />
                          </div>
                          <div>
                            <Label>Docker Image Tag</Label>
                            <Input value={dockerTag} onChange={e => setDockerTag(e.target.value)} placeholder="Empty means only push commit sha tag" />
                          </div>
                        </div>

                        <SectionDivider label="Build" />
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label>Install Command</Label>
                            <Input value={installCmd} onChange={e => setInstallCmd(e.target.value)} placeholder="npm install" />
                          </div>
                          <div>
                            <Label>Build Command</Label>
                            <Input value={buildCmd} onChange={e => setBuildCmd(e.target.value)} placeholder="npm run build" />
                          </div>
                          <div>
                            <Label>Start Command</Label>
                            <Input value={startCmd} onChange={e => setStartCmd(e.target.value)} placeholder="npm start" />
                          </div>
                        </div>
                        <p className="text-[0.72rem] text-[var(--text-muted)] -mt-2">
                          Nixpacks will detect the required configuration automatically.
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Publish Directory</Label>
                            <Input value={publishDir} onChange={e => setPublishDir(e.target.value)} placeholder="/" />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ── Environment Variables ── */}
              {activeNav === 'env' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-[1.1rem] font-bold text-[var(--text-primary)]">Environment Variables</h2>
                      <p className="text-[0.78rem] text-[var(--text-muted)]">Manage runtime environment variables for your service.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input ref={fileInputRef} type="file" accept=".env,text/plain" className="hidden" onChange={handleEnvFileImport} />
                      <button type="button" onClick={() => fileInputRef.current?.click()}
                        className="h-8 px-3 text-xs font-medium rounded-[var(--radius-md)]
                                   border border-[var(--border-ghost)] text-[var(--text-secondary)]
                                   hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all
                                   flex items-center gap-1.5">
                        <Upload size={12} /> Import .env
                      </button>
                      <SaveButton onSave={handleSave} />
                    </div>
                  </div>

                  <div className="mb-5 border border-dashed border-[var(--border-ghost)] rounded-[var(--radius-md)] px-4 py-5
                                  flex flex-col items-center gap-1.5 cursor-pointer
                                  hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-all group"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (!file) return; const r = new FileReader(); r.onload = (ev) => applyParsedEnv(parseEnvFile(ev.target.result)); r.readAsText(file) }}>
                    <Upload size={18} className="text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors" />
                    <p className="text-xs text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors">
                      Drop your <span className="text-[var(--primary)] font-medium">.env file</span> here, or click to browse
                    </p>
                    <p className="text-[0.68rem] text-[var(--text-muted)] opacity-70">Parses KEY=VALUE pairs · Ignores comments · Updates existing keys</p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-[1fr_1fr_40px_40px] gap-2 mb-1">
                      <span className="text-[0.7rem] font-bold tracking-wide uppercase text-[var(--text-muted)] px-1">Key</span>
                      <span className="text-[0.7rem] font-bold tracking-wide uppercase text-[var(--text-muted)] px-1">Value</span>
                      <span /><span />
                    </div>
                    {envVars.map(ev => (
                      <EnvVarRow key={ev.id} envVar={ev} onChange={updated => updateEnvVar(ev.id, updated)} onDelete={() => deleteEnvVar(ev.id)} />
                    ))}
                    <button type="button" onClick={addEnvVar}
                      className="mt-2 h-9 px-4 text-xs font-medium rounded-[var(--radius-md)]
                                 border border-dashed border-[var(--border-ghost)]
                                 text-[var(--text-muted)] hover:text-[var(--primary)]
                                 hover:border-[var(--primary)] transition-all flex items-center gap-2">
                      <Plus size={12} /> Add Variable
                    </button>
                  </div>
                </div>
              )}

              {/* ── Webhooks ── */}
              {activeNav === 'webhooks' && (
                <WebhooksPanel serviceId={serviceId} service={service} />
              )}

              {/* ── Placeholder navs ── */}
              {!['general', 'env', 'webhooks'].includes(activeNav) && (
                <div className="flex flex-col items-center justify-center py-24 text-[var(--text-muted)]">
                  {(() => {
                    const item = NAV_ITEMS.find(n => n.id === activeNav)
                    const Icon = item?.icon ?? Settings
                    return (
                      <>
                        <Icon size={36} className="mb-4 opacity-30" />
                        <p className="text-sm font-medium text-[var(--text-secondary)]">{item?.label}</p>
                        <p className="text-xs mt-1 opacity-60">This section is coming soon.</p>
                      </>
                    )
                  })()}
                </div>
              )}
            </main>
          </div>
        )}

        {!['Configuration', 'Logs', 'Deployments'].includes(activeTab) && (
          <div className="flex flex-col items-center justify-center py-32 text-[var(--text-muted)]">
            <Terminal size={36} className="mb-4 opacity-20" />
            <p className="text-sm font-medium text-[var(--text-secondary)]">{activeTab}</p>
            <p className="text-xs mt-1 opacity-60">This tab is coming soon.</p>
          </div>
        )}
      </div>
    </div>
  )
}