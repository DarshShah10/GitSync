import { prisma } from '../db/prisma.js'
import { serverVerifyQueue } from '../jobs/queues.js'
import { testConnection, validatePrivateKey } from '../services/ssh.service.js'
import {
  createServerSchema,
  updateServerSchema,
  serverIdSchema,
} from './servers.schema.js'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strip sensitive credential fields from API responses.
 * The credential sub-object is removed entirely — only metadata is returned.
 */
function sanitizeServer(server) {
  const { credential, ...safe } = server
  return safe
}

/**
 * Build the serverConfig object required by ssh.service.js.
 * Reads from the ServerCredential relation — must be included in the Prisma query.
 */
function buildServerConfig(server) {
  const cred = server.credential
  if (!cred) throw new Error(`Server ${server.id} has no credential record`)
  return {
    ip:         server.ip,
    port:       server.sshPort,
    username:   cred.sshUsername,
    authType:   cred.authType,        // 'SSH_KEY' | 'PASSWORD'
    password:   cred.sshPassword   ?? null,
    privateKey: cred.sshPrivateKey ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

export async function serverRoutes(app) {

  // ── POST /api/servers ──────────────────────────────────────────────────────
  app.post('/api/servers', async (request, reply) => {
    const body = createServerSchema.parse(request.body)

    if (body.authType === 'SSH_KEY' && body.privateKey) {
      const keyCheck = validatePrivateKey(body.privateKey)
      if (!keyCheck.valid) {
        return reply.status(400).send({ success: false, error: keyCheck.error })
      }
    }

    const server = await prisma.server.create({
      data: {
        userId:  request.user.id,
        name:    body.name,
        ip:      body.ip,
        sshPort: body.port ?? 22,
        status:  'PENDING',
        // Credentials stored in a separate table — never returned in list queries
        credential: {
          create: {
            authType:      body.authType,
            sshUsername:   body.username ?? 'root',
            sshPrivateKey: body.authType === 'SSH_KEY'   ? body.privateKey : null,
            sshPassword:   body.authType === 'PASSWORD'  ? body.password   : null,
          },
        },
      },
      include: { credential: true },
    })

    const job = await serverVerifyQueue.add(
      'verify',
      { serverId: server.id },
      { jobId: `verify-${server.id}` }
    )

    app.log.info({ serverId: server.id, jobId: job.id }, 'Server created, verification queued')

    return reply.status(201).send({
      success: true,
      data:    sanitizeServer(server),
      jobId:   job.id,
    })
  })

  // ── GET /api/servers ───────────────────────────────────────────────────────
  app.get('/api/servers', async (request, reply) => {
    const servers = await prisma.server.findMany({
      where:   { userId: request.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { services: { where: { type: 'DATABASE' } } } },
      },
    })

    return { success: true, data: servers.map(sanitizeServer) }
  })

  // ── GET /api/servers/:id ───────────────────────────────────────────────────
  app.get('/api/servers/:id', async (request, reply) => {
    const { id } = serverIdSchema.parse(request.params)

    const server = await prisma.server.findFirst({
      where:   { id, userId: request.user.id },
      include: {
        services: {
          where:   { type: 'DATABASE' },
          select:  {
            id: true, name: true, status: true, createdAt: true,
            config: true,  // contains dbEngine
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!server) {
      return reply.status(404).send({ success: false, error: 'Server not found' })
    }

    return { success: true, data: sanitizeServer(server) }
  })

  // ── GET /api/servers/:id/status ────────────────────────────────────────────
  app.get('/api/servers/:id/status', async (request, reply) => {
    const { id } = serverIdSchema.parse(request.params)

    const server = await prisma.server.findFirst({
      where: { id, userId: request.user.id },
      select: {
        id: true, status: true, dockerVersion: true,
        errorMessage: true, lastCheckedAt: true,
      },
    })

    if (!server) {
      return reply.status(404).send({ success: false, error: 'Server not found' })
    }

    return { success: true, data: server }
  })

  // ── POST /api/servers/:id/verify ───────────────────────────────────────────
  app.post('/api/servers/:id/verify', async (request, reply) => {
    const { id } = serverIdSchema.parse(request.params)

    const server = await prisma.server.findFirst({
      where: { id, userId: request.user.id },
    })
    if (!server) {
      return reply.status(404).send({ success: false, error: 'Server not found' })
    }

    await prisma.server.update({
      where: { id },
      data:  { status: 'PENDING', errorMessage: null },
    })

    const existingJob = await serverVerifyQueue.getJob(`verify-${id}`)
    if (existingJob) await existingJob.remove().catch(() => {})

    const job = await serverVerifyQueue.add(
      'verify',
      { serverId: id },
      { jobId: `verify-${id}-${Date.now()}` }
    )

    return { success: true, message: 'Verification re-queued', jobId: job.id }
  })

  // ── POST /api/servers/:id/test-connection ──────────────────────────────────
  app.post('/api/servers/:id/test-connection', async (request, reply) => {
    const { id } = serverIdSchema.parse(request.params)

    const server = await prisma.server.findFirst({
      where:   { id, userId: request.user.id },
      include: { credential: true },
    })
    if (!server) {
      return reply.status(404).send({ success: false, error: 'Server not found' })
    }

    const result = await testConnection(buildServerConfig(server))

    return {
      success: true,
      data: {
        reachable:  result.ok,
        latencyMs:  result.latencyMs,
        error:      result.error ?? null,
      },
    }
  })

  // ── PATCH /api/servers/:id ─────────────────────────────────────────────────
  app.patch('/api/servers/:id', async (request, reply) => {
    const { id }  = serverIdSchema.parse(request.params)
    const body    = updateServerSchema.parse(request.body)

    const server = await prisma.server.findFirst({
      where:   { id, userId: request.user.id },
      include: { credential: true },
    })
    if (!server) {
      return reply.status(404).send({ success: false, error: 'Server not found' })
    }

    if (body.privateKey) {
      const keyCheck = validatePrivateKey(body.privateKey)
      if (!keyCheck.valid) {
        return reply.status(400).send({ success: false, error: keyCheck.error })
      }
    }

    const credentialChanged = body.privateKey || body.password || body.authType || body.username
    const networkChanged    = body.ip || body.port

    // Update server + credential in a transaction
    const updated = await prisma.$transaction(async (tx) => {
      const srv = await tx.server.update({
        where: { id },
        data: {
          ...(body.name ? { name: body.name } : {}),
          ...(body.port ? { sshPort: body.port } : {}),
          ...((credentialChanged || networkChanged) ? { status: 'PENDING', errorMessage: null } : {}),
        },
      })

      if (credentialChanged) {
        await tx.serverCredential.update({
          where: { serverId: id },
          data: {
            ...(body.authType    ? { authType:      body.authType }                      : {}),
            ...(body.username    ? { sshUsername:   body.username }                      : {}),
            ...(body.privateKey  ? { sshPrivateKey: body.privateKey, sshPassword: null } : {}),
            ...(body.password    ? { sshPassword:   body.password,   sshPrivateKey: null } : {}),
          },
        })
      }

      return srv
    })

    return { success: true, data: sanitizeServer(updated) }
  })

  // ── DELETE /api/servers/:id ────────────────────────────────────────────────
  app.delete('/api/servers/:id', async (request, reply) => {
    const { id } = serverIdSchema.parse(request.params)

    const server = await prisma.server.findFirst({
      where:   { id, userId: request.user.id },
      include: { _count: { select: { services: { where: { type: 'DATABASE' } } } } },
    })
    if (!server) {
      return reply.status(404).send({ success: false, error: 'Server not found' })
    }

    await prisma.server.delete({ where: { id } })

    return {
      success: true,
      message: `Server "${server.name}" and its ${server._count.services} database(s) deleted.`,
    }
  })
}
