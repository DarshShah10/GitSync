import { useState } from 'react'
import { useCreateDatabase } from '../hooks/useDatabases.js'
import toast from 'react-hot-toast'
import styles from './AddDatabaseModal.module.css'

const DB_TYPES = [
  { value: 'MONGODB',    label: 'MongoDB',     icon: '🍃', desc: 'Document database' },
  { value: 'POSTGRESQL', label: 'PostgreSQL',  icon: '🐘', desc: 'Relational SQL' },
  { value: 'MYSQL',      label: 'MySQL',       icon: '🐬', desc: 'Relational SQL' },
  { value: 'MARIADB',    label: 'MariaDB',     icon: '🦭', desc: 'MySQL fork' },
  { value: 'REDIS',      label: 'Redis',       icon: '⚡', desc: 'In-memory cache/store' },
  { value: 'KEYDB',      label: 'KeyDB',       icon: '🔑', desc: 'Redis-compatible, faster' },
  { value: 'DRAGONFLY',  label: 'Dragonfly',   icon: '🐉', desc: 'Modern Redis alternative' },
  { value: 'CLICKHOUSE', label: 'ClickHouse',  icon: '📊', desc: 'Analytics database' },
]

const NEEDS_DBNAME = ['POSTGRESQL', 'MYSQL', 'MARIADB', 'CLICKHOUSE', 'MONGODB']
const NEEDS_USER   = ['POSTGRESQL', 'MYSQL', 'MARIADB', 'CLICKHOUSE', 'MONGODB']

export default function AddDatabaseModal({ servers, onClose }) {
  const [step, setStep] = useState(1) // 1=type, 2=config
  const [selectedType, setSelectedType] = useState(null)
  const [form, setForm] = useState({
    serverId: servers?.[0]?.id ?? '',
    name: '',
    dbUser: 'dbshift',
    dbPassword: '',
    dbName: '',
  })

  const create = useCreateDatabase()

  function handleTypeSelect(type) {
    setSelectedType(type)
    setStep(2)
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!form.serverId) return toast.error('Select a server')
    if (!form.name) return toast.error('Enter a database name')
    if (!form.dbPassword) return toast.error('Enter a password')

    try {
      await create.mutateAsync({
        serverId:   form.serverId,
        name:       form.name,
        type:       selectedType,
        dbUser:     NEEDS_USER.includes(selectedType) ? form.dbUser : undefined,
        dbPassword: form.dbPassword,
        dbName:     NEEDS_DBNAME.includes(selectedType) ? (form.dbName || form.name) : undefined,
      })
      toast.success('Database creation started!')
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.error ?? 'Failed to create database')
    }
  }

  const typeConfig = DB_TYPES.find(t => t.value === selectedType)

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>{step === 1 ? 'Choose Database Type' : `Create ${typeConfig?.label}`}</h2>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        {step === 1 ? (
          <div className={styles.typeGrid}>
            {DB_TYPES.map(t => (
              <button
                key={t.value}
                className={styles.typeCard}
                onClick={() => handleTypeSelect(t.value)}
              >
                <span className={styles.typeIcon}>{t.icon}</span>
                <span className={styles.typeLabel}>{t.label}</span>
                <span className={styles.typeDesc}>{t.desc}</span>
              </button>
            ))}
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.selectedType}>
              <span>{typeConfig?.icon}</span>
              <span>{typeConfig?.label}</span>
              <button type="button" className={styles.changeType} onClick={() => setStep(1)}>
                Change
              </button>
            </div>

            <div className={styles.field}>
              <label>Server</label>
              <select name="serverId" value={form.serverId} onChange={handleChange} required>
                {servers?.filter(s => s.status === 'CONNECTED' || s.status === 'READY').map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.ip})</option>
                ))}
              </select>
              {servers?.filter(s => s.status === 'CONNECTED' || s.status === 'READY').length === 0 && (
                <p className={styles.warn}>No connected servers. Add and verify a server first.</p>
              )}
            </div>

            <div className={styles.field}>
              <label>Database Name</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="my-database"
                pattern="[a-zA-Z0-9_\-]+"
                title="Only letters, numbers, underscores, hyphens"
                required
              />
            </div>

            {NEEDS_USER.includes(selectedType) && (
              <div className={styles.field}>
                <label>Username</label>
                <input
                  name="dbUser"
                  value={form.dbUser}
                  onChange={handleChange}
                  placeholder="dbshift"
                />
              </div>
            )}

            <div className={styles.field}>
              <label>Password</label>
              <input
                name="dbPassword"
                type="password"
                value={form.dbPassword}
                onChange={handleChange}
                placeholder="Min 8 characters"
                minLength={8}
                required
              />
            </div>

            {NEEDS_DBNAME.includes(selectedType) && (
              <div className={styles.field}>
                <label>Database Name <span className={styles.optional}>(defaults to instance name)</span></label>
                <input
                  name="dbName"
                  value={form.dbName}
                  onChange={handleChange}
                  placeholder={form.name || 'mydb'}
                />
              </div>
            )}

            <div className={styles.actions}>
              <button type="button" className={styles.cancel} onClick={onClose}>Cancel</button>
              <button
                type="submit"
                className={styles.submit}
                disabled={create.isPending || servers?.filter(s => s.status === 'CONNECTED' || s.status === 'READY').length === 0}
              >
                {create.isPending ? 'Creating…' : 'Create Database'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}