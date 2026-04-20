import { runCommand } from './ssh.service.js'

/**
 * Docker configurations for each supported database type.
 * Each entry defines the image, default port, env vars, and
 * how to build the connection string.
 */
export const DB_CONFIGS = {
  MONGODB: {
    image: 'mongo:7',
    internalPort: 27017,
    envVars: (cfg) => [
      `MONGO_INITDB_ROOT_USERNAME=${cfg.dbUser}`,
      `MONGO_INITDB_ROOT_PASSWORD=${cfg.dbPassword}`,
      ...(cfg.dbName ? [`MONGO_INITDB_DATABASE=${cfg.dbName}`] : []),
    ],
    connectionString: (cfg) =>
      `mongodb://${cfg.dbUser}:${cfg.dbPassword}@${cfg.ip}:${cfg.publicPort}/${cfg.dbName ?? ''}?authSource=admin`,
    internalConnectionString: (cfg) =>
      `mongodb://${cfg.dbUser}:${cfg.dbPassword}@localhost:${cfg.internalPort}/${cfg.dbName ?? ''}?authSource=admin`,
    healthCheck: `mongosh --eval "db.adminCommand('ping')" --quiet`,
  },

  POSTGRESQL: {
    image: 'postgres:16-alpine',
    internalPort: 5432,
    envVars: (cfg) => [
      `POSTGRES_USER=${cfg.dbUser}`,
      `POSTGRES_PASSWORD=${cfg.dbPassword}`,
      `POSTGRES_DB=${cfg.dbName ?? cfg.dbUser}`,
    ],
    connectionString: (cfg) =>
      `postgresql://${cfg.dbUser}:${cfg.dbPassword}@${cfg.ip}:${cfg.publicPort}/${cfg.dbName ?? cfg.dbUser}`,
    internalConnectionString: (cfg) =>
      `postgresql://${cfg.dbUser}:${cfg.dbPassword}@localhost:${cfg.internalPort}/${cfg.dbName ?? cfg.dbUser}`,
    healthCheck: `pg_isready -U postgres`,
  },

  MYSQL: {
    image: 'mysql:8.0',
    internalPort: 3306,
    envVars: (cfg) => [
      `MYSQL_ROOT_PASSWORD=${cfg.dbPassword}`,
      `MYSQL_DATABASE=${cfg.dbName ?? 'app'}`,
      `MYSQL_USER=${cfg.dbUser}`,
      `MYSQL_PASSWORD=${cfg.dbPassword}`,
    ],
    connectionString: (cfg) =>
      `mysql://${cfg.dbUser}:${cfg.dbPassword}@${cfg.ip}:${cfg.publicPort}/${cfg.dbName ?? 'app'}`,
    internalConnectionString: (cfg) =>
      `mysql://${cfg.dbUser}:${cfg.dbPassword}@localhost:${cfg.internalPort}/${cfg.dbName ?? 'app'}`,
    healthCheck: `mysqladmin ping -h localhost -u root -p${`'$MYSQL_ROOT_PASSWORD'`}`,
  },

  MARIADB: {
    image: 'mariadb:11',
    internalPort: 3306,
    envVars: (cfg) => [
      `MARIADB_ROOT_PASSWORD=${cfg.dbPassword}`,
      `MARIADB_DATABASE=${cfg.dbName ?? 'app'}`,
      `MARIADB_USER=${cfg.dbUser}`,
      `MARIADB_PASSWORD=${cfg.dbPassword}`,
    ],
    connectionString: (cfg) =>
      `mysql://${cfg.dbUser}:${cfg.dbPassword}@${cfg.ip}:${cfg.publicPort}/${cfg.dbName ?? 'app'}`,
    internalConnectionString: (cfg) =>
      `mysql://${cfg.dbUser}:${cfg.dbPassword}@localhost:${cfg.internalPort}/${cfg.dbName ?? 'app'}`,
    healthCheck: `healthcheck.sh --connect`,
  },

  REDIS: {
    image: 'redis:7-alpine',
    internalPort: 6379,
    envVars: (cfg) => [],
    // Redis uses requirepass in the command, not env vars
    extraArgs: (cfg) => `--requirepass "${cfg.dbPassword}"`,
    connectionString: (cfg) =>
      `redis://:${cfg.dbPassword}@${cfg.ip}:${cfg.publicPort}/0`,
    internalConnectionString: (cfg) =>
      `redis://:${cfg.dbPassword}@localhost:${cfg.internalPort}/0`,
    healthCheck: `redis-cli ping`,
  },

  KEYDB: {
    image: 'eqalpha/keydb:latest',
    internalPort: 6379,
    envVars: (cfg) => [],
    extraArgs: (cfg) => `--requirepass "${cfg.dbPassword}"`,
    connectionString: (cfg) =>
      `redis://:${cfg.dbPassword}@${cfg.ip}:${cfg.publicPort}/0`,
    internalConnectionString: (cfg) =>
      `redis://:${cfg.dbPassword}@localhost:${cfg.internalPort}/0`,
    healthCheck: `keydb-cli ping`,
  },

  DRAGONFLY: {
    image: 'docker.dragonflydb.io/dragonflydb/dragonfly:latest',
    internalPort: 6379,
    envVars: (cfg) => [],
    extraArgs: (cfg) => `--requirepass "${cfg.dbPassword}"`,
    connectionString: (cfg) =>
      `redis://:${cfg.dbPassword}@${cfg.ip}:${cfg.publicPort}/0`,
    internalConnectionString: (cfg) =>
      `redis://:${cfg.dbPassword}@localhost:${cfg.internalPort}/0`,
    healthCheck: `redis-cli ping`,
  },

  CLICKHOUSE: {
    image: 'clickhouse/clickhouse-server:latest',
    internalPort: 8123,
    envVars: (cfg) => [
      `CLICKHOUSE_USER=${cfg.dbUser}`,
      `CLICKHOUSE_PASSWORD=${cfg.dbPassword}`,
      `CLICKHOUSE_DB=${cfg.dbName ?? 'default'}`,
    ],
    connectionString: (cfg) =>
      `clickhouse://${cfg.dbUser}:${cfg.dbPassword}@${cfg.ip}:${cfg.publicPort}/${cfg.dbName ?? 'default'}`,
    internalConnectionString: (cfg) =>
      `clickhouse://${cfg.dbUser}:${cfg.dbPassword}@localhost:${cfg.internalPort}/${cfg.dbName ?? 'default'}`,
    healthCheck: `wget --spider -q http://localhost:8123/ping`,
  },
}

