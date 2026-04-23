import { GitHubSource } from '../models/githubSource.model.js'
import { fetchInstallations, listInstallationRepos } from '../services/github.service.js'

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
  }).lean()

  if (!source) return { error: 'Source not found', status: 404 }
  return { success: true, data: sanitizeSource(source, true) }
}

// ─── Create source (manual) ──────────────────────────────────────────────────
export async function createSource(request) {
  const {
    name, organization, isSystemWide,
    appId, installationId, clientId,
    clientSecret, webhookSecret, privateKey,
    htmlUrl, apiUrl, gitUser, gitPort,
  } = request.body ?? {}

  if (!name) return { error: 'Name is required', status: 400 }

  const source = await GitHubSource.create({
    userId: request.user.id,
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
    isConnected: !!(appId && installationId && privateKey),
  })

  return { success: true, data: sanitizeSource(source.toObject()), status: 201 }
}

// ─── Initiate automated GitHub App installation ───────────────────────────────
export async function initiateAutomatedInstall(request) {
  const { name, organization, isSystemWide } = request.body ?? {}
  if (!name) return { error: 'Name is required', status: 400 }

  const slug = `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`

  const source = await GitHubSource.create({
    userId: request.user.id,
    name,
    organization:    organization || null,
    isSystemWide:    isSystemWide || false,
    installationType: 'automated',
    isConnected:     false,
    appId:           slug,
  })

  const backendUrl  = process.env.SERVER_URL || 'http://localhost:3000'
  const callbackUrl = `${backendUrl}/api/sources/github/callback`

  const manifest = {
    name:            slug,
    url:             backendUrl,
    hook_attributes: { url: `${backendUrl}/webhooks/github/app` },
    redirect_url:    callbackUrl,
    setup_url:       callbackUrl,
    setup_on_update: true,
    public:          false,
    default_permissions: { contents: 'read', metadata: 'read', pull_requests: 'read' },
    default_events:  ['push', 'pull_request'],
  }

  return {
    success: true,
    data: {
      source:        sanitizeSource(source.toObject()),
      manifestJson:  JSON.stringify(manifest),
      githubPostUrl: `https://github.com/settings/apps/new?state=${source._id}`,
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

    // Phase 1: exchange code for app credentials
    if (code) {
      const response = await fetch(`https://api.github.com/app-manifests/${code}/conversions`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
      })
      if (response.ok) {
        const appData = await response.json()
        source.appId         = appData.id?.toString() || source.appId
        source.clientId      = appData.client_id || null
        source.clientSecret  = appData.client_secret || null
        source.webhookSecret = appData.webhook_secret || null
        source.privateKey    = appData.pem || null
        source.htmlUrl       = appData.html_url || 'https://github.com'
        source.apiUrl        = 'https://api.github.com'
        source.name          = appData.name || source.name
      }
    }

    // Phase 2: capture installation_id
    if (installation_id) {
      source.installationId = installation_id
    }

    // Auto-discover installation if we have credentials but no installationId
    if (source.appId && source.privateKey && !source.installationId) {
      try {
        const appIdNumeric = parseInt(source.appId, 10)
        if (!isNaN(appIdNumeric)) {
          const installations = await fetchInstallations(
            appIdNumeric,
            source.privateKey,
            source.apiUrl || 'https://api.github.com'
          )
          if (installations.length > 0) {
            source.installationId = String(installations[0].id)
          }
        }
      } catch (apiErr) {
        console.warn('[githubAppCallback] auto-discover installation failed:', apiErr.message)
      }
    }

    source.isConnected = !!(source.appId && source.installationId && source.privateKey)
    await source.save()

    if (source.isConnected) {
      return reply.redirect(`${frontendUrl}/sources?connected=true&sourceId=${sourceId}`)
    } else if (source.appId && source.privateKey) {
      // App created but not yet installed on any repos
      const appSlug = source.name || source.appId
      return reply.redirect(
        `${frontendUrl}/sources?install=true&sourceId=${sourceId}&appSlug=${encodeURIComponent(appSlug)}`
      )
    } else {
      return reply.redirect(`${frontendUrl}/sources?connected=true&sourceId=${sourceId}`)
    }
  } catch (err) {
    console.error('GitHub App callback error:', err)
    const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173'
    return reply.redirect(`${frontendUrl}/sources?error=callback_failed`)
  }
}

// ─── Get installations for a source ──────────────────────────────────────────
export async function getSourceInstallations(request) {
  try {
    const source = await GitHubSource.findOne({
      _id: request.params.id,
      userId: request.user.id,
    }).lean()

    if (!source) return { error: 'Source not found', status: 404 }
    if (!source.appId || !source.privateKey) {
      return { error: 'Source does not have credentials yet', status: 400 }
    }

    const appIdNumeric = parseInt(source.appId, 10)
    if (isNaN(appIdNumeric)) {
      return { error: 'App credentials not yet confirmed — please wait for GitHub callback', status: 400 }
    }

    const installations = await fetchInstallations(
      appIdNumeric,
      source.privateKey,
      source.apiUrl || 'https://api.github.com'
    )

    return {
      success: true,
      data: installations.map(i => ({
        id:      i.id,
        account: { login: i.account?.login, type: i.account?.type },
      })),
    }
  } catch (err) {
    console.error('[getSourceInstallations]', err)
    return { error: err.message, status: 500 }
  }
}

// ─── Set installation ID ──────────────────────────────────────────────────────
export async function setInstallationId(request) {
  const { installationId } = request.body ?? {}
  if (!installationId) return { error: 'installationId is required', status: 400 }

  const source = await GitHubSource.findOne({
    _id: request.params.id,
    userId: request.user.id,
  })
  if (!source) return { error: 'Source not found', status: 404 }

  source.installationId = String(installationId)
  source.isConnected = !!(source.appId && source.installationId && source.privateKey)
  await source.save()

  return { success: true, data: sanitizeSource(source.toObject()) }
}

// ─── List repos accessible to a connected source ─────────────────────────────
export async function listSourceRepos(request) {
  try {
    const source = await GitHubSource.findOne({
      _id: request.params.id,
      userId: request.user.id,
    }).lean()

    if (!source) return { error: 'Source not found', status: 404 }
    if (!source.isConnected) return { error: 'Source is not connected', status: 400 }

    const repos = await listInstallationRepos(
      source.appId,
      source.installationId,
      source.privateKey,
      source.apiUrl || 'https://api.github.com'
    )

    return {
      success: true,
      data: repos.map(r => ({
        fullName:      r.full_name,
        isPrivate:     r.private,
        defaultBranch: r.default_branch,
        description:   r.description,
        htmlUrl:       r.html_url,
      })),
    }
  } catch (err) {
    console.error('[listSourceRepos]', err)
    return { error: err.message, status: 500 }
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
function sanitizeSource(src, includeSecrets = false) {
  const obj = { ...src }
  obj.id = (obj._id ?? obj.id)?.toString()
  delete obj._id
  delete obj.__v
  delete obj.userId

  if (!includeSecrets && obj.privateKey)    obj.privateKey    = '***hidden***'
  if (!includeSecrets && obj.clientSecret)  obj.clientSecret  = '***hidden***'
  if (!includeSecrets && obj.webhookSecret) obj.webhookSecret = '***hidden***'

  return obj
}