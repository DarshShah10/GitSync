import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ChevronDown, Info, Loader2,
  Server, Wifi, WifiOff, AlertCircle,
  Container, Eye, EyeOff, Lock
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'

const SERVER_STATUS = {
  CONNECTED:   { color: '#50fa7b', label: 'Connected',   icon: Wifi },
  PENDING:     { color: '#f1fa8c', label: 'Pending',     icon: Loader2 },
  VERIFYING:   { color: '#f1fa8c', label: 'Verifying',   icon: Loader2 },
  UNREACHABLE: { color: '#ff5555', label: 'Unreachable', icon: WifiOff },
  MAINTENANCE: { color: '#7070a0', label: 'Maintenance', icon: AlertCircle },
  ERROR:       { color: '#ff5555', label: 'Error',       icon: AlertCircle },
}

// Popular public images for quick-pick
const POPULAR_IMAGES = [
  { label: 'nginx',        value: 'nginx:latest',         port: 80,   desc: 'Web server / reverse proxy' },
  { label: 'node',         value: 'node:20-alpine',       port: 3000, desc: 'Node.js runtime' },
  { label: 'python',       value: 'python:3.12-slim',     port: 8000, desc: 'Python 3.12' },
  { label: 'redis',        value: 'redis:7-alpine',       port: 6379, desc: 'In-memory data store' },
  { label: 'postgres',     value: 'postgres:16-alpine',   port: 5432, desc: 'PostgreSQL database' },
  { label: 'ghost',        value: 'ghost:latest',         port: 2368, desc: 'Blog platform' },
  { label: 'wordpress',    value: 'wordpress:latest',     port: 80,   desc: 'CMS platform' },
  { label: 'minio/minio',  value: 'minio/minio:latest',  port: 9000, desc: 'S3-compatible storage' },
]

// ── Shared components ─────────────────────────────────────────────────────────

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

