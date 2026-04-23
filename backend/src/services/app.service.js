// import { runCommand } from './ssh.service.js'

// // ─────────────────────────────────────────────────────────────────────────────
// // app.service.js
// //
// // All SSH logic for deploying a Git-based application:
// //   1. Ensure platform Docker network exists
// //   2. Ensure Nginx reverse proxy container is running
// //   3. Clone repo into isolated build dir
// //   4. Build with Nixpacks or Dockerfile
// //   5. Stop + remove old container if exists
// //   6. Run new container on internal Docker network
// //   7. Write Nginx config and reload
// //   8. Cleanup build files + old image
// // ─────────────────────────────────────────────────────────────────────────────

// const PLATFORM_NETWORK  = 'sovereign'
// const PLATFORM_NGINX    = 'sovereign-nginx'
// const NGINX_CONFIG_DIR  = '/etc/sovereign/nginx'
// const BUILD_BASE_DIR    = '/tmp/sovereign/builds'

// // ── Helpers ──────────────────────────────────────────────────────────────────

// /** Sanitise a string to use as a Docker container/image name */
// export function toSlug(str) {
//   return str
//     .toLowerCase()
//     .replace(/[^a-z0-9-]/g, '-')
//     .replace(/-+/g, '-')
//     .replace(/^-|-$/g, '')
//     .slice(0, 60)
// }

// /** Build the names we'll use for this service's container/image */
// export function buildServiceNames(serviceId, repoName) {
//   const slug          = toSlug(repoName)
//   const short         = serviceId.toString().slice(-8)   // last 8 chars of Mongo _id
//   const containerName = `sov-${slug}-${short}`
//   const imageName     = `sov-img-${slug}-${short}`
//   return { containerName, imageName }
// }

// /** Get the nginx conf file path for a service */
// export function nginxConfPath(containerName) {
//   return `${NGINX_CONFIG_DIR}/${containerName}.conf`
// }

// // ── Phase 1: Ensure VM is ready (called once at server setup) ─────────────────
// // You already have this in server-verify.job.js — we just need the network/nginx
// // parts so we can call them from the deployment job too.

// export async function ensurePlatformNetwork(serverConfig, opts = {}) {
//   const log = (msg) => opts.onLog?.(msg)
//   log('Ensuring platform Docker network exists…')
//   await runCommand(
//     serverConfig,
//     `docker network create ${PLATFORM_NETWORK} 2>/dev/null || true`,
//     { timeout: 15000 }
//   )
//   log(`Network "${PLATFORM_NETWORK}" ready. ✓`)
// }

// export async function ensureNginxProxy(serverConfig, opts = {}) {
//   const log = (msg) => opts.onLog?.(msg)
//   log('Checking Nginx reverse proxy…')

//   // Check if already running
//   const { stdout } = await runCommand(
//     serverConfig,
//     `docker inspect --format='{{.State.Running}}' ${PLATFORM_NGINX} 2>/dev/null || echo "missing"`,
//     { timeout: 15000 }
//   )

//   if (stdout.trim() === 'true') {
//     log('Nginx proxy already running. ✓')
//     return
//   }

//   log('Starting Nginx proxy container…')

//   // Create config directory
//   await runCommand(serverConfig, `mkdir -p ${NGINX_CONFIG_DIR}`, { timeout: 10000 })

//   // Remove dead container if exists
//   await runCommand(
//     serverConfig,
//     `docker rm -f ${PLATFORM_NGINX} 2>/dev/null || true`,
//     { timeout: 15000 }
//   )

//   // Start Nginx
//   const { code, stderr } = await runCommand(
//     serverConfig,
//     [
//       'docker run -d',
//       `--name ${PLATFORM_NGINX}`,
//       `--network ${PLATFORM_NETWORK}`,
//       '--restart unless-stopped',
//       '-p 80:80 -p 443:443',
//       `-v ${NGINX_CONFIG_DIR}:/etc/nginx/conf.d`,
//       'nginx:alpine',
//     ].join(' '),
//     { timeout: 60000 }
//   )

//   if (code !== 0) throw new Error(`Failed to start Nginx: ${stderr}`)
//   log('Nginx proxy started. ✓')
// }

// // ── Step 1: Clone repo ────────────────────────────────────────────────────────

