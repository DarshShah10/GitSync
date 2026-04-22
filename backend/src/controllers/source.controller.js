import { GitHubSource } from '../models/githubSource.model.js'

// ─── List all sources for current user ────────────────────────────────────────
export async function listSources(request) {
  const sources = await GitHubSource.find({ userId: request.user.id })
    .select('-privateKey -clientSecret -webhookSecret')
    .sort({ createdAt: -1 })
    .lean()

  return {
    success: true,
    data: sources.map(sanitizeSource),
  }
}

// ─── Get single source ─────────────────────────────────────────────────────────
export async function getSource(request) {
  const source = await GitHubSource.findOne({
    _id: request.params.id,
    userId: request.user.id,
  })
    .select('-privateKey -clientSecret -webhookSecret')
    .lean()

  if (!source) return { error: 'Source not found', status: 404 }

  return { success: true, data: sanitizeSource(source) }
}

// ─── Create source (manual installation) ─────────────────────────────────────
export async function createSource(request) {
  const {
    name,
    organization,
    isSystemWide,
    appId,
    installationId,
    clientId,
    clientSecret,
    webhookSecret,
    privateKey,
    htmlUrl,
    apiUrl,
    gitUser,
    gitPort,
  } = request.body ?? {}

  if (!name) return { error: 'Name is required', status: 400 }

  const source = await GitHubSource.create({
    userId:         request.user.id,
    name,
    organization:   organization || null,
    isSystemWide:   isSystemWide || false,
    appId:          appId || null,
    installationId: installationId || null,
    clientId:       clientId || null,
    clientSecret:   clientSecret || null,
    webhookSecret:  webhookSecret || null,
    privateKey:     privateKey || null,
    htmlUrl:        htmlUrl || 'https://github.com',
    apiUrl:         apiUrl  || 'https://api.github.com',
    gitUser:        gitUser || 'git',
    gitPort:        gitPort || 22,
    installationType: 'manual',
    isConnected:    !!(appId && installationId && privateKey),
  })

  return { success: true, data: sanitizeSource(source.toObject()), status: 201 }
}

// ─── Initiate automated GitHub App installation ───────────────────────────────
export async function initiateAutomatedInstall(request) {
  const { name, organization, isSystemWide } = request.body ?? {}
  if (!name) return { error: 'Name is required', status: 400 }

  const slug = `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`

  const source = await GitHubSource.create({
    userId:          request.user.id,
    name,
    organization:    organization || null,
    isSystemWide:    isSystemWide || false,
    installationType: 'automated',
    isConnected:     false,
    appId:           slug,
  })

  const backendUrl  = process.env.BACKEND_URL || 'http://localhost:3000'
  const callbackUrl = `${backendUrl}/api/sources/github/callback`

  // GitHub's App Manifest flow requires a POST form submission — not a GET redirect.
  // The frontend builds a hidden <form method="POST"> to:
  //   https://github.com/settings/apps/new?state=<sourceId>
  // with a single hidden input `manifest` = JSON string below.
  // This produces GitHub's clean one-click "Create GitHub App for <user>" page.
  const manifest = {
    name:            slug,
    url:             backendUrl,
    hook_attributes: { url: `${backendUrl}/webhooks/github` },
    redirect_url:    callbackUrl,
    public:          false,
    default_permissions: { contents: 'read', metadata: 'read', pull_requests: 'read' },
    default_events:  ['push', 'pull_request'],
  }

  return {
    success: true,
    data: {
      source:        sanitizeSource(source.toObject()),
      manifestJson:  JSON.stringify(manifest),                             // hidden form field value
      githubPostUrl: `https://github.com/settings/apps/new?state=${source._id}`, // form action
    },
    status: 201,
  }
}

// ─── GitHub App OAuth callback — no auth, redirects to frontend ───────────────
export async function githubAppCallback(request, reply) {
  try {
    const { code, state: sourceId, installation_id } = request.query ?? {}

    const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173'

    if (!sourceId) return reply.redirect(`${frontendUrl}/sources?error=missing_state`)

    const source = await GitHubSource.findById(sourceId)
    if (!source) return reply.redirect(`${frontendUrl}/sources?error=source_not_found`)

    // In production: exchange `code` with GitHub for credentials
    // POST https://api.github.com/app-manifests/${code}/conversions
    if (installation_id) source.installationId = installation_id
    source.isConnected = true
    await source.save()

    return reply.redirect(`${frontendUrl}/sources?connected=true&sourceId=${sourceId}`)
  } catch {
    const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173'
    return reply.redirect(`${frontendUrl}/sources?error=callback_failed`)
  }
}

// ─── Update source ─────────────────────────────────────────────────────────────
export async function updateSource(request) {
  const source = await GitHubSource.findOne({
    _id: request.params.id,
    userId: request.user.id,
  })
  if (!source) return { error: 'Source not found', status: 404 }

  const fields = [
    'name', 'organization', 'isSystemWide',
    'appId', 'installationId', 'clientId',
    'clientSecret', 'webhookSecret', 'privateKey',
    'htmlUrl', 'apiUrl', 'gitUser', 'gitPort',
  ]
  const body = request.body ?? {}
  for (const field of fields) {
    if (body[field] !== undefined) source[field] = body[field]
  }
  source.isConnected = !!(source.appId && source.installationId && source.privateKey)
  await source.save()

  return { success: true, data: sanitizeSource(source.toObject()) }
}

// ─── Delete source ─────────────────────────────────────────────────────────────
export async function deleteSource(request) {
  const source = await GitHubSource.findOneAndDelete({
    _id: request.params.id,
    userId: request.user.id,
  })
  if (!source) return { error: 'Source not found', status: 404 }
  return { success: true, message: 'Source deleted' }
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function sanitizeSource(src) {
  const obj = { ...src }
  delete obj.privateKey
  delete obj.clientSecret
  delete obj.webhookSecret
  obj.id = (obj._id ?? obj.id)?.toString()
  return obj
}
