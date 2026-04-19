import { useState } from 'react'
import { X, Eye, EyeOff, Loader, Key, Lock, Terminal } from 'lucide-react'
import { useCreateServer } from '../hooks/useServers.js'
import styles from './AddServerModal.module.css'

const INIT = { name: '', ip: '', port: '22', username: 'root', authType: 'PASSWORD', password: '', privateKey: '' }

function Field({ label, error, hint, children, style }) {
  return (
    <div className={styles.field} style={style}>
      <label className={styles.label}>{label}</label>
      {children}
      {error && <span className={styles.error}>{error}</span>}
      {!error && hint && <span className={styles.hint}>{hint}</span>}
    </div>
  )
}

export default function AddServerModal({ onClose, onCreated }) {
  const [form, setForm]         = useState(INIT)
  const [showSecret, setShow]   = useState(false)
  const [errors, setErrors]     = useState({})
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
      else if (!form.privateKey.trim().startsWith('-----BEGIN')) e.privateKey = 'Must start with -----BEGIN...'
    }
    return e
  }

  async function submit(ev) {
    ev.preventDefault()
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }

    const payload = {
      name: form.name.trim(), ip: form.ip.trim(),
      port: parseInt(form.port, 10), username: form.username.trim(),
      authType: form.authType,
      ...(form.authType === 'PASSWORD'
        ? { password: form.password.trim() }
        : { privateKey: form.privateKey.trim() }),
    }

    try {
      const result = await create(payload)
      onCreated?.(result.data)
      onClose()
    } catch (err) {
      const details = err.response?.data?.details
      if (details) {
        const fe = {}
        details.forEach(({ field, message }) => { fe[field] = message })
        setErrors(fe)
      }
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.modalIcon}><Terminal size={16} /></div>
          <div>
            <div className={styles.modalTitle}>Connect Server</div>
            <div className={styles.modalSub}>We'll SSH in and configure Docker automatically</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} disabled={isPending}><X size={16} /></button>
        </div>

        <form onSubmit={submit} className={styles.form}>
          <Field label="Server Name" error={errors.name} hint="e.g. prod-us-1">
            <input className={styles.input} placeholder="prod-us-1" value={form.name}
              onChange={e => set('name', e.target.value)} disabled={isPending} autoFocus />
          </Field>

          <div className={styles.row}>
            <Field label="IP / Hostname" error={errors.ip} style={{ flex: 2 }}>
              <input className={styles.input} placeholder="164.92.95.225" value={form.ip}
                onChange={e => set('ip', e.target.value)} disabled={isPending} />
            </Field>
            <Field label="Port" error={errors.port} style={{ flex: 1 }}>
              <input className={styles.input} type="number" placeholder="22" value={form.port}
                onChange={e => set('port', e.target.value)} disabled={isPending} />
            </Field>
          </div>

          <Field label="SSH Username" error={errors.username}>
            <input className={styles.input} placeholder="root" value={form.username}
              onChange={e => set('username', e.target.value)} disabled={isPending} />
          </Field>

          {/* Auth toggle */}
          <div className={styles.field}>
            <label className={styles.label}>Auth Method</label>
            <div className={styles.toggle}>
              <button type="button" disabled={isPending}
                className={`${styles.toggleBtn} ${form.authType === 'PASSWORD' ? styles.toggleActive : ''}`}
                onClick={() => set('authType', 'PASSWORD')}>
                <Lock size={13} /> Password
              </button>
              <button type="button" disabled={isPending}
                className={`${styles.toggleBtn} ${form.authType === 'KEY' ? styles.toggleActive : ''}`}
                onClick={() => set('authType', 'KEY')}>
                <Key size={13} /> SSH Key
              </button>
            </div>
          </div>

          {form.authType === 'PASSWORD' && (
            <Field label="Password" error={errors.password}>
              <div className={styles.secretWrap}>
                <input className={styles.input} type={showSecret ? 'text' : 'password'}
                  placeholder="••••••••" value={form.password}
                  onChange={e => set('password', e.target.value)} disabled={isPending} />
                <button type="button" className={styles.eyeBtn} onClick={() => setShow(s => !s)}>
                  {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>
          )}

          {form.authType === 'KEY' && (
            <Field label="SSH Private Key" error={errors.privateKey} hint="Paste contents of id_rsa or id_ed25519">
              <div className={styles.secretWrap}>
                <textarea className={`${styles.input} ${styles.keyArea}`}
                  placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----"}
                  value={form.privateKey} onChange={e => set('privateKey', e.target.value)}
                  disabled={isPending} spellCheck={false}
                  style={{ filter: showSecret ? 'none' : 'blur(3px)', fontFamily: 'var(--font-mono)' }} />
                <button type="button" className={styles.eyeBtn} onClick={() => setShow(s => !s)}>
                  {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>
          )}

          <div className={styles.infoBox}>
            <span className={styles.infoStep}>1</span> SSH connection test &nbsp;→&nbsp;
            <span className={styles.infoStep}>2</span> Docker check / install &nbsp;→&nbsp;
            <span className={styles.infoStep}>3</span> Status: Ready
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isPending}>Cancel</button>
            <button type="submit" className={styles.submitBtn} disabled={isPending}>
              {isPending ? <><Loader size={14} className={styles.spin} /> Connecting…</> : 'Connect Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
