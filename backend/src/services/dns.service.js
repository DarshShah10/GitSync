/**
 * dns.service.js — Cloudflare API version
 * Replaces CoreDNS zone file approach entirely.
 */

const CF_TOKEN   = process.env.CLOUDFLARE_API_TOKEN
const CF_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID
const BASE_URL   = `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records`

const headers = {
  'Authorization': `Bearer ${CF_TOKEN}`,
  'Content-Type':  'application/json',
}

// ── Find existing CF record ID for a subdomain ────────────────────────
async function findRecord(name, type = 'A') {
  const res  = await fetch(`${BASE_URL}?name=${name}&type=${type}`, { headers })
  const json = await res.json()
  return json.result?.[0] ?? null
}

// ── Create or update an A/AAAA record ────────────────────────────────
async function upsertRecord(name, type, content) {
  const existing = await findRecord(name, type)

  if (existing) {
    // Update
    const res = await fetch(`${BASE_URL}/${existing.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ type, name, content, ttl: 60, proxied: false }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(`CF update failed: ${JSON.stringify(json.errors)}`)
  } else {
    // Create
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ type, name, content, ttl: 60, proxied: false }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(`CF create failed: ${JSON.stringify(json.errors)}`)
  }
}

// ── Delete a record ───────────────────────────────────────────────────
async function deleteRecord(name, type) {
  const existing = await findRecord(name, type)
  if (!existing) return

  await fetch(`${BASE_URL}/${existing.id}`, { method: 'DELETE', headers })
}


// ── Public API (same interface as before) ─────────────────────────────

/**
 * Called when user sets/updates their IP.
 * Pass the full domain object from MongoDB.
 */
export async function syncDomainToCloudflare(domain) {
  try {
    const BASE_DOMAIN = process.env.BASE_DOMAIN || 'git-sync.app'
    const fqdn = `${domain.subdomain}.${BASE_DOMAIN}`

    // IPv4
    if (domain.ip) {
      await upsertRecord(fqdn, 'A', domain.ip)
      console.log(`[CF] A record set: ${fqdn} → ${domain.ip}`)
    } else {
      await deleteRecord(fqdn, 'A')
      console.log(`[CF] A record deleted: ${fqdn}`)
    }

    // IPv6
    if (domain.ipv6) {
      await upsertRecord(fqdn, 'AAAA', domain.ipv6)
      console.log(`[CF] AAAA record set: ${fqdn} → ${domain.ipv6}`)
    } else {
      await deleteRecord(fqdn, 'AAAA')
    }

  } catch (err) {
    console.error('[CF] Failed to sync domain:', err)
    // Don't throw — DNS failure must never crash the API
  }
}

/**
 * Called when user deletes their domain.
 */
export async function removeDomainFromCloudflare(domain) {
  try {
    const BASE_DOMAIN = process.env.BASE_DOMAIN || 'git-sync.app'
    const fqdn = `${domain.subdomain}.${BASE_DOMAIN}`

    await deleteRecord(fqdn, 'A')
    await deleteRecord(fqdn, 'AAAA')
    console.log(`[CF] Records deleted: ${fqdn}`)

  } catch (err) {
    console.error('[CF] Failed to remove domain:', err)
  }
}

// Keep this as a no-op so nothing else breaks if still imported
export async function rebuildZoneFile() {}