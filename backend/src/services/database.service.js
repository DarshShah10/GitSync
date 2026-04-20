import { runCommand } from './ssh.service.js'
import { DB_CONFIGS } from '../constants/index.js'

export { DB_CONFIGS }

function yamlStr(val) {
  return `'${String(val ?? '').replace(/'/g, "''")}'`
}

function shSingleQuote(val) {
  return `'${String(val ?? '').replace(/'/g, "'\\''")}'`
}

function yamlDqEscape(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function composeDir(containerName) {
  return `/opt/gitsync/databases/${containerName}`
}

function composePath(containerName) {
  return `${composeDir(containerName)}/docker-compose.yml`
}

function generateComposeYaml(containerName, typeConfig, dbConfig, volumeName) {
  const { internalPort, dataPath } = typeConfig
  const envVars = typeConfig.envVars(dbConfig)
  const healthCmd = typeConfig.healthCheck?.(dbConfig) ?? 'echo ok'

  const lines = [
    'services:',
    '  db:',
    `    image: ${typeConfig.image}`,
    `    container_name: ${containerName}`,
    '    restart: unless-stopped',
  ]

  // Environment section — YAML single-quoted values handle $, !, ", backticks
  if (envVars.length > 0) {
    lines.push('    environment:')
    for (const e of envVars) {
      const eqIdx = e.indexOf('=')
      const key   = e.substring(0, eqIdx)
      const val   = e.substring(eqIdx + 1)
      lines.push(`      ${key}: ${yamlStr(val)}`)
    }
  }

  // Volume mount
  lines.push('    volumes:')
  lines.push(`      - ${volumeName}:${dataPath}`)

  // Internal network (db is not exposed directly to the host)
  lines.push('    networks:')
  lines.push('      - internal')

  // Docker native healthcheck — compose waits for `healthy` before proxy starts
  lines.push('    healthcheck:')
  lines.push(`      test: ["CMD-SHELL", "${yamlDqEscape(healthCmd)}"]`)
  lines.push('      interval: 10s')
  lines.push('      timeout: 10s')
  lines.push('      retries: 15')
  lines.push('      start_period: 60s')

  // Command override (Redis/KeyDB/Dragonfly use argv array — no shell, no escaping issues)
  if (typeConfig.composeCommand) {
    const cmd = typeConfig.composeCommand(dbConfig)
    if (Array.isArray(cmd)) {
      lines.push(`    command: [${cmd.map(yamlStr).join(', ')}]`)
    } else {
      lines.push(`    command: ${yamlStr(String(cmd))}`)
    }
  }

  lines.push('')

  // socat proxy — binds the public port and forwards TCP to the db service.
  // The database container never has a host port — the proxy handles it.
  // This means public port can be changed by recreating only the proxy.
  lines.push('  proxy:')
  lines.push('    image: alpine/socat')
  lines.push(`    container_name: ${containerName}_proxy`)
  lines.push('    restart: unless-stopped')
  lines.push('    ports:')
  lines.push(`      - "${dbConfig.publicPort}:${internalPort}"`)
  lines.push(`    command: TCP-LISTEN:${internalPort},fork,reuseaddr TCP:db:${internalPort}`)
  lines.push('    networks:')
  lines.push('      - internal')
  lines.push('    depends_on:')
  lines.push('      db:')
  lines.push('        condition: service_healthy')

  lines.push('')
  lines.push('volumes:')
  lines.push(`  ${volumeName}:`)
  lines.push(`    name: ${volumeName}`)
  lines.push('')
  lines.push('networks:')
  lines.push('  internal:')
  lines.push(`    name: ${containerName}_net`)

  return lines.join('\n') + '\n'
}

// ─────────────────────────────────────────────────────────────────────────────
// Port discovery
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Finds a free port on the remote server in a given range.
 * Collects all in-use ports from Docker and ss, then returns the first free one.
 */
export async function findFreePort(serverConfig, startPort = 20000, endPort = 30000) {
  const { stdout: dockerPorts } = await runCommand(
    serverConfig,
    `docker ps --format '{{.Ports}}' 2>/dev/null | grep -oP '\\d+(?=->)' | sort -n || echo ""`,
    { timeout: 15000 }
  )
  const { stdout: ssPorts } = await runCommand(
    serverConfig,
    `ss -tlnp 2>/dev/null | awk '{print $4}' | grep -oP ':\\K\\d+' | sort -n || echo ""`,
    { timeout: 10000 }
  )

  const usedPorts = new Set([
    ...dockerPorts.split('\n').map(Number).filter(Boolean),
    ...ssPorts.split('\n').map(Number).filter(Boolean),
  ])

  for (let port = startPort; port <= endPort; port++) {
    if (!usedPorts.has(port)) return port
  }

  throw new Error(`No free port found between ${startPort} and ${endPort}`)
}

export async function provisionDatabase(serverConfig, dbConfig, opts = {}) {
  const log = (msg) => opts.onLog?.(`[provision] ${msg}`)
  const typeConfig = DB_CONFIGS[dbConfig.type]

  if (!typeConfig) throw new Error(`Unsupported database type: ${dbConfig.type}`)

  const ts            = Date.now()
  const sanitized     = dbConfig.name.toLowerCase().replace(/[^a-z0-9]/g, '_')
  const containerName = `gitsync_${sanitized}_${ts}`
  const volumeName    = `gitsync_${sanitized}_${ts}_data`
  const cDir          = composeDir(containerName)
  const cPath         = composePath(containerName)

  const composeYaml = generateComposeYaml(containerName, typeConfig, dbConfig, volumeName)

  let composeStarted = false

  try {
    // Pull images upfront so `up -d` is fast
    log(`Pulling image: ${typeConfig.image}`)
    const pull = await runCommand(
      serverConfig,
      `docker pull ${typeConfig.image} 2>&1`,
      { timeout: 300000, onStdout: (c) => c.split('\n').filter(Boolean).forEach(log) }
    )
    if (pull.code !== 0) throw new Error(`Failed to pull ${typeConfig.image}: ${pull.stderr}`)

    log('Pulling socat proxy image…')
    await runCommand(serverConfig, `docker pull alpine/socat 2>&1 || true`, { timeout: 120000 })

    // Write compose file (base64-encoded to avoid all shell escaping problems)
    log(`Writing compose file → ${cPath}`)
    const b64 = Buffer.from(composeYaml, 'utf8').toString('base64')
    const write = await runCommand(
      serverConfig,
      `mkdir -p '${cDir}' && printf '%s' '${b64}' | base64 -d > '${cPath}'`,
      { timeout: 15000 }
    )
    if (write.code !== 0) throw new Error(`Failed to write compose file: ${write.stderr}`)

    // Bring the stack up
    log(`Starting compose stack: ${containerName}`)
    const up = await runCommand(
      serverConfig,
      `docker compose -f '${cPath}' up -d 2>&1`,
      { timeout: 300000, onStdout: (c) => c.split('\n').filter(Boolean).forEach(log) }
    )
    if (up.code !== 0) throw new Error(`docker compose up failed: ${up.stderr || up.stdout}`)
    composeStarted = true

    // Wait for the db service to become healthy (up to 90s, polled every 3s)
    log('Waiting for database healthcheck to pass…')
    let healthy = false
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 3000))
      const { stdout } = await runCommand(
        serverConfig,
        `docker inspect --format='{{.State.Health.Status}}' ${containerName} 2>/dev/null`,
        { timeout: 10000 }
      )
      const hs = stdout.trim()
      log(`Healthcheck: ${hs || 'starting…'}`)
      if (hs === 'healthy') { healthy = true; break }
      if (hs === 'unhealthy') break
    }

    if (!healthy) {
      const { stdout: dbLogs } = await runCommand(
        serverConfig,
        `docker logs --tail 40 ${containerName} 2>&1`,
        { timeout: 10000 }
      )
      throw new Error(`Database did not become healthy within 90s.\nLogs:\n${dbLogs}`)
    }

    // Get the short container ID for reference
    const { stdout: idOut } = await runCommand(
      serverConfig,
      `docker inspect --format='{{.Id}}' ${containerName} 2>/dev/null`,
      { timeout: 10000 }
    )
    const containerId = idOut.trim().substring(0, 12)

    log('Database healthy and proxy running. ✓')
    return { containerId, containerName, volumeName }

  } catch (err) {
    if (composeStarted) {
      log(`Tearing down failed stack ${containerName}…`)
      await runCommand(
        serverConfig,
        `docker compose -f '${cPath}' down -v 2>/dev/null || true`,
        { timeout: 30000 }
      ).catch(() => {})
    }
    await runCommand(serverConfig, `rm -rf '${cDir}'`, { timeout: 10000 }).catch(() => {})
    throw err
  }
}

