import { Service, Server, Project, BackupPolicy, BackupRun, S3Credential } from '../models/index.js'
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

function sanitizeDatabase(svc) {
  const cfg = svc.config ?? {}
  return {
    id:              svc._id,
    name:            svc.name,
    type:            cfg.dbEngine ?? svc.type,
    status:          svc.status,
    containerId:     svc.containerId,
    containerName:   svc.containerName,
    volumeName:      svc.volumeName,
    internalPort:    svc.internalPort,
    isPublic:        svc.isPublic,
    publicPort:      svc.exposedPort,
    connectionString: svc.connectionString
      ? svc.connectionString.replace(/:([^@/]+)@/, ':****@')
      : null,
    dbUser:          cfg.dbUser,
    dbName:          cfg.dbName,
    errorMessage:    svc.errorMessage,
    server:          svc.server,
    backupConfigs:   svc.backupConfigs,
    createdAt:       svc.createdAt,
    updatedAt:       svc.updatedAt,
  }
}

function sanitizeBackupPolicy(policy) {
  const cred = policy.s3Credential ?? {}
  const { s3Credential, runs, ...rest } = policy
  return {
    ...rest,
    s3Endpoint:  cred.endpoint  ?? null,
    s3Bucket:    cred.bucket    ?? '',
    s3Region:    cred.region    ?? 'us-east-1',
    s3Path:      policy.s3PathPrefix ?? '',
    executions:  runs?.map(sanitizeRun) ?? undefined,
  }
}

function sanitizeRun(run) {
  return run
}

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

async function getOrCreateDefaultEnv(userId) {
  const existing = await Project.findOne({
    userId: userId,
    name: 'Default',
    'environments.slug': 'production'
  }).lean()

  if (existing) {
    return existing.environments[0]
  }

  const project = await Project.create({
    userId: userId,
    name: 'Default',
    environments: [{ name: 'Production', slug: 'production' }]
  })

  return project.environments[0]
}

