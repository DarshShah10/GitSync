/**
 * Sanitize a raw subdomain string.
 *
 * Rules (same as DuckDNS):
 *  - lowercase only
 *  - alphanumeric + hyphens
 *  - no leading/trailing hyphen
 *  - 1–63 chars
 *
 * Returns the cleaned string, or empty string if invalid.
 */
export function cleanSubdomain(raw = '') {
  return raw
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '')   // strip anything not alphanum or hyphen
    .replace(/^-+|-+$/g, '')       // strip leading / trailing hyphens
    .slice(0, 63)
}

/**
 * Returns true if the cleaned subdomain is usable.
 */
export function isValidSubdomain(subdomain) {
  return /^[a-z0-9][a-z0-9-]{0,62}$/.test(subdomain)
}

// Subdomains reserved for the platform itself — users cannot claim these.
const RESERVED = new Set([
  'www', 'api', 'mail', 'smtp', 'ns1', 'ns2',
  'admin', 'root', 'dashboard', 'app',
  'git-sync', 'gitsync', 'support', 'help',
  'ftp', 'ssh', 'vpn', 'cdn', 'static',
])

export function isReservedSubdomain(subdomain) {
  return RESERVED.has(subdomain)
}