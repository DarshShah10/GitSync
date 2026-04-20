import { runCommand } from './ssh.service.js'
import { BACKUP_TOOLS, AWS_CLI_VERSION, AWS_CLI_URL } from '../constants/index.js'

/**
 * Returns the installed AWS CLI version string, or null if not installed.
 */
async function getAwsCliVersion(serverConfig) {
  const { code, stdout } = await runCommand(serverConfig, 'aws --version 2>/dev/null', { timeout: 10000 })
  if (code !== 0 || !stdout) return null
  // stdout: "aws-cli/2.13.0 Python/3.11.4 ..."
  const match = stdout.match(/aws-cli\/([\d.]+)/)
  return match ? match[1] : null
}

/**
 * Returns true if the installed version is too new (>= 2.22.0).
 * AWS CLI v2.22+ enables CRC64NVME checksums by default which breaks GCS uploads.
 */
function isTooNew(version) {
  if (!version) return false
  const [major, minor] = version.split('.').map(Number)
  return major === 2 && minor >= 22
}

/**
 * Installs AWS CLI v2.13.0 (pinned) via the official installer.
 * Uses --update flag so it overwrites any existing version.
 */
async function installPinnedAwsCli(serverConfig, log) {
  log(`Installing AWS CLI v${AWS_CLI_VERSION} (pinned for GCS compatibility)...`)

  await runCommand(
    serverConfig,
    'which unzip || apt-get install -y unzip 2>/dev/null || yum install -y unzip 2>/dev/null || true',
    { timeout: 60000 }
  )

  const steps = [
    'rm -rf /tmp/awscliv2.zip /tmp/aws-cli-v2',
    `curl -fsSL "${AWS_CLI_URL}" -o /tmp/awscliv2.zip`,
    'unzip -q /tmp/awscliv2.zip -d /tmp/aws-cli-v2',
    '/tmp/aws-cli-v2/aws/install --install-dir /usr/local/aws-cli --bin-dir /usr/local/bin --update',
    'rm -rf /tmp/awscliv2.zip /tmp/aws-cli-v2',
  ]

  for (const cmd of steps) {
    const { code, stderr, stdout } = await runCommand(serverConfig, cmd, { timeout: 180000 })
    if (code !== 0) {
      log(`  Step failed: ${cmd.substring(0, 60)} → ${(stderr || stdout).substring(0, 120)}`)
      return false
    }
  }

  const version = await getAwsCliVersion(serverConfig)
  return version !== null
}

/**
 * Ensures AWS CLI v2.13.0 is installed on the remote server.
 *
 * Cases handled:
 *   1. Not installed → install v2.13.0
 *   2. Installed but too new (>= v2.22) → downgrade to v2.13.0
 *   3. Installed and version is fine → do nothing
 */
async function ensureAwsCli(serverConfig, opts = {}) {
  const log = (msg) => opts.onLog?.(`[aws-cli] ${msg}`)

  const currentVersion = await getAwsCliVersion(serverConfig)

  if (currentVersion && !isTooNew(currentVersion)) {
    log(`AWS CLI v${currentVersion} already installed. ✓`)
    return
  }

  if (currentVersion && isTooNew(currentVersion)) {
    log(`AWS CLI v${currentVersion} is too new — CRC64NVME checksums break GCS. Downgrading to v${AWS_CLI_VERSION}...`)
  } else {
    log(`AWS CLI not found. Installing v${AWS_CLI_VERSION}...`)
  }

  if (await installPinnedAwsCli(serverConfig, log)) {
    const installedVersion = await getAwsCliVersion(serverConfig)
    log(`AWS CLI v${installedVersion} ready. ✓`)
    return
  }

  throw new Error(
    `Failed to install AWS CLI v${AWS_CLI_VERSION}.\n` +
    `Manual fix — SSH into the server and run:\n` +
    `  curl "${AWS_CLI_URL}" -o /tmp/awscliv2.zip\n` +
    `  unzip /tmp/awscliv2.zip -d /tmp/aws-cli-v2\n` +
    `  /tmp/aws-cli-v2/aws/install --update\n` +
    `  aws --version`
  )
}

function isGCS(endpoint) {
  if (!endpoint) return false
  return endpoint.includes('storage.googleapis.com')
}

