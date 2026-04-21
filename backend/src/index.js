import 'dotenv/config'
import Fastify          from 'fastify'
import cors             from '@fastify/cors'
import helmet           from '@fastify/helmet'
import rateLimit        from '@fastify/rate-limit'
import cookie           from '@fastify/cookie'
import session          from '@fastify/session'
import { passport }     from './config/passport.config.js'
import { config }       from './constants/index.js'
import { connect as connectMongo, disconnect as disconnectMongo } from './db/mongo.js'
import { registerErrorHandler } from './middlewares/errorHandler.js'
import { attachUser }   from './middlewares/auth.middleware.js'
import { healthRoutes } from './routes/health.routes.js'
import { serverRoutes } from './routes/server.routes.js'
import { databaseRoutes } from './routes/database.routes.js'
import { projectRoutes } from './routes/project.routes.js'
import { authRoutes }   from './routes/auth.routes.js'
import { startAllWorkers, stopAllWorkers } from './jobs/workers.js'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.app.isDev ? 'debug' : 'info',
      transport: config.app.isDev
        ? {
            target:  'pino-pretty',
            options: {
              colorize:      true,
              translateTime: 'SYS:standard',
              ignore:        'pid,hostname',
            },
          }
        : undefined,
    },
    genReqId:   () => crypto.randomUUID(),
    trustProxy: config.app.isProd,
  })

  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(cors, {
    origin:         config.app.isDev ? true : ['http://localhost:5173'],
    methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials:    true,
  })
  await app.register(rateLimit, {
    max:                  100,
    timeWindow:           '1 minute',
    errorResponseBuilder: () => ({
      success: false,
      error:   'Too many requests. Please slow down.',
    }),
  })

  // ── Auth plugins (order matters — cookie before session before passport) ──
  await app.register(cookie)
  await app.register(session, {
    secret:            process.env.SESSION_SECRET,
    saveUninitialized: false,
    cookie: {
      secure:   config.app.isProd,
      sameSite: config.app.isProd ? 'none' : 'lax',
      maxAge:   10 * 60 * 1000,   // 10 min — only needed for OAuth round-trip
    },
  })
  await app.register(passport.initialize())
  await app.register(passport.secureSession())

  registerErrorHandler(app)

  // Skip attachUser for auth routes — they don't have a token yet
  app.addHook('preHandler', async (request, reply) => {
    if (request.routeOptions?.config?.skipAuth) return
    return attachUser(request, reply)
  })

  // Auth routes first so OAuth callbacks aren't intercepted by other plugins
  await app.register(authRoutes)
  await app.register(healthRoutes)
  await app.register(serverRoutes)
  await app.register(databaseRoutes)
  await app.register(projectRoutes)

  app.get('/', async () => ({
    name:    'GitSync API',
    version: '3.0.0',
    docs:    '/health',
  }))

  return app
}

async function start() {
  let app
  let workers = []
  try {
    await connectMongo()
    console.log('MongoDB connected.')
    app = await buildApp()
    await app.listen({ port: config.app.port, host: config.app.host })
    app.log.info(`Environment: ${config.app.env}`)
    app.log.info(`Server listening on http://${config.app.host}:${config.app.port}`)
    workers = await startAllWorkers()
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
      await disconnectMongo()
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