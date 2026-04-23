import {
  createService,
  deployService,
  streamDeploymentLogs,
  getDeployments,
  checkRepo,
  getService,
  getAllServices,
  updateService,
  createPrivateService,
  checkPrivateRepo,
} from '../controllers/service.controller.js'
import { handleResult } from '../utils/index.js'

export async function serviceRoutes(app) {

  // ── Must be before /:serviceId so Fastify doesn't treat fixed paths as params
  app.get('/api/services/check-repo', async (request, reply) => {
    const result = await checkRepo(request)
    return handleResult(reply, result)
  })

  app.get('/api/services/check-private-repo', async (request, reply) => {
    const result = await checkPrivateRepo(request)
    return handleResult(reply, result)
  })

  // GET  /api/services          — list all user's services
  app.get('/api/services', async (request, reply) => {
    const result = await getAllServices(request)
    return reply.send(result)
  })

  // POST /api/services          — create public service
  app.post('/api/services', async (request, reply) => {
    const result = await createService(request)
    return handleResult(reply, result)
  })

  // POST /api/services/private  — create private-repo service
  app.post('/api/services/private', async (request, reply) => {
    const result = await createPrivateService(request)
    return handleResult(reply, result)
  })

  // GET  /api/services/:serviceId
  app.get('/api/services/:serviceId', async (request, reply) => {
    const result = await getService(request)
    return handleResult(reply, result)
  })

  // PATCH /api/services/:serviceId
  app.patch('/api/services/:serviceId', async (request, reply) => {
    const result = await updateService(request)
    return handleResult(reply, result)
  })

  // POST /api/services/:serviceId/deploy
  app.post('/api/services/:serviceId/deploy', async (request, reply) => {
    const result = await deployService(request)
    return handleResult(reply, result)
  })

  // GET  /api/services/:serviceId/deployments
  app.get('/api/services/:serviceId/deployments', async (request, reply) => {
    const result = await getDeployments(request)
    return reply.send(result)
  })

  // GET  /api/deployments/:deploymentId/logs  — SSE
  app.get('/api/deployments/:deploymentId/logs', async (request, reply) => {
    return streamDeploymentLogs(request, reply)
  })

}