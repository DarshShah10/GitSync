import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink, ChevronDown, Info, Loader2, Server, Wifi, WifiOff, AlertCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'

const BUILD_PACKS = ['Nixpacks', 'Static', 'Dockerfile', 'Docker Compose']

// ── Status badge config for server dropdown ──────────────────
const SERVER_STATUS = {
  CONNECTED:   { color: '#50fa7b', label: 'Connected',   icon: Wifi },
  PENDING:     { color: '#f1fa8c', label: 'Pending',     icon: Loader2 },
  VERIFYING:   { color: '#f1fa8c', label: 'Verifying',   icon: Loader2 },
  UNREACHABLE: { color: '#ff5555', label: 'Unreachable', icon: WifiOff },
  MAINTENANCE: { color: '#7070a0', label: 'Maintenance', icon: AlertCircle },
  ERROR:       { color: '#ff5555', label: 'Error',       icon: AlertCircle },
}

// ── Shared small components ───────────────────────────────────

function Tooltip({ text }) {
  return (
    <div className="group relative inline-flex items-center">
      <Info size={13} className="text-[var(--text-muted)] cursor-help" />
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
                      w-52 rounded-lg bg-[var(--bg-highest)] border border-[var(--border-ghost)]
                      px-3 py-2 text-[0.7rem] text-[var(--text-secondary)] leading-relaxed
                      opacity-0 group-hover:opacity-100 transition-opacity shadow-xl">
        {text}
      </div>
    </div>
  )
}

function Label({ children, required, tooltip }) {
  return (
    <label className="flex items-center gap-2 text-[0.78rem] font-semibold text-[var(--text-secondary)] mb-1.5">
      {children}
      {required && <span className="text-rose-400">*</span>}
      {tooltip && <Tooltip text={tooltip} />}
    </label>
  )
}

function Input({ value, onChange, placeholder, className = '', ...rest }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`
        w-full h-10 px-3
        bg-[var(--bg-elevated)] border border-[var(--border-ghost)]
        rounded-[var(--radius-md)] text-sm text-[var(--text-primary)]
        placeholder:text-[var(--text-muted)]
        outline-none focus:border-[var(--primary)]
        focus:shadow-[0_0_0_3px_rgba(132,85,239,0.15)]
        transition-all
        ${className}
      `}
      {...rest}
    />
  )
}

function Select({ value, onChange, options, open, setOpen }) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="
          w-full h-10 px-3 flex items-center justify-between
          bg-[var(--bg-elevated)] border border-[var(--border-ghost)]
          rounded-[var(--radius-md)] text-sm text-[var(--text-primary)]
          outline-none hover:border-[var(--primary)] transition-all
          focus:border-[var(--primary)] focus:shadow-[0_0_0_3px_rgba(132,85,239,0.15)]
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

// ── Server dropdown ───────────────────────────────────────────

