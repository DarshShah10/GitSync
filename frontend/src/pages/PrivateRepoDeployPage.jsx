import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ChevronDown, Info, Loader2,
  Server, Wifi, WifiOff, AlertCircle, Lock,
  CheckCircle2, RefreshCw
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { sourcesApi } from '../services/sources'

const BUILD_PACKS = ['Nixpacks', 'Static', 'Dockerfile', 'Docker Compose']

const SERVER_STATUS = {
  CONNECTED:   { color: '#50fa7b', label: 'Connected',   icon: Wifi },
  PENDING:     { color: '#f1fa8c', label: 'Pending',     icon: Loader2 },
  VERIFYING:   { color: '#f1fa8c', label: 'Verifying',   icon: Loader2 },
  UNREACHABLE: { color: '#ff5555', label: 'Unreachable', icon: WifiOff },
  MAINTENANCE: { color: '#7070a0', label: 'Maintenance', icon: AlertCircle },
  ERROR:       { color: '#ff5555', label: 'Error',       icon: AlertCircle },
}

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
        {value ? (
          <span className="text-[var(--text-primary)]">{value}</span>
        ) : (
          <span className="text-[var(--text-muted)]">{placeholder}</span>
        )}
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

function SourceDropdown({ sources, value, onChange, open, setOpen, isLoading }) {
  const selected = sources.find(s => s.id === value)
  return (
    <Dropdown
      value={selected?.name}
      onChange={onChange}
      open={open}
      setOpen={setOpen}
      placeholder={isLoading ? 'Loading sources…' : 'Select a GitHub App source…'}
      disabled={isLoading}
    >
      {sources.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-5 text-center">
          <Lock size={20} className="text-[var(--text-muted)] opacity-40" />
          <p className="text-sm text-[var(--text-muted)]">No connected sources</p>
          <a href="/sources" className="text-xs text-[var(--primary)] hover:underline">
            Create a GitHub App source →
          </a>
        </div>
      ) : (
        sources.map(src => (
          <button
            key={src.id}
            type="button"
            onClick={() => { onChange(src.id); setOpen(false) }}
            className={`
              w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
              ${value === src.id
                ? 'bg-[var(--primary)] text-white'
                : src.isConnected
                  ? 'hover:bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                  : 'opacity-40 cursor-not-allowed text-[var(--text-muted)]'
              }
            `}
            disabled={!src.isConnected}
          >
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${src.isConnected ? 'bg-emerald-400' : 'bg-[var(--text-muted)]'}`} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{src.name}</div>
              <div className="text-xs opacity-70 truncate">
                {src.isConnected ? 'Connected' : 'Not connected'} · {src.installationType}
              </div>
            </div>
            {!src.isConnected && (
              <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold">
                Setup needed
              </span>
            )}
          </button>
        ))
      )}
    </Dropdown>
  )
}

function RepoDropdown({ repos, value, onChange, open, setOpen, isLoading, onRefresh }) {
  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <Dropdown
          value={value}
          onChange={onChange}
          open={open}
          setOpen={setOpen}
          placeholder={isLoading ? 'Loading repos…' : 'Select a repository…'}
          disabled={isLoading || repos.length === 0}
        >
          {repos.map(repo => (
            <button
              key={repo.fullName}
              type="button"
              onClick={() => { onChange(repo.fullName); setOpen(false) }}
              className={`
                w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                ${value === repo.fullName
                  ? 'bg-[var(--primary)] text-white'
                  : 'hover:bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                }
              `}
            >
              <Lock size={12} className="flex-shrink-0 opacity-60" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{repo.fullName}</div>
                {repo.description && (
                  <div className="text-xs opacity-60 truncate">{repo.description}</div>
                )}
              </div>
              <span className="text-[0.65rem] opacity-60">{repo.defaultBranch}</span>
            </button>
          ))}
        </Dropdown>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isLoading}
        title="Refresh repo list"
        className="
          flex-shrink-0 h-10 w-10 flex items-center justify-center
          bg-[var(--bg-elevated)] border border-[var(--border-ghost)]
          rounded-[var(--radius-md)] text-[var(--text-muted)]
          hover:text-[var(--primary)] hover:border-[var(--primary)] transition-all
          disabled:opacity-40
        "
      >
        <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
      </button>
    </div>
  )
}

function ServerDropdown({ servers, value, onChange, open, setOpen, isLoading }) {
  const selected = servers.find(s => s._id === value)
  return (
    <Dropdown
      value={selected ? `${selected.name} (${selected.ip})` : null}
      onChange={onChange}
      open={open}
      setOpen={setOpen}
      placeholder={isLoading ? 'Loading servers…' : 'Select a virtual machine…'}
      disabled={isLoading}
    >
      {servers.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
          <Server size={24} className="text-[var(--text-muted)] opacity-40" />
          <p className="text-sm text-[var(--text-muted)]">No virtual machines added yet</p>
          <a href="/servers/new" className="text-xs text-[var(--primary)] hover:underline">
            Add your first server →
          </a>
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
                ${isSelected ? 'bg-[var(--primary)] text-white'
                  : isConnected ? 'hover:bg-[var(--bg-elevated)] cursor-pointer'
                  : 'opacity-40 cursor-not-allowed'}
              `}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: isSelected ? 'white' : cfg.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{server.name}</div>
                <div className="text-xs font-mono opacity-70 truncate">{server.ip}</div>
              </div>
              <span className="text-[0.65rem] font-bold" style={{ color: isSelected ? 'white' : cfg.color }}>
                {cfg.label}
              </span>
            </button>
          )
        })
      )}
    </Dropdown>
  )
}

