import { useState } from 'react'
import { useCreateDatabase } from '../hooks/useDatabases.js'
import toast from 'react-hot-toast'

const DB_TYPES = [
  { value: 'MONGODB',    label: 'MongoDB',    icon: '🍃', desc: 'Document database' },
  { value: 'POSTGRESQL', label: 'PostgreSQL', icon: '🐘', desc: 'Relational SQL' },
  { value: 'MYSQL',      label: 'MySQL',      icon: '🐬', desc: 'Relational SQL' },
  { value: 'MARIADB',    label: 'MariaDB',    icon: '🦭', desc: 'MySQL fork' },
  { value: 'REDIS',      label: 'Redis',      icon: '⚡', desc: 'In-memory cache/store' },
  { value: 'KEYDB',      label: 'KeyDB',      icon: '🔑', desc: 'Redis-compatible, faster' },
  { value: 'DRAGONFLY',  label: 'Dragonfly',  icon: '🐉', desc: 'Modern Redis alternative' },
  { value: 'CLICKHOUSE', label: 'ClickHouse', icon: '📊', desc: 'Analytics database' },
]

const NEEDS_DBNAME = ['POSTGRESQL', 'MYSQL', 'MARIADB', 'CLICKHOUSE', 'MONGODB']
const NEEDS_USER   = ['POSTGRESQL', 'MYSQL', 'MARIADB', 'CLICKHOUSE', 'MONGODB']

// Shared input class for dark theme
const inputCls =
  `w-full px-3 py-2.5 bg-[#0e0e10] border border-white/[0.08] rounded-lg
   text-white text-sm outline-none
   focus:border-violet-500/60 transition-colors duration-150
   placeholder:text-gray-600`

export default function AddDatabaseModal({ servers, onClose }) {
  const [step,         setStep]        = useState(1)
  const [selectedType, setSelectedType] = useState(null)
  const [form,         setForm]         = useState({
    serverId:   servers?.[0]?.id ?? '',
    name:       '',
    dbUser:     'dbshift',
    dbPassword: '',
    dbName:     '',
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
    if (!form.serverId)   return toast.error('Select a server')
    if (!form.name)       return toast.error('Enter a database name')
    if (!form.dbPassword) return toast.error('Enter a password')

    try {
      await create.mutateAsync({
        serverId:   form.serverId,
        name:       form.name,
        type:       selectedType,
        dbUser:     NEEDS_USER.includes(selectedType)   ? form.dbUser   : undefined,
        dbPassword: form.dbPassword,
        dbName:     NEEDS_DBNAME.includes(selectedType) ? (form.dbName || form.name) : undefined,
      })
      toast.success('Database creation started!')
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.error ?? 'Failed to create database')
    }
  }

  const typeConfig      = DB_TYPES.find(t => t.value === selectedType)
  const connectedServers = servers?.filter(s => s.status === 'CONNECTED' || s.status === 'READY') ?? []

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-[4px]
                 flex items-center justify-center z-[100] p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-[#16161a] border border-white/[0.08] rounded-xl
                   w-full max-w-[560px] max-h-[90vh] overflow-y-auto
                   shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <h2 className="text-base font-semibold text-white m-0">
            {step === 1 ? 'Choose Database Type' : `Create ${typeConfig?.label}`}
          </h2>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-gray-500 text-base
                       cursor-pointer px-2 py-1 rounded hover:bg-white/[0.06]
                       transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {/* Step 1 — Type grid */}
        {step === 1 && (
          <div className="grid grid-cols-2 gap-3 p-6">
            {DB_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => handleTypeSelect(t.value)}
                className="flex flex-col items-start gap-0.5 p-4
                           bg-[#0e0e10] border border-white/[0.08] rounded-lg
                           cursor-pointer text-left
                           hover:border-violet-500/50 hover:bg-[#16161a]
                           transition-all duration-150"
              >
                <span className="text-2xl mb-1">{t.icon}</span>
                <span className="text-sm font-semibold text-white">{t.label}</span>
                <span className="text-[0.75rem] text-gray-500">{t.desc}</span>
              </button>
            ))}
          </div>
        )}

        {/* Step 2 — Config form */}
        {step === 2 && (
          <form className="p-6 flex flex-col gap-4" onSubmit={handleSubmit}>

            {/* Selected type pill */}
            <div
              className="flex items-center gap-2 px-3 py-2
                         bg-[#0e0e10] rounded-lg border border-white/[0.08]
                         text-sm font-medium text-white"
            >
              <span>{typeConfig?.icon}</span>
              <span>{typeConfig?.label}</span>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="ml-auto bg-transparent border-none text-violet-400
                           text-[0.75rem] cursor-pointer underline hover:text-violet-300"
              >
                Change
              </button>
            </div>

            {/* Server select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.75rem] font-medium text-gray-500 uppercase tracking-[0.05em]">
                Server
              </label>
              <select
                name="serverId"
                value={form.serverId}
                onChange={handleChange}
                required
                className={`${inputCls} cursor-pointer`}
                style={{ colorScheme: 'dark' }}
              >
                {connectedServers.map(s => (
                  <option key={s.id} value={s.id} className="bg-[#16161a]">
                    {s.name} ({s.ip})
                  </option>
                ))}
              </select>
              {connectedServers.length === 0 && (
                <p className="text-amber-400 text-[0.75rem] m-0">
                  No connected servers. Add and verify a server first.
                </p>
              )}
            </div>

            {/* Database name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.75rem] font-medium text-gray-500 uppercase tracking-[0.05em]">
                Database Name
              </label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="my-database"
                pattern="[a-zA-Z0-9_\-]+"
                title="Only letters, numbers, underscores, hyphens"
                required
                className={inputCls}
              />
            </div>

            {/* Username */}
            {NEEDS_USER.includes(selectedType) && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.75rem] font-medium text-gray-500 uppercase tracking-[0.05em]">
                  Username
                </label>
                <input
                  name="dbUser"
                  value={form.dbUser}
                  onChange={handleChange}
                  placeholder="dbshift"
                  className={inputCls}
                />
              </div>
            )}

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.75rem] font-medium text-gray-500 uppercase tracking-[0.05em]">
                Password
              </label>
              <input
                name="dbPassword"
                type="password"
                value={form.dbPassword}
                onChange={handleChange}
                placeholder="Min 8 characters"
                minLength={8}
                required
                className={inputCls}
              />
            </div>

            {/* DB Name (optional) */}
            {NEEDS_DBNAME.includes(selectedType) && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.75rem] font-medium text-gray-500 uppercase tracking-[0.05em]">
                  DB Name{' '}
                  <span className="text-gray-600 font-normal normal-case tracking-normal">
                    (defaults to instance name)
                  </span>
                </label>
                <input
                  name="dbName"
                  value={form.dbName}
                  onChange={handleChange}
                  placeholder={form.name || 'mydb'}
                  className={inputCls}
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end mt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-transparent border border-white/[0.08]
                           rounded-lg text-gray-400 text-sm cursor-pointer
                           hover:bg-white/[0.04] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={create.isPending || connectedServers.length === 0}
                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 border-none
                           rounded-lg text-white text-sm font-medium cursor-pointer
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors duration-150"
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