export async function databaseRoutes(app) {

  app.post('/api/databases', async (request, reply) => {
    const body = createDatabaseSchema.parse(request.body)

    const server = await Server.findById(body.serverId).lean()
    if (!server) return reply.status(404).send({ success: false, error: 'Server not found' })
    if (server.status !== 'CONNECTED') {
      return reply.status(400).send({
        success: false,
        error:   `Server is not connected (status: ${server.status}).`,
      })
    }

    const envId = body.environmentId ?? (await getOrCreateDefaultEnv(request.user.id))._id

    const typeConfig = DB_CONFIGS[body.type]
    if (!typeConfig) {
      return reply.status(400).send({ success: false, error: `Unsupported database type: ${body.type}` })
    }

    const existing = await Service.findOne({
      serverId: server._id,
      name: body.name,
      type: 'DATABASE'
    }).lean()

    if (existing) {
      return reply.status(409).send({
        success: false,
        error:   `A database named "${body.name}" already exists on this server.`,
      })
    }

    const service = await Service.create({
      projectId:     null,
      environmentId: envId,
      serverId:    server._id,
      name:        body.name,
      type:        'DATABASE',
      status:      'CREATING',
      internalPort: typeConfig.internalPort,
      config: {
        dbEngine:   body.type,
        dbUser:     'gitsync',
        dbPassword: body.dbPassword,
        dbName:     body.dbName ?? body.name,
      },
    })

    const job = await serviceCreateQueue.add(
      'create',
      { serviceId: service._id.toString() },
      { jobId: `svc-create-${service._id}` }
    )

    app.log.info({ serviceId: service._id, jobId: job.id }, 'Database creation queued')

    return reply.status(201).send({
      success: true,
      data:    sanitizeDatabase(service),
      jobId:   job.id,
    })
  })

  app.get('/api/databases', async (request, reply) => {
    const { serverId } = request.query

    const query = {
      type: 'DATABASE',
    }
    if (serverId) {
      query.serverId = serverId
    }

    const services = await Service.find(query)
      .populate('server', 'id name ip status')
      .sort({ createdAt: -1 })
      .lean()

    const userServices = services.filter(svc => svc.server?.userId?.toString() === request.user.id)

    const { BackupPolicy: BP } = await import('../models/index.js')
    const servicesWithBackups = await Promise.all(userServices.map(async (svc) => {
      const policies = await BP.find({ serviceId: svc._id })
        .populate('s3Credential')
        .sort({ createdAt: -1 })
        .lean()
      return { ...svc, backupConfigs: policies }
    }))

    return { success: true, data: servicesWithBackups.map(sanitizeDatabase) }
  })

  app.get('/api/databases/:id', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)

    const service = await Service.findById(id)
      .populate('server', 'id name ip status')
      .lean()

    if (!service) return reply.status(404).send({ success: false, error: 'Database not found' })

    const { BackupPolicy: BP, BackupRun: BR } = await import('../models/index.js')
    const policies = await BP.find({ serviceId: service._id })
      .populate('s3Credential')
      .sort({ createdAt: -1 })
      .lean()

    const policiesWithRuns = await Promise.all(policies.map(async (pol) => {
      const runs = await BR.find({ backupPolicyId: pol._id })
        .sort({ createdAt: -1 })
        .limit(1)
        .lean()
      return { ...pol, runs }
    }))

    return { success: true, data: { ...service, backupConfigs: policiesWithRuns } }
  })

  app.get('/api/databases/:id/status', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)

    const service = await Service.findById(id)
      .populate('server')
      .lean()

    if (!service) return reply.status(404).send({ success: false, error: 'Database not found' })

    let liveStatus = null
    if (service.status === 'RUNNING' && service.containerName && service.server.status === 'CONNECTED') {
      try {
        liveStatus = await getContainerStatus(buildServerConfig(service.server), service.containerName)
        if (liveStatus === 'stopped') {
          await Service.updateOne({ _id: id }, { $set: { status: 'STOPPED' } })
        }
      } catch (_) {}
    }

    return {
      success: true,
      data: {
        id:                  service._id,
        status:              service.status,
        errorMessage:        service.errorMessage,
        liveContainerStatus: liveStatus,
        connectionString:    service.connectionString?.replace(/:([^@/]+)@/, ':****@'),
        publicPort:          service.exposedPort,
      },
    }
  })

  app.get('/api/databases/:id/stats', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)

    const service = await Service.findById(id)
      .populate('server')
      .lean()

    if (!service) return reply.status(404).send({ success: false, error: 'Database not found' })
    if (!service.containerName) {
      return reply.status(400).send({ success: false, error: 'Database has no container yet' })
    }

    const stats = await getContainerStats(buildServerConfig(service.server), service.containerName)
    return { success: true, data: stats }
  })

  app.get('/api/databases/:id/logs', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)
    const tailRaw = parseInt(request.query.tail ?? '100', 10)
    const tail    = isNaN(tailRaw) ? 100 : Math.min(tailRaw, 500)

    const service = await Service.findById(id)
      .populate('server')
      .lean()

    if (!service) return reply.status(404).send({ success: false, error: 'Database not found' })
    if (!service.containerName) {
      return reply.status(400).send({ success: false, error: 'Database has no container yet' })
    }

    const logs = await getContainerLogs(buildServerConfig(service.server), service.containerName, tail)
    return { success: true, data: { logs } }
  })

  app.post('/api/databases/:id/start', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)

    const service = await Service.findById(id)
      .populate('server')
      .lean()

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

    await Service.updateOne({ _id: id }, { $set: { status: 'RUNNING' } })
    return { success: true, message: 'Database started' }
  })

  app.post('/api/databases/:id/stop', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)

    const service = await Service.findById(id)
      .populate('server')
      .lean()

    if (!service) return reply.status(404).send({ success: false, error: 'Database not found' })
    if (!service.containerName) {
      return reply.status(400).send({ success: false, error: 'No container to stop' })
    }

    const result = await stopContainer(buildServerConfig(service.server), service.containerName)
    if (result.success) {
      await Service.updateOne({ _id: id }, { $set: { status: 'STOPPED' } })
    }

    return {
      success: result.success,
      message: result.success ? 'Database stopped' : 'Failed to stop database',
    }
  })

  app.post('/api/databases/:id/restart', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)

    const service = await Service.findById(id)
      .populate('server')
      .lean()

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

    await Service.updateOne({ _id: id }, { $set: { status: 'RUNNING' } })
    return { success: true, message: 'Database restarted' }
  })

  app.delete('/api/databases/:id', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)

    const service = await Service.findById(id)
      .populate('server')
      .lean()

    if (!service) return reply.status(404).send({ success: false, error: 'Database not found' })

    if (service.containerName) {
      try {
        await removeContainer(buildServerConfig(service.server), service.containerName)
      } catch (err) {
        app.log.warn({ err, serviceId: id }, 'Failed to remove container — continuing delete')
      }
    }

    await Service.deleteOne({ _id: id })
    return { success: true, message: `Database "${service.name}" deleted.` }
  })

  app.post('/api/databases/:id/backups', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)
    const body   = createBackupConfigSchema.parse(request.body)

    const service = await Service.findById(id)
      .populate('server')
      .lean()

    if (!service) return reply.status(404).send({ success: false, error: 'Database not found' })
    if (service.status !== 'RUNNING') {
      return reply.status(400).send({
        success: false,
        error:   'Database must be running to configure a backup',
      })
    }

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

    const cred = await S3Credential.create({
      userId:    request.user.id,
      name:      `${service.name} backup — ${body.s3Bucket}`,
      endpoint:  body.s3Endpoint || null,
      bucket:    body.s3Bucket,
      region:    body.s3Region,
      accessKey: body.s3AccessKey,
      secretKey: body.s3SecretKey,
    })

    const pol = await BackupPolicy.create({
      serviceId:      service._id,
      s3CredentialId: cred._id,
      schedule:       body.schedule ?? null,
      s3PathPrefix:   body.s3Path || service.name,
      backupType:     'FULL',
      retentionDays:  30,
    })

    let execution = null
    if (body.triggerNow) {
      execution = await BackupRun.create({
        backupPolicyId: pol._id,
        status: 'PENDING',
        backupType: 'FULL',
      })
    }

    let jobId = null
    if (execution) {
      const job = await backupQueue.add(
        'run',
        { policyId: pol._id.toString(), runId: execution._id.toString() },
        { jobId: `backup-${pol._id}-${execution._id}` }
      )
      jobId = job.id
    }

    const policyWithCred = await BackupPolicy.findById(pol._id)
      .populate('s3Credential')
      .lean()

    return reply.status(201).send({
      success: true,
      data:    sanitizeBackupPolicy({ ...policyWithCred, runs: execution ? [execution] : [] }),
      jobId,
    })
  })

  app.get('/api/databases/:id/backups', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)

    const policies = await BackupPolicy.find({ serviceId: id })
      .populate('s3Credential')
      .sort({ createdAt: -1 })
      .lean()

    const { BackupRun: BR } = await import('../models/index.js')
    const policiesWithRuns = await Promise.all(policies.map(async (pol) => {
      const runs = await BR.find({ backupPolicyId: pol._id })
        .sort({ createdAt: -1 })
        .limit(1)
        .lean()
      return { ...pol, runs }
    }))

    return { success: true, data: policiesWithRuns.map(sanitizeBackupPolicy) }
  })

  app.get('/api/backups/:id/executions', async (request, reply) => {
    const { id } = backupConfigIdSchema.parse(request.params)

    const runs = await BackupRun.find({ backupPolicyId: id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()

    return { success: true, data: runs.map(sanitizeRun) }
  })

  app.post('/api/backups/:id/run', async (request, reply) => {
    const { id } = backupConfigIdSchema.parse(request.params)

    const policy = await BackupPolicy.findById(id).lean()
    if (!policy) return reply.status(404).send({ success: false, error: 'Backup policy not found' })

    const { Service: Svc } = await import('../models/index.js')
    const service = await Svc.findById(policy.serviceId).lean()
    if (!service || service.status !== 'RUNNING') {
      return reply.status(400).send({
        success: false,
        error:   'Database must be running to trigger a backup',
      })
    }

    const run = await BackupRun.create({
      backupPolicyId: id,
      status: 'PENDING',
      backupType: 'FULL',
    })

    const job = await backupQueue.add(
      'run',
      { policyId: id, runId: run._id.toString() },
      { jobId: `backup-${id}-${run._id}` }
    )

    return { success: true, message: 'Backup triggered', jobId: job.id, executionId: run._id }
  })

  app.delete('/api/backups/:id', async (request, reply) => {
    const { id } = backupConfigIdSchema.parse(request.params)

    const policy = await BackupPolicy.findById(id).lean()
    if (!policy) return reply.status(404).send({ success: false, error: 'Backup policy not found' })

    await BackupPolicy.deleteOne({ _id: id })
    await S3Credential.deleteOne({ _id: policy.s3CredentialId })

    return { success: true, message: 'Backup configuration deleted.' }
  })

  app.post('/api/databases/:id/backups/test-s3', async (request, reply) => {
    const { id } = databaseIdSchema.parse(request.params)
    const body   = testS3Schema.parse(request.body)

    const service = await Service.findById(id)
      .populate('server')
      .lean()

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
      message: result.ok ? 'S3 connection successful' : `Connection failed: ${result.error}`,
    }
  })
}