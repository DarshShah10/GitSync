import { Worker } from 'bullmq'
import { createRedisConnection } from '../db/redis.js'
import { prisma } from '../db/prisma.js'
import { QUEUE_NAMES } from './queues.js'
import { runCommand } from '../services/ssh.service.js'

/**
 * Runs every 60 seconds (repeatable BullMQ job).
 *
 * For every CONNECTED server, SSHs in and gets the list of running Docker containers.
 * Compares against our service records and syncs status:
 *   - DB says RUNNING but container is gone  → mark STOPPED
 *   - DB says STOPPED but container is found → mark RUNNING
 *
 * Also marks servers UNREACHABLE if SSH fails, and updates lastCheckedAt.
 */
async function processServerCheck(job) {
  const servers = await prisma.server.findMany({
    where:   { status: 'CONNECTED' },
    include: {
      credential: true,
      services: {
        where: {
          type:          'DATABASE',
          status:        { in: ['RUNNING', 'STOPPED'] },
          containerName: { not: null },
        },
      },
    },
  })

  let serversChecked = 0
  let statusUpdated  = 0

  for (const server of servers) {
    if (!server.credential) continue

    const serverConfig = {
      ip:         server.ip,
      port:       server.sshPort,
      username:   server.credential.sshUsername,
      authType:   server.credential.authType,
      password:   server.credential.sshPassword   ?? null,
      privateKey: server.credential.sshPrivateKey ?? null,
    }

    try {
      const { stdout, code } = await runCommand(
        serverConfig,
        `docker ps --no-trunc --format '{{.Names}}' 2>/dev/null`,
        { timeout: 15000 }
      )

      if (code !== 0) continue

      const runningContainers = new Set(
        stdout.split('\n').map(s => s.trim()).filter(Boolean)
      )

      serversChecked++

      // Update lastCheckedAt on successful SSH
      await prisma.server.update({
        where: { id: server.id },
        data:  { lastCheckedAt: new Date() },
      })

      for (const svc of server.services) {
        const isRunning = runningContainers.has(svc.containerName)

        if (svc.status === 'RUNNING' && !isRunning) {
          await prisma.service.update({
            where: { id: svc.id },
            data:  { status: 'STOPPED' },
          })
          console.log(`[server-check] ${svc.name} on ${server.name}: RUNNING → STOPPED (container gone)`)
          statusUpdated++
        } else if (svc.status === 'STOPPED' && isRunning) {
          await prisma.service.update({
            where: { id: svc.id },
            data:  { status: 'RUNNING', lastHealthCheckAt: new Date() },
          })
          console.log(`[server-check] ${svc.name} on ${server.name}: STOPPED → RUNNING (container found)`)
          statusUpdated++
        } else if (svc.status === 'RUNNING' && isRunning) {
          // Still running — just update health check timestamp
          await prisma.service.update({
            where: { id: svc.id },
            data:  { lastHealthCheckAt: new Date() },
          })
        }
      }
    } catch (err) {
      // Don't fail the whole job if one server is temporarily unreachable
      console.error(`[server-check] Error checking server ${server.name} (${server.ip}):`, err.message)

      try {
        await prisma.server.update({
          where: { id: server.id },
          data:  { status: 'UNREACHABLE', lastCheckedAt: new Date() },
        })
      } catch (_) {}
    }
  }

  return { serversChecked, statusUpdated }
}

export function startServerCheckWorker() {
  const worker = new Worker(
    QUEUE_NAMES.SERVER_CHECK,
    processServerCheck,
    {
      connection:  createRedisConnection(),
      concurrency: 1, // only one check run at a time — avoid overlapping SSH sessions
    }
  )

  worker.on('completed', (job, result) => {
    if (result.statusUpdated > 0) {
      console.log(
        `[server-check] Job ${job.id}: checked ${result.serversChecked} server(s), ` +
        `updated ${result.statusUpdated} status(es)`
      )
    }
  })

  worker.on('failed', (job, err) => {
    console.error(`[server-check] Job ${job?.id} failed:`, err.message)
  })

  worker.on('error', (err) => {
    console.error('[server-check] Worker error:', err)
  })

  console.log('[server-check] Worker started.')
  return worker
}
