import {
  createService,
  deployService,
  streamDeploymentLogs,
  getDeployments,
  checkRepo,
  getService,
  getAllServices,
  updateService,
  deleteService,
} from '../controllers/service.controller.js'
import { handleResult } from '../utils/index.js'

export async function serviceRoutes(app) {

  // ── Must be before /:serviceId so Fastify doesn't treat "check-repo" as a param
  app.get('/api/services/check-repo', async (request, reply) => {
    const result = await checkRepo(request)
    return handleResult(reply, result)
  })

  // GET  /api/services          — list all user's services
  app.get('/api/services', async (request, reply) => {
    const result = await getAllServices(request)
    return reply.send(result)
  })

  // POST /api/services          — create service (returns serviceId)
  app.post('/api/services', async (request, reply) => {
    const result = await createService(request)
    return handleResult(reply, result)
  })

  // GET  /api/services/:serviceId       — get one service
  app.get('/api/services/:serviceId', async (request, reply) => {
    const result = await getService(request)
    return handleResult(reply, result)
  })

  // PATCH /api/services/:serviceId      — save config (domain, envVars, buildPack etc.)
  app.patch('/api/services/:serviceId', async (request, reply) => {
    const result = await updateService(request)
    return handleResult(reply, result)
  })

  // DELETE /api/services/:serviceId     — delete service + all deployments & logs
  app.delete('/api/services/:serviceId', async (request, reply) => {
    const result = await deleteService(request)
    return handleResult(reply, result)
  })

  // POST /api/services/:serviceId/deploy  — queue a deployment job, returns deploymentId
  app.post('/api/services/:serviceId/deploy', async (request, reply) => {
    const result = await deployService(request)
    return handleResult(reply, result)
  })

  // GET  /api/services/:serviceId/deployments  — deployment history
  app.get('/api/services/:serviceId/deployments', async (request, reply) => {
    const result = await getDeployments(request)
    return reply.send(result)
  })

  // GET  /api/deployments/:deploymentId/logs  — SSE stream of live build logs
  // Browser: const es = new EventSource('/api/deployments/:id/logs')
  // Events:  data (log line) | done (finished) | timeout
  app.get('/api/deployments/:deploymentId/logs', async (request, reply) => {
    return streamDeploymentLogs(request, reply)
  })

}