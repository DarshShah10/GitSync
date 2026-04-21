import { User }      from '../models/index.js'
import { verifyToken, getTokenFromRequest } from '../utils/jwt.utils.js'

// Always verify JWT — no dev seed-user bypass.
// Auth is implemented and working, so every request must carry a valid token.
export async function attachUser(request, reply) {
  const token = getTokenFromRequest(request)
  if (!token) {
    return reply.status(401).send({ success: false, error: 'Unauthorized' })
  }

  try {
    const decoded = verifyToken(token)
    const user    = await User.findById(decoded.id).select('-passwordHash').lean()
    if (!user) {
      return reply.status(401).send({ success: false, error: 'Account not found.' })
    }
    request.user = {
      id:    user._id.toString(),
      name:  user.name,
      email: user.email,
    }
  } catch {
    return reply.status(401).send({ success: false, error: 'Invalid or expired session.' })
  }
}

// Kept for backwards compatibility — no-op now that dev bypass is removed
export function clearDevUserCache() {}