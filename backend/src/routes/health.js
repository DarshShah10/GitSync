import { mongoose } from '../db/mongo.js'
import { redis } from '../db/redis.js'

export async function healthRoutes(app) {
  app.get('/health', {
    schema: {
      tags: ['Health'],
      summary: 'Liveness probe',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            uptime: { type: 'number' },
            version: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
    }
  })

  app.get('/health/ready', {
    schema: {
      tags: ['Health'],
      summary: 'Readiness probe — checks DB and Redis',
    },
  }, async (request, reply) => {
    const checks = {
      database: false,
      redis: false,
    }

    try {
      if (mongoose.connection.readyState === 1) {
        checks.database = true
      }
    } catch (err) {
      app.log.error({ err }, 'Database health check failed')
    }

    try {
      await redis.connect().catch(() => {})
      await redis.ping()
      checks.redis = true
    } catch (err) {
      app.log.error({ err }, 'Redis health check failed')
    }

    const allHealthy = Object.values(checks).every(Boolean)

    return reply.status(allHealthy ? 200 : 503).send({
      status: allHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    })
  })
}
