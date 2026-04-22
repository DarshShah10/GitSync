import { Service } from '../models/index.js'

// ─────────────────────────────────────────────────────────────────────────────
// In Fastify, request.body, request.params, request.query work the same way
// but instead of res.status().json() we return { status, data } or { error }
// and let handleResult() in the route send the actual reply
// ─────────────────────────────────────────────────────────────────────────────


// POST /api/services
// Creates a new Service document in MongoDB
// Returns { serviceId, name } → frontend navigates to /apps/:serviceId
export const createService = async (request) => {
  try {
    const {
      repoUrl,
      branch,
      baseDir,
      buildPack,    // 'NIXPACKS' | 'DOCKERFILE' | 'STATIC'
      internalPort,
      isStatic,
      type,         // 'GIT'
      serverId,
    } = request.body

    if (!repoUrl)  return { error: 'repoUrl is required', status: 400 }
    if (!serverId) return { error: 'serverId is required', status: 400 }

    // Auto-generate name from repo URL
    // "https://github.com/user/my-app" → "my-app"
    const name = repoUrl.split('/').pop().replace('.git', '') || 'my-app'

    // MongoDB auto-generates _id here
    const service = await Service.create({
      userId:       request.user.id,   // injected by your auth middleware/hook
      serverId,
      name,
      type:         type || 'GIT',
      status:       'STOPPED',
      internalPort: internalPort || 3000,
      isStatic:     isStatic || false,
      config: {
        repoUrl,
        branch:   branch  || 'main',
        baseDir:  baseDir || '/',
        buildPack,
      },
    })

    return {
      status: 201,
      data: {
        serviceId: service._id,   // frontend navigates to /apps/:serviceId
        name:      service.name,
      },
    }

  } catch (err) {
    console.error('[createService]', err)
    return { error: err.message || 'Failed to create service', status: 500 }
  }
}


// GET /api/services/check-repo?url=...
// Checks if a GitHub repo is publicly accessible
export const checkRepo = async (request) => {
  try {
    const { url } = request.query

    if (!url) return { error: 'url is required', status: 400 }

    // "https://github.com/user/repo" → match[1]="user", match[2]="repo"
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/)
    if (!match) {
      return { error: 'Only GitHub URLs are supported for now', status: 400 }
    }

    const apiUrl = `https://api.github.com/repos/${match[1]}/${match[2]}`
    const ghRes  = await fetch(apiUrl, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    })

    if (!ghRes.ok) {
      return { error: 'Repository not found or is private', status: 404 }
    }

    const repo = await ghRes.json()

    return {
      data: {
        ok:            true,
        name:          repo.full_name,
        defaultBranch: repo.default_branch,
      },
    }

  } catch (err) {
    console.error('[checkRepo]', err)
    return { error: 'Failed to check repository', status: 500 }
  }
}


// GET /api/services/:serviceId
// Returns a single service by MongoDB _id
export const getService = async (request) => {
  try {
    const service = await Service.findOne({
      _id:    request.params.serviceId,
      userId: request.user._id,
    }).populate('serverId', 'name ip status')

    if (!service) return { error: 'Service not found', status: 404 }

    return { data: service }

  } catch (err) {
    console.error('[getService]', err)
    return { error: err.message, status: 500 }
  }
}


// GET /api/services
// Returns all services for the logged-in user
// Uses reply.send() directly in the route (same pattern as listDatabases)
export const getAllServices = async (request) => {
  try {
    const services = await Service.find({ userId: request.user._id })
      .sort({ createdAt: -1 })
      .populate('serverId', 'name ip status')

    return services

  } catch (err) {
    console.error('[getAllServices]', err)
    return []
  }
}