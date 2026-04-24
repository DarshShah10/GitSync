import { Service, Server, Deployment, DeploymentLog } from '../models/index.js'
import { appDeployQueue } from '../jobs/queues.js'
import { buildServerConfig } from '../utils/index.js'

// POST /api/services
export const createService = async (request) => {
  try {
    const { repoUrl, branch, baseDir, buildPack, internalPort, isStatic, type, serverId } = request.body

    if (!repoUrl)  return { error: 'repoUrl is required', status: 400 }
    if (!serverId) return { error: 'serverId is required', status: 400 }

    const server = await Server.findOne({ _id: serverId, userId: request.user.id })
    if (!server) return { error: 'Server not found', status: 404 }
    if (server.status !== 'CONNECTED') return { error: `Server "${server.name}" is not connected`, status: 400 }

    const name = repoUrl.split('/').pop().replace('.git', '') || 'my-app'

    const service = await Service.create({
      userId:       request.user.id,
      serverId,
      name,
      type:         type || 'APP',
      status:       'STOPPED',
      internalPort: internalPort || 3000,
      isStatic:     isStatic || false,
      config: {
        repoUrl,
        branch:    branch    || 'main',
        baseDir:   baseDir   || '/',
        buildPack: buildPack || 'NIXPACKS',
      },
    })

    return { status: 201, data: { serviceId: service._id, name: service.name } }

  } catch (err) {
    console.error('[createService]', err)
    return { error: err.message || 'Failed to create service', status: 500 }
  }
}


// POST /api/services/:serviceId/deploy
export const deployService = async (request) => {
  try {
    const { serviceId } = request.params

    const service = await Service.findOne({ _id: serviceId, userId: request.user.id })
    if (!service) return { error: 'Service not found', status: 404 }

    if (!service.domain) {
      return { error: 'No domain configured. Set a domain in Configuration → General first.', status: 400 }
    }

    // ── Prevent concurrent deployments for the same service ─────────────────
    const activeDeployment = await Deployment.findOne({
      serviceId: service._id,
      status: { $in: ['QUEUED', 'BUILDING', 'DEPLOYING'] },
    })
    if (activeDeployment) {
      return {
        error: `A deployment is already in progress (status: ${activeDeployment.status}). Wait for it to finish before starting a new one.`,
        status: 409,
      }
    }

    const cfg       = service.config ?? {}
    const buildPack = (cfg.buildPack || 'NIXPACKS').toUpperCase()

    if (buildPack !== 'DOCKER_IMAGE') {
      if (!cfg.repoUrl) return { error: 'Service has no repoUrl in config', status: 400 }
    } else {
      if (!cfg.dockerImage) return { error: 'Service has no dockerImage in config', status: 400 }
    }

    const deployment = await Deployment.create({
      serviceId:  service._id,
      status:     'QUEUED',
      trigger:    'MANUAL',
      buildPack:  buildPack,
      startedAt:  new Date(),
    })

    await Service.updateOne({ _id: serviceId }, { $set: { status: 'BUILDING' } })

    await appDeployQueue.add(
      'deploy',
      { deploymentId: deployment._id.toString() },
      { jobId: `deploy-${deployment._id}` }
    )

    return { status: 201, data: { deploymentId: deployment._id, message: 'Deployment queued' } }

  } catch (err) {
    console.error('[deployService]', err)
    return { error: err.message || 'Failed to queue deployment', status: 500 }
  }
}


