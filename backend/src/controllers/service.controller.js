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
// Creates Deployment record + queues BullMQ app-deploy job
// Returns { deploymentId } — frontend opens SSE to /api/deployments/:deploymentId/logs
export const deployService = async (request) => {
  try {
    const { serviceId } = request.params

    const service = await Service.findOne({ _id: serviceId, userId: request.user.id })
    if (!service) return { error: 'Service not found', status: 404 }

    if (!service.domain) {
      return { error: 'No domain configured. Set a domain in Configuration → General first.', status: 400 }
    }
    console.log("console log doesnt showen up")
    const cfg = service.config ?? {}
    console.log(" configure service config:", cfg)
    if (!cfg.repoUrl) return { error: 'Service has no repoUrl in config', status: 400 }

    // Create Deployment document — status starts as QUEUED
    const deployment = await Deployment.create({
      serviceId:  service._id,
      status:     'QUEUED',
      trigger:    'MANUAL',
      buildPack: 'NIXPACKS',
      startedAt:  new Date(),
    })

    await Service.updateOne({ _id: serviceId }, { $set: { status: 'BUILDING' } })

    // Queue the BullMQ job — app-deploy.job.js processes this
    await appDeployQueue.add(
      'deploy',
      { deploymentId: deployment._id.toString() },
      { jobId: `deploy-${deployment._id}` }
    )

    return { status: 201, data: { deploymentId: deployment._id, message: 'Deployment queued' } }
    // return { status: 201, data: { deploymentId: deployment._id.toString(), message: 'Deployment queued' } }

  } catch (err) {
    console.error('[deployService]', err)
    return { error: err.message || 'Failed to queue deployment', status: 500 }
  }
}


// GET /api/deployments/:deploymentId/logs  — SSE endpoint
// Streams DeploymentLog lines to the browser every 500ms
// Browser uses: const es = new EventSource('/api/deployments/:id/logs')
export const streamDeploymentLogs = async (request, reply) => {
  const { deploymentId } = request.params

  const deployment = await Deployment.findById(deploymentId)
  if (!deployment) return reply.status(404).send({ error: 'Deployment not found' })

  const service = await Service.findOne({ _id: deployment.serviceId, userId: request.user.id })
  if (!service) return reply.status(403).send({ error: 'Forbidden' })

  // SSE headers
  reply.raw.writeHead(200, {
    'Content-Type':      'text/event-stream',
    'Cache-Control':     'no-cache',
    'Connection':        'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  let lastLine     = 0
  let pollInterval = null
  let done         = false

  const sendData  = (data)         => reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
  const sendEvent = (event, data)  => reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

  async function poll() {
    if (done) return
    try {
      // Send any new log lines
      const newLogs = await DeploymentLog.find({ deploymentId, line: { $gt: lastLine } })
        .sort({ line: 1 }).lean()

      for (const log of newLogs) {
        sendData({ line: log.line, output: log.output, isError: log.isError, timestamp: log.createdAt })
        lastLine = log.line
      }

      // Check if finished
      const current = await Deployment.findById(deploymentId).lean()
      if (['SUCCESS', 'FAILED', 'CANCELLED'].includes(current?.status)) {
        done = true
        clearInterval(pollInterval)
        sendEvent('done', {
          status: current.status,
          url:    current.status === 'SUCCESS' ? `http://${service.domain}` : null,
          error:  current.errorMessage ?? null,
        })
        reply.raw.end()
      }
    } catch (err) {
      console.error('[streamDeploymentLogs] poll error:', err.message)
    }
  }

  pollInterval = setInterval(poll, 500)
  await poll()   // run immediately so first lines appear without waiting 500ms

  request.raw.on('close', () => { done = true; clearInterval(pollInterval) })

  // Safety: stop after 30 minutes
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
// Saves changes from the Configuration page (domain, env vars, build commands etc.)
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