export async function stopContainer(serverConfig, containerName) {
  const { code } = await runCommand(
    serverConfig,
    `docker compose -f '${composePath(containerName)}' stop 2>&1`,
    { timeout: 30000 }
  )
  return { success: code === 0 }
}

export async function startContainer(serverConfig, containerName) {
  const { code } = await runCommand(
    serverConfig,
    `docker compose -f '${composePath(containerName)}' start 2>&1`,
    { timeout: 30000 }
  )
  return { success: code === 0 }
}

export async function restartContainer(serverConfig, containerName) {
  const { code } = await runCommand(
    serverConfig,
    `docker compose -f '${composePath(containerName)}' restart 2>&1`,
    { timeout: 60000 }
  )
  return { success: code === 0 }
}

export async function removeContainer(serverConfig, containerName) {
  const cPath = composePath(containerName)
  const cDir  = composeDir(containerName)

  await runCommand(
    serverConfig,
    `docker compose -f '${cPath}' down -v 2>/dev/null || true`,
    { timeout: 60000 }
  )
  await runCommand(serverConfig, `rm -rf '${cDir}'`, { timeout: 10000 })
  return { success: true }
}

export async function getContainerStatus(serverConfig, containerName) {
  const { stdout, code } = await runCommand(
    serverConfig,
    `docker inspect --format='{{.State.Status}}' ${containerName} 2>/dev/null`,
    { timeout: 10000 }
  )
  if (code !== 0 || !stdout) return 'not_found'
  const s = stdout.trim()
  if (s === 'running') return 'running'
  if (s === 'exited' || s === 'stopped') return 'stopped'
  return s
}

export async function getContainerStats(serverConfig, containerName) {
  const { stdout, code } = await runCommand(
    serverConfig,
    `docker stats ${containerName} --no-stream --format '{{json .}}' 2>/dev/null`,
    { timeout: 15000 }
  )
  if (code !== 0 || !stdout) return null
  try {
    const raw = JSON.parse(stdout)
    return {
      cpuPercent: raw.CPUPerc,
      memUsage:   raw.MemUsage,
      memPercent: raw.MemPerc,
      netIO:      raw.NetIO,
      blockIO:    raw.BlockIO,
      pids:       raw.PIDs,
    }
  } catch {
    return null
  }
}

export async function getContainerLogs(serverConfig, containerName, tail = 100) {
  const { stdout } = await runCommand(
    serverConfig,
    `docker logs --tail ${tail} --timestamps ${containerName}`,
    { timeout: 15000 }
  )
  return stdout
}

export function buildConnectionStrings(type, cfg) {
  const typeConfig = DB_CONFIGS[type]
  if (!typeConfig) throw new Error(`Unknown type: ${type}`)
  return {
    external: typeConfig.connectionString(cfg),
    internal: typeConfig.internalConnectionString(cfg),
  }
}