// GET /api/deployments/:deploymentId/logs  — SSE endpoint
// EventSource cannot send Authorization headers — accepts JWT as ?token= query param
export const streamDeploymentLogs = async (request, reply) => {
  const { deploymentId } = request.params

  const token = request.query.token
  if (!token) return reply.status(401).send({ error: 'Missing token query parameter' })

  let userId
  try {
    const { verifyToken } = await import('../utils/jwt.utils.js')
    const payload = verifyToken(token)
    userId = payload?.id || payload?.userId || payload?.sub
    if (!userId) throw new Error('No user id in token')
  } catch (err) {
    return reply.status(401).send({ error: 'Invalid or expired token' })
  }

  const deployment = await Deployment.findById(deploymentId)
  if (!deployment) return reply.status(404).send({ error: 'Deployment not found' })

  const service = await Service.findOne({ _id: deployment.serviceId, userId })
  if (!service) return reply.status(403).send({ error: 'Forbidden' })

  // In streamDeploymentLogs, replace the writeHead block with:
  const origin = request.headers.origin || '*'
  reply.raw.writeHead(200, {
    'Content-Type':                'text/event-stream',
    'Cache-Control':               'no-cache',
    'Connection':                  'keep-alive',
    'X-Accel-Buffering':           'no',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
  })

  let lastLine     = 0
  let pollInterval = null
  let done         = false

  const sendData  = (data)        => reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
  const sendEvent = (event, data) => reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

  async function poll() {
    if (done) return
    try {
      const newLogs = await DeploymentLog.find({ deploymentId, line: { $gt: lastLine } })
        .sort({ line: 1 }).lean()

      for (const log of newLogs) {
        sendData({ line: log.line, output: log.output, isError: log.isError, timestamp: log.createdAt })
        lastLine = log.line
      }

      const current = await Deployment.findById(deploymentId).lean()
      if (['SUCCESS', 'FAILED', 'CANCELLED'].includes(current?.status)) {
        done = true
        clearInterval(pollInterval)
        sendEvent('done', {
          status: current.status,
          url:    current.status === 'SUCCESS' ? service.domain : null,
          error:  current.errorMessage ?? null,
        })
        reply.raw.end()
      }
    } catch (err) {
      console.error('[streamDeploymentLogs] poll error:', err.message)
    }
  }

  pollInterval = setInterval(poll, 500)
  await poll()

  request.raw.on('close', () => { done = true; clearInterval(pollInterval) })

  setTimeout(() => {
    if (!done) {
      done = true
      clearInterval(pollInterval)
      sendEvent('timeout', { message: 'Stream timed out' })
      reply.raw.end()
    }
  }, 30 * 60 * 1000)
}


// GET /api/services/:serviceId/deployments
export const getDeployments = async (request) => {
  try {
    const { serviceId } = request.params
    const service = await Service.findOne({ _id: serviceId, userId: request.user.id })
    if (!service) return { error: 'Service not found', status: 404 }

    const deployments = await Deployment.find({ serviceId }).sort({ createdAt: -1 }).limit(20).lean()
    return deployments
  } catch (err) {
    console.error('[getDeployments]', err)
    return []
  }
}


// GET /api/services/check-repo?url=...
export const checkRepo = async (request) => {
  try {
    const { url } = request.query
    if (!url) return { error: 'url is required', status: 400 }

    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/)
    if (!match) return { error: 'Only GitHub URLs are supported for now', status: 400 }

    const apiUrl = `https://api.github.com/repos/${match[1]}/${match[2]}`
    const ghRes  = await fetch(apiUrl, { headers: { Accept: 'application/vnd.github.v3+json' } })

    if (!ghRes.ok) return { error: 'Repository not found or is private', status: 404 }

    const repo = await ghRes.json()
    return { data: { ok: true, name: repo.full_name, defaultBranch: repo.default_branch } }
  } catch (err) {
    console.error('[checkRepo]', err)
    return { error: 'Failed to check repository', status: 500 }
  }
}


// GET /api/services/:serviceId
export const getService = async (request) => {
  try {
    const service = await Service.findOne({ _id: request.params.serviceId, userId: request.user.id })
      .populate('serverId', 'name ip status')
    if (!service) return { error: 'Service not found', status: 404 }
    return { data: service }
  } catch (err) {
    console.error('[getService]', err)
    return { error: err.message, status: 500 }
  }
}


// GET /api/services
export const getAllServices = async (request) => {
  try {
    const services = await Service.find({ userId: request.user.id })
      .sort({ createdAt: -1 }).populate('serverId', 'name ip status')
    return services
  } catch (err) {
    console.error('[getAllServices]', err)
    return []
  }
}