export default function PrivateRepoDeployPage() {
  const navigate = useNavigate()

  const [sourceId,      setSourceId]      = useState('')
  const [repoUrl,       setRepoUrl]       = useState('')
  const [branch,        setBranch]        = useState('main')
  const [baseDir,       setBaseDir]       = useState('/')
  const [buildPack,     setBuildPack]     = useState('Nixpacks')
  const [port,          setPort]          = useState('3000')
  const [isStatic,      setIsStatic]      = useState(false)
  const [serverId,      setServerId]      = useState('')

  const [sourceOpen,    setSourceOpen]    = useState(false)
  const [repoOpen,      setRepoOpen]      = useState(false)
  const [buildOpen,     setBuildOpen]     = useState(false)
  const [serverOpen,    setServerOpen]    = useState(false)
  const [checking,      setChecking]      = useState(false)
  const [repoChecked,   setRepoChecked]   = useState(false)
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState(null)
  const [repoRefreshKey, setRepoRefreshKey] = useState(0)

  const { data: sourcesData, isLoading: sourcesLoading } = useQuery({
    queryKey: ['sources', 'list'],
    queryFn: sourcesApi.list,
    staleTime: 30_000,
  })
  const sources = (sourcesData?.data ?? []).filter(s => s.isConnected)

  const { data: reposData, isLoading: reposLoading } = useQuery({
    queryKey: ['sources', sourceId, 'repos', repoRefreshKey],
    queryFn:  () => api.get(`/api/sources/${sourceId}/repos`).then(r => r.data.data ?? []),
    enabled:  !!sourceId,
    staleTime: 60_000,
  })
  const repos = reposData ?? []

  const { data: serversRes, isLoading: serversLoading } = useQuery({
    queryKey: ['servers'],
    queryFn:  () => api.get('/api/servers').then(r => r.data),
    staleTime: 30_000,
  })
  const servers = serversRes?.data ?? []

  const handleRepoSelect = (fullName) => {
    const repo = repos.find(r => r.fullName === fullName)
    if (repo) {
      setRepoUrl(`https://github.com/${repo.fullName}`)
      setBranch(repo.defaultBranch || 'main')
      setRepoChecked(false)
    }
  }

  const handleCheckRepo = async () => {
    if (!repoUrl.trim() || !sourceId) return
    setChecking(true)
    setError(null)
    try {
      await api.get('/api/services/check-private-repo', {
        params: { url: repoUrl, sourceId },
      })
      setRepoChecked(true)
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error ||
               'Repository not accessible via this source.')
    } finally {
      setChecking(false)
    }
  }

  const handleContinue = async (e) => {
    e.preventDefault()
    setError(null)

    if (!sourceId)       return setError('Please select a GitHub App source.')
    if (!repoUrl.trim()) return setError('Repository URL is required.')
    if (!serverId)       return setError('Please select a virtual machine.')

    setLoading(true)
    try {
      const { data } = await api.post('/api/services/private', {
        serverId,
        githubSourceId: sourceId,
        repoUrl,
        branch,
        baseDir,
        buildPack:    buildPack.toUpperCase(),
        internalPort: Number(port),
        isStatic,
      })
      navigate(`/apps/${data.data.serviceId}`)
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to create service')
    } finally {
      setLoading(false)
    }
  }

  const handlePageClick = () => {
    setSourceOpen(false); setRepoOpen(false)
    setBuildOpen(false);  setServerOpen(false)
  }

  const selectedSource = sources.find(s => s.id === sourceId)

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]" onClick={handlePageClick}>
      <div className="max-w-[680px] mx-auto px-6 py-10 animate-[fadeIn_0.25s_ease-out]">

        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[var(--text-secondary)] text-sm mb-8
                     hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft size={15} /> Back
        </button>

        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-1">
            <Lock size={20} className="text-[var(--primary)]" />
            <h1 className="text-[1.75rem] font-extrabold tracking-[-0.02em] text-[var(--text-primary)]">
              Deploy Private Repository
            </h1>
          </div>
          <p className="text-[var(--text-secondary)] text-sm">
            Deploy private GitHub repositories using your connected GitHub App source.
          </p>
        </div>

        <form onSubmit={handleContinue} onClick={e => e.stopPropagation()}>
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-ghost)] rounded-[var(--radius-lg)] p-6 flex flex-col gap-5">

            {/* GITHUB SOURCE */}
            <div>
              <Label required tooltip="Select which GitHub App source to use. The source must be connected and installed on the target repository.">
                GitHub App Source
              </Label>
              <div onClick={e => e.stopPropagation()}>
                <SourceDropdown
                  sources={sources}
                  value={sourceId}
                  onChange={(id) => { setSourceId(id); setRepoUrl(''); setRepoChecked(false) }}
                  open={sourceOpen}
                  setOpen={setSourceOpen}
                  isLoading={sourcesLoading}
                />
              </div>
              {sources.length === 0 && !sourcesLoading && (
                <div className="mt-2 flex items-center gap-2 px-3 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-[var(--radius-md)]">
                  <Info size={13} className="text-amber-400 flex-shrink-0" />
                  <p className="text-[0.72rem] text-amber-300/80">
                    No connected sources found.{' '}
                    <a href="/sources" className="text-amber-300 underline">Create a GitHub App source</a> first.
                  </p>
                </div>
              )}
              {selectedSource && (
                <p className="mt-1.5 text-[0.72rem] text-[var(--text-muted)]">
                  Using: <span className="text-[var(--text-secondary)] font-medium">{selectedSource.name}</span>
                </p>
              )}
            </div>

            <hr className="border-[var(--border-ghost)]" />

            {/* REPOSITORY */}
            <div>
              <Label required tooltip="Select a repository or paste a GitHub URL.">Repository</Label>

              {sourceId && repos.length > 0 && (
                <div className="mb-3" onClick={e => e.stopPropagation()}>
                  <p className="text-[0.72rem] text-[var(--text-muted)] mb-1.5">Pick from accessible repos:</p>
                  <RepoDropdown
                    repos={repos}
                    value={repos.find(r => `https://github.com/${r.fullName}` === repoUrl)?.fullName}
                    onChange={handleRepoSelect}
                    open={repoOpen}
                    setOpen={setRepoOpen}
                    isLoading={reposLoading}
                    onRefresh={() => setRepoRefreshKey(k => k + 1)}
                  />
                </div>
              )}
              {sourceId && reposLoading && (
                <div className="flex items-center gap-2 text-[0.75rem] text-[var(--text-muted)] mb-3">
                  <Loader2 size={12} className="animate-spin" /> Loading repositories…
                </div>
              )}

              <Label tooltip="Or type the HTTPS URL of the repository manually.">Or enter URL manually</Label>
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
                  disabled={!repoUrl.trim() || !sourceId || checking}
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
                      ? <><CheckCircle2 size={13} className="text-emerald-400" /> Verified</>
                      : 'Verify access'
                  }
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
                <Label tooltip="Branch to deploy from.">Branch</Label>
                <Input value={branch} onChange={e => setBranch(e.target.value)} placeholder="main" />
              </div>
              <div onClick={e => e.stopPropagation()}>
                <Label required tooltip="How your app should be built.">Build Pack</Label>
                <Dropdown
                  value={buildPack}
                  onChange={setBuildPack}
                  open={buildOpen}
                  setOpen={setBuildOpen}
                  placeholder="Select build pack…"
                >
                  {BUILD_PACKS.map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => { setBuildPack(opt); setBuildOpen(false) }}
                      className={`
                        w-full text-left px-3 py-2.5 text-sm transition-colors
                        ${buildPack === opt
                          ? 'bg-[var(--primary)] text-white font-medium'
                          : 'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                        }
                      `}
                    >
                      {buildPack === opt && <span className="mr-2">✓</span>}
                      {opt}
                    </button>
                  ))}
                </Dropdown>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label tooltip="Subdirectory in the repo to build from.">Base Directory</Label>
                <Input value={baseDir} onChange={e => setBaseDir(e.target.value)} placeholder="/" />
              </div>
              <div>
                <Label tooltip="Port your app listens on inside the container.">Port</Label>
                <Input value={port} onChange={e => setPort(e.target.value)} placeholder="3000" type="number" />
              </div>
            </div>

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
                <Tooltip text="Static sites served directly by Nginx without a running container." />
              </span>
            </div>
          </div>

          {error && (
            <div className="mt-3 px-3 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-[var(--radius-md)] flex items-start gap-2">
              <AlertCircle size={13} className="text-rose-400 mt-0.5 flex-shrink-0" />
              <p className="text-[0.75rem] text-rose-400">{error}</p>
            </div>
          )}

          <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border-ghost)] rounded-[var(--radius-md)]">
            <Lock size={13} className="text-[var(--primary)] mt-0.5 flex-shrink-0" />
            <p className="text-[0.72rem] text-[var(--text-muted)] leading-relaxed">
              Your private repository is cloned using a temporary GitHub App installation token — no SSH keys or personal access tokens needed.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !repoUrl.trim() || !serverId || !sourceId}
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
              : <><Lock size={14} /> Deploy Private Repository</>
            }
          </button>
        </form>
      </div>
    </div>
  )
}