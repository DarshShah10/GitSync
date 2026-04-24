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
  removeNginxConfig,
  runContainer,
  writeNginxConfig,
  cleanupBuild,
  installNixpacks,
  buildServiceNames,
  cleanStaleNginxConfigs,
} from '../services/app.service.js'
import { GitHubSource } from '../models/githubSource.model.js'
import {
  getInstallationToken,
  buildAuthenticatedCloneUrl,
} from '../services/github.service.js'
import { runCommand } from '../services/ssh.service.js'

// ─── Docker-image-specific helpers ───────────────────────────────────────────

async function dockerRegistryLogin(serverConfig, { registryUrl, registryUser, registryPassword }, log) {
  if (!registryUser || !registryPassword) return

  const registry = registryUrl || 'docker.io'
  await log(`Logging in to registry: ${registry}`)

  const loginCmd = `echo ${JSON.stringify(registryPassword)} | docker login ${registry} -u ${JSON.stringify(registryUser)} --password-stdin 2>&1`
  const { code, stdout, stderr } = await runCommand(serverConfig, loginCmd, { timeout: 30_000 })

  if (code !== 0) throw new Error(`Registry login failed: ${stderr || stdout}`)
  await log('Registry login successful. ✓')
}

async function pullDockerImage(serverConfig, fullImage, log) {
  await log(`Pulling image: ${fullImage}`)
  const { code, stdout, stderr } = await runCommand(
    serverConfig,
    `docker pull ${fullImage} 2>&1`,
    { timeout: 300_000, onStdout: (chunk) => chunk.split('\n').filter(Boolean).forEach(l => log(l)) }
  )
  if (code !== 0) throw new Error(`docker pull failed: ${stderr || stdout}`)
  await log('Image pulled. ✓')
}

async function buildDockerfileImage(serverConfig, { workDir, imageName, dockerfilePath = 'Dockerfile' }, log) {
  const tag      = `${imageName}:dockerfile-${Date.now()}`
  const dfPath   = dockerfilePath.startsWith('/') ? dockerfilePath : `${workDir}/${dockerfilePath}`
  const buildCmd = `docker build -t ${tag} -f ${dfPath} ${workDir} 2>&1`

  await log(`Building image with Dockerfile: ${dfPath}`)
  await log(`Image tag: ${tag}`)

  const { code, stdout, stderr } = await runCommand(
    serverConfig,
    buildCmd,
    { timeout: 600_000, onStdout: (chunk) => chunk.split('\n').filter(Boolean).forEach(l => log(l)) }
  )
  if (code !== 0) throw new Error(`docker build failed: ${stderr || stdout}`)
  await log('Dockerfile build complete. ✓')
  return tag
}

// ─── Shared helper: get authenticated clone URL if service has a GitHub source ─

