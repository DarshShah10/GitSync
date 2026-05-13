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
import { runCommand } from '../services/ssh.service.js'

// ─────────────────────────────────────────────────────────────────────────────
// app-deploy.job.js
//
// BullMQ worker that runs the full deployment pipeline.
// Supports four build strategies determined by service.config.buildPack:
//
//   NIXPACKS     — clone repo → nixpacks build → run container
//   STATIC       — clone repo → nixpacks build (static) → nginx serve
//   DOCKERFILE   — clone repo → docker build -f Dockerfile → run container
//   DOCKER_IMAGE — docker pull image → run container  (no clone/build step)
//
//   QUEUED → BUILDING → DEPLOYING → SUCCESS
//                ↓           ↓
//             FAILED      FAILED
//
// Job data: { deploymentId }
// All log lines are saved to DeploymentLog for SSE streaming.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Docker-image-specific helpers ───────────────────────────────────────────

/**
 * Log in to a private Docker registry on the remote server (if creds provided).
 */
async function dockerRegistryLogin(serverConfig, { registryUrl, registryUser, registryPassword }, log) {
  if (!registryUser || !registryPassword) return

  const registry = registryUrl || 'docker.io'
  await log(`Logging in to registry: ${registry}`)

  const loginCmd = `echo ${JSON.stringify(registryPassword)} | docker login ${registry} -u ${JSON.stringify(registryUser)} --password-stdin 2>&1`
  const { code, stdout, stderr } = await runCommand(serverConfig, loginCmd, { timeout: 30_000 })

  if (code !== 0) {
    throw new Error(`Registry login failed: ${stderr || stdout}`)
  }
  await log('Registry login successful. ✓')
}

/**
 * Pull a Docker image on the remote server and stream output to log.
 */
async function pullDockerImage(serverConfig, fullImage, log) {
  await log(`Pulling image: ${fullImage}`)
  const { code, stdout, stderr } = await runCommand(
    serverConfig,
    `docker pull ${fullImage} 2>&1`,
    {
      timeout:  300_000, // 5 min — large images can take a while
      onStdout: (chunk) => chunk.split('\n').filter(Boolean).forEach(l => log(l)),
    }
  )

  if (code !== 0) {
    throw new Error(`docker pull failed: ${stderr || stdout}`)
  }
  await log(`Image pulled. ✓`)
}

/**
 * Build a Docker image from a Dockerfile that already exists on the remote server.
 * Returns the image tag used.
 */
