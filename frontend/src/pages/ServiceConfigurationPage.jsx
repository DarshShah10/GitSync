import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Play, RotateCcw, ChevronDown, Info, Plus, Trash2,
  Eye, EyeOff, Copy, Check, Loader2, ExternalLink,
  Terminal, BarChart2, Tag, AlertTriangle, Globe,
  HardDrive, GitBranch, Clock, Webhook, Activity,
  Shield, Settings, Server, Code, Layers
} from 'lucide-react'

// ── Sidebar nav items ────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'general',        label: 'General',              icon: Settings },
  { id: 'advanced',       label: 'Advanced',             icon: Layers },
  { id: 'env',            label: 'Environment Variables', icon: Code },
  { id: 'storage',        label: 'Persistent Storage',   icon: HardDrive },
  { id: 'git',            label: 'Git Source',           icon: GitBranch },
  { id: 'servers',        label: 'Servers',              icon: Server },
  { id: 'scheduled',      label: 'Scheduled Tasks',      icon: Clock },
  { id: 'webhooks',       label: 'Webhooks',             icon: Webhook },
  { id: 'preview',        label: 'Preview Deployments',  icon: Eye },
  { id: 'healthcheck',    label: 'Healthcheck',          icon: Activity },
  { id: 'rollback',       label: 'Rollback',             icon: RotateCcw },
  { id: 'limits',         label: 'Resource Limits',      icon: BarChart2 },
  { id: 'operations',     label: 'Resource Operations',  icon: Shield },
  { id: 'metrics',        label: 'Metrics',              icon: BarChart2 },
  { id: 'tags',           label: 'Tags',                 icon: Tag },
  { id: 'danger',         label: 'Danger Zone',          icon: AlertTriangle },
]

const TOP_TABS = ['Configuration', 'Deployments', 'Logs', 'Terminal', 'Links']

const BUILD_PACKS = ['Nixpacks', 'Dockerfile', 'Static', 'Docker Compose']
const DIRECTION_OPTIONS = ['Allow www & non-www.', 'Force www', 'Force non-www']

// ── Tiny helpers ─────────────────────────────────────────────────────────────

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

