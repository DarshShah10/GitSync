import { User, Project } from '../models/index.js'
import { config } from '../config/index.js'

let _cachedDevUser = null

async function resolveDevUser() {
  if (_cachedDevUser) return _cachedDevUser

  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@gitsync.local'

  const user = await User.findOne({ email: adminEmail }).lean()

  if (!user) {
    throw new Error(
      `[auth] Dev user "${adminEmail}" not found. Run: npm run db:seed`
    )
  }

  const env = await Project.findOne({
    userId: user._id,
    name: 'Default',
    'environments.slug': 'production'
  }).lean()

  _cachedDevUser = {
    id:                   user._id,
    name:                 user.name,
    email:                user.email,
    defaultEnvironmentId: env?.environments?.[0]?._id ?? null,
  }

  return _cachedDevUser
}

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

  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ success: false, error: 'Unauthorized' })
  }

  return reply.status(401).send({ success: false, error: 'Auth not yet implemented in production mode' })
}

export function clearDevUserCache() {
  _cachedDevUser = null
}