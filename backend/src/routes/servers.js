import { prisma } from '../db/prisma.js'
import { serverVerifyQueue } from '../jobs/queues.js'
import { testConnection, validatePrivateKey } from '../services/ssh.service.js'
import {
  createServerSchema,
  updateServerSchema,
  serverIdSchema,
} from './servers.schema.js'

/**
 * Never return credentials in API responses.
 */
function sanitizeServer(server) {
  const { privateKey, password, ...safe } = server
  return safe
}

export async function serverRoutes(app) {

  // ── POST /api/servers ─────────────────────────────────────────────
  app.post('/api/servers', async (request, reply) => {
    const body = createServerSchema.parse(request.body)

    // Extra key validation when using key auth
    if (body.authType === 'KEY' && body.privateKey) {
      const keyCheck = validatePrivateKey(body.privateKey)
      if (!keyCheck.valid) {
        return reply.status(400).send({ success: false, error: keyCheck.error })
      }
    }

    const server = await prisma.server.create({
      data: {
        name:       body.name,
        ip:         body.ip,
        port:       body.port,
        username:   body.username,
        authType:   body.authType,
        privateKey: body.authType === 'KEY'      ? body.privateKey : null,
        password:   body.authType === 'PASSWORD' ? body.password   : null,
        status:     'PENDING',
      },
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

  // ── GET /api/servers ──────────────────────────────────────────────
  app.get('/api/servers', async (request, reply) => {
    const servers = await prisma.server.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { databases: true } } },
    })

    return { success: true, data: servers.map(sanitizeServer) }
  })

  // ── GET /api/servers/:id ──────────────────────────────────────────
  app.get('/api/servers/:id', async (request, reply) => {
    const { id } = serverIdSchema.parse(request.params)

    const server = await prisma.server.findUnique({
      where: { id },
      include: {
        databases: {
          select: { id: true, name: true, type: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!server) {
      return reply.status(404).send({ success: false, error: 'Server not found' })
    }

    return { success: true, data: sanitizeServer(server) }
  })

  // ── GET /api/servers/:id/status ───────────────────────────────────
  app.get('/api/servers/:id/status', async (request, reply) => {
    const { id } = serverIdSchema.parse(request.params)

    const server = await prisma.server.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        dockerVersion: true,
        errorMessage: true,
        lastCheckedAt: true,
      },
    })

    if (!server) {
      return reply.status(404).send({ success: false, error: 'Server not found' })
    }

    return { success: true, data: server }
  })

  // ── POST /api/servers/:id/verify ──────────────────────────────────
  app.post('/api/servers/:id/verify', async (request, reply) => {
    const { id } = serverIdSchema.parse(request.params)

    const server = await prisma.server.findUnique({ where: { id } })
    if (!server) {
      return reply.status(404).send({ success: false, error: 'Server not found' })
    }

    await prisma.server.update({
      where: { id },
      data: { status: 'PENDING', errorMessage: null },
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

  // ── POST /api/servers/:id/test-connection ─────────────────────────
  app.post('/api/servers/:id/test-connection', async (request, reply) => {
    const { id } = serverIdSchema.parse(request.params)

    const server = await prisma.server.findUnique({ where: { id } })
    if (!server) {
      return reply.status(404).send({ success: false, error: 'Server not found' })
    }

    const result = await testConnection({
      ip:         server.ip,
      port:       server.port,
      username:   server.username,
      authType:   server.authType,
      password:   server.password,
      privateKey: server.privateKey,
    })

    return {
      success: true,
      data: {
        reachable:  result.ok,
        latencyMs:  result.latencyMs,
        error:      result.error ?? null,
      },
    }
  })

  // ── PATCH /api/servers/:id ────────────────────────────────────────
  app.patch('/api/servers/:id', async (request, reply) => {
    const { id }  = serverIdSchema.parse(request.params)
    const body    = updateServerSchema.parse(request.body)

    const server = await prisma.server.findUnique({ where: { id } })
    if (!server) {
      return reply.status(404).send({ success: false, error: 'Server not found' })
    }

    if (body.privateKey) {
      const keyCheck = validatePrivateKey(body.privateKey)
      if (!keyCheck.valid) {
        return reply.status(400).send({ success: false, error: keyCheck.error })
      }
    }

    // Changing auth credentials resets status
    const credentialsChanged = body.privateKey || body.password || body.authType || body.ip || body.port || body.username
    const updated = await prisma.server.update({
      where: { id },
      data: {
        ...body,
        ...(credentialsChanged ? { status: 'PENDING', errorMessage: null } : {}),
      },
    })

    return { success: true, data: sanitizeServer(updated) }
  })

  // ── DELETE /api/servers/:id ───────────────────────────────────────
  app.delete('/api/servers/:id', async (request, reply) => {
    const { id } = serverIdSchema.parse(request.params)

    const server = await prisma.server.findUnique({
      where: { id },
      include: { _count: { select: { databases: true } } },
    })

    if (!server) {
      return reply.status(404).send({ success: false, error: 'Server not found' })
    }

    await prisma.server.delete({ where: { id } })

    return {
      success: true,
      message: `Server "${server.name}" and its ${server._count.databases} database(s) deleted.`,
    }
  })
}
