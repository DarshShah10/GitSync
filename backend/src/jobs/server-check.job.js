import { Worker } from 'bullmq'
import { createRedisConnection } from '../db/redis.js'
import { Server, Service } from '../models/index.js'
import { QUEUE_NAMES } from './queues.js'
import { runCommand } from '../services/ssh.service.js'

async function processServerCheck(job) {
  const servers = await Server.find({ status: 'CONNECTED' }).lean()

  let serversChecked = 0
  let statusUpdated = 0

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

      await Server.updateOne(
        { _id: server._id },
        { $set: { lastCheckedAt: new Date() } }
      )

      const services = await Service.find({
        serverId: server._id,
        type:          'DATABASE',
        status:        { $in: ['RUNNING', 'STOPPED'] },
        containerName: { $ne: null },
      }).lean()

      for (const svc of services) {
        const isRunning = runningContainers.has(svc.containerName)

        if (svc.status === 'RUNNING' && !isRunning) {
          await Service.updateOne(
            { _id: svc._id },
            { $set: { status: 'STOPPED' } }
          )
          console.log(`[server-check] ${svc.name} on ${server.name}: RUNNING → STOPPED (container gone)`)
          statusUpdated++
        } else if (svc.status === 'STOPPED' && isRunning) {
          await Service.updateOne(
            { _id: svc._id },
            { $set: { status: 'RUNNING', lastHealthCheckAt: new Date() } }
          )
          console.log(`[server-check] ${svc.name} on ${server.name}: STOPPED → RUNNING (container found)`)
          statusUpdated++
        } else if (svc.status === 'RUNNING' && isRunning) {
          await Service.updateOne(
            { _id: svc._id },
            { $set: { lastHealthCheckAt: new Date() } }
          )
        }
      }
    } catch (err) {
      console.error(`[server-check] Error checking server ${server.name} (${server.ip}):`, err.message)

      try {
        await Server.updateOne(
          { _id: server._id },
          { $set: { status: 'UNREACHABLE', lastCheckedAt: new Date() } }
        )
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
      concurrency: 1,
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