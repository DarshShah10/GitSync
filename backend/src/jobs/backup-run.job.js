import { Worker } from 'bullmq'
import { createRedisConnection } from '../db/redis.js'
import { prisma } from '../db/prisma.js'
import { QUEUE_NAMES } from './queues.js'
import { runBackup } from '../services/backup.service.js'

async function processBackupRun(job) {
  const { backupId } = job.data
  const logs = []

  function log(message) {
    const line = `[${new Date().toISOString()}] ${message}`
    logs.push(line)
    job.log(line)
    console.log(line)
  }

  // Load backup with database and server
  const backup = await prisma.backup.findUnique({
    where: { id: backupId },
    include: {
      database: {
        include: { server: true },
      },
    },
  })

  if (!backup) throw new Error(`Backup ${backupId} not found`)

  const { database } = backup
  const { server } = database

  log(`Starting backup for ${database.name} (${database.type})`)
  log(`Target: s3://${backup.s3Bucket}/${backup.s3Path ?? database.name}/`)

  await prisma.backup.update({
    where: { id: backupId },
    data: { status: 'RUNNING', startedAt: new Date() },
  })

  await job.updateProgress(10)

  const serverConfig = {
    ip:         server.ip,
    port:       server.port,
    username:   server.username,
    authType:   server.authType,
    password:   server.password ?? null,
    privateKey: server.privateKey ?? null,
  }

  const dbConfig = {
    type:             database.type,
    name:             database.name,
    dbUser:           database.dbUser,
    dbPassword:       database.dbPassword,
    dbName:           database.dbName,
    internalPort:     database.internalPort,
    connectionString: database.connectionString,
    containerName:    database.containerName,
  }

  const backupConfig = {
    s3Endpoint:   backup.s3Endpoint,
    s3Bucket:     backup.s3Bucket,
    s3AccessKey:  backup.s3AccessKey,
    s3SecretKey:  backup.s3SecretKey,
    s3Region:     backup.s3Region,
    s3Path:       backup.s3Path,
  }

  await job.updateProgress(20)

  const { s3Key, sizeBytes } = await runBackup(
    serverConfig,
    dbConfig,
    backupConfig,
    { onLog: log }
  )

  await job.updateProgress(95)

  await prisma.backup.update({
    where: { id: backupId },
    data: {
      status:      'SUCCESS',
      s3Path:      s3Key,
      sizeBytes:   BigInt(sizeBytes),
      completedAt: new Date(),
      errorMessage: null,
    },
  })

  await job.updateProgress(100)
  log(`Backup complete: ${s3Key} ✓`)

  return { backupId, s3Key, sizeBytes }
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

    if (job?.data?.backupId) {
      try {
        await prisma.backup.update({
          where: { id: job.data.backupId },
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