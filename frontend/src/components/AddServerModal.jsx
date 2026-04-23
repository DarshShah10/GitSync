import { useState } from 'react'
import { X, Eye, EyeOff, Loader, Key, Lock, Terminal } from 'lucide-react'
import { useCreateServer } from '../hooks/useServers.js'

const INIT = {
  name: '', ip: '', port: '22', username: 'root',
  authType: 'PASSWORD', password: '', privateKey: '',
}

// Reusable field wrapper
function Field({ label, error, hint, children, className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-[0.75rem] font-semibold text-gray-500 tracking-[0.04em]">
        {label}
      </label>
      {children}
      {error && <span className="text-[0.7rem] text-red-400">{error}</span>}
      {!error && hint && <span className="text-[0.7rem] text-gray-600">{hint}</span>}
    </div>
  )
}

// Shared input class
const inputCls =
  `w-full bg-[#1c1c21] border border-white/[0.08] rounded-lg
   text-white text-sm px-3 py-2 outline-none font-sans
   focus:border-violet-500/60 transition-colors duration-150
   disabled:opacity-50 disabled:cursor-not-allowed
   placeholder:text-gray-600`

export default function AddServerModal({ onClose, onCreated }) {
  const [form,       setForm]  = useState(INIT)
  const [showSecret, setShow]  = useState(false)
  const [errors,     setErrors] = useState({})
  const { mutateAsync: create, isPending } = useCreateServer()

  function set(k, v) {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => ({ ...e, [k]: undefined, authType: undefined }))
  }

  function validate() {
    const e = {}
    if (!form.name.trim())     e.name     = 'Required'
    if (!form.ip.trim())       e.ip       = 'Required'
    if (!form.username.trim()) e.username = 'Required'
    const p = parseInt(form.port, 10)
    if (isNaN(p) || p < 1 || p > 65535) e.port = '1–65535'
    if (form.authType === 'PASSWORD') {
      if (!form.password.trim()) e.password = 'Required'
    } else {
      if (!form.privateKey.trim()) e.privateKey = 'Required'
      else if (!form.privateKey.trim().startsWith('-----BEGIN'))
        e.privateKey = 'Must start with -----BEGIN...'
    }
    return e
  }

  async function submit(ev) {
    ev.preventDefault()
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }

    const payload = {
      name:     form.name.trim(),
      ip:       form.ip.trim(),
      port:     parseInt(form.port, 10),
      username: form.username.trim(),
      authType: form.authType,
      ...(form.authType === 'PASSWORD'
        ? { password:   form.password.trim() }
        : { privateKey: form.privateKey.trim() }),
    }

    try {
      const result = await create(payload)
      onCreated?.(result.data)
      onClose()
    } catch (err) {
      // Zod validation errors from the backend come as { details: [{path, message}] }
      const details = err.response?.data?.details
      if (Array.isArray(details) && details.length) {
        const fe = {}
        details.forEach(({ path, field, message }) => {
          const key = path ?? field
          if (key) fe[key] = message
        })
        if (Object.keys(fe).length) setErrors(fe)
      }
      // onError in useCreateServer already shows a toast for everything else
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-[4px]
                 flex items-center justify-center z-[100] p-5"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-[#16161a] border border-white/[0.08] rounded-2xl
                   w-full max-w-[500px] max-h-[90vh] overflow-y-auto
                   shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-5 pb-0">
          <div
            className="w-[34px] h-[34px] bg-violet-500/10 border border-violet-500/25
                       rounded-lg flex items-center justify-center text-violet-400 flex-shrink-0"
          >
            <Terminal size={16} />
          </div>
          <div>
            <div className="text-base font-bold text-white">Connect Server</div>
            <div className="text-[0.75rem] text-gray-500 mt-px">
              We'll SSH in and configure Docker automatically
            </div>
          </div>
          <button
            className="ml-auto text-gray-500 hover:text-white transition-colors
                       p-1.5 rounded-md flex items-center justify-center"
            onClick={onClose}
            disabled={isPending}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="p-5 flex flex-col gap-3.5">

          <Field label="Server Name" error={errors.name} hint="e.g. prod-us-1">
            <input
              className={inputCls}
              placeholder="prod-us-1"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              disabled={isPending}
              autoFocus
            />
          </Field>

          <div className="flex gap-2.5">
            <Field label="IP / Hostname" error={errors.ip} className="flex-[2]">
              <input
                className={inputCls}
                placeholder="164.92.95.225"
                value={form.ip}
                onChange={e => set('ip', e.target.value)}
                disabled={isPending}
              />
            </Field>
            <Field label="Port" error={errors.port} className="flex-1">
              <input
                className={inputCls}
                type="number"
                placeholder="22"
                value={form.port}
                onChange={e => set('port', e.target.value)}
                disabled={isPending}
              />
            </Field>
          </div>

          <Field label="SSH Username" error={errors.username}>
            <input
              className={inputCls}
              placeholder="root"
              value={form.username}
              onChange={e => set('username', e.target.value)}
              disabled={isPending}
            />
          </Field>

          {/* Auth toggle */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.75rem] font-semibold text-gray-500 tracking-[0.04em]">
              Auth Method
            </label>
            <div className="flex gap-1.5">
              {[
                { value: 'PASSWORD', icon: Lock, label: 'Password' },
                { value: 'SSH_KEY',  icon: Key,  label: 'SSH Key' },
              ].map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  type="button"
                  disabled={isPending}
                  onClick={() => set('authType', value)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2
                              border rounded-lg text-[0.8125rem] font-medium
                              transition-all duration-150 cursor-pointer
                              ${form.authType === value
                                ? 'bg-violet-500/10 border-violet-500/50 text-violet-400'
                                : 'bg-[#1c1c21] border-white/[0.08] text-gray-500 hover:text-white hover:border-white/20'
                              }`}
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Password field */}
          {form.authType === 'PASSWORD' && (
            <Field label="Password" error={errors.password}>
              <div className="relative">
                <input
                  className={inputCls}
                  type={showSecret ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  disabled={isPending}
                />
                <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  className="absolute top-[7px] right-2 bg-[#1c1c21] border border-white/[0.08]
                             rounded text-gray-500 hover:text-white cursor-pointer p-[3px]
                             flex items-center justify-center transition-colors"
                >
                  {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>
          )}

          {/* SSH Key field */}
          {form.authType === 'SSH_KEY' && (
            <Field
              label="SSH Private Key"
              error={errors.privateKey}
              hint="Paste contents of id_rsa or id_ed25519"
            >
              <div className="relative">
                <textarea
                  className={`${inputCls} resize-y min-h-[110px] text-[0.75rem] leading-relaxed font-mono`}
                  placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----"}
                  value={form.privateKey}
                  onChange={e => set('privateKey', e.target.value)}
                  disabled={isPending}
                  spellCheck={false}
                  style={{ filter: showSecret ? 'none' : 'blur(3px)' }}
                />
                <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  className="absolute top-[7px] right-2 bg-[#1c1c21] border border-white/[0.08]
                             rounded text-gray-500 hover:text-white cursor-pointer p-[3px]
                             flex items-center justify-center transition-colors"
                >
                  {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>
          )}

          {/* Info strip */}
          <div
            className="bg-[#1c1c21] border border-white/[0.06] rounded-lg
                       px-3.5 py-2.5 text-[0.75rem] text-gray-500
                       flex items-center flex-wrap gap-1"
          >
            <span className="inline-flex items-center justify-center w-[18px] h-[18px]
                             bg-violet-500/10 text-violet-400 rounded-full
                             text-[0.6875rem] font-bold font-mono">1</span>
            SSH connection test &nbsp;→&nbsp;
            <span className="inline-flex items-center justify-center w-[18px] h-[18px]
                             bg-violet-500/10 text-violet-400 rounded-full
                             text-[0.6875rem] font-bold font-mono">2</span>
            Docker check / install &nbsp;→&nbsp;
            <span className="inline-flex items-center justify-center w-[18px] h-[18px]
                             bg-violet-500/10 text-violet-400 rounded-full
                             text-[0.6875rem] font-bold font-mono">3</span>
            Status: Ready
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-0.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 bg-transparent border border-white/[0.08] rounded-lg
                         text-gray-400 text-sm font-medium cursor-pointer
                         hover:border-white/20 hover:text-white
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-150"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-[18px] py-2 bg-violet-600 hover:bg-violet-500 border-none rounded-lg
                         text-white text-sm font-semibold cursor-pointer
                         flex items-center gap-1.5
                         disabled:opacity-60 disabled:cursor-not-allowed
                         transition-colors duration-150"
            >
              {isPending
                ? <><Loader size={14} className="animate-spin" /> Connecting…</>
                : 'Connect Server'
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}