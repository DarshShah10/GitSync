/**
 * /api/databases routes
 *
 * Backward-compatible API surface (all URLs unchanged) backed by the new
 * prisma.service model (type = 'DATABASE') + prisma.backupPolicy + prisma.backupRun.
 *
 * Inline S3 credentials (s3Endpoint, s3Bucket, etc.) from the request body
 * are stored as S3Credential records and referenced via BackupPolicy.
 * The frontend doesn't need to know about S3Credential directly.
 */

import { prisma } from '../db/prisma.js'
import { serviceCreateQueue, backupQueue } from '../jobs/queues.js'
import {
  createDatabaseSchema,
  createBackupConfigSchema,
  testS3Schema,
  databaseIdSchema,
  backupConfigIdSchema,
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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shape a Service row (type=DATABASE) into the response the frontend expects.
 * Spreads config JSONB fields up to top level so the frontend doesn't change.
 */
function sanitizeDatabase(svc) {
  const cfg = svc.config ?? {}
  const out = {
    id:              svc.id,
    name:            svc.name,
    type:            cfg.dbEngine ?? svc.type,   // "POSTGRESQL" etc. — matches old database.type
    status:          svc.status,
    containerId:     svc.containerId,
    containerName:   svc.containerName,
    volumeName:      svc.volumeName,
    internalPort:    svc.internalPort,
    isPublic:        svc.isPublic,
    publicPort:      svc.exposedPort,            // old field name kept for frontend compat
    connectionString: svc.connectionString
      ? svc.connectionString.replace(/:([^@/]+)@/, ':****@')
      : null,
    dbUser:          cfg.dbUser,
    dbName:          cfg.dbName,
    errorMessage:    svc.errorMessage,
    server:          svc.server,
    backupConfigs:   svc.backupPolicies?.map(sanitizeBackupPolicy) ?? undefined,
    _count:          svc._count
      ? { backupConfigs: svc._count.backupPolicies ?? 0 }
      : undefined,
    createdAt:       svc.createdAt,
    updatedAt:       svc.updatedAt,
  }
  return out
}

function sanitizeBackupPolicy(policy) {
  // Merge s3Credential fields back to old s3* names for frontend compat
  const cred = policy.s3Credential ?? {}
  const { s3Credential, runs, ...rest } = policy
  const out = {
    ...rest,
    s3Endpoint:  cred.endpoint  ?? null,
    s3Bucket:    cred.bucket    ?? '',
    s3Region:    cred.region    ?? 'us-east-1',
    s3Path:      policy.s3PathPrefix ?? '',
    // Never expose accessKey/secretKey in responses
    executions:  runs?.map(sanitizeRun) ?? undefined,
  }
  return out
}

function sanitizeRun(run) {
  return {
    ...run,
    sizeBytes: typeof run.sizeBytes === 'bigint' ? Number(run.sizeBytes) : run.sizeBytes,
  }
}

/**
 * Build the serverConfig object ssh.service.js needs from Server + credential.
 */
function buildServerConfig(server) {
  const cred = server.credential
  if (!cred) throw new Error('Server has no credential record')
  return {
    ip:         server.ip,
    port:       server.sshPort,
    username:   cred.sshUsername,
    authType:   cred.authType,
    password:   cred.sshPassword   ?? null,
    privateKey: cred.sshPrivateKey ?? null,
  }
}

/**
 * Returns the default environment for the authed user.
 * Creates Default project + Production environment if they don't exist yet.
 */
async function getOrCreateDefaultEnv(userId) {
  const existing = await prisma.environment.findFirst({
    where: { slug: 'production', project: { userId, name: 'Default' } },
    include: { project: true },
  })
  if (existing) return existing

  const project = await prisma.project.create({
    data: {
      userId,
      name: 'Default',
      environments: { create: { name: 'Production', slug: 'production' } },
    },
    include: { environments: true },
  })
  return project.environments[0]
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

export async function databaseRoutes(app) {

  // ── POST /api/databases ─────────────────────────────────────────────────────
  app.post('/api/databases', async (request, reply) => {
    const body = createDatabaseSchema.parse(request.body)

    const server = await prisma.server.findUnique({
      where:   { id: body.serverId },
      include: { credential: true },
    })
    if (!server) return reply.status(404).send({ success: false, error: 'Server not found' })
    if (server.status !== 'CONNECTED') {
      return reply.status(400).send({
        success: false,
        error:   `Server is not connected (status: ${server.status}).`,
      })
    }

    // Resolve environment — use provided ID or fall back to user's default
    const envId = body.environmentId ?? (await getOrCreateDefaultEnv(request.user.id)).id

    const typeConfig = DB_CONFIGS[body.type]
    if (!typeConfig) {
      return reply.status(400).send({ success: false, error: `Unsupported database type: ${body.type}` })
    }

    // Guard against duplicate names on the same server
    const existing = await prisma.service.findFirst({
      where: { serverId: server.id, name: body.name, type: 'DATABASE' },
    })
    if (existing) {
      return reply.status(409).send({
        success: false,
        error:   `A database named "${body.name}" already exists on this server.`,
      })
    }

    const service = await prisma.service.create({
      data: {
        environmentId: envId,
        serverId:      body.serverId,
        name:          body.name,
        type:          'DATABASE',
        status:        'CREATING',
        internalPort:  typeConfig.internalPort,
        config: {
          dbEngine:   body.type,
          dbUser:     body.dbUser ?? 'dbshift',
          dbPassword: body.dbPassword,
          dbName:     body.dbName ?? body.name,
        },
      },
    })

    const job = await serviceCreateQueue.add(
      'create',
      { serviceId: service.id },
      { jobId: `svc-create-${service.id}` }
    )

    app.log.info({ serviceId: service.id, jobId: job.id }, 'Database creation queued')

    return reply.status(201).send({
      success: true,
      data:    sanitizeDatabase(service),
      jobId:   job.id,
    })
  })

  // ── GET /api/databases ──────────────────────────────────────────────────────
  app.get('/api/databases', async (request, reply) => {
    const { serverId } = request.query

    const services = await prisma.service.findMany({
      where: {
        type: 'DATABASE',
        server: { userId: request.user.id },
        ...(serverId ? { serverId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        server: { select: { id: true, name: true, ip: true, status: true } },
        _count: { select: { backupPolicies: true } },
      },
    })

    return { success: true, data: services.map(sanitizeDatabase) }
  })

  // ── GET /api/databases/:id ──────────────────────────────────────────────────
  app.get('/api/databases/:id', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)

    const service = await prisma.service.findFirst({
      where:   { id, type: 'DATABASE', server: { userId: request.user.id } },
      include: {
        server: { select: { id: true, name: true, ip: true, status: true } },
        backupPolicies: {
          orderBy: { createdAt: 'desc' },
          include: {
            s3Credential: true,
            runs: {
              orderBy: { createdAt: 'desc' },
              take:    1,
            },
            _count: { select: { runs: true } },
          },
        },
      },
    })

    if (!service) return reply.status(404).send({ success: false, error: 'Database not found' })

    return { success: true, data: sanitizeDatabase(service) }
  })

  // ── GET /api/databases/:id/status ───────────────────────────────────────────
  app.get('/api/databases/:id/status', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)

    const service = await prisma.service.findFirst({
      where:  { id, type: 'DATABASE', server: { userId: request.user.id } },
      select: {
        id: true, status: true, errorMessage: true,
        containerId: true, containerName: true, exposedPort: true, connectionString: true,
        server: {
          select: {
            ip: true, sshPort: true, status: true,
            credential: true,
          },
        },
      },
    })

    if (!service) return reply.status(404).send({ success: false, error: 'Database not found' })

    let liveStatus = null
    if (service.status === 'RUNNING' && service.containerName && service.server.status === 'CONNECTED') {
      try {
        liveStatus = await getContainerStatus(buildServerConfig(service.server), service.containerName)
        if (liveStatus === 'stopped') {
          await prisma.service.update({ where: { id }, data: { status: 'STOPPED' } })
        }
      } catch (_) {}
    }

    return {
      success: true,
      data: {
        id:                  service.id,
        status:              service.status,
        errorMessage:        service.errorMessage,
        liveContainerStatus: liveStatus,
        connectionString:    service.connectionString?.replace(/:([^@/]+)@/, ':****@'),
        publicPort:          service.exposedPort,
      },
    }
  })

  // ── GET /api/databases/:id/stats ─────────────────────────────────────────────
  app.get('/api/databases/:id/stats', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)

    const service = await prisma.service.findFirst({
      where:   { id, type: 'DATABASE', server: { userId: request.user.id } },
      include: { server: { include: { credential: true } } },
    })
    if (!service) return reply.status(404).send({ success: false, error: 'Database not found' })
    if (!service.containerName) {
      return reply.status(400).send({ success: false, error: 'Database has no container yet' })
    }

    const stats = await getContainerStats(buildServerConfig(service.server), service.containerName)
    return { success: true, data: stats }
  })

  // ── GET /api/databases/:id/logs ──────────────────────────────────────────────
  app.get('/api/databases/:id/logs', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)
    const tailRaw = parseInt(request.query.tail ?? '100', 10)
    const tail    = isNaN(tailRaw) ? 100 : Math.min(tailRaw, 500)

    const service = await prisma.service.findFirst({
      where:   { id, type: 'DATABASE', server: { userId: request.user.id } },
      include: { server: { include: { credential: true } } },
    })
    if (!service) return reply.status(404).send({ success: false, error: 'Database not found' })
    if (!service.containerName) {
      return reply.status(400).send({ success: false, error: 'Database has no container yet' })
    }

    const logs = await getContainerLogs(buildServerConfig(service.server), service.containerName, tail)
    return { success: true, data: { logs } }
  })

  // ── POST /api/databases/:id/start ────────────────────────────────────────────
  app.post('/api/databases/:id/start', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)

    const service = await prisma.service.findFirst({
      where:   { id, type: 'DATABASE', server: { userId: request.user.id } },
      include: { server: { include: { credential: true } } },
    })
    if (!service) return reply.status(404).send({ success: false, error: 'Database not found' })
    if (!service.containerName) {
      return reply.status(400).send({ success: false, error: 'No container to start' })
    }

    const result = await startContainer(buildServerConfig(service.server), service.containerName)
    if (!result.success) return { success: false, message: 'Failed to start database' }

    await new Promise(r => setTimeout(r, 2000))
    const liveStatus = await getContainerStatus(buildServerConfig(service.server), service.containerName)
    if (liveStatus !== 'running') {
      return reply.status(500).send({
        success: false,
        message: 'Container started but exited immediately — check logs',
      })
    }

    await prisma.service.update({ where: { id }, data: { status: 'RUNNING' } })
    return { success: true, message: 'Database started' }
  })

  // ── POST /api/databases/:id/stop ─────────────────────────────────────────────
  app.post('/api/databases/:id/stop', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)

    const service = await prisma.service.findFirst({
      where:   { id, type: 'DATABASE', server: { userId: request.user.id } },
      include: { server: { include: { credential: true } } },
    })
    if (!service) return reply.status(404).send({ success: false, error: 'Database not found' })
    if (!service.containerName) {
      return reply.status(400).send({ success: false, error: 'No container to stop' })
    }

    const result = await stopContainer(buildServerConfig(service.server), service.containerName)
    if (result.success) {
      await prisma.service.update({ where: { id }, data: { status: 'STOPPED' } })
    }

    return {
      success: result.success,
      message: result.success ? 'Database stopped' : 'Failed to stop database',
    }
  })

  // ── POST /api/databases/:id/restart ──────────────────────────────────────────
  app.post('/api/databases/:id/restart', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)

    const service = await prisma.service.findFirst({
      where:   { id, type: 'DATABASE', server: { userId: request.user.id } },
      include: { server: { include: { credential: true } } },
    })
    if (!service) return reply.status(404).send({ success: false, error: 'Database not found' })
    if (!service.containerName) {
      return reply.status(400).send({ success: false, error: 'No container to restart' })
    }

    const result = await restartContainer(buildServerConfig(service.server), service.containerName)
    if (!result.success) return { success: false, message: 'Failed to restart database' }

    await new Promise(r => setTimeout(r, 2000))
    const liveStatus = await getContainerStatus(buildServerConfig(service.server), service.containerName)
    if (liveStatus !== 'running') {
      return reply.status(500).send({
        success: false,
        message: 'Container restarted but exited immediately — check logs',
      })
    }

    await prisma.service.update({ where: { id }, data: { status: 'RUNNING' } })
    return { success: true, message: 'Database restarted' }
  })

  // ── DELETE /api/databases/:id ─────────────────────────────────────────────────
  app.delete('/api/databases/:id', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)

    const service = await prisma.service.findFirst({
      where:   { id, type: 'DATABASE', server: { userId: request.user.id } },
      include: { server: { include: { credential: true } } },
    })
    if (!service) return reply.status(404).send({ success: false, error: 'Database not found' })

    if (service.containerName) {
      try {
        await removeContainer(buildServerConfig(service.server), service.containerName)
      } catch (err) {
        app.log.warn({ err, serviceId: id }, 'Failed to remove container — continuing delete')
      }
    }

    await prisma.service.delete({ where: { id } })
    return { success: true, message: `Database "${service.name}" deleted.` }
  })

  // ══════════════════════════════════════════════════════════════════════════
  // BACKUP ROUTES
  // ══════════════════════════════════════════════════════════════════════════

  // ── POST /api/databases/:id/backups ────────────────────────────────────────
  // Creates S3Credential + BackupPolicy in one transaction.
  // Accepts the same inline s3* fields the old API used — no frontend change needed.
  app.post('/api/databases/:id/backups', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)
    const body   = createBackupConfigSchema.parse(request.body)

    const service = await prisma.service.findFirst({
      where:   { id, type: 'DATABASE', server: { userId: request.user.id } },
      include: { server: { include: { credential: true } } },
    })
    if (!service) return reply.status(404).send({ success: false, error: 'Database not found' })
    if (service.status !== 'RUNNING') {
      return reply.status(400).send({
        success: false,
        error:   'Database must be running to configure a backup',
      })
    }

    // Validate S3 credentials before persisting
    const s3TestCfg = {
      s3Endpoint:  body.s3Endpoint || null,
      s3Bucket:    body.s3Bucket,
      s3AccessKey: body.s3AccessKey,
      s3SecretKey: body.s3SecretKey,
      s3Region:    body.s3Region,
    }
    const s3Test = await testS3Connection(buildServerConfig(service.server), s3TestCfg)
    if (!s3Test.ok) {
      return reply.status(400).send({ success: false, error: `S3 connection failed: ${s3Test.error}` })
    }

    // Create S3Credential + BackupPolicy in one transaction
    const { policy, run } = await prisma.$transaction(async (tx) => {
      const cred = await tx.s3Credential.create({
        data: {
          userId:    request.user.id,
          name:      `${service.name} backup — ${body.s3Bucket}`,
          endpoint:  body.s3Endpoint || null,
          bucket:    body.s3Bucket,
          region:    body.s3Region,
          accessKey: body.s3AccessKey,
          secretKey: body.s3SecretKey,
        },
      })

      const pol = await tx.backupPolicy.create({
        data: {
          serviceId:      id,
          s3CredentialId: cred.id,
          schedule:       body.schedule ?? null,
          s3PathPrefix:   body.s3Path || service.name,
          backupType:     'FULL',
          retentionDays:  30,
        },
        include: { s3Credential: true },
      })

      let execution = null
      if (body.triggerNow) {
        execution = await tx.backupRun.create({
          data: { backupPolicyId: pol.id, status: 'PENDING', backupType: 'FULL' },
        })
      }

      return { policy: pol, run: execution }
    })

    let jobId = null
    if (run) {
      const job = await backupQueue.add(
        'run',
        { policyId: policy.id, runId: run.id },
        { jobId: `backup-${policy.id}-${run.id}` }
      )
      jobId = job.id
    }

    return reply.status(201).send({
      success: true,
      data:    sanitizeBackupPolicy({ ...policy, runs: run ? [run] : [] }),
      jobId,
    })
  })

  // ── GET /api/databases/:id/backups ──────────────────────────────────────────
  app.get('/api/databases/:id/backups', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)

    const policies = await prisma.backupPolicy.findMany({
      where:   { serviceId: id, service: { server: { userId: request.user.id } } },
      orderBy: { createdAt: 'desc' },
      include: {
        s3Credential: true,
        runs: {
          orderBy: { createdAt: 'desc' },
          take:    1,
        },
        _count: { select: { runs: true } },
      },
    })

    return { success: true, data: policies.map(sanitizeBackupPolicy) }
  })

  // ── GET /api/backups/:id/executions ─────────────────────────────────────────
  app.get('/api/backups/:id/executions', async (request, reply) => {
    const { id } = backupConfigIdSchema.parse(request.params)

    const policy = await prisma.backupPolicy.findFirst({
      where: { id, service: { server: { userId: request.user.id } } },
    })
    if (!policy) return reply.status(404).send({ success: false, error: 'Backup policy not found' })

    const runs = await prisma.backupRun.findMany({
      where:   { backupPolicyId: id },
      orderBy: { createdAt: 'desc' },
      take:    50,
    })

    return { success: true, data: runs.map(sanitizeRun) }
  })

  // ── POST /api/backups/:id/run ────────────────────────────────────────────────
  app.post('/api/backups/:id/run', async (request, reply) => {
    const { id } = backupConfigIdSchema.parse(request.params)

    const policy = await prisma.backupPolicy.findFirst({
      where:   { id, service: { server: { userId: request.user.id } } },
      include: { service: true },
    })
    if (!policy) return reply.status(404).send({ success: false, error: 'Backup policy not found' })
    if (policy.service.status !== 'RUNNING') {
      return reply.status(400).send({
        success: false,
        error:   'Database must be running to trigger a backup',
      })
    }

    const run = await prisma.backupRun.create({
      data: { backupPolicyId: id, status: 'PENDING', backupType: 'FULL' },
    })

    const job = await backupQueue.add(
      'run',
      { policyId: id, runId: run.id },
      { jobId: `backup-${id}-${run.id}` }
    )

    return { success: true, message: 'Backup triggered', jobId: job.id, executionId: run.id }
  })

  // ── DELETE /api/backups/:id ──────────────────────────────────────────────────
  app.delete('/api/backups/:id', async (request, reply) => {
    const { id } = backupConfigIdSchema.parse(request.params)

    const policy = await prisma.backupPolicy.findFirst({
      where: { id, service: { server: { userId: request.user.id } } },
    })
    if (!policy) return reply.status(404).send({ success: false, error: 'Backup policy not found' })

    // Also delete the S3Credential if it's not used by any other policy
    await prisma.$transaction(async (tx) => {
      await tx.backupPolicy.delete({ where: { id } })
      const otherPolicies = await tx.backupPolicy.count({
        where: { s3CredentialId: policy.s3CredentialId },
      })
      if (otherPolicies === 0) {
        await tx.s3Credential.delete({ where: { id: policy.s3CredentialId } })
      }
    })

    return { success: true, message: 'Backup configuration deleted.' }
  })

  // ── POST /api/databases/:id/backups/test-s3 ──────────────────────────────────
  app.post('/api/databases/:id/backups/test-s3', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)
    const body   = testS3Schema.parse(request.body)

    const service = await prisma.service.findFirst({
      where:   { id, type: 'DATABASE', server: { userId: request.user.id } },
      include: { server: { include: { credential: true } } },
    })
    if (!service) return reply.status(404).send({ success: false, error: 'Database not found' })

    const result = await testS3Connection(buildServerConfig(service.server), {
      s3Endpoint:  body.s3Endpoint,
      s3Bucket:    body.s3Bucket,
      s3AccessKey: body.s3AccessKey,
      s3SecretKey: body.s3SecretKey,
      s3Region:    body.s3Region,
    })

    return {
      success: result.ok,
      message: result.ok ? 'S3 connection successful ✓' : `Connection failed: ${result.error}`,
    }
  })
}
