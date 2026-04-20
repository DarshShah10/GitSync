/**
 * /api/projects routes
 *
 * Projects group services by product/repo.
 * Each project has named Environments (prod, staging, dev).
 */

import { prisma } from '../db/prisma.js'
import { z } from 'zod'

const projectIdSchema = z.object({ id: z.string().uuid() })
const envIdSchema     = z.object({ id: z.string().uuid(), envId: z.string().uuid() })

const createProjectSchema = z.object({
  name:        z.string().min(1).max(64).trim(),
  description: z.string().max(256).optional(),
  teamId:      z.string().uuid().optional(),
})

const createEnvironmentSchema = z.object({
  name: z.string().min(1).max(64).trim(),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens')
    .trim(),
})

export async function projectRoutes(app) {

  // ── POST /api/projects ──────────────────────────────────────────────────────
  app.post('/api/projects', async (request, reply) => {
    const body = createProjectSchema.parse(request.body)

    const project = await prisma.project.create({
      data: {
        userId:      request.user.id,
        teamId:      body.teamId ?? null,
        name:        body.name,
        description: body.description ?? null,
      },
      include: { environments: true },
    })

    return reply.status(201).send({ success: true, data: project })
  })

  // ── GET /api/projects ───────────────────────────────────────────────────────
  app.get('/api/projects', async (request, reply) => {
    const projects = await prisma.project.findMany({
      where:   { userId: request.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        environments: {
          include: { _count: { select: { services: true } } },
        },
        _count: { select: { environments: true } },
      },
    })

    return { success: true, data: projects }
  })

  // ── GET /api/projects/:id ───────────────────────────────────────────────────
  app.get('/api/projects/:id', async (request, reply) => {
    const { id } = projectIdSchema.parse(request.params)

    const project = await prisma.project.findFirst({
      where:   { id, userId: request.user.id },
      include: {
        environments: {
          include: {
            services: {
              where:   { type: 'DATABASE' },
              select:  { id: true, name: true, status: true, config: true },
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!project) return reply.status(404).send({ success: false, error: 'Project not found' })

    return { success: true, data: project }
  })

  // ── PATCH /api/projects/:id ─────────────────────────────────────────────────
  app.patch('/api/projects/:id', async (request, reply) => {
    const { id } = projectIdSchema.parse(request.params)
    const body   = createProjectSchema.partial().parse(request.body)

    const project = await prisma.project.findFirst({ where: { id, userId: request.user.id } })
    if (!project) return reply.status(404).send({ success: false, error: 'Project not found' })

    const updated = await prisma.project.update({ where: { id }, data: body })
    return { success: true, data: updated }
  })

  // ── DELETE /api/projects/:id ────────────────────────────────────────────────
  app.delete('/api/projects/:id', async (request, reply) => {
    const { id } = projectIdSchema.parse(request.params)

    const project = await prisma.project.findFirst({
      where:   { id, userId: request.user.id },
      include: { _count: { select: { environments: true } } },
    })
    if (!project) return reply.status(404).send({ success: false, error: 'Project not found' })

    await prisma.project.delete({ where: { id } })
    return { success: true, message: `Project "${project.name}" deleted.` }
  })

  // ── POST /api/projects/:id/environments ─────────────────────────────────────
  app.post('/api/projects/:id/environments', async (request, reply) => {
    const { id } = projectIdSchema.parse(request.params)
    const body   = createEnvironmentSchema.parse(request.body)

    const project = await prisma.project.findFirst({ where: { id, userId: request.user.id } })
    if (!project) return reply.status(404).send({ success: false, error: 'Project not found' })

    // Check slug uniqueness within project
    const existing = await prisma.environment.findUnique({
      where: { projectId_slug: { projectId: id, slug: body.slug } },
    })
    if (existing) {
      return reply.status(409).send({
        success: false,
        error:   `An environment with slug "${body.slug}" already exists in this project.`,
      })
    }

    const env = await prisma.environment.create({
      data: { projectId: id, name: body.name, slug: body.slug },
    })

    return reply.status(201).send({ success: true, data: env })
  })

  // ── DELETE /api/projects/:id/environments/:envId ────────────────────────────
  app.delete('/api/projects/:id/environments/:envId', async (request, reply) => {
    const { id, envId } = envIdSchema.parse(request.params)

    const env = await prisma.environment.findFirst({
      where:   { id: envId, projectId: id, project: { userId: request.user.id } },
      include: { _count: { select: { services: true } } },
    })
    if (!env) return reply.status(404).send({ success: false, error: 'Environment not found' })
    if (env._count.services > 0) {
      return reply.status(400).send({
        success: false,
        error:   `Cannot delete environment with ${env._count.services} active service(s). Delete services first.`,
      })
    }

    await prisma.environment.delete({ where: { id: envId } })
    return { success: true, message: `Environment "${env.name}" deleted.` }
  })
}
