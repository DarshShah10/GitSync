// ─── ADD THESE TO service.routes.js ──────────────────────────────────────────
// Place this route BEFORE the /:serviceId param routes but after check-repo routes

// Webhook endpoint — called by GitHub on push
// No auth middleware here (GitHub calls this externally)
// app.post('/api/services/:serviceId/webhook', async (request, reply) => {
//   const result = await handleWebhook(request)
//   return handleResult(reply, result)
// })

// Also add this route for fetching log lines of a specific deployment:
// app.get('/api/deployments/:deploymentId/log-lines', async (request, reply) => {
//   const result = await getDeploymentLogLines(request)
//   return handleResult(reply, result)
// })


// ─── FULL UPDATED service.routes.js ──────────────────────────────────────────

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
  createPrivateService,
  checkPrivateRepo,
  handleWebhook,
  getDeploymentLogLines,
} from '../controllers/service.controller.js'
import {
  createDockerfileService,
  createDockerImageService,
} from '../controllers/docker.controller.js'
import { handleResult } from '../utils/index.js'

export async function serviceRoutes(app) {

  // ── Static helpers (must be registered before /:serviceId param routes) ───

  app.get('/api/services/check-repo', async (request, reply) => {
    const result = await checkRepo(request)
    return handleResult(reply, result)
  })
  app.get('/api/services/check-private-repo', async (request, reply) => {
    const result = await checkPrivateRepo(request)
    return handleResult(reply, result)
  })

  // ── List / create ─────────────────────────────────────────────────────────

  app.get('/api/services', async (request, reply) => {
    const result = await getAllServices(request)
    return reply.send(result)
  })

  app.post('/api/services', async (request, reply) => {
    const result = await createService(request)
    return handleResult(reply, result)
  })

  app.post('/api/services/private', async (request, reply) => {
    const result = await createPrivateService(request)
    return handleResult(reply, result)
  })

  app.post('/api/services/dockerfile', async (request, reply) => {
    const result = await createDockerfileService(request)
    return handleResult(reply, result)
  })

  app.post('/api/services/docker-image', async (request, reply) => {
    const result = await createDockerImageService(request)
    return handleResult(reply, result)
  })

  // ── Per-service operations ────────────────────────────────────────────────

  app.get('/api/services/:serviceId', async (request, reply) => {
    const result = await getService(request)
    return handleResult(reply, result)
  })

  app.patch('/api/services/:serviceId', async (request, reply) => {
    const result = await updateService(request)
    return handleResult(reply, result)
  })

  app.delete('/api/services/:serviceId', async (request, reply) => {
    const result = await deleteService(request)
    return handleResult(reply, result)
  })

  app.post('/api/services/:serviceId/deploy', async (request, reply) => {
    const result = await deployService(request)
    return handleResult(reply, result)
  })

  app.get('/api/services/:serviceId/deployments', async (request, reply) => {
    const result = await getDeployments(request)
    return reply.send(result)
  })

  // ── Webhook — GitHub push triggers auto-redeploy ──────────────────────────
  // No auth middleware — GitHub calls this. Authentication via service ID.
  app.post('/api/services/:serviceId/webhook', { config: { skipAuth: true } }, async (request, reply) => {
    const result = await handleWebhook(request)
    return handleResult(reply, result)
  })

  // ── Deployment log lines (for history) ───────────────────────────────────
  app.get('/api/deployments/:deploymentId/log-lines', async (request, reply) => {
    const result = await getDeploymentLogLines(request)
    return handleResult(reply, result)
  })

  // ── Deployment SSE log stream ─────────────────────────────────────────────
  app.get('/api/deployments/:deploymentId/logs', { config: { skipAuth: true } }, async (request, reply) => {
    return streamDeploymentLogs(request, reply)
  })
}