import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ChevronDown, Info, Loader2,
  Server, Wifi, WifiOff, AlertCircle, Lock,
  CheckCircle2, FileCode2
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { sourcesApi } from '../services/sources'

const SERVER_STATUS = {
  CONNECTED:   { color: '#50fa7b', label: 'Connected',   icon: Wifi },
  PENDING:     { color: '#f1fa8c', label: 'Pending',     icon: Loader2 },
  VERIFYING:   { color: '#f1fa8c', label: 'Verifying',   icon: Loader2 },
  UNREACHABLE: { color: '#ff5555', label: 'Unreachable', icon: WifiOff },
  MAINTENANCE: { color: '#7070a0', label: 'Maintenance', icon: AlertCircle },
  ERROR:       { color: '#ff5555', label: 'Error',       icon: AlertCircle },
}

// ── Tiny shared components ────────────────────────────────────────────────────

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
        transition-all ${className}
      `}
      {...rest}
    />
  )
}

function Dropdown({ value, onChange, open, setOpen, children, placeholder, disabled }) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className={`
          w-full h-10 px-3 flex items-center justify-between
          bg-[var(--bg-elevated)] border rounded-[var(--radius-md)]
          text-sm outline-none transition-all
          ${open ? 'border-[var(--primary)] shadow-[0_0_0_3px_rgba(132,85,239,0.15)]' : 'border-[var(--border-ghost)] hover:border-[var(--primary)]'}
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      >
        {value
          ? <span className="text-[var(--text-primary)]">{value}</span>
          : <span className="text-[var(--text-muted)]">{placeholder}</span>}
        <ChevronDown size={14} className={`text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50
                        bg-[var(--bg-highest)] border border-[var(--border-ghost)]
                        rounded-[var(--radius-md)] shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  )
}

function ServerDropdown({ servers, value, onChange, open, setOpen, isLoading }) {
  const selected = servers.find(s => s._id === value)
  return (
    <Dropdown
      value={selected ? `${selected.name} (${selected.ip})` : null}
      open={open}
      setOpen={setOpen}
      placeholder={isLoading ? 'Loading servers…' : 'Select a virtual machine…'}
      disabled={isLoading}
    >
      {servers.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
          <Server size={24} className="text-[var(--text-muted)] opacity-40" />
          <p className="text-sm text-[var(--text-muted)]">No virtual machines added yet</p>
          <a href="/servers/new" className="text-xs text-[var(--primary)] hover:underline">Add your first server →</a>
        </div>
      ) : (
        servers.map(server => {
          const cfg = SERVER_STATUS[server.status] ?? SERVER_STATUS.ERROR
          const isConnected = server.status === 'CONNECTED'
          const isSelected  = server._id === value
          return (
            <button
              key={server._id}
              type="button"
              disabled={!isConnected}
              onClick={() => { if (isConnected) { onChange(server._id); setOpen(false) } }}
              className={`
                w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                ${isSelected ? 'bg-[var(--primary)] text-white' : isConnected ? 'hover:bg-[var(--bg-elevated)] cursor-pointer' : 'opacity-40 cursor-not-allowed'}
              `}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: isSelected ? 'white' : cfg.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{server.name}</div>
                <div className="text-xs font-mono opacity-70 truncate">{server.ip}</div>
              </div>
              <span className="text-[0.65rem] font-bold" style={{ color: isSelected ? 'white' : cfg.color }}>{cfg.label}</span>
            </button>
          )
        })
      )}
    </Dropdown>
  )
}

function SourceDropdown({ sources, value, onChange, open, setOpen, isLoading }) {
  const selected = sources.find(s => s.id === value)
  return (
    <Dropdown
      value={selected?.name}
      open={open}
      setOpen={setOpen}
      placeholder={isLoading ? 'Loading sources…' : 'Select a GitHub App source (optional)…'}
      disabled={isLoading}
    >
      {/* "None / public repo" option */}
      <button
        type="button"
        onClick={() => { onChange(''); setOpen(false) }}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
          ${!value ? 'bg-[var(--primary)] text-white' : 'hover:bg-[var(--bg-elevated)] text-[var(--text-primary)]'}`}
      >
        <div className="w-2 h-2 rounded-full flex-shrink-0 bg-emerald-400" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">Public repository</div>
          <div className="text-xs opacity-70">No authentication required</div>
        </div>
      </button>
      {sources.map(src => (
        <button
          key={src.id}
          type="button"
          onClick={() => { onChange(src.id); setOpen(false) }}
          disabled={!src.isConnected}
          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
            ${value === src.id ? 'bg-[var(--primary)] text-white' : src.isConnected ? 'hover:bg-[var(--bg-elevated)] text-[var(--text-primary)]' : 'opacity-40 cursor-not-allowed text-[var(--text-muted)]'}`}
        >
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${src.isConnected ? 'bg-emerald-400' : 'bg-[var(--text-muted)]'}`} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{src.name}</div>
            <div className="text-xs opacity-70">{src.isConnected ? 'Connected' : 'Not connected'}</div>
          </div>
          {!src.isConnected && (
            <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold">Setup needed</span>
          )}
        </button>
      ))}
    </Dropdown>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DockerfileDeployPage() {
  const navigate = useNavigate()

  const [repoUrl,        setRepoUrl]        = useState('')
  const [branch,         setBranch]         = useState('main')
  const [baseDir,        setBaseDir]        = useState('/')
  const [dockerfilePath, setDockerfilePath] = useState('Dockerfile')
  const [port,           setPort]           = useState('3000')
  const [serverId,       setServerId]       = useState('')
  const [sourceId,       setSourceId]       = useState('')   // '' = public

  const [serverOpen,  setServerOpen]  = useState(false)
  const [sourceOpen,  setSourceOpen]  = useState(false)
  const [checking,    setChecking]    = useState(false)
  const [repoChecked, setRepoChecked] = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)

  const { data: sourcesData, isLoading: sourcesLoading } = useQuery({
    queryKey: ['sources', 'list'],
    queryFn:  sourcesApi.list,
    staleTime: 30_000,
  })
  const sources = (sourcesData?.data ?? []).filter(s => s.isConnected)

  const { data: serversRes, isLoading: serversLoading } = useQuery({
    queryKey: ['servers'],
    queryFn:  () => api.get('/api/servers').then(r => r.data),
    staleTime: 30_000,
  })
  const servers = serversRes?.data ?? []

  const handleCheckRepo = async () => {
    if (!repoUrl.trim()) return
    setChecking(true); setError(null)
    try {
      if (sourceId) {
        await api.get('/api/services/check-private-repo', { params: { url: repoUrl, sourceId } })
      } else {
        await api.get('/api/services/check-repo', { params: { url: repoUrl } })
      }
      setRepoChecked(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Repository not accessible.')
    } finally {
      setChecking(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!repoUrl.trim()) return setError('Repository URL is required.')
    if (!serverId)       return setError('Please select a virtual machine.')

    setLoading(true)
    try {
      const { data } = await api.post('/api/services/dockerfile', {
        serverId,
        repoUrl,
        branch,
        baseDir,
        dockerfilePath,
        internalPort:   Number(port),
        ...(sourceId ? { githubSourceId: sourceId } : {}),
      })
      navigate(`/apps/${data.data.serviceId}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create service')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]"
      onClick={() => { setServerOpen(false); setSourceOpen(false) }}
    >
      <div className="max-w-[680px] mx-auto px-6 py-10 animate-[fadeIn_0.25s_ease-out]">

        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[var(--text-secondary)] text-sm mb-8 hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft size={15} /> Back
        </button>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-1">
            <FileCode2 size={20} className="text-[var(--primary)]" />
            <h1 className="text-[1.75rem] font-extrabold tracking-[-0.02em]">Deploy with Dockerfile</h1>
          </div>
          <p className="text-[var(--text-secondary)] text-sm">
            Build and deploy an app using a Dockerfile inside your repository.
          </p>
        </div>

        <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()}>
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-ghost)] rounded-[var(--radius-lg)] p-6 flex flex-col gap-5">

            {/* REPO AUTH */}
            <div onClick={e => e.stopPropagation()}>
              <Label tooltip="If your repository is private, select a connected GitHub App source. For public repos, leave as 'Public repository'.">
                Repository Access
              </Label>
              <SourceDropdown
                sources={sources}
                value={sourceId}
                onChange={setSourceId}
                open={sourceOpen}
                setOpen={setSourceOpen}
                isLoading={sourcesLoading}
              />
            </div>

            <hr className="border-[var(--border-ghost)]" />

            {/* REPO URL */}
            <div>
              <Label required tooltip="HTTPS URL of the repository containing your Dockerfile.">
                Repository URL
              </Label>
              <div className="flex gap-2">
                <Input
                  value={repoUrl}
                  onChange={e => { setRepoUrl(e.target.value); setRepoChecked(false) }}
                  placeholder="https://github.com/owner/repo"
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
                    disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2
                  "
                >
                  {checking
                    ? <><Loader2 size={13} className="animate-spin" /> Checking…</>
                    : repoChecked
                      ? <><CheckCircle2 size={13} className="text-emerald-400" /> Verified</>
                      : 'Verify access'}
                </button>
              </div>
            </div>

            {/* SERVER */}
            <div onClick={e => e.stopPropagation()}>
              <Label required tooltip="Virtual machine to deploy on. Only connected servers are selectable.">
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
            </div>

            <hr className="border-[var(--border-ghost)]" />

            {/* BUILD CONFIG */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label tooltip="Git branch to clone and build from.">Branch</Label>
                <Input value={branch} onChange={e => setBranch(e.target.value)} placeholder="main" />
              </div>
              <div>
                <Label tooltip="Path to your Dockerfile relative to the base directory.">
                  Dockerfile Path
                </Label>
                <Input value={dockerfilePath} onChange={e => setDockerfilePath(e.target.value)} placeholder="Dockerfile" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label tooltip="Subdirectory in the repo to use as the Docker build context.">Base Directory</Label>
                <Input value={baseDir} onChange={e => setBaseDir(e.target.value)} placeholder="/" />
              </div>
              <div>
                <Label tooltip="Port your container exposes.">Port</Label>
                <Input value={port} onChange={e => setPort(e.target.value)} placeholder="3000" type="number" />
              </div>
            </div>

            {/* Info box */}
            <div className="flex items-start gap-2 px-3 py-2.5 bg-[var(--bg-highest)] border border-[var(--border-ghost)] rounded-[var(--radius-md)]">
              <FileCode2 size={13} className="text-[var(--primary)] mt-0.5 flex-shrink-0" />
              <p className="text-[0.72rem] text-[var(--text-muted)] leading-relaxed">
                GitSync will clone your repository and run <code className="text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-1 rounded">docker build -f {dockerfilePath || 'Dockerfile'} .</code> on your server. No local Docker needed.
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-3 px-3 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-[var(--radius-md)] flex items-start gap-2">
              <AlertCircle size={13} className="text-rose-400 mt-0.5 flex-shrink-0" />
              <p className="text-[0.75rem] text-rose-400">{error}</p>
            </div>
          )}

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
              : <><FileCode2 size={14} /> Deploy with Dockerfile</>}
          </button>
        </form>
      </div>
    </div>
  )
}