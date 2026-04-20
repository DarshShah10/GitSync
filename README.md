# GitSync

A premium, self-hosted PaaS and database manager. Bring your own VPS and manage everything visually from a sleek, localized control panel.

## Architecture

- **Backend:** Node.js, Fastify, Prisma, PostgreSQL
- **Frontend:** React, Vite, React Query (Vanilla CSS)
- **Infra Engine:** BullMQ, Redis, SSH2

## Quick Start

### 1. External Requirements
- Node.js 20+
- Docker & Docker Compose (for DBs)

### 2. Setup
```bash
git clone <repo-url>
cd dbshift
npm install

# Start core services
docker compose up -d

# Environment setup
cp backend/.env.example backend/.env
# Update DATABASE_URL and JWT_SECRET in .env
```

### 3. Database Sync & Run
```bash
cd backend
npm run db:generate
npm run db:migrate 

# Start the cluster
npm run dev
```

### Entrypoints
- **Frontend Dashboard:** http://localhost:5173 
- **Backend API:** http://localhost:3001 

*Self-hosting cloud infrastructure without the friction.*