// export async function cloneRepo(serverConfig, { deploymentId, repoUrl, branch, baseDir }, opts = {}) {
//   const log = (msg) => opts.onLog?.(msg)
//   const buildDir = `${BUILD_BASE_DIR}/${deploymentId}`

//   log(`Cloning ${repoUrl} (branch: ${branch})…`)

//   await runCommand(serverConfig, `mkdir -p ${buildDir}`, { timeout: 10000 })

//   const { code, stderr } = await runCommand(
//     serverConfig,
//     `git clone --depth=1 -b ${branch} ${repoUrl} ${buildDir}`,
//     { timeout: 120000, onStdout: opts.onStdout, onStderr: opts.onStdout }
//   )

//   if (code !== 0) throw new Error(`git clone failed: ${stderr}`)

//   // Move into base directory if specified
//   const workDir = baseDir && baseDir !== '/'
//     ? `${buildDir}/${baseDir.replace(/^\//, '')}`
//     : buildDir

//   log(`Clone complete. Working directory: ${workDir} ✓`)
//   return { buildDir, workDir }
// }

// // ── Step 2: Build image ───────────────────────────────────────────────────────

// export async function buildImage(serverConfig, { workDir, imageName, buildPack }, opts = {}) {
//   const log = (msg) => opts.onLog?.(msg)

//   log(`Building image "${imageName}" using ${buildPack}…`)

//   let buildCmd

//   if (buildPack === 'NIXPACKS') {
//     buildCmd = [
//       `cd ${workDir}`,
//       `&& bash -lc "nixpacks build . --name ${imageName}"`,
//     ].join(' ')
//   }else if (buildPack === 'DOCKERFILE') {
//     buildCmd = `cd ${workDir} && docker build -t ${imageName}:latest .`
//   } else if (buildPack === 'STATIC') {
//     // For static sites we just note the workDir — nginx serves it directly
//     log('Static site — skipping Docker build.')
//     return { imageTag: null, isStatic: true, workDir }
//   } else {
//     throw new Error(`Unsupported buildPack: ${buildPack}`)
//   }

//   const { code, stderr } = await runCommand(
//     serverConfig,
//     buildCmd,
//     { timeout: 600000, onStdout: opts.onStdout, onStderr: opts.onStdout }  // 10 min build timeout
//   )

//   if (code !== 0) throw new Error(`Build failed: ${stderr}`)

//   // Get the short commit SHA to tag the image
//   const { stdout: sha } = await runCommand(
//     serverConfig,
//     `cd ${workDir} && git rev-parse --short HEAD 2>/dev/null || echo "latest"`,
//     { timeout: 10000 }
//   )

//   const commitHash = sha.trim() || 'latest'
//   const imageTag   = `${imageName}:${commitHash}`

//   // Tag with commit hash for rollback support
//   if (buildPack !== 'NIXPACKS') {
//     await runCommand(
//       serverConfig,
//       `docker tag ${imageName}:latest ${imageTag}`,
//       { timeout: 15000 }
//     )
//   }

//   log(`Image built: ${imageTag} ✓`)
//   return { imageTag, commitHash, isStatic: false }
// }

// // ── Step 3: Stop and remove old container ────────────────────────────────────

// export async function removeOldContainer(serverConfig, containerName, opts = {}) {
//   const log = (msg) => opts.onLog?.(msg)
//   log(`Removing old container "${containerName}" if exists…`)

//   await runCommand(
//     serverConfig,
//     `docker stop ${containerName} 2>/dev/null || true && docker rm ${containerName} 2>/dev/null || true`,
//     { timeout: 30000 }
//   )

//   log('Old container removed. ✓')
// }

// // ── Step 4: Run new container ─────────────────────────────────────────────────

// export async function runContainer(serverConfig, { containerName, imageName, imageTag, internalPort, envVars = [] }, opts = {}) {
//   const log = (msg) => opts.onLog?.(msg)
//   log(`Starting container "${containerName}"…`)

//   // Build --env flags from envVars array
//   const envFlags = envVars
//     .map(e => `--env ${e.key}=${shEscape(e.value)}`)
//     .join(' ')

//   const cmd = [
//     'docker run -d',
//     `--name ${containerName}`,
//     `--network ${PLATFORM_NETWORK}`,
//     '--restart unless-stopped',
//     envFlags,
//     // NOT exposed on host port — only reachable via the platform Docker network
//     // Nginx is the only thing that talks to this container
//     `${imageTag || `${imageName}:latest`}`,
//   ].filter(Boolean).join(' ')

