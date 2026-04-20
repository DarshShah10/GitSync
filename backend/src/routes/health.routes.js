import { healthCheck, readinessCheck } from '../controllers/health.controller.js'

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
    const result = await healthCheck()
    return result
  })

  app.get('/health/ready', {
    schema: {
      tags: ['Health'],
      summary: 'Readiness probe — checks DB and Redis',
    },
  }, async (request, reply) => {
    const result = await readinessCheck()
    return reply.status(result.isHealthy ? 200 : 503).send({
      status: result.status,
      timestamp: result.timestamp,
      checks: result.checks,
    })
  })
}