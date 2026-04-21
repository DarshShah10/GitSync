import {
  createServer,
  listServers,
  getServer,
  getServerStatus,
  verifyServer,
  testServerConnection,
  updateServer,
  deleteServer,
} from '../controllers/server.controller.js'
import { serverIdSchema } from '../schemas/server.schema.js'
import { handleResult } from '../utils/index.js'

export async function serverRoutes(app) {

  app.post('/api/servers', async (request, reply) => {
    const result = await createServer(request)
    return handleResult(reply, result)
  })

  app.get('/api/servers', async (request, reply) => {
    const result = await listServers(request)
    return reply.send(result)
  })

  app.get('/api/servers/:id', async (request, reply) => {
    const result = await getServer(request)
    return handleResult(reply, result)
  })

  app.get('/api/servers/:id/status', async (request, reply) => {
    const result = await getServerStatus(request)
    return handleResult(reply, result)
  })

  app.post('/api/servers/:id/verify', async (request, reply) => {
    const result = await verifyServer(request)
    return handleResult(reply, result)
  })

  app.post('/api/servers/:id/test-connection', async (request, reply) => {
    const result = await testServerConnection(request)
    return handleResult(reply, result)
  })

  app.patch('/api/servers/:id', async (request, reply) => {
    const result = await updateServer(request)
    return handleResult(reply, result)
  })

  app.delete('/api/servers/:id', async (request, reply) => {
    const result = await deleteServer(request)
    return handleResult(reply, result)
  })
}