//   const { code, stdout, stderr } = await runCommand(
//     serverConfig,
//     cmd,
//     { timeout: 60000 }
//   )

//   if (code !== 0) throw new Error(`Failed to start container: ${stderr}`)

//   const containerId = stdout.trim().slice(0, 12)
//   log(`Container started: ${containerId} ✓`)
//   return { containerId }
// }

// // ── Step 5: Write Nginx config and reload ─────────────────────────────────────

// export async function writeNginxConfig(serverConfig, { containerName, internalPort, domain }, opts = {}) {
//   const log = (msg) => opts.onLog?.(msg)
//   const confFile = nginxConfPath(containerName)

//   log(`Writing Nginx config for domain "${domain}"…`)

//   // Build the nginx server block
//   const conf = [
//     'server {',
//     '    listen 80;',
//     `    server_name ${domain};`,
//     '',
//     '    location / {',
//     `        proxy_pass http://${containerName}:${internalPort};`,
//     '        proxy_http_version 1.1;',
//     '        proxy_set_header Upgrade $http_upgrade;',
//     '        proxy_set_header Connection "upgrade";',
//     `        proxy_set_header Host $host;`,
//     '        proxy_set_header X-Real-IP $remote_addr;',
//     '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
//     '        proxy_set_header X-Forwarded-Proto $scheme;',
//     '        proxy_read_timeout 60s;',
//     '        proxy_connect_timeout 60s;',
//     '    }',
//     '}',
//   ].join('\n')

//   // Write config file using heredoc — safer than escaping
//   const { code: writeCode, stderr: writeErr } = await runCommand(
//     serverConfig,
//     `mkdir -p ${NGINX_CONFIG_DIR} && cat > ${confFile} << 'NGINXEOF'\n${conf}\nNGINXEOF`,
//     { timeout: 15000 }
//   )

//   if (writeCode !== 0) throw new Error(`Failed to write nginx config: ${writeErr}`)

//   log('Nginx config written. Validating…')

//   // Validate — a bad config kills ALL apps on this VM
//   const { code: testCode, stderr: testErr } = await runCommand(
//     serverConfig,
//     `docker exec ${PLATFORM_NGINX} nginx -t 2>&1`,
//     { timeout: 15000 }
//   )

//   if (testCode !== 0) {
//     // Remove the bad config so we don't break nginx
//     await runCommand(serverConfig, `rm -f ${confFile}`, { timeout: 10000 })
//     throw new Error(`Nginx config validation failed: ${testErr}`)
//   }

//   log('Nginx config valid. Reloading…')

//   // Reload nginx — zero downtime
//   const { code: reloadCode } = await runCommand(
//     serverConfig,
//     `docker exec ${PLATFORM_NGINX} nginx -s reload`,
//     { timeout: 15000 }
//   )

//   if (reloadCode !== 0) throw new Error('Nginx reload failed')

//   log(`Nginx reloaded. App accessible at http://${domain} ✓`)
//   return { confFile }
// }

// // ── Step 6: Cleanup ───────────────────────────────────────────────────────────

// export async function cleanupBuild(serverConfig, { buildDir, oldImageName }, opts = {}) {
//   const log = (msg) => opts.onLog?.(msg)
//   log('Cleaning up build files and old images…')

//   await runCommand(serverConfig, `rm -rf ${buildDir}`, { timeout: 30000 })

//   if (oldImageName) {
//     // Remove old image to save disk space — ignore errors (image might not exist)
//     await runCommand(
//       serverConfig,
//       `docker rmi ${oldImageName} 2>/dev/null || true`,
//       { timeout: 15000 }
//     )
//   }

//   log('Cleanup done. ✓')
// }

// // ── Utility ───────────────────────────────────────────────────────────────────

// function shEscape(val) {
//   return `'${String(val ?? '').replace(/'/g, "'\\''")}'`
// }



import { runCommand } from './ssh.service.js'

// ─────────────────────────────────────────────────────────────────────────────
// app.service.js
//
// All SSH logic for deploying a Git-based application:
//   1. Ensure platform Docker network exists
//   2. Ensure Nginx reverse proxy container is running
//   3. Clone repo into isolated build dir
//   4. Build with Nixpacks or Dockerfile
//   5. Stop + remove old container if exists
//   6. Run new container on internal Docker network
//   7. Write Nginx config and reload
//   8. Cleanup build files + old image
// ─────────────────────────────────────────────────────────────────────────────

