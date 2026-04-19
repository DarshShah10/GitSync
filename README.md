# DBShift

Self-hosted database manager. Bring your own VPS, we run the databases on it.

## Stack

| Layer      | Tech                          |
|------------|-------------------------------|
| Backend    | Node.js · Fastify · JavaScript |
| Frontend   | React · Vite                  |
| State DB   | PostgreSQL · Prisma            |
| Job Queue  | BullMQ · Redis                |
| SSH        | ssh2                          |

## Prerequisites

- Node.js 20+
- Docker + Docker Compose (for local Postgres + Redis)

---

## Local Development Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd dbshift
npm install
```

### 2. Start Postgres + Redis

```bash
docker compose up -d
```

### 3. Configure the backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and set at minimum:

```env
DATABASE_URL="postgresql://dbshift:dbshift_pass@localhost:5432/dbshift?schema=public"
JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```

### 4. Run database migrations

```bash
cd backend
npm run db:generate   # generate Prisma client
npm run db:migrate    # run migrations (creates tables)
cd ..
```

### 5. Start both servers

```bash
npm run dev
```

- **Backend** → http://localhost:3001
- **Frontend** → http://localhost:5173
- **Health check** → http://localhost:3001/health/ready

---

## Project Structure

```
dbshift/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma         # DB schema (Server, Database, Backup)
│   └── src/
│       ├── config/index.js       # env var validation
│       ├── db/
│       │   ├── prisma.js         # Prisma client singleton
│       │   └── redis.js          # Redis + BullMQ connections
│       ├── middleware/
│       │   └── errorHandler.js   # global error handling
│       ├── routes/
│       │   └── health.js         # GET /health, GET /health/ready
│       └── index.js              # Fastify app + server bootstrap
├── frontend/
│   └── src/
│       ├── components/
│       │   └── Layout.jsx        # sidebar shell
│       ├── pages/
│       │   ├── HomePage.jsx      # overview dashboard
│       │   └── NotFoundPage.jsx
│       ├── services/
│       │   └── api.js            # axios client
│       ├── App.jsx               # router
│       └── main.jsx              # entry point
├── docker-compose.yml            # local Postgres + Redis
└── package.json                  # monorepo root
```

## Build Phases

| Phase | What                          | Status |
|-------|-------------------------------|--------|
| 1     | Project scaffold + Fastify server | ✅ Step 1 |
| 1     | SSH service + server validation   | 🔜 Step 2 |
| 1     | Server API routes (CRUD)          | 🔜 Step 3 |
| 1     | Add Server UI                     | 🔜 Step 4 |
| 2     | MongoDB container provisioning    | Upcoming |
| 3     | Database dashboard                | Upcoming |
| 4     | S3 backups                        | Upcoming |
| 5     | Public access toggle              | Upcoming |
