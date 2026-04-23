import { Worker }     from 'bullmq'
import { createRedisConnection } from '../db/redis.js'
import { Service, Server, Deployment, DeploymentLog } from '../models/index.js'
import { QUEUE_NAMES } from './queues.js'
import { buildServerConfig } from '../utils/index.js'
import {
  ensurePlatformNetwork,
  ensureNginxProxy,
  cloneRepo,
  buildImage,
  removeOldContainer,
  runContainer,
  writeNginxConfig,
  cleanupBuild,
  installNixpacks,
  buildServiceNames,
} from '../services/app.service.js'
import { GitHubSource } from '../models/githubSource.model.js'
import {
  getInstallationToken,
  buildAuthenticatedCloneUrl,
} from '../services/github.service.js'

// ─────────────────────────────────────────────────────────────────────────────
// app-deploy.job.js
//
// BullMQ worker that runs the full deployment pipeline:
//
//   QUEUED → BUILDING → DEPLOYING → SUCCESS
//                ↓           ↓
//             FAILED      FAILED
//
// Job data: { deploymentId }
// All log lines are saved to DeploymentLog for SSE streaming.
// ─────────────────────────────────────────────────────────────────────────────

async function processAppDeploy(job) {
  const { deploymentId } = job.data
  let logLineNumber = 0

  // ── Helper: save a log line to MongoDB (SSE reads from here) ──────────────
  async function log(output, isError = false) {
    logLineNumber++
    job.log(output)   // also stored in BullMQ for debug

    try {
      await DeploymentLog.create({
        deploymentId,
        line:    logLineNumber,
        output,
        isError,
      })
    } catch (_) {
      // Non-fatal — don't crash the job over a log write failure
    }
  }

  // ── Load deployment + service + server ───────────────────────────────────
  const deployment = await Deployment.findById(deploymentId)
  if (!deployment) throw new Error(`Deployment ${deploymentId} not found`)

  const service = await Service.findById(deployment.serviceId)
  if (!service) throw new Error(`Service ${deployment.serviceId} not found`)

  const server = await Server.findById(service.serverId)
  if (!server) throw new Error(`Server ${service.serverId} not found`)
  if (!server.credential) throw new Error(`Server has no SSH credentials`)
  if (server.status !== 'CONNECTED') {
    throw new Error(`Server "${server.name}" is not connected (status: ${server.status})`)
  }

  const serverConfig = buildServerConfig(server)

  const cfg          = service.config ?? {}
  const repoUrl      = cfg.repoUrl
  const branch       = cfg.branch   || 'main'
  const baseDir      = cfg.baseDir  || '/'
  const buildPack    = deployment.buildPack || cfg.buildPack || 'NIXPACKS'
  const internalPort = service.internalPort || 3000
  const domain       = service.domain

  if (!repoUrl) throw new Error('Service has no repoUrl in config')
  if (!domain)  throw new Error('Service has no domain set — save a domain in Configuration first')

  // ── For private repos, get an installation access token ───────────────────
  let authenticatedRepoUrl = repoUrl
  if (service.repoType === 'private' && service.githubSourceId) {
    await log('[0/7] Fetching GitHub App installation token for private repo…')
    const source = await GitHubSource.findById(service.githubSourceId)
    if (!source || !source.isConnected) {
      throw new Error('GitHub App source is not connected. Re-check the source in Sources page.')
    }
    try {
      const { token } = await getInstallationToken(
        source.appId,
        source.installationId,
        source.privateKey,
        source.apiUrl || 'https://api.github.com'
      )
      authenticatedRepoUrl = buildAuthenticatedCloneUrl(repoUrl, token)
      await log('Installation token acquired. ✓')
    } catch (tokenErr) {
      throw new Error(`Failed to get GitHub installation token: ${tokenErr.message}`)
    }
  }

  // Build consistent container/image names from serviceId
  const { containerName, imageName } = buildServiceNames(service._id, service.name)
  const oldImageName = service.imageName   // for cleanup after successful deploy

  await log(`═══════════════════════════════════════`)
  await log(`  Deploying: ${service.name}`)
  await log(`  Server:    ${server.name} (${server.ip})`)
  await log(`  Repo:      ${repoUrl}${service.repoType === 'private' ? ' (private)' : ''}`)
  await log(`  Branch:    ${branch}`)
  await log(`  BuildPack: ${buildPack}`)
  await log(`  Domain:    ${domain}`)
  await log(`═══════════════════════════════════════`)

  // ── Mark deployment as BUILDING ──────────────────────────────────────────
  await Deployment.updateOne(
    { _id: deploymentId },
    { $set: { status: 'BUILDING', startedAt: new Date() } }
  )
  await Service.updateOne(
    { _id: service._id },
    { $set: { status: 'BUILDING' } }
  )

  await job.updateProgress(5)

  // ── Step 1: Ensure platform network + nginx exist ─────────────────────────
  await log('[1/7] Ensuring platform infrastructure…')
  await ensurePlatformNetwork(serverConfig, { onLog: log })
  await ensureNginxProxy(serverConfig,     { onLog: log })
  await job.updateProgress(10)

  // ── Step 2: Clone repo ────────────────────────────────────────────────────
  await log('[2/7] Cloning repository…')
  const { buildDir, workDir } = await cloneRepo(
    serverConfig,
    { deploymentId: deploymentId.toString(), repoUrl: authenticatedRepoUrl, branch, baseDir },
    { onLog: log, onStdout: (l) => log(l) }
  )
  await job.updateProgress(25)

  if (buildPack === 'NIXPACKS') {
    await log('[2.5/7] Ensuring Nixpacks is installed…')
    await installNixpacks(serverConfig, { onLog: log })
  }

  // ── Step 3: Build image ───────────────────────────────────────────────────
  await log('[3/7] Building image…')
  const { imageTag, commitHash, isStatic } = await buildImage(
    serverConfig,
    { workDir, imageName, buildPack },
    { onLog: log, onStdout: (l) => log(l) }
  )
  await job.updateProgress(65)

  // ── Step 4: Mark as DEPLOYING ─────────────────────────────────────────────
  await log('[4/7] Switching to new container…')
  await Deployment.updateOne(
    { _id: deploymentId },
    { $set: { status: 'DEPLOYING', builtImageName: imageTag, commitHash } }
  )
  await Service.updateOne(
    { _id: service._id },
    { $set: { status: 'DEPLOYING' } }
  )

  // ── Step 5: Stop old container, start new one ─────────────────────────────
  await removeOldContainer(serverConfig, containerName, { onLog: log })

  let containerId = null
  if (!isStatic) {
    const result = await runContainer(
      serverConfig,
      {
        containerName,
        imageName,
        imageTag,
        internalPort,
        envVars: service.envVars ?? [],
      },
      { onLog: log }
    )
    containerId = result.containerId
  }
  await job.updateProgress(80)

  // ── Step 6: Write Nginx config and reload ─────────────────────────────────
  await log('[5/7] Configuring Nginx…')
  const { confFile } = await writeNginxConfig(
    serverConfig,
    { containerName, internalPort, domain },
    { onLog: log }
  )
  await job.updateProgress(90)

  // ── Step 7: Cleanup build files + old Docker image ───────────────────────
  await log('[6/7] Cleaning up…')
  await cleanupBuild(serverConfig, { buildDir, oldImageName }, { onLog: log })
  await job.updateProgress(95)

  // ── Mark SUCCESS ──────────────────────────────────────────────────────────
  await log('[7/7] Finalising…')

  const now = new Date()
  console.log("first")
  await Deployment.updateOne(
    { _id: deploymentId },
    {
      $set: {
        status:      'SUCCESS',
        finishedAt:  now,
        commitHash:  commitHash ?? null,
        builtImageName: imageTag ?? null,
      },
    }
  )
console.log("second")
  await Service.updateOne(
    { _id: service._id },
    {
      $set: {
        status:          'RUNNING',
        containerId:     containerId ?? null,
        containerName,
        imageName:       imageTag ?? null,
        nginxConfigFile: confFile,
        lastCommitHash:  commitHash ?? null,
        lastDeployedAt:  now,
        errorMessage:    null,
        healthStatus:    'UNKNOWN',   // health check worker will update this
      },
    }
  )
console.log("third")
  await job.updateProgress(100)
  console.log("fourth")
  await log(`✓ Deployment complete! App live at: http://${domain}`)
  await log(`═══════════════════════════════════════`)

  return {
    deploymentId: deploymentId.toString(),
    serviceId:    service._id.toString(),
    domain,
    url:          `http://${domain}`,
    containerId,
    commitHash,
  }
}