/**
 * Finds a free port on the remote server in a given range.
 * Scans the range and returns the first port not in use.
 */
export async function findFreePort(serverConfig, startPort = 20000, endPort = 30000) {
  // Get all ports currently in use by Docker containers
  const { stdout } = await runCommand(
    serverConfig,
    `docker ps --format '{{.Ports}}' 2>/dev/null | grep -oP '\\d+(?=->)' | sort -n || echo ""`,
    { timeout: 15000 }
  )

  const usedPorts = new Set(
    stdout.split('\n').map(Number).filter(Boolean)
  )

  // Also check system ports
  const { stdout: netstat } = await runCommand(
    serverConfig,
    `ss -tlnp 2>/dev/null | awk '{print $4}' | grep -oP ':\\K\\d+' | sort -n || echo ""`,
    { timeout: 10000 }
  )

  netstat.split('\n').map(Number).filter(Boolean).forEach(p => usedPorts.add(p))

  for (let port = startPort; port <= endPort; port++) {
    if (!usedPorts.has(port)) return port
  }

  throw new Error(`No free port found between ${startPort} and ${endPort}`)
}

/**
 * Provisions a new database container on the remote server.
 *
 * @param {object} serverConfig   - SSH connection config
 * @param {object} dbConfig       - { name, type, dbUser, dbPassword, dbName, publicPort }
 * @param {object} [opts]
 * @param {function} [opts.onLog] - streaming log callback
 *
 * @returns {Promise<{ containerId: string, containerName: string }>}
 */
