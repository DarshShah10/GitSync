import { useNavigate, useParams } from 'react-router-dom'
import {
    GitBranch, Key, FileCode, Layers, Box,
    Database, Cloud, Cpu, Wind, Zap, BarChart2,
    ArrowLeft, Search
  } from 'lucide-react'
import { useState } from 'react'

// ── Resource option definitions ─────────────────────────────────────────────

const GIT_OPTIONS = [
  {
    id: 'public-repo',
    icon: <GitBranch size={28} />,
    color: '#f05033',
    label: 'Public Repository',
    desc: 'Deploy any public repository from GitHub, GitLab, or Bitbucket.',
  },
  {
    id: 'github-app',
    icon: <GitBranch size={28} />,
    color: '#e8e8f0',
    label: 'Private Repository (GitHub App)',
    desc: 'Deploy public & private repositories through your connected GitHub App.',
  },
  {
    id: 'deploy-key',
    icon: <Key size={28} />,
    color: '#7070a0',
    label: 'Private Repository (Deploy Key)',
    desc: 'Deploy private repositories using an SSH deploy key.',
  },
]

const DOCKER_OPTIONS = [
  {
    id: 'dockerfile',
    icon: <FileCode size={28} />,
    color: '#2496ed',
    label: 'Dockerfile',
    desc: 'Deploy using a Dockerfile in your repository — no Git source required.',
  },
  {
    id: 'docker-compose',
    icon: <Layers size={28} />,
    color: '#2496ed',
    label: 'Docker Compose',
    desc: 'Deploy multi-container applications using a docker-compose.yml file.',
  },
  {
    id: 'docker-image',
    icon: <Box size={28} />,
    color: '#2496ed',
    label: 'Docker Image',
    desc: 'Deploy any existing image from Docker Hub or a private registry.',
  },
]

const DATABASE_OPTIONS = [
  { id: 'postgresql', icon: <Database size={24} />, color: '#336791', label: 'PostgreSQL',  desc: 'Reliable, open-source relational database.' },
  { id: 'mysql',      icon: <Database size={24} />, color: '#4479a1', label: 'MySQL',       desc: 'The world\'s most popular open-source database.' },
  { id: 'mongodb',    icon: <Database size={24} />, color: '#47a248', label: 'MongoDB',     desc: 'Flexible, document-oriented NoSQL database.' },
  { id: 'redis',      icon: <Zap size={24} />,      color: '#dc382d', label: 'Redis',       desc: 'In-memory data structure store and cache.' },
  { id: 'mariadb',    icon: <Database size={24} />, color: '#003545', label: 'MariaDB',     desc: 'Community-developed fork of MySQL.' },
  { id: 'clickhouse', icon: <BarChart2 size={24} />,color: '#faff69', label: 'ClickHouse',  desc: 'Columnar OLAP database for real-time analytics.' },
  { id: 'dragonfly',  icon: <Wind size={24} />,     color: '#6c63ff', label: 'DragonFly',   desc: 'Modern Redis-compatible in-memory store.' },
  { id: 'keydb',      icon: <Cpu size={24} />,      color: '#e05252', label: 'KeyDB',       desc: 'High-performance Redis alternative.' },
]

// ── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[0.7rem] font-bold tracking-[0.15em] uppercase text-[var(--text-muted)]">
        {children}
      </span>
      <div className="flex-1 h-px bg-[var(--border-ghost)]" />
    </div>
  )
}

