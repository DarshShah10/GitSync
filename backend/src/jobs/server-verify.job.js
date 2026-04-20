import { Worker } from 'bullmq'
import { createRedisConnection } from '../db/redis.js'
import { prisma } from '../db/prisma.js'
import { QUEUE_NAMES } from './queues.js'
import { testConnection } from '../services/ssh.service.js'
import { ensureDockerReady } from '../services/docker.service.js'

async function processServerVerify(job) {
  const { serverId } = job.data
  const logs = []

  function log(message) {
    const line = `[${new Date().toISOString()}] ${message}`
    logs.push(line)
    job.log(line)
    console.log(line)
  }

  // Load server + credential
  const server = await prisma.server.findUnique({
    where:   { id: serverId },
    include: { credential: true },
  })

  if (!server) throw new Error(`Server ${serverId} not found in database.`)
  if (!server.credential) throw new Error(`Server ${serverId} has no credential record.`)

  log(`Starting verification for server: ${server.name} (${server.ip})`)

  console.log('[server-verify] Auth debug:', {
    serverId:    server.id,
    authType:    server.credential.authType,
    hasPassword: !!server.credential.sshPassword,
    hasKey:      !!server.credential.sshPrivateKey,
  })

  await prisma.server.update({
    where: { id: serverId },
    data:  { status: 'VERIFYING', errorMessage: null },
  })

  const serverConfig = {
    ip:         server.ip,
    port:       server.sshPort,
    username:   server.credential.sshUsername,
    authType:   server.credential.authType,       // 'SSH_KEY' | 'PASSWORD'
    password:   server.credential.sshPassword   ?? null,
    privateKey: server.credential.sshPrivateKey ?? null,
  }

  // ── Step 1: Test SSH connection ────────────────────────────────────────────
  log(`Step 1/2: Testing SSH connection (authType: ${server.credential.authType})...`)
  await job.updateProgress(10)

  const { ok, latencyMs, error: sshError } = await testConnection(serverConfig)

  if (!ok) {
    const message = sshError ?? 'SSH connection failed for unknown reason.'
    log(`SSH connection failed: ${message}`)

    await prisma.server.update({
      where: { id: serverId },
      data: {
        status:        'UNREACHABLE',
        errorMessage:  message,
        lastCheckedAt: new Date(),
      },
    })

    throw new Error(message)
  }

  log(`SSH connection successful. Latency: ${latencyMs}ms ✓`)
  await job.updateProgress(40)

  // ── Step 2: Ensure Docker ──────────────────────────────────────────────────
  log('Step 2/2: Checking Docker...')

  const docker = await ensureDockerReady(serverConfig, { onLog: (msg) => log(msg) })

  await job.updateProgress(80)

  if (!docker.ready) {
    const message = docker.error ?? 'Docker setup failed.'
    log(`Docker check failed: ${message}`)

    await prisma.server.update({
      where: { id: serverId },
      data: {
        status:        'ERROR',
        errorMessage:  message,
        lastCheckedAt: new Date(),
      },
    })

    throw new Error(message)
  }

  log(`Docker ${docker.version} confirmed. ✓`)
  log('Server verification complete. Status → CONNECTED')

  await prisma.server.update({
    where: { id: serverId },
    data: {
      status:        'CONNECTED',    // was READY — renamed in new schema
      dockerVersion: docker.version,
      errorMessage:  null,
      lastCheckedAt: new Date(),
    },
  })

  await job.updateProgress(100)

  return {
    serverId,
    status:        'CONNECTED',
    dockerVersion: docker.version,
    sshLatencyMs:  latencyMs,
  }
}

export function startServerVerifyWorker() {
  const worker = new Worker(
    QUEUE_NAMES.SERVER_VERIFY,
    processServerVerify,
    {
      connection:  createRedisConnection(),
      concurrency: 5,
    }
  )

  worker.on('completed', (job, result) => {
    console.log(`[server-verify] Job ${job.id} completed:`, result)
  })

  worker.on('failed', (job, err) => {
    console.error(`[server-verify] Job ${job?.id} failed:`, err.message)
  })

  worker.on('error', (err) => {
    console.error('[server-verify] Worker error:', err)
  })

  console.log('[server-verify] Worker started.')
  return worker
}
