import jwt from 'jsonwebtoken'
import crypto from 'crypto'

// ─────────────────────────────────────────────────────────────────────────────
// github.service.js
//
// Utilities for GitHub App authentication:
//   - generateAppJWT:       short-lived JWT to authenticate as the App itself
//   - getInstallationToken: OAuth token scoped to one installation (for git clone)
//   - fetchInstallations:   list all installations of an App
//   - checkRepoAccess:      verify an installation has access to a specific repo
//   - verifyWebhookSignature: HMAC-SHA256 signature check for incoming webhooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a short-lived JWT to authenticate AS the GitHub App.
 * Valid for 10 minutes. Used to call /app/installations/*.
 */
export function generateAppJWT(appId, privateKey) {
  const now = Math.floor(Date.now() / 1000)
  return jwt.sign(
    {
      iat: now - 60,       // issued 60s ago — handles slight clock skew
      exp: now + (9 * 60), // expires in 9 minutes
      iss: String(appId),
    },
    privateKey,
    { algorithm: 'RS256' }
  )
}

/**
 * Exchange an installation ID for a short-lived installation access token.
 * The token can be used as a password for HTTPS git clones:
 *   https://x-access-token:{token}@github.com/owner/repo.git
 */
export async function getInstallationToken(appId, installationId, privateKey, apiUrl = 'https://api.github.com') {
  const appJwt = generateAppJWT(appId, privateKey)

  const resp = await fetch(
    `${apiUrl}/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  )

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`GitHub: failed to get installation token (${resp.status}): ${body}`)
  }

  const data = await resp.json()
  return { token: data.token, expiresAt: data.expires_at }
}

/**
 * List all installations of this GitHub App.
 */
export async function fetchInstallations(appId, privateKey, apiUrl = 'https://api.github.com') {
  const appJwt = generateAppJWT(appId, privateKey)

  const resp = await fetch(`${apiUrl}/app/installations`, {
    headers: {
      Authorization: `Bearer ${appJwt}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`GitHub: failed to list installations (${resp.status}): ${body}`)
  }

  return resp.json()
}

/**
 * List repositories accessible by a specific installation.
 */
export async function listInstallationRepos(appId, installationId, privateKey, apiUrl = 'https://api.github.com') {
  const { token } = await getInstallationToken(appId, installationId, privateKey, apiUrl)

  const resp = await fetch(`${apiUrl}/installation/repositories?per_page=100`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`GitHub: failed to list repos (${resp.status}): ${body}`)
  }

  const data = await resp.json()
  return data.repositories ?? []
}

/**
 * Check whether a specific installation has access to a given repo URL.
 */
export async function checkRepoAccess(appId, installationId, privateKey, repoUrl, apiUrl = 'https://api.github.com') {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (!match) throw new Error('Invalid GitHub repo URL')
  const fullName = `${match[1]}/${match[2]}`

  const repos = await listInstallationRepos(appId, installationId, privateKey, apiUrl)
  const found = repos.find(r => r.full_name.toLowerCase() === fullName.toLowerCase())

  if (!found) {
    throw new Error(`Repository "${fullName}" is not accessible via this GitHub App installation. Make sure the app is installed on this repository.`)
  }

  return {
    accessible: true,
    defaultBranch: found.default_branch,
    fullName: found.full_name,
    isPrivate: found.private,
  }
}

/**
 * Build an authenticated HTTPS clone URL using an installation token.
 */
export function buildAuthenticatedCloneUrl(repoUrl, token) {
  const url = new URL(repoUrl.endsWith('.git') ? repoUrl : `${repoUrl}.git`)
  url.username = 'x-access-token'
  url.password = token
  return url.toString()
}

/**
 * Verify the HMAC-SHA256 signature on a GitHub webhook payload.
 */
export function verifyWebhookSignature(rawBody, signature, secret) {
  if (!signature || !secret) return false

  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(signature, 'utf8')
    )
  } catch {
    return false
  }
}

/**
 * Generate a cryptographically-random webhook secret (hex, 40 chars).
 */
export function generateWebhookSecret() {
  return crypto.randomBytes(20).toString('hex')
}