import { useNavigate } from 'react-router-dom'

export default function ComingSoonPage() {
  const navigate = useNavigate()

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: 'calc(100vh - 200px)',
      textAlign: 'center', animation: 'fadeIn 0.4s ease-out',
    }}>
      {/* Icon */}
      <div style={{
        width: 80, height: 80, borderRadius: 20,
        background: '#131315', border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 32, position: 'relative',
        boxShadow: '0 0 40px rgba(186,158,255,0.08)',
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ba9eff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
          <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
          <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
          <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
        </svg>
        {/* Glow ring */}
        <div style={{
          position: 'absolute', inset: -1, borderRadius: 21,
          background: 'linear-gradient(135deg, #ba9eff, #34b5fa)',
          opacity: 0.15, filter: 'blur(8px)', zIndex: -1,
        }} />
      </div>

      <h2 style={{
        fontSize: 40, fontWeight: 800, letterSpacing: '-0.04em',
        margin: '0 0 12px',
        background: 'linear-gradient(135deg, #f9f5f8, #71717a)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
      }}>
        Feature in Development
      </h2>
      <p style={{ color: '#71717a', fontSize: 15, maxWidth: 380, lineHeight: 1.65, margin: '0 0 36px' }}>
        We're working hard to bring this feature to the Sovereign Cloud OS.
        Stay tuned for upcoming updates!
      </p>

      <button
        onClick={() => navigate(-1)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '10px 24px',
          background: '#131315', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, color: '#f9f5f8', fontWeight: 600, fontSize: 14,
          cursor: 'pointer', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(186,158,255,0.3)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'translateY(0)' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
        </svg>
        Go Back
      </button>
    </div>
  )
}