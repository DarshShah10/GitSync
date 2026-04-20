import { Service, Server, Project, BackupPolicy, BackupRun, S3Credential } from '../models/index.js'
import { serviceCreateQueue, backupQueue } from '../jobs/queues.js'
import {
  createDatabaseSchema,
  createBackupConfigSchema,
  testS3Schema,
  databaseIdSchema,
  backupConfigIdSchema,
} from '../schemas/database.schema.js'
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
import { sanitizeDatabase, sanitizeBackupPolicy, sanitizeRun, buildServerConfig, getOrCreateDefaultEnv } from '../utils/helpers.js'

export async function createDatabase(request) {
  const body = createDatabaseSchema.parse(request.body)

  const server = await Server.findById(body.serverId).lean()
  if (!server) return { error: 'Server not found', status: 404 }
  if (server.status !== 'CONNECTED') {
    return { error: `Server is not connected (status: ${server.status}).`, status: 400 }
  }

  const envId = body.environmentId ?? (await getOrCreateDefaultEnv(Project, request.user.id))._id

  const typeConfig = DB_CONFIGS[body.type]
  if (!typeConfig) {
    return { error: `Unsupported database type: ${body.type}`, status: 400 }
  }

  const existing = await Service.findOne({
    serverId: server._id,
    name: body.name,
    type: 'DATABASE'
  }).lean()

  if (existing) {
    return { error: `A database named "${body.name}" already exists on this server.`, status: 409 }
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

  return {
    success: true,
    data:    sanitizeDatabase(service),
    jobId:   job.id,
    status: 201,
  }
}

export async function listDatabases(request) {
  const { serverId } = request.query

  const query = { type: 'DATABASE' }
  if (serverId) {
    query.serverId = serverId
  }

  const services = await Service.find(query)
    .populate('server', 'id name ip status')
    .sort({ createdAt: -1 })
    .lean()

  const userServices = services.filter(svc => svc.server?.userId?.toString() === request.user.id)

  const servicesWithBackups = await Promise.all(userServices.map(async (svc) => {
    const policies = await BackupPolicy.find({ serviceId: svc._id })
      .populate('s3Credential')
      .sort({ createdAt: -1 })
      .lean()
    return { ...svc, backupConfigs: policies }
  }))

  return { success: true, data: servicesWithBackups.map(sanitizeDatabase) }
}

export async function getDatabase(request) {
  const { id } = databaseIdSchema.parse(request.params)

  const service = await Service.findById(id)
    .populate('server', 'id name ip status')
    .lean()

  if (!service) return { error: 'Database not found', status: 404 }

  const policies = await BackupPolicy.find({ serviceId: service._id })
    .populate('s3Credential')
    .sort({ createdAt: -1 })
    .lean()

  const policiesWithRuns = await Promise.all(policies.map(async (pol) => {
    const runs = await BackupRun.find({ backupPolicyId: pol._id })
      .sort({ createdAt: -1 })
      .limit(1)
      .lean()
    return { ...pol, runs }
  }))

  return { success: true, data: { ...service, backupConfigs: policiesWithRuns } }
}

export async function getDatabaseStatus(request) {
  const { id } = databaseIdSchema.parse(request.params)

  const service = await Service.findById(id)
    .populate('server')
    .lean()

  if (!service) return { error: 'Database not found', status: 404 }

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
      connectionString:   service.connectionString?.replace(/:([^@/]+)@/, ':****@'),
      publicPort:          service.exposedPort,
    },
  }
}

export async function getDatabaseStats(request) {
  const { id } = databaseIdSchema.parse(request.params)

  const service = await Service.findById(id)
    .populate('server')
    .lean()

  if (!service) return { error: 'Database not found', status: 404 }
  if (!service.containerName) {
    return { error: 'Database has no container yet', status: 400 }
  }

  const stats = await getContainerStats(buildServerConfig(service.server), service.containerName)
  return { success: true, data: stats }
}

export async function getDatabaseLogs(request) {
  const { id } = databaseIdSchema.parse(request.params)
  const tailRaw = parseInt(request?.query?.tail ?? '100', 10)
  const tail    = isNaN(tailRaw) ? 100 : Math.min(tailRaw, 500)

  const service = await Service.findById(id)
    .populate('server')
    .lean()

  if (!service) return { error: 'Database not found', status: 404 }
  if (!service.containerName) {
    return { error: 'Database has no container yet', status: 400 }
  }

  const logs = await getContainerLogs(buildServerConfig(service.server), service.containerName, tail)
  return { success: true, data: { logs } }
}

export async function startDatabase(request) {
  const { id } = databaseIdSchema.parse(request.params)

  const service = await Service.findById(id)
    .populate('server')
    .lean()

  if (!service) return { error: 'Database not found', status: 404 }
  if (!service.containerName) {
    return { error: 'No container to start', status: 400 }
  }

  const result = await startContainer(buildServerConfig(service.server), service.containerName)
  if (!result.success) return { success: false, message: 'Failed to start database' }

  await new Promise(r => setTimeout(r, 2000))
  const liveStatus = await getContainerStatus(buildServerConfig(service.server), service.containerName)
  if (liveStatus !== 'running') {
    return {
      success: false,
      message: 'Container started but exited immediately — check logs',
      status: 500,
    }
  }

  await Service.updateOne({ _id: id }, { $set: { status: 'RUNNING' } })
  return { success: true, message: 'Database started' }
}