// ── Worker ────────────────────────────────────────────────────────────────────

export function startAppDeployWorker() {
  const worker = new Worker(
    QUEUE_NAMES.APP_DEPLOY,
    processAppDeploy,
    {
      connection:  createRedisConnection(),
      concurrency: 2,   // max 2 concurrent deployments
    }
  )

  worker.on('active', async (job) => {
    console.log(`[app-deploy] Job ${job.id} started — deploymentId: ${job.data.deploymentId}`)
  })

  worker.on('completed', async (job, result) => {
    console.log(`[app-deploy] Job ${job.id} completed — url: ${result?.url}`)
  })

  worker.on('failed', async (job, err) => {
    console.error(`[app-deploy] Job ${job?.id} failed:`, err.message)

    if (!job?.data?.deploymentId) return

    const deploymentId = job.data.deploymentId

    try {
      // Save error to DeploymentLog
      await DeploymentLog.create({
        deploymentId,
        line:    9999,
        output:  `✗ Deployment failed: ${err.message}`,
        isError: true,
      })

      // Mark deployment + service as FAILED
      await Deployment.updateOne(
        { _id: deploymentId },
        {
          $set: {
            status:       'FAILED',
            finishedAt:   new Date(),
            errorMessage: err.message,
          },
        }
      )

      // Get serviceId from deployment to update service status
      const deployment = await Deployment.findById(deploymentId).lean()
      if (deployment?.serviceId) {
        await Service.updateOne(
          { _id: deployment.serviceId },
          {
            $set: {
              status:       'ERROR',
              errorMessage: err.message,
            },
          }
        )
      }
    } catch (updateErr) {
      console.error('[app-deploy] Failed to update status after job failure:', updateErr.message)
    }
  })

  return worker
}