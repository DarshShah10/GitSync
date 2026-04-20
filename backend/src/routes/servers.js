import { Server } from '../models/index.js'
import { serverVerifyQueue } from '../jobs/queues.js'
import { testConnection, validatePrivateKey } from '../services/ssh.service.js'
import mongoose from 'mongoose'
import {
  createServerSchema,
  updateServerSchema,
  serverIdSchema,
} from './servers.schema.js'

function sanitizeServer(server) {
  const obj = server.toObject ? server.toObject() : server
  delete obj.credential
  return obj
}

function buildServerConfig(server) {
  const cred = server.credential
  if (!cred) throw new Error(`Server ${server.id} has no credential record`)
  return {
    ip:         server.ip,
    port:       server.sshPort,
    username:   cred.sshUsername,
    authType:   cred.authType,
    password:   cred.sshPassword   ?? null,
    privateKey: cred.sshPrivateKey ?? null,
  }
}

export async function serverRoutes(app) {

  app.post('/api/servers', async (request, reply) => {
    const body = createServerSchema.parse(request.body)

    if (body.authType === 'SSH_KEY' && body.privateKey) {
      const keyCheck = validatePrivateKey(body.privateKey)
      if (!keyCheck.valid) {
        return reply.status(400).send({ success: false, error: keyCheck.error })
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

    const job = await serverVerifyQueue.add(
      'verify',
      { serverId: server._id.toString() },
      { jobId: `verify-${server._id}` }
    )

    app.log.info({ serverId: server._id, jobId: job.id }, 'Server created, verification queued')

    return reply.status(201).send({
      success: true,
      data:    sanitizeServer(server),
      jobId:   job.id,
    })
  })

  app.get('/api/servers', async (request, reply) => {
    const servers = await Server.find({ userId: request.user.id })
      .sort({ createdAt: -1 })
      .lean()

    const { Service } = await import('../models/index.js')
    const serversWithCount = await Promise.all(servers.map(async (srv) => {
      const count = await Service.countDocuments({
        serverId: srv._id,
        type: 'DATABASE'
      })
      return { ...srv, _count: { services: count } }
    }))

    return { success: true, data: serversWithCount.map(sanitizeServer) }
  })

  app.get('/api/servers/:id', async (request, reply) => {
    const { id } = serverIdSchema.parse(request.params)

    const server = await Server.findOne({
      _id: id,
      userId: request.user.id
    }).lean()

    if (!server) {
      return reply.status(404).send({ success: false, error: 'Server not found' })
    }

    const { Service } = await import('../models/index.js')
    const services = await Service.find({
      serverId: server._id,
      type: 'DATABASE'
    })
      .select('id name status createdAt config')
      .sort({ createdAt: -1 })
      .lean()

    return { success: true, data: { ...server, services } }
  })

  app.get('/api/servers/:id/status', async (request, reply) => {
    const { id } = serverIdSchema.parse(request.params)

    const server = await Server.findOne({
      _id: id,
      userId: request.user.id
    })
      .select('id status dockerVersion errorMessage lastCheckedAt')
      .lean()

    if (!server) {
      return reply.status(404).send({ success: false, error: 'Server not found' })
    }

    return { success: true, data: server }
  })

  app.post('/api/servers/:id/verify', async (request, reply) => {
    const { id } = serverIdSchema.parse(request.params)

    const server = await Server.findOne({
      _id: id,
      userId: request.user.id
    })
    if (!server) {
      return reply.status(404).send({ success: false, error: 'Server not found' })
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
  })

  app.post('/api/servers/:id/test-connection', async (request, reply) => {
    const { id } = serverIdSchema.parse(request.params)

    const server = await Server.findOne({
      _id: id,
      userId: request.user.id
    }).lean()

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

  app.patch('/api/servers/:id', async (request, reply) => {
    const { id }  = serverIdSchema.parse(request.params)
    const body    = updateServerSchema.parse(request.body)

    const server = await Server.findOne({
      _id: id,
      userId: request.user.id
    }).lean()

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
  })

  app.delete('/api/servers/:id', async (request, reply) => {
    const { id } = serverIdSchema.parse(request.params)

    const server = await Server.findOne({
      _id: id,
      userId: request.user.id
    })

    if (!server) {
      return reply.status(404).send({ success: false, error: 'Server not found' })
    }

    const { Service } = await import('../models/index.js')
    const count = await Service.countDocuments({
      serverId: server._id,
      type: 'DATABASE'
    })

    await Server.deleteOne({ _id: id })

    return {
      success: true,
      message: `Server "${server.name}" and its ${count} database(s) deleted.`,
    }
  })
}