async function buildDockerfileImage(serverConfig, { workDir, imageName, dockerfilePath = 'Dockerfile' }, log) {
  const tag       = `${imageName}:dockerfile-${Date.now()}`
  const dfPath    = dockerfilePath.startsWith('/') ? dockerfilePath : `${workDir}/${dockerfilePath}`
  const buildCmd  = `docker build -t ${tag} -f ${dfPath} ${workDir} 2>&1`

  await log(`Building image with Dockerfile: ${dfPath}`)
  await log(`Image tag: ${tag}`)

  const { code, stdout, stderr } = await runCommand(
    serverConfig,
    buildCmd,
    {
      timeout:  600_000, // 10 min
      onStdout: (chunk) => chunk.split('\n').filter(Boolean).forEach(l => log(l)),
    }
  )

  if (code !== 0) {
    throw new Error(`docker build failed: ${stderr || stdout}`)
  }

  await log('Dockerfile build complete. ✓')
  return tag
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

async function processAppDeploy(job) {
  const { deploymentId } = job.data
  let logLineNumber = 0

  // ── Helper: save a log line to MongoDB (SSE reads from here) ──────────────
  async function log(output, isError = false) {
    logLineNumber++
    job.log(output)

    try {
      await DeploymentLog.create({
        deploymentId,
        line:    logLineNumber,
        output,
        isError,
      })
    } catch (_) {}
  }

  // ── Load deployment + service + server ────────────────────────────────────
  const deployment = await Deployment.findById(deploymentId)
  if (!deployment) throw new Error(`Deployment ${deploymentId} not found`)

  const service = await Service.findById(deployment.serviceId)
  if (!service) throw new Error(`Service ${deployment.serviceId} not found`)

  const server = await Server.findById(service.serverId)
  if (!server)              throw new Error(`Server ${service.serverId} not found`)
  if (!server.credential)   throw new Error(`Server has no SSH credentials`)
  if (server.status !== 'CONNECTED') {
    throw new Error(`Server "${server.name}" is not connected (status: ${server.status})`)
  }

  const serverConfig = buildServerConfig(server)

  const cfg          = service.config ?? {}
  const buildPack    = (deployment.buildPack || cfg.buildPack || 'NIXPACKS').toUpperCase()
  const internalPort = service.internalPort || 3000
  const domain       = service.domain

  if (!domain) throw new Error('Service has no domain set — save a domain in Configuration first')

  // Build consistent container/image names
  const { containerName, imageName } = buildServiceNames(service._id, service.name)
  const oldImageName = service.imageName

  await log(`═══════════════════════════════════════`)
  await log(`  Deploying: ${service.name}`)
  await log(`  Server:    ${server.name} (${server.ip})`)
  await log(`  Strategy:  ${buildPack}`)
  await log(`  Domain:    ${domain}`)
  await log(`═══════════════════════════════════════`)

  // ── Mark as BUILDING ──────────────────────────────────────────────────────
  await Deployment.updateOne(
    { _id: deploymentId },
    { $set: { status: 'BUILDING', startedAt: new Date() } }
  )
  await Service.updateOne(
    { _id: service._id },
    { $set: { status: 'BUILDING' } }
  )
  await job.updateProgress(5)

  // ── Ensure platform infra ──────────────────────────────────────────────────
  await log('[1/?] Ensuring platform infrastructure…')
  await ensurePlatformNetwork(serverConfig, { onLog: log })
  await ensureNginxProxy(serverConfig,     { onLog: log })
  await job.updateProgress(10)

  // ═══════════════════════════════════════════════════════════════════════════
  //  STRATEGY BRANCH
  // ═══════════════════════════════════════════════════════════════════════════

  let imageTag    = null
  let commitHash  = null
  let isStatic    = false
  let containerId = null

  // ───────────────────────────────────────────────────────────────────────────
  //  A) DOCKER_IMAGE  — pull a pre-built image, skip clone + build
  // ───────────────────────────────────────────────────────────────────────────
  if (buildPack === 'DOCKER_IMAGE') {
    const fullImage       = cfg.dockerImage
    const registryUrl     = cfg.registryUrl     || null
    const registryUser    = cfg.registryUser    || null
    const registryPassword= cfg.registryPassword|| null

    if (!fullImage) throw new Error('Service config is missing dockerImage')

    await log(`[2/5] Docker image: ${fullImage}`)

    // Optional registry login
    await dockerRegistryLogin(serverConfig, { registryUrl, registryUser, registryPassword }, log)
    await job.updateProgress(20)

    // Pull
    await log('[3/5] Pulling image…')
    await pullDockerImage(serverConfig, fullImage, log)
    imageTag = fullImage
    await job.updateProgress(60)

  // ───────────────────────────────────────────────────────────────────────────
  //  B) DOCKERFILE  — clone repo, then docker build -f Dockerfile
  // ───────────────────────────────────────────────────────────────────────────
  } else if (buildPack === 'DOCKERFILE') {
    const repoUrl      = cfg.repoUrl
    const branch       = cfg.branch        || 'main'
    const baseDir      = cfg.baseDir       || '/'
    const dockerfilePath = cfg.dockerfilePath || 'Dockerfile'

    if (!repoUrl) throw new Error('Service has no repoUrl in config')

    // Resolve authenticated URL for private repos
    let authenticatedRepoUrl = repoUrl
    if (service.repoType === 'private' && service.githubSourceId) {
      await log('[2/6] Fetching GitHub App installation token…')
      const source = await GitHubSource.findById(service.githubSourceId)
      if (!source || !source.isConnected) {
        throw new Error('GitHub App source is not connected.')
      }
      const { token } = await getInstallationToken(
        source.appId, source.installationId, source.privateKey,
        source.apiUrl || 'https://api.github.com'
      )
      authenticatedRepoUrl = buildAuthenticatedCloneUrl(repoUrl, token)
      await log('Installation token acquired. ✓')
    }

    await log(`[2/6] Cloning repository: ${repoUrl} (${branch})`)
    const { buildDir, workDir } = await cloneRepo(
      serverConfig,
      { deploymentId: deploymentId.toString(), repoUrl: authenticatedRepoUrl, branch, baseDir },
      { onLog: log, onStdout: (l) => log(l) }
    )
    await job.updateProgress(30)

    // Capture commit hash
    try {
      const { stdout } = await runCommand(serverConfig, `cd ${workDir} && git rev-parse --short HEAD 2>/dev/null`, { timeout: 10_000 })
      commitHash = stdout.trim() || null
    } catch (_) {}

    await log('[3/6] Building Docker image from Dockerfile…')
    imageTag = await buildDockerfileImage(
      serverConfig,
      { workDir, imageName, dockerfilePath },
      log
    )
    await job.updateProgress(65)

  // ───────────────────────────────────────────────────────────────────────────
  //  C) NIXPACKS / STATIC  — original pipeline
  // ───────────────────────────────────────────────────────────────────────────
  } else {
    const repoUrl  = cfg.repoUrl
    const branch   = cfg.branch  || 'main'
    const baseDir  = cfg.baseDir || '/'

    if (!repoUrl) throw new Error('Service has no repoUrl in config')

    let authenticatedRepoUrl = repoUrl
    if (service.repoType === 'private' && service.githubSourceId) {
      await log('[2/7] Fetching GitHub App installation token for private repo…')
      const source = await GitHubSource.findById(service.githubSourceId)
      if (!source || !source.isConnected) {
        throw new Error('GitHub App source is not connected. Re-check the source in Sources page.')
      }
      const { token } = await getInstallationToken(
        source.appId, source.installationId, source.privateKey,
        source.apiUrl || 'https://api.github.com'
      )
      authenticatedRepoUrl = buildAuthenticatedCloneUrl(repoUrl, token)
      await log('Installation token acquired. ✓')
    }

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

    await log('[3/7] Building image…')
    const result = await buildImage(
      serverConfig,
      { workDir, imageName, buildPack },
      { onLog: log, onStdout: (l) => log(l) }
    )
    imageTag   = result.imageTag
    commitHash = result.commitHash
    isStatic   = result.isStatic
    await job.updateProgress(65)
  }

  // ── Step 4: DEPLOYING ─────────────────────────────────────────────────────
  await log('[4/?] Switching to new container…')
  await Deployment.updateOne(
    { _id: deploymentId },
    { $set: { status: 'DEPLOYING', builtImageName: imageTag, commitHash } }
  )
  await Service.updateOne(
    { _id: service._id },
    { $set: { status: 'DEPLOYING' } }
  )

  // ── Step 5: Stop old + start new container ────────────────────────────────
  await removeOldContainer(serverConfig, containerName, { onLog: log })

  if (!isStatic) {
    const result = await runContainer(
      serverConfig,
      {
        containerName,
        imageName: imageTag,   // use the resolved tag directly
        imageTag,
        internalPort,
        envVars: service.envVars ?? [],
      },
      { onLog: log }
    )
    containerId = result.containerId
  }
  await job.updateProgress(80)

  // ── Step 6: Nginx config ──────────────────────────────────────────────────
  await log('[5/?] Configuring Nginx…')
  const { confFile } = await writeNginxConfig(
    serverConfig,
    { containerName, internalPort, domain },
    { onLog: log }
  )
  await job.updateProgress(90)

  // ── Step 7: Cleanup (skip for DOCKER_IMAGE — nothing to clean) ────────────
  if (buildPack !== 'DOCKER_IMAGE') {
    await log('[6/?] Cleaning up build files…')
    // buildDir is only set for git-based builds; pass null-safe values
    await cleanupBuild(serverConfig, { buildDir: null, oldImageName }, { onLog: log })
  }
  await job.updateProgress(95)

  // ── Mark SUCCESS ──────────────────────────────────────────────────────────
  await log('[7/?] Finalising…')
  const now = new Date()

  await Deployment.updateOne(
    { _id: deploymentId },
    {
      $set: {
        status:         'SUCCESS',
        finishedAt:     now,
        commitHash:     commitHash  ?? null,
        builtImageName: imageTag    ?? null,
      },
    }
  )

  await Service.updateOne(
    { _id: service._id },
    {
      $set: {
        status:          'RUNNING',
        containerId:     containerId ?? null,
        containerName,
        imageName:       imageTag    ?? null,
        nginxConfigFile: confFile,
        lastCommitHash:  commitHash  ?? null,
        lastDeployedAt:  now,
        errorMessage:    null,
        healthStatus:    'UNKNOWN',
      },
    }
  )

  await job.updateProgress(100)
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
      concurrency: 2,
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
      await DeploymentLog.create({
        deploymentId,
        line:    9999,
        output:  `✗ Deployment failed: ${err.message}`,
        isError: true,
      })
      await Deployment.updateOne(
        { _id: deploymentId },
        { $set: { status: 'FAILED', finishedAt: new Date(), errorMessage: err.message } }
      )
      const deployment = await Deployment.findById(deploymentId).lean()
      if (deployment?.serviceId) {
        await Service.updateOne(
          { _id: deployment.serviceId },
          { $set: { status: 'ERROR', errorMessage: err.message } }
        )
      }
    } catch (updateErr) {
      console.error('[app-deploy] Failed to update status after job failure:', updateErr.message)
    }
  })

  return worker
}