/**
 * frontend/src/services/domains.js
 *
 * Thin wrappers around the domain REST endpoints.
 * All functions throw on non-2xx so React Query catches them automatically.
 */

import api from './api.js'   // your existing axios / fetch wrapper

// ➕ Register subdomain
export async function createDomain({ subdomain }) {
  try {
    const { data } = await api.post('/api/domains', { subdomain })
    return data
  } catch (err) {
    const msg = err?.response?.data?.error ?? err?.message ?? 'Failed to create domain'
    throw new Error(msg)
  }
}

// 📄 Fetch all my domains
export async function fetchDomains() {
  const { data } = await api.get('/api/domains')
  return data
}

// 🔄 Update IP or IPv6 for a domain
export async function updateDomain({ id, ip, ipv6 }) {
  const body = {}
  if (ip   !== undefined) body.ip   = ip
  if (ipv6 !== undefined) body.ipv6 = ipv6

  const { data } = await api.patch(`/api/domains/${id}`, body)
  return data
}

// ❌ Delete a domain
export async function deleteDomain(id) {
  const { data } = await api.delete(`/api/domains/${id}`)
  return data
}