import { Worker } from 'bullmq'
import { createRedisConnection } from '../db/redis.js'
import { BackupPolicy, BackupRun, Service, Server, S3Credential } from '../models/index.js'
import { QUEUE_NAMES } from './queues.js'
import { runBackup } from '../services/backup.service.js'

async function processBackupRun(job) {
  const { policyId, runId } = job.data
  const logs = []

  function log(message) {
    const line = `[${new Date().toISOString()}] ${message}`
    logs.push(line)
    job.log(line)
    console.log(line)
  }

  const policy = await BackupPolicy.findById(policyId).lean()
  if (!policy) throw new Error(`BackupPolicy ${policyId} not found`)

  const s3Cred = await S3Credential.findById(policy.s3CredentialId).lean()
  if (!s3Cred) throw new Error(`BackupPolicy ${policyId} has no S3 credential`)

  const service = await Service.findById(policy.serviceId).lean()
  if (!service) throw new Error(`Service ${policy.serviceId} not found`)

  const server = await Server.findById(service.serverId).lean()
  if (!server) throw new Error(`Server ${service.serverId} not found`)

  if (service.status !== 'RUNNING') {
    throw new Error(
      `Database "${service.name}" is not running (status: ${service.status}). Cannot run backup.`
    )
  }

  const cfg = service.config ?? {}

  log(`Starting backup for ${service.name} (${cfg.dbEngine})`)
  log(`Target: s3://${s3Cred.bucket}/${policy.s3PathPrefix ?? service.name}/`)

  await BackupRun.updateOne(
    { _id: runId },
    { $set: { status: 'RUNNING', startedAt: new Date() } }
  )

  await job.updateProgress(10)

  const serverConfig = {
    ip:         server.ip,
    port:       server.sshPort,
    username:   server.credential?.sshUsername ?? 'root',
    authType:   server.credential?.authType ?? 'PASSWORD',
    password:   server.credential?.sshPassword   ?? null,
    privateKey: server.credential?.sshPrivateKey ?? null,
  }

  const dbConfig = {
    type:          cfg.dbEngine,
    name:          service.name,
    dbUser:        cfg.dbUser,
    dbPassword:    cfg.dbPassword,
    dbName:        cfg.dbName,
    internalPort:  service.internalPort,
    containerName: service.containerName,
  }

  const backupConfig = {
    s3Endpoint:  s3Cred.endpoint  ?? null,
    s3Bucket:    s3Cred.bucket,
    s3AccessKey: s3Cred.accessKey,
    s3SecretKey: s3Cred.secretKey,
    s3Region:    s3Cred.region,
    s3Path:      policy.s3PathPrefix ?? service.name,
  }

  await job.updateProgress(20)

  const { s3Key, sizeBytes } = await runBackup(
    serverConfig,
    dbConfig,
    backupConfig,
    { onLog: log }
  )

  await job.updateProgress(95)

  await BackupRun.updateOne(
    { _id: runId },
    {
      $set: {
        status:       'SUCCESS',
        s3Key,
        sizeBytes:    sizeBytes,
        completedAt:  new Date(),
        errorMessage: null,
      }
    }
  )

  await job.updateProgress(100)
  log(`Backup complete: ${s3Key}`)

  return { policyId, runId, s3Key, sizeBytes }
}

export function startBackupWorker() {
  const worker = new Worker(
    QUEUE_NAMES.BACKUP_RUN,
    processBackupRun,
    {
      connection:  createRedisConnection(),
      concurrency: 2,
    }
  )

  worker.on('completed', (job, result) => {
    console.log(`[backup] Job ${job.id} completed:`, result.s3Key)
  })

  worker.on('failed', async (job, err) => {
    console.error(`[backup] Job ${job?.id} failed:`, err.message)

    if (job?.data?.runId) {
      try {
        await BackupRun.updateOne(
          { _id: job.data.runId },
          {
            $set: {
              status:       'FAILED',
              errorMessage: err.message,
              completedAt:  new Date(),
            }
          }
        )
      } catch (_) {}
    }
  })

  worker.on('error', (err) => {
    console.error('[backup] Worker error:', err)
  })

  console.log('[backup] Worker started.')
  return worker
}