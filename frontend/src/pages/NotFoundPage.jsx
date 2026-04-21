import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-3">
      <span className="text-[5rem] font-extrabold text-[var(--border)] leading-none font-mono">
        404
      </span>
      <h1 className="text-2xl text-[var(--text-primary)]">Page not found</h1>
      <p className="text-[var(--text-secondary)] text-[0.9375rem]">
        The page you're looking for doesn't exist.
      </p>
      <Link
        to="/"
        className="mt-2 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)]"
      >
        ← Back to Overview
      </Link>
    </div>
  )
}
