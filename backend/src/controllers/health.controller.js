import { mongoose } from '../db/mongo.js'
import { redis } from '../db/redis.js'

export async function healthCheck() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
  }
}

export async function readinessCheck() {
  const checks = { database: false, redis: false }

  if (mongoose.connection.readyState === 1) {
    checks.database = true
  }

  try {
    await redis.connect().catch(() => {})
    if (redis.isReady) {
      await redis.ping()
      checks.redis = true
    }
  } catch (_) {}

  const allHealthy = Object.values(checks).every(Boolean)

  return {
    status: allHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
    isHealthy: allHealthy,
  }
}