const PLATFORM_NETWORK  = 'sovereign'
const PLATFORM_NGINX    = 'sovereign-nginx'
const NGINX_CONFIG_DIR  = '/etc/sovereign/nginx'
const BUILD_BASE_DIR    = '/tmp/sovereign/builds'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Sanitise a string to use as a Docker container/image name */
export function toSlug(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

/** Build the names we'll use for this service's container/image */
export function buildServiceNames(serviceId, repoName) {
  const slug          = toSlug(repoName)
  const short         = serviceId.toString().slice(-8)   // last 8 chars of Mongo _id
  const containerName = `sov-${slug}-${short}`
  const imageName     = `sov-img-${slug}-${short}`
  return { containerName, imageName }
}

/** Get the nginx conf file path for a service */
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
  console.log("first")
    if (code !== 0) throw new Error(`Failed to install Nixpacks: ${stderr}`)
  console.log("second")
    // Find where nixpacks was actually installed
    const { stdout: foundPath } = await runCommand(
        serverConfig,
        `which nixpacks 2>/dev/null || find /root /home /usr/local -name "nixpacks" -type f 2>/dev/null | head -1`,
        { timeout: 15000 }
    )
  console.log("third")
    const nixpacksBin = foundPath.trim()
  
    if (!nixpacksBin) {
      throw new Error('Nixpacks binary not found after installation. Install may have failed silently.')
    }
  console.log("fourth")
    log(`Found nixpacks at: ${nixpacksBin}`)
  console.log("five")
    // Symlink to /usr/local/bin so it's always in PATH
    await runCommand(
      serverConfig,
      `ln -sf ${nixpacksBin} /usr/local/bin/nixpacks`,
      { timeout: 10000 }
    )
  console.log("six")
    // Final verify
    const { code: verifyCode, stdout: verifyOut } = await runCommand(
      serverConfig,
      `nixpacks --version`,
      { timeout: 15000 }
    )
  console.log("seven")
    if (verifyCode !== 0) throw new Error(`Nixpacks symlinked but still not runnable. Binary path: ${nixpacksBin}`)
  console.log("eight")
    log(`Nixpacks installed: ${verifyOut.trim()} ✓`)
  }
// ── Phase 1: Ensure VM is ready (called once at server setup) ─────────────────

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

  // Check if already running
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

  // Create config directory
  await runCommand(serverConfig, `mkdir -p ${NGINX_CONFIG_DIR}`, { timeout: 10000 })

  // Remove dead container if exists
  await runCommand(
    serverConfig,
    `docker rm -f ${PLATFORM_NGINX} 2>/dev/null || true`,
    { timeout: 15000 }
  )

  // Start Nginx
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

// ── Step 1: Clone repo ────────────────────────────────────────────────────────

export async function cloneRepo(serverConfig, { deploymentId, repoUrl, branch, baseDir }, opts = {}) {
  const log = (msg) => opts.onLog?.(msg)
  const buildDir = `${BUILD_BASE_DIR}/${deploymentId}`

  log(`Cloning ${repoUrl} (branch: ${branch})…`)

  await runCommand(serverConfig, `mkdir -p ${buildDir}`, { timeout: 10000 })

  const { code, stderr } = await runCommand(
    serverConfig,
    `git clone --depth=1 -b ${branch} ${repoUrl} ${buildDir}`,
    { timeout: 120000, onStdout: opts.onStdout, onStderr: opts.onStdout }
  )

  if (code !== 0) throw new Error(`git clone failed: ${stderr}`)

  // Move into base directory if specified
  const workDir = baseDir && baseDir !== '/'
    ? `${buildDir}/${baseDir.replace(/^\//, '')}`
    : buildDir

  log(`Clone complete. Working directory: ${workDir} ✓`)
  return { buildDir, workDir }
}

// ── Step 2: Build image ───────────────────────────────────────────────────────

