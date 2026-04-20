import { Worker } from 'bullmq'
import { createRedisConnection } from '../db/redis.js'
import { Service, Server } from '../models/index.js'
import { QUEUE_NAMES } from './queues.js'
import {
  provisionDatabase,
  findFreePort,
  buildConnectionStrings,
  DB_CONFIGS,
} from '../services/database.service.js'

async function processServiceCreate(job) {
  const { serviceId } = job.data
  const logs = []

  function log(message) {
    const line = `[${new Date().toISOString()}] ${message}`
    logs.push(line)
    job.log(line)
    console.log(line)
  }

  const service = await Service.findById(serviceId).lean()
  if (!service) throw new Error(`Service ${serviceId} not found`)

  const server = await Server.findById(service.serverId).lean()
  if (!server) throw new Error(`Server ${service.serverId} not found`)
  if (!server.credential) throw new Error(`Server has no credential record`)
  if (server.status !== 'CONNECTED') {
    throw new Error(
      `Server ${server.name} is not connected (status: ${server.status}).`
    )
  }

  const cfg = service.config
  if (!cfg?.dbEngine) throw new Error(`Service ${serviceId} has no dbEngine in config`)

  const typeConfig = DB_CONFIGS[cfg.dbEngine]
  if (!typeConfig) throw new Error(`Unsupported database engine: ${cfg.dbEngine}`)

  log(`Provisioning ${cfg.dbEngine} database: ${service.name}`)
  log(`Server: ${server.name} (${server.ip})`)

  await job.updateProgress(5)

  const serverConfig = {
    ip:         server.ip,
    port:       server.sshPort,
    username:   server.credential.sshUsername,
    authType:   server.credential.authType,
    password:   server.credential.sshPassword   ?? null,
    privateKey: server.credential.sshPrivateKey ?? null,
  }

  log('Finding available port…')
  const publicPort = await findFreePort(serverConfig, 20000, 30000)
  log(`Assigned public port: ${publicPort}`)

  await job.updateProgress(15)

  await Service.updateOne(
    { _id: serviceId },
    { $set: { exposedPort: publicPort, isPublic: true } }
  )

  const dbCfg = {
    name:         service.name,
    type:         cfg.dbEngine,
    dbUser:       cfg.dbUser   ?? 'gitsync',
    dbPassword:   cfg.dbPassword,
    dbName:       cfg.dbName,
    publicPort,
    ip:           server.ip,
    internalPort: typeConfig.internalPort,
  }

  await job.updateProgress(20)

  const { containerId, containerName, volumeName } = await provisionDatabase(
    serverConfig,
    dbCfg,
    { onLog: log }
  )

  await job.updateProgress(85)

  const { external } = buildConnectionStrings(cfg.dbEngine, {
    ...dbCfg,
    ip: server.ip,
  })

  log('Connection string built.')

  await Service.updateOne(
    { _id: serviceId },
    {
      $set: {
        status:           'RUNNING',
        containerId,
        containerName,
        volumeName,
        internalPort:     typeConfig.internalPort,
        exposedPort:      publicPort,
        isPublic:         true,
        connectionString: external,
        errorMessage:     null,
        lastHealthCheckAt: new Date(),
      }
    }
  )

  await job.updateProgress(100)
  log(`Database ${service.name} provisioned successfully.`)

  return { serviceId, containerId, containerName, volumeName, publicPort, connectionString: external }
}

export function startServiceCreateWorker() {
  const worker = new Worker(
    QUEUE_NAMES.SERVICE_CREATE,
    processServiceCreate,
    {
      connection:  createRedisConnection(),
      concurrency: 3,
    }
  )

  worker.on('completed', (job, result) => {
    console.log(`[service-create] Job ${job.id} completed:`, result.serviceId)
  })

  worker.on('failed', async (job, err) => {
    console.error(`[service-create] Job ${job?.id} failed:`, err.message)

    if (job?.data?.serviceId) {
      try {
        await Service.updateOne(
          { _id: job.data.serviceId },
          {
            $set: {
              status:       'ERROR',
              errorMessage: err.message,
              exposedPort:  null,
              isPublic:     false,
            }
          }
        )
      } catch (_) {}
    }
  })

  worker.on('error', (err) => {
    console.error('[service-create] Worker error:', err)
  })

  console.log('[service-create] Worker started.')
  return worker
}

export { startServiceCreateWorker as startDatabaseCreateWorker }