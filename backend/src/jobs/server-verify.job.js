// import { Worker } from 'bullmq'
// import { createRedisConnection } from '../db/redis.js'
// import { Server } from '../models/index.js'
// import { QUEUE_NAMES } from './queues.js'
// import { testConnection } from '../services/ssh.service.js'
// import { ensureDockerReady } from '../services/docker.service.js'

// async function processServerVerify(job) {
//   const { serverId } = job.data

//   function log(message) {
//     job.log(message)
//   }

//   const server = await Server.findById(serverId).lean()

//   if (!server) throw new Error(`Server ${serverId} not found in database.`)
//   if (!server.credential) throw new Error(`Server ${serverId} has no credential record.`)

//   log(`Starting verification for server: ${server.name} (${server.ip})`)

//   await Server.updateOne(
//     { _id: serverId },
//     { $set: { status: 'VERIFYING', errorMessage: null } }
//   )

//   const serverConfig = {
//     ip:         server.ip,
//     port:       server.sshPort,
//     username:   server.credential.sshUsername,
//     authType:   server.credential.authType,
//     password:   server.credential.sshPassword   ?? null,
//     privateKey: server.credential.sshPrivateKey ?? null,
//   }

//   log(`Step 1/2: Testing SSH connection (authType: ${server.credential.authType})...`)
//   await job.updateProgress(10)

//   const { ok, latencyMs, error: sshError } = await testConnection(serverConfig)

//   if (!ok) {
//     const message = sshError ?? 'SSH connection failed for unknown reason.'
//     log(`SSH connection failed: ${message}`)

//     await Server.updateOne(
//       { _id: serverId },
//       {
//         $set: {
//           status:        'UNREACHABLE',
//           errorMessage:  message,
//           lastCheckedAt: new Date(),
//         }
//       }
//     )

//     throw new Error(message)
//   }

//   log(`SSH connection successful. Latency: ${latencyMs}ms`)
//   await job.updateProgress(40)

//   log('Step 2/2: Checking Docker...')

//   const docker = await ensureDockerReady(serverConfig, { onLog: (msg) => log(msg) })

//   await job.updateProgress(80)

//   if (!docker.ready) {
//     const message = docker.error ?? 'Docker setup failed.'
//     log(`Docker check failed: ${message}`)

//     await Server.updateOne(
//       { _id: serverId },
//       {
//         $set: {
//           status:        'ERROR',
//           errorMessage:  message,
//           lastCheckedAt: new Date(),
//         }
//       }
//     )

//     throw new Error(message)
//   }

//   log(`Docker ${docker.version} confirmed.`)
//   log('Server verification complete. Status → CONNECTED')

//   await Server.updateOne(
//     { _id: serverId },
//     {
//       $set: {
//         status:        'CONNECTED',
//         dockerVersion: docker.version,
//         errorMessage:  null,
//         lastCheckedAt: new Date(),
//       }
//     }
//   )

//   await job.updateProgress(100)

//   return {
//     serverId,
//     status:        'CONNECTED',
//     dockerVersion: docker.version,
//     sshLatencyMs:  latencyMs,
//   }
// }

// export function startServerVerifyWorker() {
//   const worker = new Worker(
//     QUEUE_NAMES.SERVER_VERIFY,
//     processServerVerify,
//     {
//       connection:  createRedisConnection(),
//       concurrency: 5,
//     }
//   )

//   worker.on('failed', (job, err) => {
//     job.log(`Job failed: ${err.message}`)
//   })

//   return worker
// }


import { Worker } from 'bullmq'
import { createRedisConnection } from '../db/redis.js'
import { Server } from '../models/index.js'
import { QUEUE_NAMES } from './queues.js'
import { testConnection } from '../services/ssh.service.js'
import { ensureDockerReady } from '../services/docker.service.js'
import { installNixpacks } from '../services/app.service.js'

async function processServerVerify(job) {
  const { serverId } = job.data

  function log(message) {
    job.log(message)
  }

  const server = await Server.findById(serverId).lean()

  if (!server) throw new Error(`Server ${serverId} not found in database.`)
  if (!server.credential) throw new Error(`Server ${serverId} has no credential record.`)

  log(`Starting verification for server: ${server.name} (${server.ip})`)

  await Server.updateOne(
    { _id: serverId },
    { $set: { status: 'VERIFYING', errorMessage: null } }
  )

  const serverConfig = {
    ip:         server.ip,
    port:       server.sshPort,
    username:   server.credential.sshUsername,
    authType:   server.credential.authType,
    password:   server.credential.sshPassword   ?? null,
    privateKey: server.credential.sshPrivateKey ?? null,
  }

  // ── Step 1: Test SSH connection ───────────────────────────────────────────
  log(`Step 1/3: Testing SSH connection (authType: ${server.credential.authType})...`)
  await job.updateProgress(10)

  const { ok, latencyMs, error: sshError } = await testConnection(serverConfig)

  if (!ok) {
    const message = sshError ?? 'SSH connection failed for unknown reason.'
    log(`SSH connection failed: ${message}`)

    await Server.updateOne(
      { _id: serverId },
      {
        $set: {
          status:        'UNREACHABLE',
          errorMessage:  message,
          lastCheckedAt: new Date(),
        }
      }
    )

    throw new Error(message)
  }

  log(`SSH connection successful. Latency: ${latencyMs}ms`)
  await job.updateProgress(30)

  // ── Step 2: Check Docker ──────────────────────────────────────────────────
  log('Step 2/3: Checking Docker...')

  const docker = await ensureDockerReady(serverConfig, { onLog: (msg) => log(msg) })

  await job.updateProgress(60)

  if (!docker.ready) {
    const message = docker.error ?? 'Docker setup failed.'
    log(`Docker check failed: ${message}`)

    await Server.updateOne(
      { _id: serverId },
      {
        $set: {
          status:        'ERROR',
          errorMessage:  message,
          lastCheckedAt: new Date(),
        }
      }
    )

    throw new Error(message)
  }

  log(`Docker ${docker.version} confirmed.`)
  await job.updateProgress(65)

  // ── Step 3: Install Nixpacks ──────────────────────────────────────────────
  log('Step 3/3: Checking Nixpacks...')

  try {
    await installNixpacks(serverConfig, { onLog: (msg) => log(msg) })
  } catch (nixErr) {
    // Nixpacks failure is non-fatal for server verification —
    // the server is still usable for Dockerfile builds.
    // We log the warning but don't fail the whole job.
    log(`⚠ Nixpacks install warning: ${nixErr.message}`)
    log('Server marked CONNECTED — Nixpacks builds may fail until resolved.')
  }

  await job.updateProgress(95)

  // ── Done ──────────────────────────────────────────────────────────────────
  log('Server verification complete. Status → CONNECTED')

  await Server.updateOne(
    { _id: serverId },
    {
      $set: {
        status:        'CONNECTED',
        dockerVersion: docker.version,
        errorMessage:  null,
        lastCheckedAt: new Date(),
      }
    }
  )

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

  worker.on('failed', (job, err) => {
    job.log(`Job failed: ${err.message}`)
  })

  return worker
}