export async function provisionDatabase(serverConfig, dbConfig, opts = {}) {
  const log = (msg) => opts.onLog?.(`[provision] ${msg}`)
  const typeConfig = DB_CONFIGS[dbConfig.type]

  if (!typeConfig) {
    throw new Error(`Unsupported database type: ${dbConfig.type}`)
  }

  const containerName = `dbshift_${dbConfig.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`
  const ip = serverConfig.ip

  // Build environment variable flags
  const envFlags = typeConfig.envVars({ ...dbConfig, ip })
    .map(e => `-e "${e}"`)
    .join(' ')

  // Extra args (e.g. Redis requirepass)
  const extraArgs = typeConfig.extraArgs?.({ ...dbConfig, ip }) ?? ''

  // Port mapping: publicPort:internalPort
  const portMapping = `-p ${dbConfig.publicPort}:${typeConfig.internalPort}`

  // Docker run command
  const dockerCmd = [
    'docker run -d',
    `--name ${containerName}`,
    '--restart unless-stopped',
    portMapping,
    envFlags,
    typeConfig.image,
    extraArgs,
  ].filter(Boolean).join(' ')

  log(`Pulling image: ${typeConfig.image}`)
  const pullResult = await runCommand(
    serverConfig,
    `docker pull ${typeConfig.image} 2>&1`,
    { timeout: 300000, onStdout: (chunk) => chunk.split('\n').filter(Boolean).forEach(log) }
  )

  if (pullResult.code !== 0) {
    throw new Error(`Failed to pull image ${typeConfig.image}: ${pullResult.stderr}`)
  }

  log(`Starting container: ${containerName}`)
  const runResult = await runCommand(serverConfig, dockerCmd, { timeout: 60000 })

  if (runResult.code !== 0) {
    throw new Error(`Failed to start container: ${runResult.stderr || runResult.stdout}`)
  }

  const containerId = runResult.stdout.trim().substring(0, 12)
  log(`Container started: ${containerId}`)

  // Wait for health — poll up to 30 seconds
  log('Waiting for database to be ready...')
  let ready = false
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const { stdout: status } = await runCommand(
      serverConfig,
      `docker inspect --format='{{.State.Status}}' ${containerName} 2>/dev/null`,
      { timeout: 10000 }
    )
    if (status.trim() === 'running') {
      ready = true
      break
    }
  }

  if (!ready) {
    // Get logs for debugging
    const { stdout: logs } = await runCommand(
      serverConfig,
      `docker logs --tail 20 ${containerName} 2>&1`,
      { timeout: 10000 }
    )
    throw new Error(`Container did not reach running state. Logs:\n${logs}`)
  }

  log(`Database is ready. ✓`)

  return { containerId, containerName }
}

/**
 * Stops a running database container.
 */
export async function stopContainer(serverConfig, containerName) {
  const { code } = await runCommand(
    serverConfig,
    `docker stop ${containerName}`,
    { timeout: 30000 }
  )
  return { success: code === 0 }
}

/**
 * Starts a stopped database container.
 */
export async function startContainer(serverConfig, containerName) {
  const { code } = await runCommand(
    serverConfig,
    `docker start ${containerName}`,
    { timeout: 30000 }
  )
  return { success: code === 0 }
}

/**
 * Restarts a database container.
 */
export async function restartContainer(serverConfig, containerName) {
  const { code } = await runCommand(
    serverConfig,
    `docker restart ${containerName}`,
    { timeout: 30000 }
  )
  return { success: code === 0 }
}

/**
 * Permanently removes a container and its data.
 */
export async function removeContainer(serverConfig, containerName) {
  await runCommand(serverConfig, `docker stop ${containerName} 2>/dev/null || true`, { timeout: 30000 })
  const { code } = await runCommand(
    serverConfig,
    `docker rm -v ${containerName}`,
    { timeout: 30000 }
  )
  return { success: code === 0 }
}

/**
 * Gets live stats for a running container (CPU, memory, network).
 */
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
      cpuPercent:   raw.CPUPerc,
      memUsage:     raw.MemUsage,
      memPercent:   raw.MemPerc,
      netIO:        raw.NetIO,
      blockIO:      raw.BlockIO,
      pids:         raw.PIDs,
    }
  } catch {
    return null
  }
}

/**
 * Gets the recent logs from a container.
 */
export async function getContainerLogs(serverConfig, containerName, tail = 100) {
  const { stdout } = await runCommand(
    serverConfig,
    `docker logs --tail ${tail} --timestamps ${containerName} 2>&1`,
    { timeout: 15000 }
  )
  return stdout
}

/**
 * Checks the actual running status of a container on the server.
 * Returns: running | stopped | not_found | error
 */
export async function getContainerStatus(serverConfig, containerName) {
  const { stdout, code } = await runCommand(
    serverConfig,
    `docker inspect --format='{{.State.Status}}' ${containerName} 2>/dev/null`,
    { timeout: 10000 }
  )

  if (code !== 0 || !stdout) return 'not_found'
  const status = stdout.trim()
  if (status === 'running') return 'running'
  if (status === 'exited' || status === 'stopped') return 'stopped'
  return status
}

/**
 * Builds both connection strings (public + internal) for a database.
 */
export function buildConnectionStrings(type, cfg) {
  const typeConfig = DB_CONFIGS[type]
  if (!typeConfig) throw new Error(`Unknown type: ${type}`)

  return {
    external: typeConfig.connectionString(cfg),
    internal: typeConfig.internalConnectionString(cfg),
  }
}