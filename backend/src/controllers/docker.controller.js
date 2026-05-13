import { Service, Server, Deployment, DeploymentLog } from '../models/index.js'
import { appDeployQueue } from '../jobs/queues.js'
import { buildServerConfig } from '../utils/index.js'

// ─── POST /api/services/dockerfile ───────────────────────────────────────────
// Create a service that builds from a Dockerfile in a repo (public or private)
export const createDockerfileService = async (request) => {
  try {
    const {
      serverId,
      repoUrl,
      branch,
      baseDir,
      dockerfilePath,
      internalPort,
      githubSourceId,   // optional — if set, treat as private repo
    } = request.body ?? {}

    if (!repoUrl)   return { error: 'repoUrl is required', status: 400 }
    if (!serverId)  return { error: 'serverId is required', status: 400 }

    const server = await Server.findOne({ _id: serverId, userId: request.user.id })
    if (!server)                      return { error: 'Server not found', status: 404 }
    if (server.status !== 'CONNECTED') return { error: `Server "${server.name}" is not connected`, status: 400 }

    const name = repoUrl.split('/').pop().replace('.git', '') || 'my-app'

    const service = await Service.create({
      userId:       request.user.id,
      serverId,
      name,
      type:         'APP',
      status:       'STOPPED',
      internalPort: internalPort || 3000,
      isStatic:     false,
      repoType:     githubSourceId ? 'private' : 'public',
      ...(githubSourceId ? { githubSourceId } : {}),
      config: {
        repoUrl,
        branch:         branch         || 'main',
        baseDir:        baseDir        || '/',
        buildPack:      'DOCKERFILE',
        dockerfilePath: dockerfilePath || 'Dockerfile',
      },
    })

    return { status: 201, data: { serviceId: service._id, name: service.name } }
  } catch (err) {
    console.error('[createDockerfileService]', err)
    return { error: err.message || 'Failed to create service', status: 500 }
  }
}

// ─── POST /api/services/docker-image ─────────────────────────────────────────
// Create a service that pulls and runs a pre-built Docker image (no build step)
export const createDockerImageService = async (request) => {
  try {
    const {
      serverId,
      imageName,       // e.g. "nginx:latest" or "myregistry.io/myapp:v1.2.3"
      imageTag,        // optional override — combined into imageName:imageTag if both given
      internalPort,
      registryUrl,     // optional private registry host
      registryUser,    // optional private registry credentials
      registryPassword,
    } = request.body ?? {}

    if (!imageName) return { error: 'imageName is required', status: 400 }
    if (!serverId)  return { error: 'serverId is required', status: 400 }

    const server = await Server.findOne({ _id: serverId, userId: request.user.id })
    if (!server)                      return { error: 'Server not found', status: 404 }
    if (server.status !== 'CONNECTED') return { error: `Server "${server.name}" is not connected`, status: 400 }

    // Normalise full image reference
    const fullImage = imageTag ? `${imageName}:${imageTag}` : imageName
    const name      = imageName.split('/').pop().split(':')[0] || 'my-app'

    const service = await Service.create({
      userId:       request.user.id,
      serverId,
      name,
      type:         'APP',
      status:       'STOPPED',
      internalPort: internalPort || 80,
      isStatic:     false,
      config: {
        buildPack:        'DOCKER_IMAGE',
        dockerImage:      fullImage,
        registryUrl:      registryUrl      || null,
        registryUser:     registryUser     || null,
        registryPassword: registryPassword || null,
      },
    })

    return { status: 201, data: { serviceId: service._id, name: service.name } }
  } catch (err) {
    console.error('[createDockerImageService]', err)
    return { error: err.message || 'Failed to create service', status: 500 }
  }
}