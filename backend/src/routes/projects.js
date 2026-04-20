import { Project, Service } from '../models/index.js'
import { z } from 'zod'

const projectIdSchema = z.object({ id: z.string() })
const envIdSchema     = z.object({ id: z.string(), envId: z.string() })

const createProjectSchema = z.object({
  name:        z.string().min(1).max(64).trim(),
  description: z.string().max(256).optional(),
  teamId:      z.string().optional(),
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

  app.post('/api/projects', async (request, reply) => {
    const body = createProjectSchema.parse(request.body)

    const project = await Project.create({
      userId:      request.user.id,
      teamId:      body.teamId ?? null,
      name:        body.name,
      description: body.description ?? null,
    })

    return reply.status(201).send({ success: true, data: project })
  })

  app.get('/api/projects', async (request, reply) => {
    const projects = await Project.find({ userId: request.user.id })
      .sort({ createdAt: -1 })
      .lean()

    const projectsWithCounts = await Promise.all(projects.map(async (proj) => {
      const envCount = proj.environments?.length ?? 0
      let serviceCount = 0
      if (proj.environments?.length) {
        serviceCount = await Service.countDocuments({
          environmentId: { $in: proj.environments.map(e => e._id) }
        })
      }
      return { ...proj, _count: { environments: envCount, services: serviceCount } }
    }))

    return { success: true, data: projectsWithCounts }
  })

  app.get('/api/projects/:id', async (request, reply) => {
    const { id } = projectIdSchema.parse(request.params)

    const project = await Project.findOne({
      _id: id,
      userId: request.user.id
    }).lean()

    if (!project) return reply.status(404).send({ success: false, error: 'Project not found' })

    return { success: true, data: project }
  })

  app.patch('/api/projects/:id', async (request, reply) => {
    const { id } = projectIdSchema.parse(request.params)
    const body   = createProjectSchema.partial().parse(request.body)

    const project = await Project.findOne({ _id: id, userId: request.user.id })
    if (!project) return reply.status(404).send({ success: false, error: 'Project not found' })

    const updateData = {}
    if (body.name) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description

    await Project.updateOne({ _id: id }, { $set: updateData })

    const updated = await Project.findById(id).lean()
    return { success: true, data: updated }
  })

  app.delete('/api/projects/:id', async (request, reply) => {
    const { id } = projectIdSchema.parse(request.params)

    const project = await Project.findOne({
      _id: id,
      userId: request.user.id
    })

    if (!project) return reply.status(404).send({ success: false, error: 'Project not found' })

    await Project.deleteOne({ _id: id })
    return { success: true, message: `Project "${project.name}" deleted.` }
  })

  app.post('/api/projects/:id/environments', async (request, reply) => {
    const { id } = projectIdSchema.parse(request.params)
    const body   = createEnvironmentSchema.parse(request.body)

    const project = await Project.findOne({ _id: id, userId: request.user.id })
    if (!project) return reply.status(404).send({ success: false, error: 'Project not found' })

    const existing = project.environments?.find(e => e.slug === body.slug)
    if (existing) {
      return reply.status(409).send({
        success: false,
        error:   `An environment with slug "${body.slug}" already exists in this project.`,
      })
    }

    await Project.updateOne(
      { _id: id },
      { $push: { environments: { name: body.name, slug: body.slug } } }
    )

    const updated = await Project.findById(id).lean()
    const env = updated.environments.find(e => e.slug === body.slug)

    return reply.status(201).send({ success: true, data: env })
  })

  app.delete('/api/projects/:id/environments/:envId', async (request, reply) => {
    const { id, envId } = envIdSchema.parse(request.params)

    const project = await Project.findOne({
      _id: id,
      userId: request.user.id
    }).lean()

    if (!project) return reply.status(404).send({ success: false, error: 'Project not found' })

    const env = project.environments?.find(e => e._id?.toString() === envId)
    if (!env) return reply.status(404).send({ success: false, error: 'Environment not found' })

    const serviceCount = await Service.countDocuments({ environmentId: envId })
    if (serviceCount > 0) {
      return reply.status(400).send({
        success: false,
        error:   `Cannot delete environment with ${serviceCount} active service(s). Delete services first.`,
      })
    }

    await Project.updateOne(
      { _id: id },
      { $pull: { environments: { _id: envId } } }
    )

    return { success: true, message: `Environment "${env.name}" deleted.` }
  })
}