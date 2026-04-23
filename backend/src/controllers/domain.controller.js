/**
 * domain.controller.js
 *
 * All functions return a plain result object:
 *   { success: true,  data: …,    status?: number }
 *   { error: '…',                 status: number  }
 *
 * `handleResult` in routeUtils maps this to a Fastify reply.
 */

import { Domain } from '../models/domain.model.js'
import { cleanSubdomain, isValidSubdomain, isReservedSubdomain } from '../utils/domain.js'
import { rebuildZoneFile } from '../services/dns.service.js'


// ─────────────────────────────────────────────────────────────────────────────
// ➕ CREATE DOMAIN
// ─────────────────────────────────────────────────────────────────────────────
export async function createDomain(request) {
  let { subdomain } = request.body ?? {}

  if (!subdomain) {
    return { error: 'Subdomain is required', status: 400 }
  }

  subdomain = cleanSubdomain(subdomain)

  if (!isValidSubdomain(subdomain)) {
    return {
      error: 'Invalid subdomain — use only letters, numbers and hyphens (no leading/trailing hyphen, max 63 chars)',
      status: 400,
    }
  }

  if (isReservedSubdomain(subdomain)) {
    return { error: `"${subdomain}" is reserved and cannot be registered`, status: 400 }
  }

  // Optional: cap how many domains one user can own
  const MAX_PER_USER = parseInt(process.env.MAX_DOMAINS_PER_USER || '5', 10)
  const count = await Domain.countDocuments({ userId: request.user.id })
  if (count >= MAX_PER_USER) {
    return { error: `You can only have ${MAX_PER_USER} domains`, status: 429 }
  }
//   console.log("first")

console.log('[createDomain] userId:', request.user.id, typeof request.user.id)
console.log('[createDomain] subdomain:', subdomain)
  try {
    const domain = await Domain.create({
      userId: request.user.id,
      subdomain,
    })
    // console.log("second")
    // No IP yet — zone file doesn't need updating until user sets one
    return { success: true, data: domain.toJSON(), status: 201 }

} catch (err) {
  console.error('[createDomain] full error:', {
    code: err.code,
    message: err.message,
    errors: err.errors,        // ← Mongoose validation errors
    keyValue: err.keyValue,    // ← which field caused 11000
  })

  if (err.code === 11000) {
    return { error: 'Subdomain is already taken', status: 409 }
  }
  return { error: 'Failed to create domain', status: 500 }
}
}


// ─────────────────────────────────────────────────────────────────────────────
// 📄 LIST MY DOMAINS
// ─────────────────────────────────────────────────────────────────────────────
export async function listDomains(request) {
  try {
    const domains = await Domain.find({ userId: request.user.id })
      .sort({ createdAt: -1 })
      .lean({ virtuals: true })

    return { success: true, data: domains }
  } catch (err) {
    console.error('[listDomains]', err)
    return { error: 'Failed to fetch domains', status: 500 }
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// 🔄 UPDATE IP / IPv6
// ─────────────────────────────────────────────────────────────────────────────
export async function updateDomainIP(request) {
  const { id } = request.params
  const { ip, ipv6 } = request.body ?? {}

  if (ip === undefined && ipv6 === undefined) {
    return { error: 'Provide at least one of: ip, ipv6', status: 400 }
  }

  // Loose validation — accept any plausible IP string
  if (ip !== undefined && ip !== null && ip !== '' && !isLooseIP(ip)) {
    return { error: 'Invalid IPv4 address', status: 400 }
  }

  if (ipv6 !== undefined && ipv6 !== null && ipv6 !== '' && !isLooseIPv6(ipv6)) {
    return { error: 'Invalid IPv6 address', status: 400 }
  }

  const domain = await Domain.findOne({ _id: id, userId: request.user.id })
  if (!domain) {
    return { error: 'Domain not found', status: 404 }
  }

  const patch = { lastUpdatedAt: new Date() }
  if (ip  !== undefined) patch.ip   = ip  || null
  if (ipv6 !== undefined) patch.ipv6 = ipv6 || null

  await Domain.updateOne({ _id: id }, { $set: patch })

  // Sync CoreDNS zone file
  await rebuildZoneFile()

  const updated = await Domain.findById(id).lean({ virtuals: true })
  return { success: true, data: updated }
}


// ─────────────────────────────────────────────────────────────────────────────
// ❌ DELETE DOMAIN
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteDomain(request) {
  const { id } = request.params

  const domain = await Domain.findOne({ _id: id, userId: request.user.id })
  if (!domain) {
    return { error: 'Domain not found', status: 404 }
  }

  await Domain.deleteOne({ _id: id })

  // Remove from zone file
  await rebuildZoneFile()

  return {
    success: true,
    message: `Domain "${domain.fullDomain}" deleted.`,
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// 🌐 PUBLIC: RESOLVE — used by the updater script / clients
//    GET /api/domains/resolve/:subdomain
//    Returns the stored IP for a subdomain (no auth required)
// ─────────────────────────────────────────────────────────────────────────────
export async function resolveDomain(request) {
  const { subdomain } = request.params

  const domain = await Domain.findOne({ subdomain: subdomain.toLowerCase() }).lean()
  if (!domain) {
    return { error: 'Subdomain not found', status: 404 }
  }

  return {
    success: true,
    data: {
      subdomain: domain.subdomain,
      ip:   domain.ip,
      ipv6: domain.ipv6,
    },
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// 🔑 TOKEN-BASED UPDATE — for the customer's cron / updater script
//    No session required, just subdomain + API token
//    PATCH /api/domains/update-ip
// ─────────────────────────────────────────────────────────────────────────────
export async function updateIPViaToken(request) {
  const { subdomain, ip, ipv6, token } = request.body ?? {}

  if (!subdomain || !token) {
    return { error: 'subdomain and token are required', status: 400 }
  }

  // Look up domain and verify token against hashed value
  const domain = await Domain.findOne({ subdomain: subdomain.toLowerCase() })
    .populate('userId', 'apiToken')

  if (!domain) {
    return { error: 'Subdomain not found', status: 404 }
  }

  // Simple comparison — replace with bcrypt.compare() if you hash tokens
  if (domain.userId?.apiToken !== token) {
    return { error: 'Invalid token', status: 401 }
  }

  const patch = { lastUpdatedAt: new Date() }
  if (ip   !== undefined) patch.ip   = ip   || null
  if (ipv6 !== undefined) patch.ipv6 = ipv6 || null

  await Domain.updateOne({ _id: domain._id }, { $set: patch })
  await rebuildZoneFile()

  return { success: true, message: `IP updated for ${domain.subdomain}` }
}


// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function isLooseIP(str) {
  // Accepts standard IPv4 dotted-decimal
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(str)
}

function isLooseIPv6(str) {
  // Very loose — just check it has colons and hex chars
  return /^[0-9a-fA-F:]+$/.test(str) && str.includes(':')
}