async function resolveCloneUrl(service, repoUrl, log) {
  if (!service.githubSourceId) return repoUrl

  const source = await GitHubSource.findById(service.githubSourceId)
  if (!source) throw new Error('GitHub source not found. Re-check the source in Sources page.')
  if (!source.isConnected) throw new Error('GitHub App source is not connected. Re-check the source in Sources page.')

  await log('Fetching GitHub App installation token for private repo…')
  const { token } = await getInstallationToken(
    source.appId,
    source.installationId,
    source.privateKey,
    source.apiUrl || 'https://api.github.com'
  )
  await log('Installation token acquired. ✓')
  return buildAuthenticatedCloneUrl(repoUrl, token)
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

async function processAppDeploy(job) {
  const { deploymentId } = job.data
  let logLineNumber = 0

  async function log(output, isError = false) {
    logLineNumber++
    job.log(output)
    try {
      await DeploymentLog.create({ deploymentId, line: logLineNumber, output, isError })
    } catch (_) {}
  }

  const deployment = await Deployment.findById(deploymentId)
  if (!deployment) throw new Error(`Deployment ${deploymentId} not found`)

  const service = await Service.findById(deployment.serviceId)
  if (!service) throw new Error(`Service ${deployment.serviceId} not found`)

  const server = await Server.findById(service.serverId)
  if (!server)            throw new Error(`Server ${service.serverId} not found`)
  if (!server.credential) throw new Error('Server has no SSH credentials')
  if (server.status !== 'CONNECTED') throw new Error(`Server "${server.name}" is not connected (status: ${server.status})`)

  const serverConfig = buildServerConfig(server)

  const cfg          = service.config ?? {}
  const buildPack    = (deployment.buildPack || cfg.buildPack || 'NIXPACKS').toUpperCase()
  const internalPort = service.internalPort || 3000
  const domain       = service.domain

  if (!domain) throw new Error('Service has no domain set — save a domain in Configuration first')

  const { containerName, imageName } = buildServiceNames(service._id, service.name)
  const oldImageName       = service.imageName
  const oldNginxConfigFile = service.nginxConfigFile

  await log('═══════════════════════════════════════')
  await log(`  Deploying: ${service.name}`)
  await log(`  Server:    ${server.name} (${server.ip})`)
  await log(`  Strategy:  ${buildPack}`)
  await log(`  Domain:    ${domain}`)
  await log('═══════════════════════════════════════')

  await Deployment.updateOne({ _id: deploymentId }, { $set: { status: 'BUILDING', startedAt: new Date() } })
  await Service.updateOne({ _id: service._id }, { $set: { status: 'BUILDING' } })
  await job.updateProgress(5)

  await log('[1/?] Ensuring platform infrastructure…')
  await ensurePlatformNetwork(serverConfig, { onLog: log })
  await ensureNginxProxy(serverConfig, { onLog: log })
  await log('Cleaning stale nginx configs…')
  await cleanStaleNginxConfigs(serverConfig, { onLog: log })
  await job.updateProgress(10)

  let imageTag    = null
  let commitHash  = null
  let isStatic    = false
  let containerId = null
  let buildDir    = null

  // ─── DOCKER_IMAGE ─────────────────────────────────────────────────────────
  if (buildPack === 'DOCKER_IMAGE') {
    const fullImage        = cfg.dockerImage
    const registryUrl      = cfg.registryUrl      || null
    const registryUser     = cfg.registryUser     || null
    const registryPassword = cfg.registryPassword || null

    if (!fullImage) throw new Error('Service config is missing dockerImage')

    await log(`[2/5] Docker image: ${fullImage}`)
    await dockerRegistryLogin(serverConfig, { registryUrl, registryUser, registryPassword }, log)
    await job.updateProgress(20)

    await log('[3/5] Pulling image…')
    await pullDockerImage(serverConfig, fullImage, log)
    imageTag = fullImage
    await job.updateProgress(60)

  // ─── DOCKERFILE ───────────────────────────────────────────────────────────
  } else if (buildPack === 'DOCKERFILE') {
    const repoUrl        = cfg.repoUrl
    const branch         = cfg.branch        || 'main'
    const baseDir        = cfg.baseDir        || '/'
    const dockerfilePath = cfg.dockerfilePath || 'Dockerfile'

    if (!repoUrl) throw new Error('Service has no repoUrl in config')

    await log('[2/6] Resolving clone URL…')
    const authenticatedRepoUrl = await resolveCloneUrl(service, repoUrl, log)

    await log(`[3/6] Cloning repository: ${repoUrl} (${branch})`)
    const cloneResult = await cloneRepo(
      serverConfig,
      { deploymentId: deploymentId.toString(), repoUrl: authenticatedRepoUrl, branch, baseDir },
      { onLog: log, onStdout: (l) => log(l) }
    )
    buildDir = cloneResult.buildDir
    const workDir = cloneResult.workDir
    await job.updateProgress(30)

    try {
      const { stdout } = await runCommand(serverConfig, `cd ${workDir} && git rev-parse --short HEAD 2>/dev/null`, { timeout: 10_000 })
      commitHash = stdout.trim() || null
    } catch (_) {}

    await log('[4/6] Building Docker image from Dockerfile…')
    imageTag = await buildDockerfileImage(serverConfig, { workDir, imageName, dockerfilePath }, log)
    await job.updateProgress(65)

  // ─── NIXPACKS / STATIC ────────────────────────────────────────────────────
  } else {
    const repoUrl = cfg.repoUrl
    const branch  = cfg.branch  || 'main'
    const baseDir = cfg.baseDir || '/'

    if (!repoUrl) throw new Error('Service has no repoUrl in config')

    await log('[2/7] Resolving clone URL…')
    const authenticatedRepoUrl = await resolveCloneUrl(service, repoUrl, log)

    await log('[3/7] Cloning repository…')
    const cloneResult = await cloneRepo(
      serverConfig,
      { deploymentId: deploymentId.toString(), repoUrl: authenticatedRepoUrl, branch, baseDir },
      { onLog: log, onStdout: (l) => log(l) }
    )
    buildDir = cloneResult.buildDir
    const workDir = cloneResult.workDir
    await job.updateProgress(25)

    try {
      const { stdout: hashOut } = await runCommand(serverConfig, `cd ${workDir} && git rev-parse --short HEAD 2>/dev/null`, { timeout: 10_000 })
      commitHash = hashOut.trim() || null
    } catch (_) {}

    try {
      const { stdout: msgOut } = await runCommand(serverConfig, `cd ${workDir} && git log -1 --pretty=%s 2>/dev/null`, { timeout: 10_000 })
      if (msgOut.trim()) {
        await Deployment.updateOne({ _id: deploymentId }, { $set: { commitMessage: msgOut.trim() } })
      }
    } catch (_) {}

    if (buildPack === 'NIXPACKS') {
      await log('[3.5/7] Ensuring Nixpacks is installed…')
      await installNixpacks(serverConfig, { onLog: log })
    }

    await log('[4/7] Building image…')
    const result = await buildImage(
      serverConfig,
      { workDir, imageName, buildPack },
      { onLog: log, onStdout: (l) => log(l) }
    )
    imageTag   = result.imageTag
    commitHash = result.commitHash || commitHash
    isStatic   = result.isStatic
    await job.updateProgress(65)
  }

  // ── Step: DEPLOYING ───────────────────────────────────────────────────────
  await log('[5/?] Switching to new container…')
  await Deployment.updateOne(
    { _id: deploymentId },
    { $set: { status: 'DEPLOYING', builtImageName: imageTag, commitHash } }
  )
  await Service.updateOne({ _id: service._id }, { $set: { status: 'DEPLOYING' } })

  if (oldNginxConfigFile) {
    await log('Removing old nginx config…')
    await removeNginxConfig(serverConfig, oldNginxConfigFile, { onLog: log })
  }

  await removeOldContainer(serverConfig, containerName, { onLog: log })

  if (!isStatic) {
    const result = await runContainer(
      serverConfig,
      { containerName, imageName: imageTag, imageTag, internalPort, envVars: service.envVars ?? [] },
      { onLog: log }
    )
    containerId = result.containerId
  }
  await job.updateProgress(80)

  await log('[6/?] Configuring Nginx…')
  const { confFile } = await writeNginxConfig(
    serverConfig,
    { containerName, internalPort, domain },
    { onLog: log }
  )
  await job.updateProgress(90)

  if (buildPack !== 'DOCKER_IMAGE') {
    await log('[7/?] Cleaning up build files…')
    await cleanupBuild(serverConfig, { buildDir, oldImageName }, { onLog: log })
  }
  await job.updateProgress(95)

  await log('[8/?] Finalising…')
  const now = new Date()

  await Deployment.updateOne(
    { _id: deploymentId },
    { $set: { status: 'SUCCESS', finishedAt: now, commitHash: commitHash ?? null, builtImageName: imageTag ?? null } }
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
  await log(`✓ Deployment complete! App live at: ${domain}`)
  await log('═══════════════════════════════════════')

  return { deploymentId: deploymentId.toString(), serviceId: service._id.toString(), domain, url: domain, containerId, commitHash }
}

export function startAppDeployWorker() {
  const worker = new Worker(
    QUEUE_NAMES.APP_DEPLOY,
    processAppDeploy,
    { connection: createRedisConnection(), concurrency: 3 }
  )

  worker.on('active', (job) => {
    console.log(`[app-deploy] Job ${job.id} started — deploymentId: ${job.data.deploymentId}`)
  })

  worker.on('completed', (job, result) => {
    console.log(`[app-deploy] Job ${job.id} completed — url: ${result?.url}`)
  })

  worker.on('failed', async (job, err) => {
    console.error(`[app-deploy] Job ${job?.id} failed:`, err.message)
    if (!job?.data?.deploymentId) return

    const deploymentId = job.data.deploymentId
    try {
      await DeploymentLog.create({ deploymentId, line: 9999, output: `✗ Deployment failed: ${err.message}`, isError: true })
      await Deployment.updateOne({ _id: deploymentId }, { $set: { status: 'FAILED', finishedAt: new Date(), errorMessage: err.message } })
      const deployment = await Deployment.findById(deploymentId).lean()
      if (deployment?.serviceId) {
        await Service.updateOne({ _id: deployment.serviceId }, { $set: { status: 'ERROR', errorMessage: err.message } })
      }
    } catch (updateErr) {
      console.error('[app-deploy] Failed to update status after job failure:', updateErr.message)
    }
  })

  return worker
}