function ResourceCard({ option, onClick, compact = false }) {
  return (
    <button
      onClick={() => onClick(option.id)}
      className={`
        group w-full text-left
        bg-[var(--bg-elevated)] border border-[var(--border-ghost)]
        rounded-[var(--radius-lg)] transition-all duration-200
        hover:border-[var(--primary)] hover:bg-[rgba(132,85,239,0.05)]
        hover:shadow-[0_0_0_1px_var(--primary),0_8px_32px_rgba(0,0,0,0.25)]
        hover:-translate-y-[2px]
        ${compact ? 'p-4 flex items-center gap-4' : 'p-5 flex items-start gap-4'}
      `}
    >
      {/* Icon */}
      <div
        className={`
          flex-shrink-0 rounded-[var(--radius-md)]
          flex items-center justify-center
          bg-[var(--bg-highest)] border border-[var(--border-ghost)]
          transition-colors group-hover:border-[var(--primary)]
          ${compact ? 'w-10 h-10' : 'w-12 h-12'}
        `}
        style={{ color: option.color }}
      >
        {option.icon}
      </div>

      {/* Text */}
      <div className="min-w-0">
        <div className={`font-bold text-[var(--text-primary)] mb-0.5 ${compact ? 'text-sm' : 'text-[0.95rem]'}`}>
          {option.label}
        </div>
        <div className={`text-[var(--text-secondary)] leading-relaxed ${compact ? 'text-[0.72rem]' : 'text-[0.78rem]'}`}>
          {option.desc}
        </div>
      </div>

      {/* Arrow hint */}
      <div className="ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--primary)]">
        <ArrowLeft size={16} className="rotate-180" />
      </div>
    </button>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function NewResourcePage() {
  const navigate   = useNavigate()
  const { projectId, environmentId } = useParams()
  const [search, setSearch] = useState('')

  // Filter all options by search query
  const q = search.toLowerCase().trim()
  const filterOpts = (opts) =>
    q ? opts.filter(o => o.label.toLowerCase().includes(q) || o.desc.toLowerCase().includes(q)) : opts

  const filteredGit    = filterOpts(GIT_OPTIONS)
  const filteredDocker = filterOpts(DOCKER_OPTIONS)
  const filteredDB     = filterOpts(DATABASE_OPTIONS)
  const noResults      = q && !filteredGit.length && !filteredDocker.length && !filteredDB.length

  const handleSelect = (type, id) => {
    // Navigate to the appropriate deploy form
    // Adjust the route to match your router setup
    navigate(`/apps/new/${type}/${id}`)

  }

  return (
    <div className="animate-[fadeIn_0.25s_ease-out] max-w-[860px]">

      {/* ── Header ── */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[var(--text-secondary)] text-sm mb-5
                     hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft size={15} /> Back
        </button>

        <h1 className="text-[2rem] font-extrabold tracking-[-0.03em] text-[var(--text-primary)] mb-1">
          New Resource
        </h1>
        <p className="text-[var(--text-secondary)] text-sm">
          Deploy applications, databases, and services to your server.
        </p>
      </div>

      {/* ── Search ── */}
      <div className="relative mb-8">
        <Search
          size={15}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
        />
        <input
          type="text"
          placeholder="Type to search resources…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="
            w-full pl-10 pr-4 h-11
            bg-[var(--bg-elevated)] border border-[var(--border-ghost)]
            rounded-[var(--radius-md)] text-sm text-[var(--text-primary)]
            placeholder:text-[var(--text-muted)]
            outline-none focus:border-[var(--primary)]
            focus:shadow-[0_0_0_3px_rgba(132,85,239,0.15)]
            transition-all
          "
          autoFocus
        />
      </div>

      {noResults ? (
        <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
          <Search size={32} className="mb-4 opacity-40" />
          <p className="text-sm">No resources match <strong className="text-[var(--text-secondary)]">"{search}"</strong></p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">

          {/* ── Git Based ── */}
          {filteredGit.length > 0 && (
            <section>
              <SectionLabel>Git Based</SectionLabel>
              <div className="flex flex-col gap-3">
                {filteredGit.map(opt => (
                  <ResourceCard
                    key={opt.id}
                    option={opt}
                    onClick={(id) => handleSelect('git', id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Docker Based ── */}
          {filteredDocker.length > 0 && (
            <section>
              <SectionLabel>Docker Based</SectionLabel>
              <div className="grid grid-cols-3 gap-3">
                {filteredDocker.map(opt => (
                  <ResourceCard
                    key={opt.id}
                    option={opt}
                    onClick={(id) => handleSelect('docker', id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Databases ── */}
          {filteredDB.length > 0 && (
            <section>
              <SectionLabel>Databases</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                {filteredDB.map(opt => (
                  <ResourceCard
                    key={opt.id}
                    option={opt}
                    onClick={(id) => handleSelect('database', id)}
                    compact
                  />
                ))}
              </div>
            </section>
          )}

        </div>
      )}
    </div>
  )
}