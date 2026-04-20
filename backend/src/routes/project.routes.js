import {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  createEnvironment,
  deleteEnvironment,
} from '../controllers/project.controller.js'
import { handleResult } from '../utils/index.js'

export async function projectRoutes(app) {

  app.post('/api/projects', async (request, reply) => {
    const result = await createProject(request)
    return handleResult(reply, result)
  })

  app.get('/api/projects', async (request, reply) => {
    const result = await listProjects(request)
    return reply.send(result)
  })

  app.get('/api/projects/:id', async (request, reply) => {
    const result = await getProject(request)
    return handleResult(reply, result)
  })

  app.patch('/api/projects/:id', async (request, reply) => {
    const result = await updateProject(request)
    return handleResult(reply, result)
  })

  app.delete('/api/projects/:id', async (request, reply) => {
    const result = await deleteProject(request)
    return handleResult(reply, result)
  })

  app.post('/api/projects/:id/environments', async (request, reply) => {
    const result = await createEnvironment(request)
    return handleResult(reply, result)
  })

  app.delete('/api/projects/:id/environments/:envId', async (request, reply) => {
    const result = await deleteEnvironment(request)
    return handleResult(reply, result)
  })
}