// PATCH /api/services/:serviceId
export const updateService = async (request) => {
  try {
    const { serviceId } = request.params
    const { name, domain, internalPort, isStatic, envVars, config } = request.body

    const service = await Service.findOne({ _id: serviceId, userId: request.user.id })
    if (!service) return { error: 'Service not found', status: 404 }

    const updates = {}
    if (name         !== undefined) updates.name         = name
    if (domain       !== undefined) updates.domain       = domain
    if (internalPort !== undefined) updates.internalPort = internalPort
    if (isStatic     !== undefined) updates.isStatic     = isStatic
    if (envVars      !== undefined) updates.envVars      = envVars
    if (config       !== undefined) updates.config       = { ...service.config, ...config }

    const updated = await Service.findByIdAndUpdate(serviceId, { $set: updates }, { new: true })
      .populate('serverId', 'name ip status')

    return { data: updated }
  } catch (err) {
    console.error('[updateService]', err)
    return { error: err.message, status: 500 }
  }
}


// DELETE /api/services/:serviceId
export const deleteService = async (request) => {
  try {
    const { serviceId } = request.params

    const service = await Service.findOne({ _id: serviceId, userId: request.user.id })
    if (!service) return { error: 'Service not found', status: 404 }

    if (['BUILDING', 'DEPLOYING'].includes(service.status)) {
      return {
        error: `Cannot delete service while it is ${service.status.toLowerCase()}. Stop it first.`,
        status: 409,
      }
    }

    const deploymentIds = await Deployment.find({ serviceId }).distinct('_id')
    if (deploymentIds.length > 0) {
      await DeploymentLog.deleteMany({ deploymentId: { $in: deploymentIds } })
      await Deployment.deleteMany({ serviceId })
    }

    await Service.deleteOne({ _id: serviceId })

    return { status: 200, data: { message: `Service "${service.name}" deleted successfully` } }

  } catch (err) {
    console.error('[deleteService]', err)
    return { error: err.message || 'Failed to delete service', status: 500 }
  }
}


// POST /api/services/private
import { GitHubSource } from '../models/githubSource.model.js'
import { checkRepoAccess } from '../services/github.service.js'

export const createPrivateService = async (request) => {
  try {
    const {
      serverId, githubSourceId, repoUrl,
      branch, baseDir, buildPack, internalPort, isStatic,
    } = request.body ?? {}

    if (!repoUrl)        return { error: 'repoUrl is required', status: 400 }
    if (!serverId)       return { error: 'serverId is required', status: 400 }
    if (!githubSourceId) return { error: 'githubSourceId is required', status: 400 }

    const server = await Server.findOne({ _id: serverId, userId: request.user.id })
    if (!server) return { error: 'Server not found', status: 404 }
    if (server.status !== 'CONNECTED') return { error: `Server "${server.name}" is not connected`, status: 400 }

    const source = await GitHubSource.findOne({ _id: githubSourceId, userId: request.user.id })
    if (!source) return { error: 'GitHub source not found', status: 404 }
    if (!source.isConnected) return { error: 'GitHub source is not connected', status: 400 }

    const name = repoUrl.split('/').pop().replace('.git', '') || 'my-app'

    const service = await Service.create({
      userId:         request.user.id,
      serverId,
      name,
      type:           'APP',
      status:         'STOPPED',
      internalPort:   internalPort || 3000,
      repoType:       'private',
      githubSourceId: source._id,
      config: {
        repoUrl,
        branch:    branch    || 'main',
        baseDir:   baseDir   || '/',
        buildPack: buildPack || 'NIXPACKS',
      },
    })

    return { status: 201, data: { serviceId: service._id, name: service.name } }
  } catch (err) {
    console.error('[createPrivateService]', err)
    return { error: err.message || 'Failed to create service', status: 500 }
  }
}


