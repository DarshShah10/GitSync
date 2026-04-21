import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// ── Icons ─────────────────────────────────────────────────────

function TerminalSquare({ size = 24, className = '' }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
    >
      <rect width="18" height="18" x="3" y="3" rx="2"/>
      <path d="m7 11 2 2-2 2"/>
      <path d="M11 13h4"/>
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

function GithubIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
    </svg>
  )
}

function EyeIcon({ open }) {
  return open ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

// ── Shared input class ─────────────────────────────────────────

const inputClass =
  'w-full px-3.5 py-2.5 text-sm rounded-lg ' +
  'bg-[#1c1c21] border border-white/[0.08] ' +
  'text-white placeholder:text-gray-600 ' +
  'focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 ' +
  'transition-colors duration-150'

// ── Features (left panel) ──────────────────────────────────────

const FEATURES = [
  { label: 'Deploy any git repo', sub: 'Node, Python, Go, PHP and more' },
  { label: 'Managed databases', sub: 'Postgres, MySQL, Redis, MongoDB' },
  { label: 'Team workspaces', sub: 'Role-based access control' },
  { label: 'Automated S3 backups', sub: 'Configurable retention policies' },
]

// ── AuthPage ──────────────────────────────────────────────────

export default function AuthPage() {
  const [mode,         setMode]         = useState('login')   // 'login' | 'signup'
  const [form,         setForm]         = useState({ name: '', email: '', password: '' })
  const [showPass,     setShowPass]     = useState(false)
  const [error,        setError]        = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [oauthLoading, setOAuthLoading] = useState(null)      // 'google' | 'github' | null

  const { user, login, signup, loginWithGoogle, loginWithGithub } = useAuth()
  const navigate       = useNavigate()
  const location       = useLocation()
  const [searchParams] = useSearchParams()

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      const to = location.state?.from?.pathname ?? '/'
      navigate(to, { replace: true })
    }
  }, [user, navigate, location.state])

  // Surface OAuth errors
  useEffect(() => {
    if (searchParams.get('error') === 'oauth_failed') {
      setError('OAuth sign-in failed. Please try again or use email.')
    }
  }, [searchParams])

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    if (error) setError('')
  }

  const switchMode = (next) => {
    setMode(next)
    setError('')
    setForm({ name: '', email: '', password: '' })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      if (mode === 'signup') {
        await signup(form.name, form.email, form.password)
      } else {
        await login(form.email, form.password)
      }
    } catch (err) {
      setError(err.response?.data?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleOAuth = (provider) => {
    setOAuthLoading(provider)
    if (provider === 'google') loginWithGoogle()
    else loginWithGithub()
  }

  return (
    <div className="min-h-screen flex bg-[#0e0e10]">

      {/* ── Left panel ───────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between p-12 relative overflow-hidden
                      bg-[#16161a] border-r border-white/[0.06]">

        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -right-10 w-[400px] h-[400px] bg-indigo-600/8 rounded-full blur-3xl" />
          {/* Subtle grid */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.025]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)"/>
          </svg>
        </div>

        {/* Brand */}
        <div className="relative flex items-center gap-3">
          <TerminalSquare size={26} className="text-violet-400" />
          <div>
            <h1
              className="text-xl font-black tracking-tighter leading-none"
              style={{
                backgroundImage: 'linear-gradient(to bottom right, #a78bfa, #7c3aed)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Sovereign
            </h1>
            <div className="text-[0.6rem] text-gray-500 uppercase tracking-[0.15em] font-semibold">
              Cloud OS
            </div>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full
                            bg-violet-500/10 border border-violet-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              <span className="text-violet-300 text-xs font-medium">Self-hosted infrastructure</span>
            </div>
            <h2 className="text-4xl font-bold text-white leading-[1.15] tracking-tight">
              Deploy anything,<br />on your own servers.
            </h2>
            <p className="text-gray-500 text-base leading-relaxed max-w-sm">
              Sovereign gives you the power of modern cloud platforms — on infrastructure you own and control.
            </p>
          </div>

          {/* Feature list */}
          <ul className="space-y-3">
            {FEATURES.map(({ label, sub }) => (
              <li key={label} className="flex items-start gap-3">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-violet-500/15 border border-violet-500/25
                                 flex items-center justify-center flex-shrink-0 text-violet-400">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1.5,5 4,7.5 8.5,2.5"/>
                  </svg>
                </span>
                <div>
                  <span className="text-gray-300 text-sm font-medium">{label}</span>
                  <span className="text-gray-600 text-sm"> — {sub}</span>
                </div>
              </li>
            ))}
          </ul>

          {/* Fake terminal */}
          <div className="rounded-xl bg-[#0e0e10] border border-white/[0.06] p-4 font-mono text-xs space-y-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
            </div>
            <p className="text-gray-600">$ sovereign deploy</p>
            <p className="text-gray-500">  ✓ Building image…</p>
            <p className="text-gray-500">  ✓ Pushing to server…</p>
            <p className="text-green-400">  ✓ Live at https://app.example.com</p>
          </div>
        </div>

        <p className="relative text-gray-700 text-xs">
          © {new Date().getFullYear()} Sovereign Cloud OS
        </p>
      </div>

      {/* ── Right panel ──────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px]">

          {/* Mobile brand */}
          <div className="flex lg:hidden items-center justify-center gap-2.5 mb-8">
            <TerminalSquare size={22} className="text-violet-400" />
            <span
              className="font-black text-lg tracking-tighter"
              style={{
                backgroundImage: 'linear-gradient(to bottom right, #a78bfa, #7c3aed)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Sovereign
            </span>
          </div>

          {/* Header */}
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="mt-1.5 text-sm text-gray-500">
              {mode === 'login'
                ? 'Sign in to your Sovereign workspace.'
                : 'Get started — it only takes a minute.'}
            </p>
          </div>

          {/* OAuth buttons */}
          <div className="space-y-2.5 mb-6">
            <button
              type="button"
              onClick={() => handleOAuth('google')}
              disabled={!!oauthLoading || submitting}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5
                         bg-[#1c1c21] border border-white/[0.08] rounded-lg
                         text-sm font-medium text-gray-300
                         hover:bg-[#222228] hover:border-white/[0.12]
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-all duration-150"
            >
              {oauthLoading === 'google' ? (
                <div className="w-4 h-4 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin" />
              ) : <GoogleIcon />}
              Continue with Google
            </button>

            <button
              type="button"
              onClick={() => handleOAuth('github')}
              disabled={!!oauthLoading || submitting}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5
                         bg-[#1c1c21] border border-white/[0.08] rounded-lg
                         text-sm font-medium text-gray-300
                         hover:bg-[#222228] hover:border-white/[0.12]
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-all duration-150"
            >
              {oauthLoading === 'github' ? (
                <div className="w-4 h-4 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin" />
              ) : <GithubIcon />}
              Continue with GitHub
            </button>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.06]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#0e0e10] px-3 text-xs text-gray-600 font-medium uppercase tracking-wider">
                or with email
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>

            {/* Name — signup only */}
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Full name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Alex Johnson"
                  required
                  className={inputClass}
                />
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                required
                className={inputClass}
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Password
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    className="text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors"
                    onClick={() => {/* TODO: forgot password flow */}}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={form.password}
                  onChange={handleChange}
                  placeholder={mode === 'signup' ? 'Min. 8 characters' : '••••••••'}
                  required
                  minLength={8}
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5
                             text-gray-600 hover:text-gray-400 transition-colors"
                  tabIndex={-1}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showPass} />
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 p-3
                              bg-red-500/10 border border-red-500/20 rounded-lg">
                <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z"/>
                  <path d="M7.25 4.75a.75.75 0 0 1 1.5 0v3a.75.75 0 0 1-1.5 0v-3zm.75 5.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5z"/>
                </svg>
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || !!oauthLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5
                         bg-gradient-to-br from-violet-500 to-violet-700
                         disabled:opacity-50 disabled:cursor-not-allowed
                         text-white text-sm font-bold rounded-lg
                         transition-all duration-150
                         hover:opacity-90 hover:shadow-[0_0_20px_rgba(132,85,239,0.4)]
                         focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 focus:ring-offset-[#0e0e10]"
            >
              {submitting && (
                <div className="w-4 h-4 border-2 border-violet-300 border-t-white rounded-full animate-spin" />
              )}
              {submitting
                ? 'Please wait…'
                : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
            </button>
          </form>

          {/* Mode switch */}
          <p className="mt-6 text-center text-sm text-gray-600">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
              className="text-violet-400 hover:text-violet-300 font-semibold
                         hover:underline underline-offset-2 transition-colors"
            >
              {mode === 'login' ? 'Sign up free' : 'Sign in'}
            </button>
          </p>

          {/* Terms */}
          {mode === 'signup' && (
            <p className="mt-4 text-center text-xs text-gray-700 leading-relaxed">
              By creating an account you agree to our{' '}
              <a href="#" className="underline underline-offset-2 hover:text-gray-500 transition-colors">Terms</a>
              {' '}and{' '}
              <a href="#" className="underline underline-offset-2 hover:text-gray-500 transition-colors">Privacy Policy</a>.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}