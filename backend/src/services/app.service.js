import { runCommand } from './ssh.service.js'

const PLATFORM_NETWORK  = 'sovereign'
const PLATFORM_NGINX    = 'sovereign-nginx'
const NGINX_CONFIG_DIR  = '/etc/sovereign/nginx'
const BUILD_BASE_DIR    = '/tmp/sovereign/builds'

export function toSlug(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

export function buildServiceNames(serviceId, repoName) {
  const slug          = toSlug(repoName)
  const short         = serviceId.toString().slice(-8)
  const containerName = `sov-${slug}-${short}`
  const imageName     = `sov-img-${slug}-${short}`
  return { containerName, imageName }
}

export function nginxConfPath(containerName) {
  return `${NGINX_CONFIG_DIR}/${containerName}.conf`
}

export async function installNixpacks(serverConfig, opts = {}) {
  const log = (msg) => opts.onLog?.(msg)

  log('Checking if Nixpacks is installed…')

  const { code: checkCode } = await runCommand(
    serverConfig,
    `nixpacks --version 2>/dev/null`,
    { timeout: 10000 }
  )

  if (checkCode === 0) {
    log('Nixpacks already installed. ✓')
    return
  }

  log('Installing Nixpacks…')

  const { code, stderr } = await runCommand(
    serverConfig,
    `curl -sSL https://nixpacks.com/install.sh | bash`,
    { timeout: 120000 }
  )

  if (code !== 0) throw new Error(`Failed to install Nixpacks: ${stderr}`)

  const { stdout: foundPath } = await runCommand(
    serverConfig,
    `which nixpacks 2>/dev/null || find /root /home /usr/local -name "nixpacks" -type f 2>/dev/null | head -1`,
    { timeout: 15000 }
  )

  const nixpacksBin = foundPath.trim()
  if (!nixpacksBin) {
    throw new Error('Nixpacks binary not found after installation.')
  }

  log(`Found nixpacks at: ${nixpacksBin}`)

  await runCommand(
    serverConfig,
    `ln -sf ${nixpacksBin} /usr/local/bin/nixpacks`,
    { timeout: 10000 }
  )

  const { code: verifyCode, stdout: verifyOut } = await runCommand(
    serverConfig,
    `nixpacks --version`,
    { timeout: 15000 }
  )

  if (verifyCode !== 0) throw new Error(`Nixpacks symlinked but still not runnable.`)
  log(`Nixpacks installed: ${verifyOut.trim()} ✓`)
}

export async function ensurePlatformNetwork(serverConfig, opts = {}) {
  const log = (msg) => opts.onLog?.(msg)
  log('Ensuring platform Docker network exists…')
  await runCommand(
    serverConfig,
    `docker network create ${PLATFORM_NETWORK} 2>/dev/null || true`,
    { timeout: 15000 }
  )
  log(`Network "${PLATFORM_NETWORK}" ready. ✓`)
}

export async function ensureNginxProxy(serverConfig, opts = {}) {
  const log = (msg) => opts.onLog?.(msg)
  log('Checking Nginx reverse proxy…')

  const { stdout } = await runCommand(
    serverConfig,
    `docker inspect --format='{{.State.Running}}' ${PLATFORM_NGINX} 2>/dev/null || echo "missing"`,
    { timeout: 15000 }
  )

  if (stdout.trim() === 'true') {
    log('Nginx proxy already running. ✓')
    return
  }

  log('Starting Nginx proxy container…')

  await runCommand(serverConfig, `mkdir -p ${NGINX_CONFIG_DIR}`, { timeout: 10000 })

  await runCommand(
    serverConfig,
    `docker rm -f ${PLATFORM_NGINX} 2>/dev/null || true`,
    { timeout: 15000 }
  )

  const { code, stderr } = await runCommand(
    serverConfig,
    [
      'docker run -d',
      `--name ${PLATFORM_NGINX}`,
      `--network ${PLATFORM_NETWORK}`,
      '--restart unless-stopped',
      '-p 80:80 -p 443:443',
      `-v ${NGINX_CONFIG_DIR}:/etc/nginx/conf.d`,
      'nginx:alpine',
    ].join(' '),
    { timeout: 60000 }
  )

  if (code !== 0) throw new Error(`Failed to start Nginx: ${stderr}`)
  log('Nginx proxy started. ✓')
}

/**
 * Remove nginx configs for containers that no longer exist.
 * Prevents stale configs from failing nginx -t.
 */
export async function cleanStaleNginxConfigs(serverConfig, opts = {}) {
  const log = (msg) => opts.onLog?.(msg)

  const { stdout: confList } = await runCommand(
    serverConfig,
    `ls ${NGINX_CONFIG_DIR}/*.conf 2>/dev/null || echo ""`,
    { timeout: 10000 }
  )

  const files = confList.trim().split('\n').filter(f => f && f.endsWith('.conf') && !f.includes('00-hash.conf'))
  if (files.length === 0) return

  for (const file of files) {
    // Extract the upstream container name from proxy_pass line
    const { stdout: passLine } = await runCommand(
      serverConfig,
      `grep -oP 'proxy_pass http://\\K[^:]+' ${file} 2>/dev/null || echo ""`,
      { timeout: 30000 }
    )
    const containerName = passLine.trim()
    if (!containerName) continue

    // Check if container is actually running
    const { code: inspectCode } = await runCommand(
      serverConfig,
      `docker inspect ${containerName} > /dev/null 2>&1`,
      { timeout: 10000 }
    )

    if (inspectCode !== 0) {
      log(`Removing stale nginx config for dead container: ${containerName}`)
      await runCommand(serverConfig, `rm -f ${file}`, { timeout: 5000 })
    }
  }
}

export async function cloneRepo(serverConfig, { deploymentId, repoUrl, branch, baseDir, accessToken }, opts = {}) {
  const log = (msg) => opts.onLog?.(msg)
  const buildDir = `${BUILD_BASE_DIR}/${deploymentId}`

  log(`Cloning ${repoUrl} (branch: ${branch})…`)

  await runCommand(serverConfig, `mkdir -p ${buildDir}`, { timeout: 10000 })

  // For private repos, inject the GitHub App installation token into the URL.
  // Format: https://x-access-token:<TOKEN>@github.com/owner/repo.git
  let cloneUrl = repoUrl
  if (accessToken) {
    cloneUrl = repoUrl.replace('https://', `https://x-access-token:${accessToken}@`)
  }

  const { code, stderr } = await runCommand(
    serverConfig,
    `bash -c 'GIT_TERMINAL_PROMPT=0 GIT_ASKPASS=echo GIT_CONFIG_NOSYSTEM=1 git -c credential.helper="" clone --depth=1 -b ${branch} ${cloneUrl} ${buildDir} 2>&1'`,
    { timeout: 120000, onStdout: opts.onStdout, onStderr: opts.onStdout }
  )

  if (code !== 0) throw new Error(`git clone failed: ${stderr}`)

  const workDir = baseDir && baseDir !== '/'
    ? `${buildDir}/${baseDir.replace(/^\//, '')}`
    : buildDir

  log(`Clone complete. Working directory: ${workDir} ✓`)
  return { buildDir, workDir }
}

export async function buildImage(serverConfig, { workDir, imageName, buildPack }, opts = {}) {
  const log = (msg) => opts.onLog?.(msg)

  log(`Building image "${imageName}" using ${buildPack}…`)

  let buildCmd

  if (buildPack === 'NIXPACKS') {
    buildCmd = `cd ${workDir} && nixpacks build . --name ${imageName}`
  } else if (buildPack === 'DOCKERFILE') {
    buildCmd = `cd ${workDir} && docker build -t ${imageName}:latest .`
  } else if (buildPack === 'STATIC') {
    log('Static site — skipping Docker build.')
    return { imageTag: null, isStatic: true, workDir }
  } else {
    throw new Error(`Unsupported buildPack: ${buildPack}`)
  }

  const { code, stderr } = await runCommand(
    serverConfig,
    buildCmd,
    { timeout: 600000, onStdout: opts.onStdout, onStderr: opts.onStdout }
  )

  if (code !== 0) throw new Error(`Build failed: ${stderr}`)

  const { stdout: sha } = await runCommand(
    serverConfig,
    `cd ${workDir} && git rev-parse --short HEAD 2>/dev/null || echo "latest"`,
    { timeout: 10000 }
  )
  const commitHash = sha.trim() || 'latest'

  let imageTag
  if (buildPack === 'NIXPACKS') {
    imageTag = `${imageName}:latest`
  } else {
    imageTag = `${imageName}:${commitHash}`
    await runCommand(
      serverConfig,
      `docker tag ${imageName}:latest ${imageTag}`,
      { timeout: 15000 }
    )
  }

  log(`Image built: ${imageTag} ✓`)
  return { imageTag, commitHash, isStatic: false }
}

export async function removeOldContainer(serverConfig, containerName, opts = {}) {
  const log = (msg) => opts.onLog?.(msg)
  log(`Removing old container "${containerName}" if exists…`)

  await runCommand(
    serverConfig,
    `docker stop ${containerName} 2>/dev/null || true && docker rm ${containerName} 2>/dev/null || true`,
    { timeout: 30000 }
  )

  log('Old container removed. ✓')
}

export async function runContainer(serverConfig, { containerName, imageName, imageTag, internalPort, envVars = [] }, opts = {}) {
  const log = (msg) => opts.onLog?.(msg)
  log(`Starting container "${containerName}"…`)

  const envFlags = envVars
    .filter(e => e.key)
    .map(e => `--env ${shEscape(e.key)}=${shEscape(e.value)}`)
    .join(' ')

  const cmd = [
    'docker run -d',
    `--name ${containerName}`,
    `--network ${PLATFORM_NETWORK}`,
    '--restart unless-stopped',
    `--env PORT=${internalPort}`,
    envFlags,
    `${imageTag || `${imageName}:latest`}`,
  ].filter(Boolean).join(' ')

  const { code, stdout, stderr } = await runCommand(
    serverConfig,
    cmd,
    { timeout: 60000 }
  )

  if (code !== 0) throw new Error(`Failed to start container: ${stderr}`)

  const containerId = stdout.trim().slice(0, 12)
  log(`Container started: ${containerId} ✓`)
  return { containerId }
}

export async function writeNginxConfig(serverConfig, { containerName, internalPort, domain }, opts = {}) {
  const log = (msg) => opts.onLog?.(msg)
  const confFile = nginxConfPath(containerName)
  const hostname = domain.replace(/^https?:\/\//, '')

  log(`Writing Nginx config for domain "${domain}"…`)

  const conf = [
    'server {',
    '    listen 80;',
    `    server_name ${hostname};`,
    '',
    '    location / {',
    `        proxy_pass http://${containerName}:${internalPort};`,
    '        proxy_http_version 1.1;',
    '        proxy_set_header Upgrade $http_upgrade;',
    '        proxy_set_header Connection "upgrade";',
    '        proxy_set_header Host $host;',
    '        proxy_set_header X-Real-IP $remote_addr;',
    '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
    '        proxy_set_header X-Forwarded-Proto $scheme;',
    '        proxy_read_timeout 60s;',
    '        proxy_connect_timeout 60s;',
    '    }',
    '}',
  ].join('\n')

  // Remove old conflicting configs by server_name
  await runCommand(
    serverConfig,
    [
      `grep -rl "server_name ${hostname}" ${NGINX_CONFIG_DIR}/ 2>/dev/null | xargs rm -f 2>/dev/null || true`,
      `grep -q "server_names_hash_bucket_size" ${NGINX_CONFIG_DIR}/00-hash.conf 2>/dev/null || printf 'server_names_hash_bucket_size 128;\\n' > ${NGINX_CONFIG_DIR}/00-hash.conf`,
    ].join(' && '),
    { timeout: 15000 }
  )

  const escapedConf = conf.replace(/\\/g, '\\\\').replace(/'/g, `'\\''`)
  await runCommand(
    serverConfig,
    `mkdir -p ${NGINX_CONFIG_DIR} && printf '%s\n' '${escapedConf}' > ${confFile}`,
    { timeout: 15000 }
  )

  // Test nginx config — if it fails, clean stale configs and retry
  const { code: testCode } = await runCommand(
    serverConfig,
    `docker exec ${PLATFORM_NGINX} nginx -t 2>&1`,
    { timeout: 30000 }
  )

  if (testCode !== 0) {
    log('Nginx test failed — cleaning stale configs and retrying…')

    // Remove configs for dead containers
    await runCommand(
      serverConfig,
      `for f in ${NGINX_CONFIG_DIR}/*.conf; do
        [ "$(basename $f)" = "00-hash.conf" ] && continue
        container=$(grep -oP 'proxy_pass http://\\K[^:]+' "$f" 2>/dev/null || echo "")
        if [ -n "$container" ] && ! docker inspect "$container" > /dev/null 2>&1; then
          echo "Removing stale config: $f"
          rm -f "$f"
        fi
      done`,
      { timeout: 30000 }
    )

    // Retry test after cleanup
    const { code: retryCode, stdout: retryOut } = await runCommand(
      serverConfig,
      `docker exec ${PLATFORM_NGINX} nginx -t 2>&1`,
      { timeout: 30000 }
    )

    if (retryCode !== 0) {
      await runCommand(serverConfig, `rm -f ${confFile}`, { timeout: 15000 })
      throw new Error(`Nginx config validation failed: ${retryOut}`)
    }
  }

  // Reload nginx
  const { code: reloadCode, stdout: reloadOut } = await runCommand(
    serverConfig,
    `docker exec ${PLATFORM_NGINX} nginx -s reload 2>&1`,
    { timeout: 30000 }
  )

  if (reloadCode !== 0) {
    await runCommand(serverConfig, `rm -f ${confFile}`, { timeout: 15000 })
    throw new Error(`Nginx reload failed: ${reloadOut}`)
  }

  log(`Nginx reloaded. App accessible at http://${hostname} ✓`)
  return { confFile }
}

export async function removeNginxConfig(serverConfig, confFile, opts = {}) {
  const log = (msg) => opts.onLog?.(msg)
  if (!confFile) return

  await runCommand(serverConfig, `rm -f ${confFile}`, { timeout: 10000 })

  // Reload nginx after removing config
  await runCommand(
    serverConfig,
    `docker exec ${PLATFORM_NGINX} nginx -s reload 2>/dev/null || true`,
    { timeout: 15000 }
  )
  log(`Removed nginx config: ${confFile} ✓`)
}

export async function cleanupBuild(serverConfig, { buildDir, oldImageName }, opts = {}) {
  const log = (msg) => opts.onLog?.(msg)
  log('Cleaning up build files and old images…')

  if (buildDir) {
    await runCommand(serverConfig, `rm -rf ${buildDir}`, { timeout: 30000 })
  }

  if (oldImageName) {
    await runCommand(
      serverConfig,
      `docker rmi ${oldImageName} 2>/dev/null || true`,
      { timeout: 15000 }
    )
  }

  log('Cleanup done. ✓')
}

function shEscape(val) {
  return `'${String(val ?? '').replace(/'/g, "'\\''")}'`
}