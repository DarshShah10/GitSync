import { Server, Service } from '../models/index.js'
import { serverVerifyQueue } from '../jobs/queues.js'
import { testConnection, validatePrivateKey } from '../services/ssh.service.js'
import { sanitizeServer, buildServerConfig } from '../utils/helpers.js'
import { createServerSchema, updateServerSchema, serverIdSchema } from '../schemas/server.schema.js'

export async function createServer(request) {
  const body = createServerSchema.parse(request.body)

  if (body.authType === 'SSH_KEY' && body.privateKey) {
    const keyCheck = validatePrivateKey(body.privateKey)
    if (!keyCheck.valid) {
      return { error: keyCheck.error, status: 400 }
    }
  }

  const server = await Server.create({
    userId:  request.user.id,
    name:    body.name,
    ip:      body.ip,
    sshPort: body.port ?? 22,
    status:  'PENDING',
    credential: {
      authType:      body.authType,
      sshUsername:   body.username ?? 'root',
      sshPrivateKey: body.authType === 'SSH_KEY'   ? body.privateKey : null,
      sshPassword:   body.authType === 'PASSWORD'  ? body.password   : null,
    },
  })

  // Enqueue verification without blocking the HTTP response.
  // If Redis is momentarily reconnecting, queue.add() can hang for several
  // seconds. We give it 8 s then move on — the server record already exists
  // with status PENDING and the worker will still pick it up once Redis is
  // ready (BullMQ persists jobs in Redis once the connection is restored).
  const jobId = `verify-${server._id}`
  const enqueue = serverVerifyQueue.add(
    'verify',
    { serverId: server._id.toString() },
    { jobId },
  )

  const timeout = new Promise((resolve) => setTimeout(resolve, 8_000))

  // Fire-and-forget — await whichever settles first; log but don't rethrow
  Promise.race([enqueue, timeout])
    .then((result) => {
      if (result?.id) {
        console.log(`[server] verify job queued: ${result.id}`)
      } else {
        console.warn(`[server] verify job enqueue timed out for ${server._id} — will retry via BullMQ reconnect`)
      }
    })
    .catch((err) => {
      console.error(`[server] verify job enqueue failed for ${server._id}:`, err.message)
    })

  return {
    success: true,
    data:    sanitizeServer(server),
    jobId,
    status: 201,
  }
}

export async function listServers(request) {
  const servers = await Server.find({ userId: request.user.id })
    .sort({ createdAt: -1 })
    .lean()

  const serversWithCount = await Promise.all(servers.map(async (srv) => {
    const count = await Service.countDocuments({
      serverId: srv._id,
      type: 'DATABASE'
    })
    return { ...srv, _count: { services: count } }
  }))

  return { success: true, data: serversWithCount.map(sanitizeServer) }
}

export async function getServer(request) {
  const { id } = serverIdSchema.parse(request.params)

  const server = await Server.findOne({
    _id: id,
    userId: request.user.id
  }).lean()

  if (!server) {
    return { error: 'Server not found', status: 404 }
  }

  const services = await Service.find({
    serverId: server._id,
    type: 'DATABASE'
  })
    .select('id name status createdAt config')
    .sort({ createdAt: -1 })
    .lean()

  return { success: true, data: { ...server, services } }
}

export async function getServerStatus(request) {
  const { id } = serverIdSchema.parse(request.params)

  const server = await Server.findOne({
    _id: id,
    userId: request.user.id
  })
    .select('id status dockerVersion errorMessage lastCheckedAt')
    .lean()

  if (!server) {
    return { error: 'Server not found', status: 404 }
  }

  return { success: true, data: server }
}

export async function verifyServer(request) {
  const { id } = serverIdSchema.parse(request.params)

  const server = await Server.findOne({
    _id: id,
    userId: request.user.id
  })
  if (!server) {
    return { error: 'Server not found', status: 404 }
  }

  await Server.updateOne(
    { _id: id },
    { $set: { status: 'PENDING', errorMessage: null } }
  )

  const existingJob = await serverVerifyQueue.getJob(`verify-${id}`)
  if (existingJob) await existingJob.remove().catch(() => {})

  const job = await serverVerifyQueue.add(
    'verify',
    { serverId: id },
    { jobId: `verify-${id}-${Date.now()}` }
  )

  return { success: true, message: 'Verification re-queued', jobId: job.id }
}

export async function testServerConnection(request) {
  const { id } = serverIdSchema.parse(request.params)

  const server = await Server.findOne({
    _id:    id,
    userId: request.user.id,
  }).lean()

  if (!server) {
    return { error: 'Server not found', status: 404 }
  }

  // ── wrap in try/catch so SSH failures return a clean 200 response
  // instead of an unhandled exception that Fastify turns into a 500
  try {
    const result = await testConnection(buildServerConfig(server))
    return {
      success: true,
      data: {
        reachable:  result.ok,
        latencyMs:  result.latencyMs,
        error:      result.error ?? null,
      },
    }
  } catch (err) {
    return {
      success: true,
      data: {
        reachable:  false,
        latencyMs:  null,
        error:      err.message ?? 'Connection test failed',
      },
    }
  }
}

export async function updateServer(request) {
  const { id } = serverIdSchema.parse(request.params)
  const body    = updateServerSchema.parse(request.body)

  const server = await Server.findOne({
    _id: id,
    userId: request.user.id
  }).lean()

  if (!server) {
    return { error: 'Server not found', status: 404 }
  }

  if (body.privateKey) {
    const keyCheck = validatePrivateKey(body.privateKey)
    if (!keyCheck.valid) {
      return { error: keyCheck.error, status: 400 }
    }
  }

  const credentialChanged = body.privateKey || body.password || body.authType || body.username
  const networkChanged    = body.ip || body.port

  const updateData = {}
  if (body.name) updateData.name = body.name
  if (body.port) updateData.sshPort = body.port
  if (credentialChanged || networkChanged) {
    updateData.status = 'PENDING'
    updateData.errorMessage = null
  }

  await Server.updateOne({ _id: id }, { $set: updateData })

  if (credentialChanged) {
    const credUpdate = {
      'credential.authType': body.authType ?? server.credential?.authType,
      'credential.sshUsername': body.username ?? server.credential?.sshUsername,
    }
    if (body.privateKey) {
      credUpdate['credential.sshPrivateKey'] = body.privateKey
      credUpdate['credential.sshPassword'] = null
    }
    if (body.password) {
      credUpdate['credential.sshPassword'] = body.password
      credUpdate['credential.sshPrivateKey'] = null
    }
    await Server.updateOne({ _id: id }, { $set: credUpdate })
  }

  const updated = await Server.findById(id).lean()
  return { success: true, data: sanitizeServer(updated) }
}

export async function deleteServer(request) {
  const { id } = serverIdSchema.parse(request.params)

  const server = await Server.findOne({
    _id: id,
    userId: request.user.id
  })

  if (!server) {
    return { error: 'Server not found', status: 404 }
  }

  const count = await Service.countDocuments({
    serverId: server._id,
    type: 'DATABASE'
  })

  await Server.deleteOne({ _id: id })

  return {
    success: true,
    message: `Server "${server.name}" and its ${count} database(s) deleted.`,
  }
}