function Textarea({ value, onChange, placeholder, rows = 2 }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className="
        w-full px-3 py-2
        bg-[var(--bg-base)] border border-[var(--border-ghost)]
        rounded-[var(--radius-md)] text-sm text-[var(--text-primary)]
        placeholder:text-[var(--text-muted)]
        outline-none focus:border-[var(--primary)]
        focus:shadow-[0_0_0_3px_rgba(132,85,239,0.15)]
        transition-all resize-none
      "
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
                ${value === opt
                  ? 'bg-[var(--primary)] text-white font-medium'
                  : 'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                }
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

function SaveButton({ onClick, saving }) {
  const [saved, setSaved] = useState(false)
  const handle = async () => {
    if (onClick) await onClick()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={handle}
      className="
        h-8 px-4 text-xs font-semibold rounded-[var(--radius-md)]
        bg-[var(--bg-elevated)] border border-[var(--border-ghost)]
        text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]
        transition-all flex items-center gap-1.5
      "
    >
      {saved ? <><Check size={12} className="text-emerald-400" /> Saved</> : 'Save'}
    </button>
  )
}

function SectionDivider({ label }) {
  return (
    <div className="flex items-center gap-3 my-6">
      <span className="text-[0.7rem] font-bold tracking-[0.15em] uppercase text-[var(--text-muted)]">
        {label}
      </span>
      <div className="flex-1 h-px bg-[var(--border-ghost)]" />
    </div>
  )
}

// ── Environment Variables section ────────────────────────────────────────────

function EnvVarRow({ envVar, onChange, onDelete }) {
  const [show, setShow] = useState(!envVar.isSecret)
  return (
    <div className="flex items-center gap-2">
      <Input
        value={envVar.key}
        onChange={e => onChange({ ...envVar, key: e.target.value })}
        placeholder="KEY"
        className="flex-1 font-mono text-xs"
      />
      <Input
        value={envVar.value}
        onChange={e => onChange({ ...envVar, value: e.target.value })}
        placeholder="VALUE"
        type={show ? 'text' : 'password'}
        className="flex-1 font-mono text-xs"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="flex-shrink-0 h-10 w-10 flex items-center justify-center
                   bg-[var(--bg-base)] border border-[var(--border-ghost)]
                   rounded-[var(--radius-md)] text-[var(--text-muted)]
                   hover:text-[var(--text-primary)] hover:border-[var(--primary)] transition-all"
      >
        {show ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="flex-shrink-0 h-10 w-10 flex items-center justify-center
                   bg-[var(--bg-base)] border border-[var(--border-ghost)]
                   rounded-[var(--radius-md)] text-[var(--text-muted)]
                   hover:text-rose-400 hover:border-rose-400/50 transition-all"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ServiceConfigurationPage() {
  const navigate = useNavigate()
  const { projectId, environmentId, serviceId } = useParams()

  const [activeTab, setActiveTab]   = useState('Configuration')
  const [activeNav, setActiveNav]   = useState('general')
  const [deploying, setDeploying]   = useState(false)
  const [copied, setCopied]         = useState(false)

  // General form state
  const [name, setName]             = useState('coollabsio/coolify-examples:v4.x-d8c8okwccskcoogwowssckog')
  const [description, setDescription] = useState('')
  const [buildPack, setBuildPack]   = useState('Nixpacks')
  const [isStatic, setIsStatic]     = useState(false)
  const [domain, setDomain]         = useState('http://bwccgo4gswow4s44c8gks4kk.31.97.203.204.sslip.io')
  const [direction, setDirection]   = useState('Allow www & non-www.')
  const [dockerImage, setDockerImage] = useState('')
  const [dockerTag, setDockerTag]   = useState('')
  const [installCmd, setInstallCmd] = useState('')
  const [buildCmd, setBuildCmd]     = useState('')
  const [startCmd, setStartCmd]     = useState('')
  const [baseDir, setBaseDir]       = useState('/nextjs/ssr')
  const [publishDir, setPublishDir] = useState('/')
  const [envVars, setEnvVars]       = useState([
    { id: 1, key: 'NODE_ENV', value: 'production', isSecret: false },
  ])

  const serviceStatus = 'exited' // would come from props/API

  const handleDeploy = async () => {
    setDeploying(true)
    await new Promise(r => setTimeout(r, 1500))
    setDeploying(false)
  }

  const copyDomain = () => {
    navigator.clipboard?.writeText(domain)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const addEnvVar = () => setEnvVars(v => [...v, { id: Date.now(), key: '', value: '', isSecret: false }])
  const updateEnvVar = (id, updated) => setEnvVars(v => v.map(e => e.id === id ? updated : e))
  const deleteEnvVar = (id) => setEnvVars(v => v.filter(e => e.id !== id))

  const statusColor = {
    running:  'bg-emerald-500',
    exited:   'bg-rose-500',
    building: 'bg-amber-400',
    stopped:  'bg-[var(--text-muted)]',
  }[serviceStatus] ?? 'bg-[var(--text-muted)]'

  const statusLabel = serviceStatus.charAt(0).toUpperCase() + serviceStatus.slice(1)

  return (
    <div
      className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]"
      onClick={() => {}}
    >
      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <div className="border-b border-[var(--border-ghost)] bg-[var(--bg-base)]">
        <div className="max-w-[1200px] mx-auto px-6">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 pt-4 pb-3 text-xs text-[var(--text-muted)]">
            <button onClick={() => navigate('/')} className="hover:text-[var(--text-primary)] transition-colors">
              My first project
            </button>
            <span>›</span>
            <button className="hover:text-[var(--text-primary)] transition-colors">production</button>
            <span>›</span>
            <span className="text-[var(--text-secondary)] truncate max-w-[280px]">
              {name}
            </span>
            <span>›</span>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[0.68rem] font-semibold
              ${serviceStatus === 'exited' ? 'bg-rose-500/15 text-rose-400' :
                serviceStatus === 'running' ? 'bg-emerald-500/15 text-emerald-400' :
                'bg-amber-500/15 text-amber-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusColor} animate-pulse`} />
              {statusLabel}
            </span>
          </div>

          {/* Tabs + Deploy */}
          <div className="flex items-center justify-between">
            <nav className="flex items-center gap-1">
              {TOP_TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`
                    relative px-4 py-2.5 text-sm font-medium transition-colors
                    ${activeTab === tab
                      ? 'text-[var(--text-primary)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                    }
                  `}
                >
                  {tab}
                  {activeTab === tab && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--primary)] rounded-t" />
                  )}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-2 pb-1">
              <button className="
                h-8 px-3 text-xs font-medium rounded-[var(--radius-md)]
                border border-[var(--border-ghost)] text-[var(--text-secondary)]
                hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all
                flex items-center gap-1.5
              ">
                Advanced <ChevronDown size={12} />
              </button>

              <button
                onClick={handleDeploy}
                disabled={deploying}
                className="
                  h-8 px-4 text-xs font-semibold rounded-[var(--radius-md)]
                  bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white
                  transition-all disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center gap-1.5
                  shadow-[0_2px_12px_rgba(132,85,239,0.4)]
                "
              >
                {deploying
                  ? <><Loader2 size={12} className="animate-spin" /> Deploying…</>
                  : <><Play size={12} fill="white" /> Deploy</>
                }
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div className="max-w-[1200px] mx-auto px-6 py-6 flex gap-6">

        {/* Sidebar */}
        <aside className="w-52 flex-shrink-0">
          <nav className="flex flex-col gap-0.5">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveNav(id)}
                className={`
                  flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-md)]
                  text-sm transition-all text-left
                  ${activeNav === id
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-medium'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50'
                  }
                  ${id === 'danger' ? 'text-rose-400 hover:text-rose-400 mt-2' : ''}
                `}
              >
                <Icon size={14} className="flex-shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 animate-[fadeIn_0.2s_ease-out]">

          {/* ── General ── */}
          {activeNav === 'general' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h2 className="text-[1.1rem] font-bold text-[var(--text-primary)]">General</h2>
                  <p className="text-[0.78rem] text-[var(--text-muted)]">General configuration for your application.</p>
                </div>
                <SaveButton />
              </div>

              <div className="mt-5 flex flex-col gap-5">

                {/* Name + Description */}
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

                {/* Build Pack */}
                <div className="grid grid-cols-2 gap-4 items-end">
                  <div>
                    <Label>Build Pack <span className="text-rose-400 font-normal normal-case tracking-normal ml-0.5">*</span></Label>
                    <SelectField value={buildPack} onChange={setBuildPack} options={BUILD_PACKS} />
                  </div>
                  <div className="flex items-center gap-3 pb-1">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isStatic}
                      onClick={() => setIsStatic(s => !s)}
                      className={`
                        relative w-4 h-4 rounded flex-shrink-0 border transition-all
                        ${isStatic
                          ? 'bg-[var(--primary)] border-[var(--primary)]'
                          : 'bg-[var(--bg-base)] border-[var(--border-ghost)] hover:border-[var(--primary)]'
                        }
                      `}
                    >
                      {isStatic && (
                        <svg className="absolute inset-0 w-full h-full p-[2px]" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <span className="text-sm text-[var(--text-secondary)] flex items-center gap-2">
                      Is it a static site?
                      <Tooltip text="Static sites are served directly by Nginx without a running container." />
                    </span>
                  </div>
                </div>

                {/* Domains */}
                <div>
                  <Label tooltip="The domain or subdomain that will route to this service via Nginx.">Domains</Label>
                  <div className="flex gap-2">
                    <Input
                      value={domain}
                      onChange={e => setDomain(e.target.value)}
                      placeholder="https://myapp.example.com"
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={copyDomain}
                      className="
                        flex-shrink-0 h-10 px-3
                        bg-[var(--bg-base)] border border-[var(--border-ghost)]
                        rounded-[var(--radius-md)] text-[var(--text-muted)]
                        hover:text-[var(--text-primary)] hover:border-[var(--primary)] transition-all
                        flex items-center gap-1.5 text-xs
                      "
                    >
                      {copied ? <><Check size={12} className="text-emerald-400" /> Copied</> : <><Copy size={12} /> Copy</>}
                    </button>
                    <a
                      href={domain}
                      target="_blank"
                      rel="noreferrer"
                      className="
                        flex-shrink-0 h-10 px-3
                        bg-[var(--bg-base)] border border-[var(--border-ghost)]
                        rounded-[var(--radius-md)] text-[var(--text-muted)]
                        hover:text-[var(--primary)] hover:border-[var(--primary)] transition-all
                        flex items-center gap-1.5 text-xs
                      "
                    >
                      <ExternalLink size={12} /> Open
                    </a>
                    <button className="
                      flex-shrink-0 h-10 px-3
                      bg-[var(--primary)]/10 border border-[var(--primary)]/30
                      rounded-[var(--radius-md)] text-[var(--primary)]
                      hover:bg-[var(--primary)]/20 transition-all
                      flex items-center gap-1.5 text-xs font-medium
                    ">
                      <Globe size={12} /> Generate Domain
                    </button>
                  </div>
                </div>

                {/* Direction */}
                <div className="grid grid-cols-2 gap-4 items-end">
                  <div>
                    <Label tooltip="How www and non-www requests are handled.">
                      Direction <span className="text-rose-400 font-normal normal-case tracking-normal ml-0.5">*</span>
                    </Label>
                    <SelectField value={direction} onChange={setDirection} options={DIRECTION_OPTIONS} />
                  </div>
                  <button className="
                    h-10 px-4 text-xs font-semibold rounded-[var(--radius-md)]
                    bg-[var(--bg-elevated)] border border-[var(--border-ghost)]
                    text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]
                    transition-all
                  ">
                    Set Direction
                  </button>
                </div>

                <SectionDivider label="Docker Registry" />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label tooltip="Push built image to a Docker registry. Leave empty to skip.">
                      Docker Image <Tooltip text="Image name to push to a registry (optional)." />
                    </Label>
                    <Input
                      value={dockerImage}
                      onChange={e => setDockerImage(e.target.value)}
                      placeholder="Empty means it won't push the image to a docker registry."
                    />
                  </div>
                  <div>
                    <Label tooltip="Tag to use when pushing to a registry.">Docker Image Tag</Label>
                    <Input
                      value={dockerTag}
                      onChange={e => setDockerTag(e.target.value)}
                      placeholder="Empty means only push commit sha tag"
                    />
                  </div>
                </div>

                <SectionDivider label="Build" />

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label tooltip="Command to install dependencies (e.g. npm install). Leave empty for auto-detection.">
                      Install Command
                    </Label>
                    <Input value={installCmd} onChange={e => setInstallCmd(e.target.value)} placeholder="npm install" />
                  </div>
                  <div>
                    <Label tooltip="Command to build the project (e.g. npm run build).">Build Command</Label>
                    <Input value={buildCmd} onChange={e => setBuildCmd(e.target.value)} placeholder="npm run build" />
                  </div>
                  <div>
                    <Label tooltip="Command to start the app (e.g. node server.js).">Start Command</Label>
                    <Input value={startCmd} onChange={e => setStartCmd(e.target.value)} placeholder="npm start" />
                  </div>
                </div>

                <p className="text-[0.72rem] text-[var(--text-muted)] -mt-2">
                  Nixpacks will detect the required configuration automatically.{' '}
                  <a href="#" className="text-[var(--primary)] hover:underline">Framework Specific Docs</a>
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label tooltip="Subdirectory of the repo to build from.">Base Directory</Label>
                    <Input value={baseDir} onChange={e => setBaseDir(e.target.value)} placeholder="/" />
                  </div>
                  <div>
                    <Label tooltip="Directory to publish for static sites.">Publish Directory</Label>
                    <Input value={publishDir} onChange={e => setPublishDir(e.target.value)} placeholder="/" />
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ── Environment Variables ── */}
          {activeNav === 'env' && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-[1.1rem] font-bold text-[var(--text-primary)]">Environment Variables</h2>
                  <p className="text-[0.78rem] text-[var(--text-muted)]">Manage runtime environment variables for your service.</p>
                </div>
                <SaveButton />
              </div>

              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-[1fr_1fr_40px_40px] gap-2 mb-1">
                  <span className="text-[0.7rem] font-bold tracking-wide uppercase text-[var(--text-muted)] px-1">Key</span>
                  <span className="text-[0.7rem] font-bold tracking-wide uppercase text-[var(--text-muted)] px-1">Value</span>
                  <span />
                  <span />
                </div>

                {envVars.map(ev => (
                  <EnvVarRow
                    key={ev.id}
                    envVar={ev}
                    onChange={updated => updateEnvVar(ev.id, updated)}
                    onDelete={() => deleteEnvVar(ev.id)}
                  />
                ))}

                <button
                  type="button"
                  onClick={addEnvVar}
                  className="
                    mt-2 h-9 px-4 text-xs font-medium rounded-[var(--radius-md)]
                    border border-dashed border-[var(--border-ghost)]
                    text-[var(--text-muted)] hover:text-[var(--primary)]
                    hover:border-[var(--primary)] transition-all
                    flex items-center gap-2
                  "
                >
                  <Plus size={12} /> Add Variable
                </button>
              </div>
            </div>
          )}

          {/* ── Placeholder navs ── */}
          {!['general', 'env'].includes(activeNav) && (
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
    </div>
  )
}