function Input({ value, onChange, placeholder, className = '', type = 'text', ...rest }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={type}
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

function ServerDropdown({ servers, value, onChange, open, setOpen, isLoading }) {
  const selected = servers.find(s => s._id === value)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={isLoading}
        className={`
          w-full h-10 px-3 flex items-center justify-between
          bg-[var(--bg-elevated)] border rounded-[var(--radius-md)]
          text-sm outline-none transition-all
          ${open ? 'border-[var(--primary)] shadow-[0_0_0_3px_rgba(132,85,239,0.15)]' : 'border-[var(--border-ghost)] hover:border-[var(--primary)]'}
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      >
        {isLoading
          ? <span className="text-[var(--text-muted)] flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Loading servers…</span>
          : selected
            ? <span className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full" style={{ background: SERVER_STATUS[selected.status]?.color ?? '#7070a0' }} />
                <span className="font-semibold truncate">{selected.name}</span>
                <span className="text-[var(--text-muted)] text-xs font-mono">{selected.ip}</span>
              </span>
            : <span className="text-[var(--text-muted)]">Select a virtual machine…</span>
        }
        <ChevronDown size={14} className={`text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && !isLoading && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50
                        bg-[var(--bg-highest)] border border-[var(--border-ghost)]
                        rounded-[var(--radius-md)] shadow-2xl overflow-hidden">
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
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DockerImageDeployPage() {
  const navigate = useNavigate()

  const [imageName,        setImageName]        = useState('')
  const [imageTag,         setImageTag]         = useState('latest')
  const [port,             setPort]             = useState('80')
  const [serverId,         setServerId]         = useState('')
  const [serverOpen,       setServerOpen]       = useState(false)

  // Private registry
  const [usePrivateReg,    setUsePrivateReg]    = useState(false)
  const [registryUrl,      setRegistryUrl]      = useState('')
  const [registryUser,     setRegistryUser]     = useState('')
  const [registryPassword, setRegistryPassword] = useState('')
  const [showPassword,     setShowPassword]     = useState(false)

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const { data: serversRes, isLoading: serversLoading } = useQuery({
    queryKey: ['servers'],
    queryFn:  () => api.get('/api/servers').then(r => r.data),
    staleTime: 30_000,
  })
  const servers = serversRes?.data ?? []

  const handleQuickPick = (img) => {
    // e.g. "nginx:latest" → name="nginx", tag="latest"
    const colonIdx = img.value.lastIndexOf(':')
    if (colonIdx > 0) {
      setImageName(img.value.slice(0, colonIdx))
      setImageTag(img.value.slice(colonIdx + 1))
    } else {
      setImageName(img.value)
      setImageTag('latest')
    }
    setPort(String(img.port))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!imageName.trim()) return setError('Image name is required.')
    if (!serverId)         return setError('Please select a virtual machine.')

    setLoading(true)
    try {
      const { data } = await api.post('/api/services/docker-image', {
        serverId,
        imageName:        imageName.trim(),
        imageTag:         imageTag.trim() || 'latest',
        internalPort:     Number(port),
        ...(usePrivateReg ? {
          registryUrl:      registryUrl.trim()  || undefined,
          registryUser:     registryUser.trim()  || undefined,
          registryPassword: registryPassword     || undefined,
        } : {}),
      })
      navigate(`/apps/${data.data.serviceId}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create service')
    } finally {
      setLoading(false)
    }
  }

  const fullImagePreview = imageName.trim()
    ? `${imageName.trim()}:${imageTag.trim() || 'latest'}`
    : null

  return (
    <div
      className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]"
      onClick={() => setServerOpen(false)}
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
            <Container size={20} className="text-[var(--primary)]" />
            <h1 className="text-[1.75rem] font-extrabold tracking-[-0.02em]">Deploy Docker Image</h1>
          </div>
          <p className="text-[var(--text-secondary)] text-sm">
            Pull and run any Docker image from Docker Hub or a private registry.
            No build step — just pull and run.
          </p>
        </div>

        <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()}>
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-ghost)] rounded-[var(--radius-lg)] p-6 flex flex-col gap-5">

            {/* Quick-pick chips */}
            <div>
              <Label tooltip="Click a common image to auto-fill the fields below.">Quick Pick</Label>
              <div className="flex flex-wrap gap-2">
                {POPULAR_IMAGES.map(img => (
                  <button
                    key={img.value}
                    type="button"
                    onClick={() => handleQuickPick(img)}
                    title={img.desc}
                    className={`
                      px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                      ${imageName === img.value.split(':')[0]
                        ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                        : 'bg-[var(--bg-highest)] border-[var(--border-ghost)] text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]'
                      }
                    `}
                  >
                    {img.label}
                  </button>
                ))}
              </div>
            </div>

            <hr className="border-[var(--border-ghost)]" />

            {/* Image name + tag */}
            <div>
              <Label required tooltip="Docker image name, e.g. 'nginx', 'myorg/myapp', or 'registry.io/myapp'.">
                Image Name
              </Label>
              <div className="flex gap-2">
                <Input
                  value={imageName}
                  onChange={e => setImageName(e.target.value)}
                  placeholder="nginx"
                  className="flex-1"
                />
                <span className="flex items-center text-[var(--text-muted)] text-sm select-none">:</span>
                <Input
                  value={imageTag}
                  onChange={e => setImageTag(e.target.value)}
                  placeholder="latest"
                  className="w-32"
                />
              </div>
              {fullImagePreview && (
                <p className="mt-1.5 text-[0.72rem] text-[var(--text-muted)]">
                  Full image reference: <code className="text-[var(--text-secondary)] bg-[var(--bg-highest)] px-1.5 py-0.5 rounded">{fullImagePreview}</code>
                </p>
              )}
            </div>

            {/* Server + Port side-by-side */}
            <div className="grid grid-cols-[1fr_120px] gap-4 items-end">
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
              <div>
                <Label tooltip="Port the container exposes internally.">Port</Label>
                <Input value={port} onChange={e => setPort(e.target.value)} placeholder="80" type="number" />
              </div>
            </div>

            <hr className="border-[var(--border-ghost)]" />

            {/* Private registry toggle */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={usePrivateReg}
                  onClick={() => setUsePrivateReg(s => !s)}
                  className={`
                    relative w-4 h-4 rounded flex-shrink-0 border transition-all
                    ${usePrivateReg ? 'bg-[var(--primary)] border-[var(--primary)]' : 'bg-[var(--bg-highest)] border-[var(--border-ghost)] hover:border-[var(--primary)]'}
                  `}
                >
                  {usePrivateReg && (
                    <svg className="absolute inset-0 w-full h-full p-[2px]" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <span className="text-sm text-[var(--text-secondary)] flex items-center gap-2">
                  Private registry credentials
                  <Tooltip text="Provide credentials to authenticate with a private Docker registry before pulling the image." />
                </span>
              </div>

              {usePrivateReg && (
                <div className="flex flex-col gap-3 pl-7 animate-[fadeIn_0.15s_ease-out]">
                  <div>
                    <Label tooltip="Registry hostname, e.g. ghcr.io, registry.gitlab.com. Leave blank for Docker Hub.">
                      Registry URL
                      <span className="text-[0.65rem] font-normal text-[var(--text-muted)] ml-1">(optional — blank = Docker Hub)</span>
                    </Label>
                    <Input
                      value={registryUrl}
                      onChange={e => setRegistryUrl(e.target.value)}
                      placeholder="ghcr.io"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label tooltip="Registry username or service account.">Username</Label>
                      <Input
                        value={registryUser}
                        onChange={e => setRegistryUser(e.target.value)}
                        placeholder="myuser"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <Label tooltip="Registry password or access token.">Password / Token</Label>
                      <div className="relative">
                        <Input
                          value={registryPassword}
                          onChange={e => setRegistryPassword(e.target.value)}
                          placeholder="••••••••"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(s => !s)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                        >
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-[var(--radius-md)]">
                    <Lock size={12} className="text-amber-400 mt-0.5 flex-shrink-0" />
                    <p className="text-[0.7rem] text-amber-300/80 leading-relaxed">
                      Credentials are stored encrypted in your service config and used only during image pulls.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-3 px-3 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-[var(--radius-md)] flex items-start gap-2">
              <AlertCircle size={13} className="text-rose-400 mt-0.5 flex-shrink-0" />
              <p className="text-[0.75rem] text-rose-400">{error}</p>
            </div>
          )}

          {/* Info strip */}
          <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border-ghost)] rounded-[var(--radius-md)]">
            <Container size={13} className="text-[var(--primary)] mt-0.5 flex-shrink-0" />
            <p className="text-[0.72rem] text-[var(--text-muted)] leading-relaxed">
              GitSync will run <code className="text-[var(--text-secondary)] bg-[var(--bg-highest)] px-1 rounded">docker pull {fullImagePreview || '<image>:<tag>'}</code> on your server, then start a container and configure Nginx routing automatically.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !imageName.trim() || !serverId}
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
              : <><Container size={14} /> Deploy Docker Image</>}
          </button>
        </form>
      </div>
    </div>
  )
}