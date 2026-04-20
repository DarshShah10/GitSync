import { Worker } from 'bullmq'
import { createRedisConnection } from '../db/redis.js'
import { prisma } from '../db/prisma.js'
import { QUEUE_NAMES } from './queues.js'
import {
  provisionDatabase,
  findFreePort,
  buildConnectionStrings,
  DB_CONFIGS,
} from '../services/database.service.js'

async function processDatabaseCreate(job) {
  const { databaseId } = job.data
  const logs = []

  function log(message) {
    const line = `[${new Date().toISOString()}] ${message}`
    logs.push(line)
    job.log(line)
    console.log(line)
  }

  // Load database record with server
  const database = await prisma.database.findUnique({
    where: { id: databaseId },
    include: { server: true },
  })

  if (!database) throw new Error(`Database ${databaseId} not found`)
  if (database.server.status !== 'READY') {
    throw new Error(`Server ${database.server.name} is not READY. Cannot provision database.`)
  }

  log(`Provisioning ${database.type} database: ${database.name}`)
  log(`Server: ${database.server.name} (${database.server.ip})`)

  await job.updateProgress(5)

  const serverConfig = {
    ip:         database.server.ip,
    port:       database.server.port,
    username:   database.server.username,
    authType:   database.server.authType,
    password:   database.server.password ?? null,
    privateKey: database.server.privateKey ?? null,
  }

  // Find a free public port
  log('Finding available port...')
  const typeConfig = DB_CONFIGS[database.type]
  const publicPort = await findFreePort(serverConfig, 20000, 30000)

  log(`Assigned public port: ${publicPort}`)
  await job.updateProgress(15)

  // Update DB with the port so it's saved even if provisioning fails
  await prisma.database.update({
    where: { id: databaseId },
    data: { publicPort, isPublic: true },
  })

  // Provision container
  const dbCfg = {
    name: database.name,
    type: database.type,
    dbUser: database.dbUser ?? 'dbshift',
    dbPassword: database.dbPassword,
    dbName: database.dbName,
    publicPort,
    ip: database.server.ip,
    internalPort: typeConfig.internalPort,
  }

  await job.updateProgress(20)

  const { containerId, containerName } = await provisionDatabase(
    serverConfig,
    dbCfg,
    { onLog: log }
  )

  await job.updateProgress(80)

  // Build connection strings
  const { external, internal } = buildConnectionStrings(database.type, {
    ...dbCfg,
    ip: database.server.ip,
  })

  log(`External connection string built.`)
  log(`Internal connection string built.`)

  // Save everything to DB
  await prisma.database.update({
    where: { id: databaseId },
    data: {
      status:           'RUNNING',
      containerId,
      containerName,
      internalPort:     typeConfig.internalPort,
      publicPort,
      isPublic:         true,
      connectionString: external,
      errorMessage:     null,
    },
  })

  await job.updateProgress(100)
  log(`Database ${database.name} provisioned successfully. ✓`)

  return {
    databaseId,
    containerId,
    containerName,
    publicPort,
    connectionString: external,
    internalConnectionString: internal,
  }
}

export function startDatabaseCreateWorker() {
  const worker = new Worker(
    QUEUE_NAMES.DATABASE_CREATE,
    processDatabaseCreate,
    {
      connection:  createRedisConnection(),
      concurrency: 3,
    }
  )

  worker.on('completed', (job, result) => {
    console.log(`[database-create] Job ${job.id} completed:`, result.databaseId)
  })

  worker.on('failed', async (job, err) => {
    console.error(`[database-create] Job ${job?.id} failed:`, err.message)

    if (job?.data?.databaseId) {
      try {
        await prisma.database.update({
          where: { id: job.data.databaseId },
          data: { status: 'ERROR', errorMessage: err.message },
        })
      } catch (_) {}
    }
  })

  worker.on('error', (err) => {
    console.error('[database-create] Worker error:', err)
  })

  console.log('[database-create] Worker started.')
  return worker
}