export async function stopDatabase(request) {
  const { id } = databaseIdSchema.parse(request.params)

  const service = await Service.findById(id)
    .populate('server')
    .lean()

  if (!service) return { error: 'Database not found', status: 404 }
  if (!service.containerName) {
    return { error: 'No container to stop', status: 400 }
  }

  const result = await stopContainer(buildServerConfig(service.server), service.containerName)
  if (result.success) {
    await Service.updateOne({ _id: id }, { $set: { status: 'STOPPED' } })
  }

  return {
    success: result.success,
    message: result.success ? 'Database stopped' : 'Failed to stop database',
  }
}

export async function restartDatabase(request) {
  const { id } = databaseIdSchema.parse(request.params)

  const service = await Service.findById(id)
    .populate('server')
    .lean()

  if (!service) return { error: 'Database not found', status: 404 }
  if (!service.containerName) {
    return { error: 'No container to restart', status: 400 }
  }

  const result = await restartContainer(buildServerConfig(service.server), service.containerName)
  if (!result.success) return { success: false, message: 'Failed to restart database' }

  await new Promise(r => setTimeout(r, 2000))
  const liveStatus = await getContainerStatus(buildServerConfig(service.server), service.containerName)
  if (liveStatus !== 'running') {
    return {
      success: false,
      message: 'Container restarted but exited immediately — check logs',
      status: 500,
    }
  }

  await Service.updateOne({ _id: id }, { $set: { status: 'RUNNING' } })
  return { success: true, message: 'Database restarted' }
}

export async function deleteDatabase(request, app) {
  const { id } = databaseIdSchema.parse(request.params)

  const service = await Service.findById(id)
    .populate('server')
    .lean()

  if (!service) return { error: 'Database not found', status: 404 }

  if (service.containerName) {
    try {
      await removeContainer(buildServerConfig(service.server), service.containerName)
    } catch (err) {
      app?.log?.warn({ err, serviceId: id }, 'Failed to remove container — continuing delete')
    }
  }

  await Service.deleteOne({ _id: id })
  return { success: true, message: `Database "${service.name}" deleted.` }
}

export async function createBackupConfig(request) {
  const { id } = databaseIdSchema.parse(request.params)
  const body   = createBackupConfigSchema.parse(request.body)

  const service = await Service.findById(id)
    .populate('server')
    .lean()

  if (!service) return { error: 'Database not found', status: 404 }
  if (service.status !== 'RUNNING') {
    return { error: 'Database must be running to configure a backup', status: 400 }
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
    return { error: `S3 connection failed: ${s3Test.error}`, status: 400 }
  }

  const cred = await S3Credential.create({
    userId:    request.user.id,
    name:     `${service.name} backup — ${body.s3Bucket}`,
    endpoint: body.s3Endpoint || null,
    bucket:   body.s3Bucket,
    region:   body.s3Region,
    accessKey: body.s3AccessKey,
    secretKey: body.s3SecretKey,
  })

  const pol = await BackupPolicy.create({
    serviceId:      service._id,
    s3CredentialId: cred._id,
    schedule:      body.schedule ?? null,
    s3PathPrefix:  body.s3Path || service.name,
    backupType:    'FULL',
    retentionDays: 30,
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

  return {
    success: true,
    data:    sanitizeBackupPolicy({ ...policyWithCred, runs: execution ? [execution] : [] }),
    jobId,
    status: 201,
  }
}

export async function listBackupConfigs(request) {
  const { id } = databaseIdSchema.parse(request.params)

  const policies = await BackupPolicy.find({ serviceId: id })
    .populate('s3Credential')
    .sort({ createdAt: -1 })
    .lean()

  const policiesWithRuns = await Promise.all(policies.map(async (pol) => {
    const runs = await BackupRun.find({ backupPolicyId: pol._id })
      .sort({ createdAt: -1 })
      .limit(1)
      .lean()
    return { ...pol, runs }
  }))

  return { success: true, data: policiesWithRuns.map(sanitizeBackupPolicy) }
}

export async function listBackupExecutions(request) {
  const { id } = backupConfigIdSchema.parse(request.params)

  const runs = await BackupRun.find({ backupPolicyId: id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()

  return { success: true, data: runs.map(sanitizeRun) }
}

export async function triggerBackup(request) {
  const { id } = backupConfigIdSchema.parse(request.params)

  const policy = await BackupPolicy.findById(id).lean()
  if (!policy) return { error: 'Backup policy not found', status: 404 }

  const service = await Service.findById(policy.serviceId).lean()
  if (!service || service.status !== 'RUNNING') {
    return { error: 'Database must be running to trigger a backup', status: 400 }
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
}

export async function deleteBackupConfig(request) {
  const { id } = backupConfigIdSchema.parse(request.params)

  const policy = await BackupPolicy.findById(id).lean()
  if (!policy) return { error: 'Backup policy not found', status: 404 }

  await BackupPolicy.deleteOne({ _id: id })
  await S3Credential.deleteOne({ _id: policy.s3CredentialId })

  return { success: true, message: 'Backup configuration deleted.' }
}

export async function testS3ConnectionHandler(request) {
  const { id } = databaseIdSchema.parse(request.params)
  const body   = testS3Schema.parse(request.body)

  const service = await Service.findById(id)
    .populate('server')
    .lean()

  if (!service) return { error: 'Database not found', status: 404 }

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
}