function ServerDropdown({ servers = [], value, onChange, open, setOpen, isLoading }) {
  const selected = servers.find(s => s._id === value)

  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={isLoading}
        className={`
          w-full h-10 px-3 flex items-center justify-between gap-2
          bg-[var(--bg-elevated)] border rounded-[var(--radius-md)]
          text-sm outline-none transition-all
          disabled:opacity-50 disabled:cursor-not-allowed
          ${open
            ? 'border-[var(--primary)] shadow-[0_0_0_3px_rgba(132,85,239,0.15)]'
            : !value
              ? 'border-[var(--border-ghost)] hover:border-[var(--primary)]'
              : 'border-[var(--border-ghost)] hover:border-[var(--primary)]'
          }
        `}
      >
        {isLoading ? (
          <span className="flex items-center gap-2 text-[var(--text-muted)]">
            <Loader2 size={13} className="animate-spin" /> Loading servers…
          </span>
        ) : selected ? (
          /* Selected state — shows name + IP + status dot */
          <span className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: SERVER_STATUS[selected.status]?.color ?? '#7070a0' }}
            />
            <span className="font-semibold text-[var(--text-primary)] truncate">{selected.name}</span>
            <span className="text-[var(--text-muted)] text-xs font-mono flex-shrink-0">{selected.ip}</span>
          </span>
        ) : (
          <span className="text-[var(--text-muted)]">Select a virtual machine…</span>
        )}
        <ChevronDown
          size={14}
          className={`text-[var(--text-muted)] flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && !isLoading && (
        <div className="
          absolute top-full left-0 right-0 mt-1 z-50
          bg-[var(--bg-highest)] border border-[var(--border-ghost)]
          rounded-[var(--radius-md)] shadow-2xl overflow-hidden
        ">
          {servers.length === 0 ? (
            /* No servers at all */
            <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
              <Server size={24} className="text-[var(--text-muted)] opacity-40" />
              <p className="text-sm text-[var(--text-muted)]">No virtual machines added yet</p>
              <a
                href="/servers/new"
                className="text-xs text-[var(--primary)] hover:underline"
              >
                Add your first server →
              </a>
            </div>
          ) : (
            servers.map(server => {
              const cfg         = SERVER_STATUS[server.status] ?? SERVER_STATUS.ERROR
              const isConnected = server.status === 'CONNECTED'
              const isSelected  = server._id === value

              // Build className string explicitly — avoids bundler issues
              // with nested ternaries inside template literals
              let btnClass = 'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors '
              if (isSelected)       btnClass += 'bg-[var(--primary)] text-white'
              else if (isConnected) btnClass += 'hover:bg-[var(--bg-elevated)] cursor-pointer'
              else                  btnClass += 'opacity-40 cursor-not-allowed'

              return (
                <button
                  key={server._id}
                  type="button"
                  disabled={!isConnected}
                  onClick={() => { if (isConnected) { onChange(server._id); setOpen(false) } }}
                  className={btnClass}
                >
                  {/* Status dot */}
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: isSelected ? 'white' : cfg.color }}
                  />

                  {/* Server info */}
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold truncate ${isSelected ? 'text-white' : 'text-[var(--text-primary)]'}`}>
                      {server.name}
                    </div>
                    <div className={`text-xs font-mono truncate ${isSelected ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>
                      {server.ip}:{server.sshPort ?? 22}
                    </div>
                  </div>

                  {/* Status badge */}
                  <span
                    className={`
                      flex-shrink-0 text-[0.65rem] font-bold px-2 py-0.5 rounded-full
                      ${isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-[var(--bg-elevated)]'
                      }
                    `}
                    style={{ color: isSelected ? 'white' : cfg.color }}
                  >
                    {cfg.label}
                  </span>

                  {/* Selected checkmark */}
                  {isSelected && <span className="text-white text-xs flex-shrink-0">✓</span>}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

export default function PublicRepoDeployPage() {
  const navigate = useNavigate()

  // Form state
  const [serverId, setServerId]           = useState('')
  const [repoUrl, setRepoUrl]             = useState('')
  const [branch, setBranch]               = useState('main')
  const [baseDir, setBaseDir]             = useState('/')
  const [buildPack, setBuildPack]         = useState('Nixpacks')
  const [port, setPort]                   = useState('3000')
  const [isStatic, setIsStatic]           = useState(false)

  // UI state
  const [serverOpen, setServerOpen]       = useState(false)
  const [buildPackOpen, setBuildPackOpen] = useState(false)
  const [checking, setChecking]           = useState(false)
  const [loading, setLoading]             = useState(false)
  const [repoChecked, setRepoChecked]     = useState(false)
  const [error, setError]                 = useState(null)

  // ── Fetch user's servers ──────────────────────────────────
  const { data: serversRes, isLoading: serversLoading } = useQuery({
    queryKey: ['servers'],
    queryFn:  () => api.get('/api/servers').then(r => r.data),
    staleTime: 30_000,
  })

  // Show all servers in dropdown but only allow selecting CONNECTED ones
  const servers = serversRes?.data ?? []

  const selectedServer = servers.find(s => s._id === serverId)

  // ── Check repo accessibility ──────────────────────────────
  const handleCheckRepo = async () => {
    if (!repoUrl.trim()) return
    setChecking(true)
    setError(null)
    try {
      await api.get('/api/services/check-repo', { params: { url: repoUrl } })
      setRepoChecked(true)
    } catch (err) {
      setError(err.response?.data?.message || 'Repository not accessible. Make sure the URL is correct and the repo is public.')
    } finally {
      setChecking(false)
    }
  }

  // ── Submit ────────────────────────────────────────────────
  const handleContinue = async (e) => {
    e.preventDefault()
    setError(null)

    // Client-side guards
    if (!serverId) {
      setError('Please select a virtual machine to deploy on.')
      return
    }
    if (!repoUrl.trim()) {
      setError('Repository URL is required.')
      return
    }
    if (selectedServer?.status !== 'CONNECTED') {
      setError('The selected server is not connected. Please choose a different server.')
      return
    }

    setLoading(true)
    try {
      const { data } = await api.post('/api/services', {
        serverId,                              // ← which VM to deploy on
        repoUrl,
        branch,
        baseDir,
        buildPack: buildPack.toUpperCase(),   // NIXPACKS / DOCKERFILE / STATIC
        internalPort: Number(port),
        isStatic,
        type: 'APP',
      })
      console.log(data.serverId)
      console.log(data.data.serviceId)
      console.log(data)
      // console.log(data.data.serverId)

      navigate(`/apps/${data.data.serviceId}`)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create service')
    } finally {
      setLoading(false)
    }
  }

  // Close all dropdowns when clicking outside
  const handlePageClick = () => {
    setServerOpen(false)
    setBuildPackOpen(false)
  }

  return (
    <div
      className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]"
      onClick={handlePageClick}
    >
      <div className="max-w-[680px] mx-auto px-6 py-10 animate-[fadeIn_0.25s_ease-out]">

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[var(--text-secondary)] text-sm mb-8
                     hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft size={15} /> Back
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[1.75rem] font-extrabold tracking-[-0.02em] text-[var(--text-primary)] mb-1">
            Create a new Application
          </h1>
          <p className="text-[var(--text-secondary)] text-sm">Deploy any public Git repositories.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleContinue} onClick={e => e.stopPropagation()}>
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-ghost)] rounded-[var(--radius-lg)] p-6 flex flex-col gap-5">

            {/* ── SERVER SELECTION ── */}
            <div>
              <Label
                required
                tooltip="Choose which of your virtual machines this app will be deployed on. Only connected servers can be selected."
              >
                Virtual Machine
              </Label>
              <ServerDropdown
                servers={servers}
                value={serverId}
                onChange={setServerId}
                open={serverOpen}
                setOpen={setServerOpen}
                isLoading={serversLoading}
              />
              {/* Show Docker version of selected server as a hint */}
              {selectedServer?.dockerVersion && (
                <p className="mt-1.5 text-[0.72rem] text-[var(--text-muted)]">
                  Docker {selectedServer.dockerVersion}
                  {selectedServer.nixpacksVersion && ` · Nixpacks ${selectedServer.nixpacksVersion}`}
                  {selectedServer.setupCompletedAt && ` · Ready since ${new Date(selectedServer.setupCompletedAt).toLocaleDateString()}`}
                </p>
              )}
            </div>

            {/* Divider */}
            <hr className="border-[var(--border-ghost)]" />

            {/* ── REPO URL ── */}
            <div>
              <Label required tooltip="Paste the HTTPS URL of any public GitHub, GitLab, or Bitbucket repository.">
                Repository URL (https://)
              </Label>
              <div className="flex gap-2">
                <Input
                  value={repoUrl}
                  onChange={e => { setRepoUrl(e.target.value); setRepoChecked(false) }}
                  placeholder="https://github.com/user/repo"
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={handleCheckRepo}
                  disabled={!repoUrl.trim() || checking}
                  className="
                    flex-shrink-0 h-10 px-4
                    bg-[var(--bg-highest)] border border-[var(--border-ghost)]
                    rounded-[var(--radius-md)] text-sm font-medium
                    text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                    hover:border-[var(--primary)] transition-all
                    disabled:opacity-40 disabled:cursor-not-allowed
                    flex items-center gap-2
                  "
                >
                  {checking
                    ? <><Loader2 size={13} className="animate-spin" /> Checking…</>
                    : repoChecked
                      ? <><span className="text-emerald-400">✓</span> Verified</>
                      : 'Check repository'
                  }
                </button>
              </div>
              <p className="mt-1.5 text-[0.72rem] text-[var(--text-muted)]">
                For example application deployments, checkout{' '}
                <a
                  href="https://github.com/coollabsio/coolify-examples"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--primary)] hover:underline inline-flex items-center gap-0.5"
                >
                  Coolify Examples <ExternalLink size={10} />
                </a>
              </p>
            </div>

            {/* Rate limit notice */}
            <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-[var(--radius-md)]">
              <Info size={13} className="text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-[0.72rem] text-amber-300/80 leading-relaxed">
                <strong className="text-amber-300">Rate Limit</strong> — Unauthenticated GitHub API requests are limited to 60/hr per IP.
                Use a GitHub App or Deploy Key for private repos or higher limits.
              </p>
            </div>

            {/* Branch + Build Pack */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label tooltip="The Git branch to deploy from.">Branch</Label>
                <Input
                  value={branch}
                  onChange={e => setBranch(e.target.value)}
                  placeholder="main"
                />
              </div>
              <div onClick={e => e.stopPropagation()}>
                <Label required tooltip="How your app should be built. Nixpacks auto-detects your stack.">
                  Build Pack
                </Label>
                <Select
                  value={buildPack}
                  onChange={setBuildPack}
                  options={BUILD_PACKS}
                  open={buildPackOpen}
                  setOpen={setBuildPackOpen}
                />
              </div>
            </div>

            {/* Base Dir + Port */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label tooltip="If your app lives in a subdirectory of the repo, specify it here (e.g. /backend).">
                  Base Directory
                </Label>
                <Input
                  value={baseDir}
                  onChange={e => setBaseDir(e.target.value)}
                  placeholder="/"
                />
              </div>
              <div>
                <Label tooltip="The port your application listens on inside the container.">
                  Port
                </Label>
                <Input
                  value={port}
                  onChange={e => setPort(e.target.value)}
                  placeholder="3000"
                  type="number"
                />
              </div>
            </div>

            {/* Is static site */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="checkbox"
                aria-checked={isStatic}
                onClick={() => setIsStatic(s => !s)}
                className={`
                  relative w-4 h-4 rounded flex-shrink-0 border transition-all
                  ${isStatic
                    ? 'bg-[var(--primary)] border-[var(--primary)]'
                    : 'bg-[var(--bg-highest)] border-[var(--border-ghost)] hover:border-[var(--primary)]'
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

          {/* Error */}
          {error && (
            <div className="mt-3 px-3 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-[var(--radius-md)] flex items-start gap-2">
              <AlertCircle size={13} className="text-rose-400 mt-0.5 flex-shrink-0" />
              <p className="text-[0.75rem] text-rose-400">{error}</p>
            </div>
          )}

          {/* Continue */}
          <button
            type="submit"
            disabled={loading || !repoUrl.trim() || !serverId}
            className="
              mt-4 w-full h-11
              bg-[var(--primary)] hover:bg-[var(--primary-hover)]
              rounded-[var(--radius-md)] text-sm font-semibold text-white
              transition-all disabled:opacity-40 disabled:cursor-not-allowed
              flex items-center justify-center gap-2
              shadow-[0_4px_20px_rgba(132,85,239,0.4)]
              hover:shadow-[0_4px_28px_rgba(132,85,239,0.6)]
              enabled:hover:scale-[1.01]
            "
          >
            {loading
              ? <><Loader2 size={15} className="animate-spin" /> Creating…</>
              : 'Continue'
            }
          </button>
        </form>
      </div>
    </div>
  )
}