function buildAwsEnv(backupConfig) {
  const gcs = isGCS(backupConfig.s3Endpoint)
  const rawRegion = backupConfig.s3Region || 'us-east-1'
  const region = (gcs || rawRegion === 'auto') ? 'us-east-1' : rawRegion

  const envPrefix = [
    `AWS_ACCESS_KEY_ID="${backupConfig.s3AccessKey}"`,
    `AWS_SECRET_ACCESS_KEY="${backupConfig.s3SecretKey}"`,
    `AWS_DEFAULT_REGION="${region}"`,
  ].join(' ')

  const endpointFlag = backupConfig.s3Endpoint
    ? `--endpoint-url "${backupConfig.s3Endpoint}"`
    : null

  const isPrivateEndpoint = backupConfig.s3Endpoint &&
    (backupConfig.s3Endpoint.startsWith('http://') ||
      /https?:\/\/(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(backupConfig.s3Endpoint))

  const noVerifySsl = isPrivateEndpoint ? '--no-verify-ssl' : null

  return { envPrefix, endpointFlag, noVerifySsl }
}

function buildAwsCmd(...parts) {
  return parts.filter(Boolean).join(' ')
}

export async function testS3Connection(serverConfig, backupConfig, opts = {}) {
  const log = (msg) => opts.onLog?.(`[s3-test] ${msg}`)

  await ensureAwsCli(serverConfig, { onLog: log })

  const { envPrefix, endpointFlag, noVerifySsl } = buildAwsEnv(backupConfig)

  // Redirect stderr to stdout so we can read the error message
  const { stdout, code } = await runCommand(
    serverConfig,
    buildAwsCmd(envPrefix, 'aws s3 ls', `s3://${backupConfig.s3Bucket}/`, endpointFlag, noVerifySsl, '2>&1 | head -10'),
    { timeout: 30000 }
  )

  if (code !== 0) {
    // Extract the human-readable error from AWS CLI output
    const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean)
    const errorLine = lines.find(l =>
      l.includes('Error') || l.includes('error') || l.includes('Invalid') || l.includes('Access Denied')
    ) ?? lines[0] ?? 'Unknown error'
    return { ok: false, error: errorLine }
  }

  return { ok: true, error: null }
}

/**
 * Runs a full backup for a database.
 * 1. Installs AWS CLI on the server if needed
 * 2. Dumps via docker exec (no host-level dump tools needed)
 * 3. Uploads to S3/GCS/R2/MinIO
 * 4. Cleans up /tmp
 */
export async function runBackup(serverConfig, dbConfig, backupConfig, opts = {}) {
  const log = (msg) => opts.onLog?.(`[backup] ${msg}`)
  const toolConfig = BACKUP_TOOLS[dbConfig.type]

  if (!toolConfig) throw new Error(`Backup not supported for type: ${dbConfig.type}`)
  if (!dbConfig.containerName) throw new Error('containerName is missing — database may not be provisioned yet')

  // Build a clean timestamp like 2026-04-19_19-54-09 (no Z, no colons)
  const now = new Date()
  const ts = now.toISOString().replace('T', '_').replace(/:/g, '-').split('.')[0]
  const backupFile = `${dbConfig.name}_${ts}${toolConfig.ext}`
  const s3Key = `${backupConfig.s3Path ?? dbConfig.name}/${backupFile}`

  const dumpCfg = {
    containerName: dbConfig.containerName,
    dbUser: dbConfig.dbUser,
    dbPassword: dbConfig.dbPassword,
    dbName: dbConfig.dbName,
    internalPort: dbConfig.internalPort,
    backupFile,
  }

  // 1. Ensure AWS CLI
  await ensureAwsCli(serverConfig, { onLog: log })

  // 2. Dump
  log(`Dumping ${dbConfig.type} → /tmp/${backupFile}`)
  const dumpResult = await runCommand(serverConfig, toolConfig.dumpCmd(dumpCfg), { timeout: 600000 })
  if (dumpResult.code !== 0) {
    throw new Error(`Dump failed (exit ${dumpResult.code}): ${dumpResult.stderr || dumpResult.stdout}`)
  }

  // 3. File size
  const { stdout: sizeOut } = await runCommand(
    serverConfig,
    `stat -c%s /tmp/${backupFile} 2>/dev/null || echo 0`,
    { timeout: 10000 }
  )
  const sizeBytes = parseInt(sizeOut.trim(), 10) || 0
  log(`Dump complete — ${(sizeBytes / 1024 / 1024).toFixed(2)} MB`)

  // 4. Upload
  const { envPrefix, endpointFlag, noVerifySsl } = buildAwsEnv(backupConfig)
  log(`Uploading → s3://${backupConfig.s3Bucket}/${s3Key}`)

  const uploadResult = await runCommand(
    serverConfig,
    buildAwsCmd(envPrefix, 'aws s3 cp', `/tmp/${backupFile}`, `s3://${backupConfig.s3Bucket}/${s3Key}`, endpointFlag, noVerifySsl, '2>&1'),
    { timeout: 600000 }
  )
  if (uploadResult.code !== 0) {
    throw new Error(`Upload failed: ${uploadResult.stdout || uploadResult.stderr}`)
  }

  // 5. Cleanup
  await runCommand(serverConfig, `rm -f /tmp/${backupFile}`, { timeout: 10000 })
  log(`Done → s3://${backupConfig.s3Bucket}/${s3Key} ✓`)

  return { s3Key, sizeBytes }
}

/**
 * Lists backup files in S3 under a given prefix.
 */
export async function listBackups(serverConfig, backupConfig, prefix) {
  const { envPrefix, endpointFlag, noVerifySsl } = buildAwsEnv(backupConfig)

  const { stdout, code } = await runCommand(
    serverConfig,
    buildAwsCmd(envPrefix, 'aws s3 ls', `s3://${backupConfig.s3Bucket}/${prefix}/`, endpointFlag, noVerifySsl, '--recursive 2>&1'),
    { timeout: 30000 }
  )

  if (code !== 0) return []

  return stdout.split('\n')
    .filter(Boolean)
    .map(line => {
      const parts = line.trim().split(/\s+/)
      return { date: parts[0], time: parts[1], size: parseInt(parts[2], 10), key: parts[3] }
    })
    .filter(b => b.key)
}