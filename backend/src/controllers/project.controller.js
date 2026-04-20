import { Project, Service } from '../models/index.js'
import { projectIdSchema, envIdSchema, createProjectSchema, createEnvironmentSchema } from '../schemas/project.schema.js'

export async function createProject(request) {
  const body = createProjectSchema.parse(request.body)

  const project = await Project.create({
    userId:      request.user.id,
    teamId:      body.teamId ?? null,
    name:       body.name,
    description: body.description ?? null,
  })

  return { success: true, data: project, status: 201 }
}

export async function listProjects(request) {
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
}

export async function getProject(request) {
  const { id } = projectIdSchema.parse(request.params)

  const project = await Project.findOne({
    _id: id,
    userId: request.user.id
  }).lean()

  if (!project) return { error: 'Project not found', status: 404 }

  return { success: true, data: project }
}

export async function updateProject(request) {
  const { id } = projectIdSchema.parse(request.params)
  const body   = createProjectSchema.partial().parse(request.body)

  const project = await Project.findOne({ _id: id, userId: request.user.id })
  if (!project) return { error: 'Project not found', status: 404 }

  const updateData = {}
  if (body.name) updateData.name = body.name
  if (body.description !== undefined) updateData.description = body.description

  await Project.updateOne({ _id: id }, { $set: updateData })

  const updated = await Project.findById(id).lean()
  return { success: true, data: updated }
}

export async function deleteProject(request) {
  const { id } = projectIdSchema.parse(request.params)

  const project = await Project.findOne({
    _id: id,
    userId: request.user.id
  })

  if (!project) return { error: 'Project not found', status: 404 }

  await Project.deleteOne({ _id: id })
  return { success: true, message: `Project "${project.name}" deleted.` }
}

export async function createEnvironment(request) {
  const { id } = projectIdSchema.parse(request.params)
  const body   = createEnvironmentSchema.parse(request.body)

  const project = await Project.findOne({ _id: id, userId: request.user.id })
  if (!project) return { error: 'Project not found', status: 404 }

  const existing = project.environments?.find(e => e.slug === body.slug)
  if (existing) {
    return { error: `An environment with slug "${body.slug}" already exists in this project.`, status: 409 }
  }

  await Project.updateOne(
    { _id: id },
    { $push: { environments: { name: body.name, slug: body.slug } } }
  )

  const updated = await Project.findById(id).lean()
  const env = updated.environments.find(e => e.slug === body.slug)

  return { success: true, data: env, status: 201 }
}

export async function deleteEnvironment(request) {
  const { id, envId } = envIdSchema.parse(request.params)

  const project = await Project.findOne({
    _id: id,
    userId: request.user.id
  }).lean()

  if (!project) return { error: 'Project not found', status: 404 }

  const env = project.environments?.find(e => e._id?.toString() === envId)
  if (!env) return { error: 'Environment not found', status: 404 }

  const serviceCount = await Service.countDocuments({ environmentId: envId })
  if (serviceCount > 0) {
    return { error: `Cannot delete environment with ${serviceCount} active service(s). Delete services first.`, status: 400 }
  }

  await Project.updateOne(
    { _id: id },
    { $pull: { environments: { _id: envId } } }
  )

  return { success: true, message: `Environment "${env.name}" deleted.` }
}