export async function buildImage(serverConfig, { workDir, imageName, buildPack }, opts = {}) {
  const log = (msg) => opts.onLog?.(msg)

  log(`Building image "${imageName}" using ${buildPack}…`)

  let buildCmd

  if (buildPack === 'NIXPACKS') {
    buildCmd = `cd ${workDir} && nixpacks build . --name ${imageName}`
  } else if (buildPack === 'DOCKERFILE') {
    buildCmd = `cd ${workDir} && docker build -t ${imageName}:latest .`
  } else if (buildPack === 'STATIC') {
    // For static sites we just note the workDir — nginx serves it directly
    log('Static site — skipping Docker build.')
    return { imageTag: null, isStatic: true, workDir }
  } else {
    throw new Error(`Unsupported buildPack: ${buildPack}`)
  }

  const { code, stderr } = await runCommand(
    serverConfig,
    buildCmd,
    { timeout: 600000, onStdout: opts.onStdout, onStderr: opts.onStdout }  // 10 min build timeout
  )
console.log("second",code)
  if (code !== 0) throw new Error(`Build failed: ${stderr}`)

  // Get the short commit SHA to tag the image
  const { stdout: sha } = await runCommand(
    serverConfig,
    `cd ${workDir} && git rev-parse --short HEAD 2>/dev/null || echo "latest"`,
    { timeout: 10000 }
  )
  const commitHash = sha.trim() || 'latest'

  // Nixpacks always tags as :latest — don't try to use a commit hash tag
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
// ── Step 3: Stop and remove old container ────────────────────────────────────

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

// ── Step 4: Run new container ─────────────────────────────────────────────────

export async function runContainer(serverConfig, { containerName, imageName, imageTag, internalPort, envVars = [] }, opts = {}) {
  const log = (msg) => opts.onLog?.(msg)
  log(`Starting container "${containerName}"…`)

  // Build --env flags from envVars array
  const envFlags = envVars
    .map(e => `--env ${e.key}=${shEscape(e.value)}`)
    .join(' ')

  const cmd = [
    'docker run -d',
    `--name ${containerName}`,
    `--network ${PLATFORM_NETWORK}`,
    '--restart unless-stopped',
    `--env PORT=${internalPort}`,  
    envFlags,
    // NOT exposed on host port — only reachable via the platform Docker network
    // Nginx is the only thing that talks to this container
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

// ── Step 5: Write Nginx config and reload ─────────────────────────────────────
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

  // Remove old conflicting configs + ensure hash bucket size
  await runCommand(
    serverConfig,
    [
      `grep -rl "server_name ${hostname}" ${NGINX_CONFIG_DIR}/ 2>/dev/null | xargs rm -f 2>/dev/null || true`,
      `grep -q "server_names_hash_bucket_size" ${NGINX_CONFIG_DIR}/00-hash.conf 2>/dev/null || printf 'server_names_hash_bucket_size 128;\\n' > ${NGINX_CONFIG_DIR}/00-hash.conf`,
    ].join(' && '),
    { timeout: 15000 }
  )

  // Write, validate and reload in ONE ssh connection
  const escapedConf = conf.replace(/\\/g, '\\\\').replace(/'/g, `'\\''`)
  const { code: allCode, stdout: allOut, stderr: allErr } = await runCommand(
    serverConfig,
    [
      `mkdir -p ${NGINX_CONFIG_DIR}`,
      `printf '%s\n' '${escapedConf}' > ${confFile}`,
      `docker exec ${PLATFORM_NGINX} nginx -t 2>&1`,
      `docker exec ${PLATFORM_NGINX} nginx -s reload 2>&1`,
    ].join(' && '),
    { timeout: 60000 }
  )

  if (allCode !== 0) {
    await runCommand(serverConfig, `rm -f ${confFile}`, { timeout: 15000 })
    throw new Error(`Nginx config validation failed: ${allOut || allErr}`)
  }

  log(`Nginx reloaded. App accessible at http://${hostname} ✓`)
  return { confFile }
}
// ── Step 6: Cleanup ───────────────────────────────────────────────────────────

export async function cleanupBuild(serverConfig, { buildDir, oldImageName }, opts = {}) {
  const log = (msg) => opts.onLog?.(msg)
  log('Cleaning up build files and old images…')

  await runCommand(serverConfig, `rm -rf ${buildDir}`, { timeout: 30000 })

  if (oldImageName) {
    // Remove old image to save disk space — ignore errors (image might not exist)
    await runCommand(
      serverConfig,
      `docker rmi ${oldImageName} 2>/dev/null || true`,
      { timeout: 15000 }
    )
  }

  log('Cleanup done. ✓')
}

// ── Utility ───────────────────────────────────────────────────────────────────

function shEscape(val) {
  return `'${String(val ?? '').replace(/'/g, "'\\''")}'`
}