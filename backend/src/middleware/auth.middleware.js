/**
 * Authentication middleware.
 *
 * DEV MODE (NODE_ENV !== 'production'):
 *   Auto-attaches the seeded admin user to every request.
 *   No token required. Swap this block for JWT.verify() when auth is built.
 *
 * PROD MODE:
 *   Placeholder — returns 401 until JWT is wired up.
 *   Replace with: jwt.verify(token, config.jwt.secret) → req.user
 *
 * The shape of req.user is always:
 *   { id, name, email, defaultEnvironmentId }
 *
 * defaultEnvironmentId is the user's "Production" environment for the
 * Default project. Routes that don't receive an explicit environmentId
 * fall back to this value.
 */

import { prisma } from '../db/prisma.js'
import { config } from '../config/index.js'

let _cachedDevUser = null

async function resolveDevUser() {
  if (_cachedDevUser) return _cachedDevUser

  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@dbshift.local'

  const user = await prisma.user.findUnique({
    where:   { email: adminEmail },
  })

  if (!user) {
    throw new Error(
      `[auth] Dev user "${adminEmail}" not found. Run: npx prisma db seed`
    )
  }

  // Find the default production environment
  const env = await prisma.environment.findFirst({
    where: {
      slug:    'production',
      project: { userId: user.id, name: 'Default' },
    },
  })

  _cachedDevUser = {
    id:                   user.id,
    name:                 user.name,
    email:                user.email,
    defaultEnvironmentId: env?.id ?? null,
  }

  return _cachedDevUser
}

/**
 * Fastify preHandler hook — attach req.user before route handlers run.
 * Register on the app instance so all routes get it automatically.
 */
export async function attachUser(request, reply) {
  if (config.app.isDev) {
    try {
      request.user = await resolveDevUser()
    } catch (err) {
      return reply.status(503).send({
        success: false,
        error:   err.message,
      })
    }
    return
  }

  // ── Production: JWT verification (implement when auth is built) ────────────
  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ success: false, error: 'Unauthorized' })
  }

  // TODO: const token = authHeader.slice(7)
  // TODO: const payload = jwt.verify(token, config.jwt.secret)
  // TODO: request.user = await prisma.user.findUnique({ where: { id: payload.sub } })
  return reply.status(401).send({ success: false, error: 'Auth not yet implemented in production mode' })
}

/**
 * Invalidates the cached dev user — call after seed re-runs in tests.
 */
export function clearDevUserCache() {
  _cachedDevUser = null
}
