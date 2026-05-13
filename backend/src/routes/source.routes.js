import {
  listSources,
  getSource,
  createSource,
  initiateAutomatedInstall,
  githubAppCallback,
  updateSource,
  deleteSource,
  getSourceInstallations,
  setInstallationId,
  listSourceRepos,
} from '../controllers/source.controller.js'
import { handleResult } from '../utils/index.js'

export async function sourceRoutes(app) {

  // Public — GitHub redirects here after OAuth flow, no JWT needed
  app.get('/api/sources/github/callback', {
    config: { skipAuth: true },
    handler: async (request, reply) => {
      return githubAppCallback(request, reply)
    },
  })

  // Protected routes
  app.get('/api/sources', async (request, reply) => {
    const result = await listSources(request)
    return handleResult(reply, result)
  })

  app.get('/api/sources/:id', async (request, reply) => {
    const result = await getSource(request)
    return handleResult(reply, result)
  })

  app.post('/api/sources', async (request, reply) => {
    const result = await createSource(request)
    return handleResult(reply, result)
  })

  app.post('/api/sources/github/initiate', async (request, reply) => {
    const result = await initiateAutomatedInstall(request)
    return handleResult(reply, result)
  })

  // Get GitHub App installations for a source
  app.get('/api/sources/:id/installations', async (request, reply) => {
    const result = await getSourceInstallations(request)
    return handleResult(reply, result)
  })

  // Set/update the installation ID on a source
  app.post('/api/sources/:id/installation', async (request, reply) => {
    const result = await setInstallationId(request)
    return handleResult(reply, result)
  })

  // List repos accessible via this source's GitHub App installation
  app.get('/api/sources/:id/repos', async (request, reply) => {
    const result = await listSourceRepos(request)
    return handleResult(reply, result)
  })

  app.patch('/api/sources/:id', async (request, reply) => {
    const result = await updateSource(request)
    return handleResult(reply, result)
  })

  app.delete('/api/sources/:id', async (request, reply) => {
    const result = await deleteSource(request)
    return handleResult(reply, result)
  })
}