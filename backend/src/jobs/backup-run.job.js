import { Worker } from 'bullmq'
import { createRedisConnection } from '../db/redis.js'
import { prisma } from '../db/prisma.js'
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

  // Load BackupPolicy → S3Credential + Service → Server + Credential
  const policy = await prisma.backupPolicy.findUnique({
    where:   { id: policyId },
    include: {
      s3Credential: true,
      service: {
        include: { server: { include: { credential: true } } },
      },
    },
  })

  if (!policy)             throw new Error(`BackupPolicy ${policyId} not found`)
  if (!policy.s3Credential) throw new Error(`BackupPolicy ${policyId} has no S3 credential`)

  const { service }  = policy
  const { server }   = service

  // Re-check service status at job pickup
  if (service.status !== 'RUNNING') {
    throw new Error(
      `Database "${service.name}" is not running (status: ${service.status}). Cannot run backup.`
    )
  }

  const cfg = service.config ?? {}

  log(`Starting backup for ${service.name} (${cfg.dbEngine})`)
  log(`Target: s3://${policy.s3Credential.bucket}/${policy.s3PathPrefix ?? service.name}/`)

  // Mark the run as RUNNING
  await prisma.backupRun.update({
    where: { id: runId },
    data:  { status: 'RUNNING', startedAt: new Date() },
  })

  await job.updateProgress(10)

  const serverConfig = {
    ip:         server.ip,
    port:       server.sshPort,
    username:   server.credential.sshUsername,
    authType:   server.credential.authType,
    password:   server.credential.sshPassword   ?? null,
    privateKey: server.credential.sshPrivateKey ?? null,
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

  // Map new S3Credential field names → the interface backup.service.js expects
  const backupConfig = {
    s3Endpoint:  policy.s3Credential.endpoint  ?? null,
    s3Bucket:    policy.s3Credential.bucket,
    s3AccessKey: policy.s3Credential.accessKey,
    s3SecretKey: policy.s3Credential.secretKey,
    s3Region:    policy.s3Credential.region,
    s3Path:      policy.s3PathPrefix ?? service.name, // folder prefix — runBackup appends filename
  }

  await job.updateProgress(20)

  const { s3Key, sizeBytes } = await runBackup(
    serverConfig,
    dbConfig,
    backupConfig,
    { onLog: log }
  )

  await job.updateProgress(95)

  await prisma.backupRun.update({
    where: { id: runId },
    data: {
      status:       'SUCCESS',
      s3Key,                          // full object key — policy.s3PathPrefix is never overwritten
      sizeBytes:    BigInt(sizeBytes),
      completedAt:  new Date(),
      errorMessage: null,
    },
  })

  await job.updateProgress(100)
  log(`Backup complete: ${s3Key} ✓`)

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
        await prisma.backupRun.update({
          where: { id: job.data.runId },
          data: {
            status:       'FAILED',
            errorMessage: err.message,
            completedAt:  new Date(),
          },
        })
      } catch (_) {}
    }
  })

  worker.on('error', (err) => {
    console.error('[backup] Worker error:', err)
  })

  console.log('[backup] Worker started.')
  return worker
}
