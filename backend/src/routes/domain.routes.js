/**
 * domain.routes.js
 *
 * Mount with:
 *   import { domainRoutes } from './routes/domain.routes.js'
 *   domainRoutes(app)
 *
 * Auth middleware (`authenticate`) must attach request.user.
 */

import {
  createDomain,
  listDomains,
  updateDomainIP,
  deleteDomain,
  resolveDomain,
  updateIPViaToken,
} from '../controllers/domain.controller.js'

import { handleResult } from '../utils/index.js'
// import { authenticate } from '../middlewares/auth.middleware.js'
export async function domainRoutes(app) {

  // ── Protected (global hook handles auth automatically) ────────────────────

  app.post('/api/domains', async (request, reply) => {
    const result = await createDomain(request)
    return handleResult(reply, result)
  })

  app.get('/api/domains', async (request, reply) => {
    const result = await listDomains(request)
    return handleResult(reply, result)
  })

  app.patch('/api/domains/:id', async (request, reply) => {
    const result = await updateDomainIP(request)
    return handleResult(reply, result)
  })

  app.delete('/api/domains/:id', async (request, reply) => {
    const result = await deleteDomain(request)
    return handleResult(reply, result)
  })


  // ── Public (tell the global hook to skip auth) ────────────────────────────

  app.get(
    '/api/domains/resolve/:subdomain',
    { config: { skipAuth: true } },          // ← this is the key part
    async (request, reply) => {
      const result = await resolveDomain(request)
      return handleResult(reply, result)
    }
  )

  app.patch(
    '/api/domains/update-ip',
    { config: { skipAuth: true } },          // ← and this
    async (request, reply) => {
      const result = await updateIPViaToken(request)
      return handleResult(reply, result)
    }
  )
}