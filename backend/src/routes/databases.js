import { prisma } from '../db/prisma.js'
import { databaseCreateQueue, backupQueue } from '../jobs/queues.js'
import {
  createDatabaseSchema,
  updateDatabaseSchema,
  createBackupSchema,
  testS3Schema,
  databaseIdSchema,
  backupIdSchema,
} from './databases.schema.js'
import {
  startContainer,
  stopContainer,
  restartContainer,
  removeContainer,
  getContainerStats,
  getContainerLogs,
  getContainerStatus,
  DB_CONFIGS,
} from '../services/database.service.js'
import { testS3Connection } from '../services/backup.service.js'

/**
 * Strip sensitive credentials from database responses.
 */
function sanitizeDatabase(db) {
  const { dbPassword, ...safe } = db
  if (safe.backups) {
    safe.backups = safe.backups.map(sanitizeBackup)
  }
  return safe
}

function sanitizeBackup(backup) {
  const { s3AccessKey, s3SecretKey, ...safe } = backup
  if (typeof safe.sizeBytes === 'bigint') {
    safe.sizeBytes = Number(safe.sizeBytes)
  }
  return safe
}



/**
 * Build the server config object from a server record.
 */
function buildServerConfig(server) {
  return {
    ip: server.ip,
    port: server.port,
    username: server.username,
    authType: server.authType,
    password: server.password ?? null,
    privateKey: server.privateKey ?? null,
  }
}

