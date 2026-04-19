import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'

import { config } from './config/index.js'
import { registerErrorHandler } from './middleware/errorHandler.js'
import { healthRoutes } from './routes/health.js'
import { serverRoutes } from './routes/servers.js'
import { startAllWorkers, stopAllWorkers } from './jobs/workers.js'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.app.isDev ? 'debug' : 'info',
      transport: config.app.isDev
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
    },
    genReqId: () => crypto.randomUUID(),
    trustProxy: config.app.isProd,
  })

  await app.register(helmet, { contentSecurityPolicy: false })

  await app.register(cors, {
    origin: config.app.isDev ? true : ['http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      success: false,
      error: 'Too many requests. Please slow down.',
    }),
  })

  registerErrorHandler(app)

  await app.register(healthRoutes)
  await app.register(serverRoutes)

  app.get('/', async () => ({
    name: 'DBShift API',
    version: '1.0.0',
    docs: '/health',
  }))

  return app
}

async function start() {
  let app
  let workers = []

  try {
    app = await buildApp()
    await app.listen({ port: config.app.port, host: config.app.host })
    app.log.info(`Environment: ${config.app.env}`)
    app.log.info(`Server listening on http://${config.app.host}:${config.app.port}`)
    workers = startAllWorkers()
  } catch (err) {
    if (app) app.log.error(err)
    else console.error('Failed to start server:', err)
    process.exit(1)
  }

  async function shutdown(signal) {
    app.log.info(`Received ${signal}. Shutting down gracefully…`)
    try {
      await stopAllWorkers(workers)
      await app.close()
      app.log.info('Server closed.')
      process.exit(0)
    } catch (err) {
      app.log.error('Error during shutdown:', err)
      process.exit(1)
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT',  () => shutdown('SIGINT'))
}

start()
