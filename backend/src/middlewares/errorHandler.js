import { ZodError } from 'zod'

/**
 * Registers a global error handler on the Fastify instance.
 * Handles Zod validation errors, Prisma errors, and generic errors
 * with consistent JSON responses.
 */
export function registerErrorHandler(app) {
  app.setErrorHandler((error, request, reply) => {
    const log = request.log || app.log

    // ── Zod validation error ─────────────────────────────────────────
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        details: error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      })
    }

    // ── Prisma known errors ──────────────────────────────────────────
    if (error.code === 'P2025') {
      return reply.status(404).send({
        success: false,
        error: 'Record not found',
      })
    }

    if (error.code === 'P2002') {
      return reply.status(409).send({
        success: false,
        error: 'A record with this value already exists',
      })
    }

    // ── Fastify 404 ──────────────────────────────────────────────────
    if (error.statusCode === 404) {
      return reply.status(404).send({
        success: false,
        error: 'Route not found',
      })
    }

    // ── Fastify rate limit ───────────────────────────────────────────
    if (error.statusCode === 429) {
      return reply.status(429).send({
        success: false,
        error: 'Too many requests. Please slow down.',
      })
    }

    // ── Generic server error ─────────────────────────────────────────
    log.error({ err: error }, 'Unhandled error')

    return reply.status(error.statusCode || 500).send({
      success: false,
      error: process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : error.message,
    })
  })

  // Handle 404 for unknown routes
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      success: false,
      error: `Route ${request.method} ${request.url} not found`,
    })
  })
}