export async function databaseRoutes(app) {

  // ── POST /api/databases ───────────────────────────────────────────────
  // Create a new database (queues provisioning job)
  app.post('/api/databases', async (request, reply) => {
    const body = createDatabaseSchema.parse(request.body)

    const server = await prisma.server.findUnique({ where: { id: body.serverId } })
    if (!server) {
      return reply.status(404).send({ success: false, error: 'Server not found' })
    }
    if (server.status !== 'READY') {
      return reply.status(400).send({
        success: false,
        error: `Server is not ready (status: ${server.status}). Cannot create database.`,
      })
    }

    // Check for name collision on same server
    const existing = await prisma.database.findFirst({
      where: { serverId: server.id, name: body.name },
    })
    if (existing) {
      return reply.status(409).send({
        success: false,
        error: `A database named "${body.name}" already exists on this server.`,
      })
    }

    const typeConfig = DB_CONFIGS[body.type]

    const database = await prisma.database.create({
      data: {
        serverId: body.serverId,
        name: body.name,
        type: body.type,
        status: 'CREATING',
        dbUser: body.dbUser ?? 'dbshift',
        dbPassword: body.dbPassword,
        dbName: body.dbName ?? body.name,
        internalPort: typeConfig.internalPort,
      },
    })

    const job = await databaseCreateQueue.add(
      'create',
      { databaseId: database.id },
      { jobId: `db-create-${database.id}` }
    )

    app.log.info({ databaseId: database.id, jobId: job.id }, 'Database creation queued')

    return reply.status(201).send({
      success: true,
      data: sanitizeDatabase(database),
      jobId: job.id,
    })
  })

  // ── GET /api/databases ────────────────────────────────────────────────
  // List all databases (optionally filter by serverId)
  app.get('/api/databases', async (request, reply) => {
    const { serverId } = request.query

    const databases = await prisma.database.findMany({
      where: serverId ? { serverId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        server: {
          select: { id: true, name: true, ip: true, status: true },
        },
        _count: { select: { backups: true } },
      },
    })

    return { success: true, data: databases.map(sanitizeDatabase) }
  })

  // ── GET /api/databases/:id ────────────────────────────────────────────
  app.get('/api/databases/:id', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)

    const database = await prisma.database.findUnique({
      where: { id },
      include: {
        server: {
          select: { id: true, name: true, ip: true, status: true },
        },
        backups: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })

    if (!database) {
      return reply.status(404).send({ success: false, error: 'Database not found' })
    }

    return { success: true, data: sanitizeDatabase(database) }
  })

  // ── GET /api/databases/:id/status ─────────────────────────────────────
  // Lightweight status poll + live container status from server
  app.get('/api/databases/:id/status', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)

    const database = await prisma.database.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        errorMessage: true,
        containerId: true,
        containerName: true,
        publicPort: true,
        connectionString: true,
        server: {
          select: { ip: true, port: true, username: true, authType: true, password: true, privateKey: true, status: true },
        },
      },
    })

    if (!database) {
      return reply.status(404).send({ success: false, error: 'Database not found' })
    }

    // If database is RUNNING, also check live container status on the server
    let liveStatus = null
    if (database.status === 'RUNNING' && database.containerName && database.server.status === 'READY') {
      try {
        liveStatus = await getContainerStatus(buildServerConfig(database.server), database.containerName)
        // Sync DB status if container is actually stopped
        if (liveStatus === 'stopped' && database.status === 'RUNNING') {
          await prisma.database.update({
            where: { id },
            data: { status: 'STOPPED' },
          })
        }
      } catch (_) { }
    }

    return {
      success: true,
      data: {
        id: database.id,
        status: database.status,
        errorMessage: database.errorMessage,
        liveContainerStatus: liveStatus,
        connectionString: database.connectionString,
        publicPort: database.publicPort,
      },
    }
  })

  // ── GET /api/databases/:id/stats ──────────────────────────────────────
  // Live container resource stats (CPU, memory, network)
  app.get('/api/databases/:id/stats', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)

    const database = await prisma.database.findUnique({
      where: { id },
      include: { server: true },
    })

    if (!database) {
      return reply.status(404).send({ success: false, error: 'Database not found' })
    }
    if (!database.containerName) {
      return reply.status(400).send({ success: false, error: 'Database has no container yet' })
    }

    const stats = await getContainerStats(
      buildServerConfig(database.server),
      database.containerName
    )

    return { success: true, data: stats }
  })

  // ── GET /api/databases/:id/logs ───────────────────────────────────────
  // Retrieve container logs
  app.get('/api/databases/:id/logs', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)
    const tail = parseInt(request.query.tail ?? '100', 10)

    const database = await prisma.database.findUnique({
      where: { id },
      include: { server: true },
    })

    if (!database) {
      return reply.status(404).send({ success: false, error: 'Database not found' })
    }
    if (!database.containerName) {
      return reply.status(400).send({ success: false, error: 'Database has no container yet' })
    }

    const logs = await getContainerLogs(
      buildServerConfig(database.server),
      database.containerName,
      Math.min(tail, 500)
    )

    return { success: true, data: { logs } }
  })

  // ── POST /api/databases/:id/start ─────────────────────────────────────
  app.post('/api/databases/:id/start', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)

    const database = await prisma.database.findUnique({
      where: { id },
      include: { server: true },
    })

    if (!database) return reply.status(404).send({ success: false, error: 'Database not found' })
    if (!database.containerName) return reply.status(400).send({ success: false, error: 'No container to start' })

    const result = await startContainer(buildServerConfig(database.server), database.containerName)

    if (result.success) {
      await prisma.database.update({ where: { id }, data: { status: 'RUNNING' } })
    }

    return { success: result.success, message: result.success ? 'Database started' : 'Failed to start database' }
  })

  // ── POST /api/databases/:id/stop ──────────────────────────────────────
  app.post('/api/databases/:id/stop', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)

    const database = await prisma.database.findUnique({
      where: { id },
      include: { server: true },
    })

    if (!database) return reply.status(404).send({ success: false, error: 'Database not found' })
    if (!database.containerName) return reply.status(400).send({ success: false, error: 'No container to stop' })

    const result = await stopContainer(buildServerConfig(database.server), database.containerName)

    if (result.success) {
      await prisma.database.update({ where: { id }, data: { status: 'STOPPED' } })
    }

    return { success: result.success, message: result.success ? 'Database stopped' : 'Failed to stop database' }
  })

  // ── POST /api/databases/:id/restart ───────────────────────────────────
  app.post('/api/databases/:id/restart', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)

    const database = await prisma.database.findUnique({
      where: { id },
      include: { server: true },
    })

    if (!database) return reply.status(404).send({ success: false, error: 'Database not found' })
    if (!database.containerName) return reply.status(400).send({ success: false, error: 'No container to restart' })

    const result = await restartContainer(buildServerConfig(database.server), database.containerName)

    if (result.success) {
      await prisma.database.update({ where: { id }, data: { status: 'RUNNING' } })
    }

    return { success: result.success, message: result.success ? 'Database restarted' : 'Failed to restart database' }
  })

  // ── DELETE /api/databases/:id ─────────────────────────────────────────
  app.delete('/api/databases/:id', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)

    const database = await prisma.database.findUnique({
      where: { id },
      include: { server: true },
    })

    if (!database) return reply.status(404).send({ success: false, error: 'Database not found' })

    // Remove Docker container if it exists
    if (database.containerName) {
      try {
        await removeContainer(buildServerConfig(database.server), database.containerName)
      } catch (err) {
        app.log.warn({ err, databaseId: id }, 'Failed to remove container — continuing delete')
      }
    }

    await prisma.database.delete({ where: { id } })

    return { success: true, message: `Database "${database.name}" deleted.` }
  })

  // ══════════════════════════════════════════════════════════════════════
  // BACKUP ROUTES
  // ══════════════════════════════════════════════════════════════════════

  // ── POST /api/databases/:id/backups ───────────────────────────────────
  // Create backup config + optionally trigger immediately
  app.post('/api/databases/:id/backups', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)
    const body = createBackupSchema.parse(request.body)

    const database = await prisma.database.findUnique({
      where: { id },
      include: { server: true },
    })

    if (!database) return reply.status(404).send({ success: false, error: 'Database not found' })
    if (database.status !== 'RUNNING') {
      return reply.status(400).send({ success: false, error: 'Database must be running to create a backup' })
    }

    // Validate S3 credentials before saving
    if (body.triggerNow) {
      const serverConfig = buildServerConfig(database.server)
      const s3Test = await testS3Connection(serverConfig, body)
      if (!s3Test.ok) {
        return reply.status(400).send({
          success: false,
          error: `S3 connection failed: ${s3Test.error}`,
        })
      }
    }

    const backup = await prisma.backup.create({
      data: {
        databaseId: id,
        s3Endpoint: body.s3Endpoint || null,
        s3Bucket: body.s3Bucket,
        s3AccessKey: body.s3AccessKey,
        s3SecretKey: body.s3SecretKey,
        s3Region: body.s3Region,
        s3Path: body.s3Path ?? database.name,
        schedule: body.schedule ?? null,
        status: 'PENDING',
      },
    })

    let jobId = null

    if (body.triggerNow) {
      const job = await backupQueue.add(
        'run',
        { backupId: backup.id },
        { jobId: `backup-${backup.id}` }
      )
      jobId = job.id
    }

    return reply.status(201).send({
      success: true,
      data: sanitizeBackup(backup),
      jobId,
    })
  })

  // ── GET /api/databases/:id/backups ────────────────────────────────────
  app.get('/api/databases/:id/backups', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)

    const backups = await prisma.backup.findMany({
      where: { databaseId: id },
      orderBy: { createdAt: 'desc' },
    })

    return { success: true, data: backups.map(sanitizeBackup) }
  })

  // ── POST /api/backups/:id/run ──────────────────────────────────────────
  // Trigger an existing backup config to run now
  app.post('/api/backups/:id/run', async (request, reply) => {
    const { id } = backupIdSchema.parse(request.params)

    const backup = await prisma.backup.findUnique({
      where: { id },
      include: { database: { include: { server: true } } },
    })

    if (!backup) return reply.status(404).send({ success: false, error: 'Backup not found' })
    if (backup.database.status !== 'RUNNING') {
      return reply.status(400).send({ success: false, error: 'Database must be running to trigger backup' })
    }

    await prisma.backup.update({
      where: { id },
      data: { status: 'PENDING', errorMessage: null },
    })

    const job = await backupQueue.add(
      'run',
      { backupId: id },
      { jobId: `backup-${id}-${Date.now()}` }
    )

    return { success: true, message: 'Backup triggered', jobId: job.id }
  })

  // ── PATCH /api/backups/:id ────────────────────────────────────────────────
  // Update backup config fields (e.g. fix s3Region on existing records)
  app.patch('/api/backups/:id', async (request, reply) => {
    const { id } = backupIdSchema.parse(request.params)

    const allowed = ['s3Endpoint', 's3Bucket', 's3AccessKey', 's3SecretKey', 's3Region', 's3Path', 'schedule']
    const updates = {}
    for (const key of allowed) {
      if (request.body[key] !== undefined) updates[key] = request.body[key]
    }

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ success: false, error: 'No valid fields provided' })
    }

    const backup = await prisma.backup.findUnique({ where: { id } })
    if (!backup) return reply.status(404).send({ success: false, error: 'Backup not found' })

    const updated = await prisma.backup.update({ where: { id }, data: updates })
    return { success: true, data: sanitizeBackup(updated) }
  })

  // ── POST /api/databases/:id/backups/test-s3 ───────────────────────────
  // Test S3 credentials without saving
  app.post('/api/databases/:id/backups/test-s3', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)
    const body = testS3Schema.parse(request.body)

    const database = await prisma.database.findUnique({
      where: { id },
      include: { server: true },
    })

    if (!database) return reply.status(404).send({ success: false, error: 'Database not found' })

    const result = await testS3Connection(buildServerConfig(database.server), body)

    return {
      success: result.ok,
      message: result.ok ? 'S3 connection successful ✓' : `Connection failed: ${result.error}`,
    }
  })
}