// GET /api/services/check-private-repo
export const checkPrivateRepo = async (request) => {
  try {
    const { url, sourceId } = request.query
    if (!url)      return { error: 'url is required', status: 400 }
    if (!sourceId) return { error: 'sourceId is required', status: 400 }

    const source = await GitHubSource.findOne({ _id: sourceId, userId: request.user.id })
    if (!source) return { error: 'Source not found', status: 404 }
    if (!source.isConnected) return { error: 'Source is not connected', status: 400 }

    const result = await checkRepoAccess(
      source.appId,
      source.installationId,
      source.privateKey,
      url,
      source.apiUrl || 'https://api.github.com'
    )

    return { data: result }
  } catch (err) {
    console.error('[checkPrivateRepo]', err)
    return { error: err.message, status: 400 }
  }
}


// POST /api/services/:serviceId/webhook
export const handleWebhook = async (request) => {
  try {
    const { serviceId } = request.params
    const githubEvent = request.headers['x-github-event']

    if (githubEvent && githubEvent !== 'push') {
      return { status: 200, data: { message: `Event "${githubEvent}" ignored` } }
    }

    const service = await Service.findById(serviceId)
    if (!service) return { error: 'Service not found', status: 404 }

    if (service.config?.buildPack === 'DOCKER_IMAGE') {
      return { status: 200, data: { message: 'Docker image services do not support webhook auto-redeploy' } }
    }

    if (!service.domain) {
      return { status: 200, data: { message: 'Service has no domain — configure one first' } }
    }

    // Prevent concurrent deployments from webhook too
    const activeDeployment = await Deployment.findOne({
      serviceId: service._id,
      status: { $in: ['QUEUED', 'BUILDING', 'DEPLOYING'] },
    })
    if (activeDeployment) {
      return { status: 200, data: { message: 'Deployment already in progress — skipped' } }
    }

    let commitHash = null
    let commitMsg  = null
    let pusher     = null

    try {
      const payload = request.body
      if (payload?.after) commitHash = payload.after.slice(0, 7)
      if (payload?.head_commit?.message) commitMsg = payload.head_commit.message
      if (payload?.pusher?.name) pusher = payload.pusher.name

      if (payload?.ref && service.config?.branch) {
        const pushedBranch = payload.ref.replace('refs/heads/', '')
        if (pushedBranch !== service.config.branch) {
          return { status: 200, data: { message: `Branch "${pushedBranch}" ignored — tracking "${service.config.branch}"` } }
        }
      }
    } catch (_) {}

    const deployment = await Deployment.create({
      serviceId:     service._id,
      status:        'QUEUED',
      trigger:       'WEBHOOK',
      buildPack:     service.config?.buildPack || 'NIXPACKS',
      startedAt:     new Date(),
      commitHash:    commitHash || null,
      commitMessage: commitMsg  || null,
    })

    await Service.updateOne({ _id: serviceId }, { $set: { status: 'BUILDING' } })
    await appDeployQueue.add('deploy', { deploymentId: deployment._id.toString() }, { jobId: `deploy-${deployment._id}` })

    return { status: 200, data: { message: 'Deployment triggered', deploymentId: deployment._id, commitHash, commitMsg, pusher } }
  } catch (err) {
    console.error('[handleWebhook]', err)
    return { error: err.message || 'Failed to handle webhook', status: 500 }
  }
}


// GET /api/deployments/:deploymentId/log-lines
export const getDeploymentLogLines = async (request) => {
  try {
    const { deploymentId } = request.params

    const deployment = await Deployment.findById(deploymentId)
    if (!deployment) return { error: 'Deployment not found', status: 404 }

    const service = await Service.findOne({ _id: deployment.serviceId, userId: request.user.id })
    if (!service) return { error: 'Forbidden', status: 403 }

    const logs = await DeploymentLog.find({ deploymentId }).sort({ line: 1 }).lean()
    return { data: logs }
  } catch (err) {
    console.error('[getDeploymentLogLines]', err)
    return { error: err.message, status: 500 }
  }
}