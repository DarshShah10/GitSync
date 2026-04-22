import {
    createService,
    checkRepo,
    getService,
    getAllServices,
  } from '../controllers/service.controller.js'
  import { handleResult } from '../utils/index.js'
//   import preHandler from '../middleware/preHandler.js'
  import { attachUser } from '../middlewares/auth.middleware.js'

  export async function serviceRoutes(app) {
  
    // GET /api/services/check-repo?url=...
    // NOTE: must be registered BEFORE /:serviceId
    // otherwise Fastify matches "check-repo" as the serviceId param
    app.get('/api/services/check-repo', async (request, reply) => {
      const result = await checkRepo(request)
      return handleResult(reply, result)
    })
  
    // GET /api/services
    // Returns all services for the logged-in user
    app.get('/api/services', async (request, reply) => {
      const result = await getAllServices(request)
      return reply.send(result)
    })
  
    // POST /api/services
    // Creates a new service, returns { serviceId, name }
    app.post('/api/services', async (request, reply) => {
        console.log("server creation",request.body)   
      const result = await createService(request)
      console.log('[serviceRoutes] createService result:', result)
      return handleResult(reply, result)
    })
  
    // GET /api/services/:serviceId
    // Returns a single service by its MongoDB _id
    app.get('/api/services/:serviceId', async (request, reply) => {
      const result = await getService(request)
      return handleResult(reply, result)
    })
  
  }