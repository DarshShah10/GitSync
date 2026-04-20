import { runCommand, runCommands, SSHError } from './ssh.service.js'

const MIN_DOCKER_MAJOR = 24

export async function checkDockerInstalled(serverConfig) {
  try {
    const { stdout, code } = await runCommand(
      serverConfig,
      'docker --version 2>/dev/null',
      { timeout: 15000 }
    )

    if (code !== 0 || !stdout) {
      return { installed: false, version: null, meetsMinimum: false }
    }

    // e.g. "Docker version 24.0.7, build afdd53b"
    const match = stdout.match(/Docker version (\d+)\.(\d+)\.(\d+)/)
    if (!match) {
      return { installed: false, version: null, meetsMinimum: false }
    }

    const version = `${match[1]}.${match[2]}.${match[3]}`
    const major = parseInt(match[1], 10)
    const meetsMinimum = major >= MIN_DOCKER_MAJOR

    return { installed: true, version, meetsMinimum }
  } catch (err) {
    if (err instanceof SSHError) throw err
    return { installed: false, version: null, meetsMinimum: false }
  }
}

export async function detectOS(serverConfig) {
  try {
    const { stdout } = await runCommand(
      serverConfig,
      // Read /etc/os-release which exists on all modern Linux distros
      'cat /etc/os-release 2>/dev/null || echo "unknown"',
      { timeout: 10000 }
    )

    const idMatch      = stdout.match(/^ID="?([^"\n]+)"?/m)
    const versionMatch = stdout.match(/^VERSION_ID="?([^"\n]+)"?/m)

    const distro  = idMatch?.[1]?.toLowerCase() ?? 'unknown'
    const version = versionMatch?.[1] ?? 'unknown'

    return { distro, version }
  } catch (_) {
    return { distro: 'unknown', version: 'unknown' }
  }
}

export async function installDocker(serverConfig, opts = {}) {
  const log = (line) => opts.onLog?.(`[docker-install] ${line}`)

  log('Starting Docker installation...')

  const commands = [
    // Update package index
    'apt-get update -y 2>&1 || yum update -y 2>&1 || true',
    // Download and run the official Docker install script
    'curl -fsSL https://get.docker.com -o /tmp/get-docker.sh',
    'sh /tmp/get-docker.sh',
    // Start and enable Docker daemon
    'systemctl start docker',
    'systemctl enable docker',
    // Clean up
    'rm -f /tmp/get-docker.sh',
  ]

  try {
    const results = await runCommands(serverConfig, commands, {
      timeout: 300000, // 5 minutes — install can take a while
      onStdout: (chunk) => {
        // Stream each line of output to the log callback
        chunk.split('\n').filter(Boolean).forEach(log)
      },
      onStderr: (chunk) => {
        chunk.split('\n').filter(Boolean).forEach((line) => log(`[stderr] ${line}`))
      },
    })

    // Check the last command (rm) — if we got here, install likely succeeded
    const failed = results.find((r) => r.code !== 0)
    if (failed) {
      return {
        success: false,
        error: `Command failed (exit ${failed.code}): ${failed.command}\n${failed.stderr}`,
      }
    }

    log('Docker installation complete.')
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Verifies Docker is running and the daemon is healthy
 * by running `docker info`.
 *
 * @param {object} serverConfig
 * @returns {Promise<{ healthy: boolean, error?: string }>}
 */
export async function verifyDockerRunning(serverConfig) {
  try {
    const { code, stdout, stderr } = await runCommand(
      serverConfig,
      'docker info --format "{{.ServerVersion}}" 2>&1',
      { timeout: 15000 }
    )

    if (code !== 0) {
      return {
        healthy: false,
        error: stderr || 'Docker daemon is not responding.',
      }
    }

    return { healthy: true, daemonVersion: stdout.trim() }
  } catch (err) {
    return { healthy: false, error: err.message }
  }
}

export async function ensureDockerReady(serverConfig, opts = {}) {
  const log = (msg) => opts.onLog?.(msg)

  // Step 1: Check if installed
  log('Checking Docker installation...')
  const { installed, version, meetsMinimum } = await checkDockerInstalled(serverConfig)

  if (!installed || !meetsMinimum) {
    if (installed && !meetsMinimum) {
      log(`Docker ${version} is too old (minimum v${MIN_DOCKER_MAJOR}). Upgrading...`)
    } else {
      log('Docker not found. Installing...')
    }

    const install = await installDocker(serverConfig, { onLog: log })
    if (!install.success) {
      return {
        ready: false,
        installed: false,
        version: null,
        daemonHealthy: false,
        error: `Docker installation failed: ${install.error}`,
      }
    }

    // Re-check after install
    const recheck = await checkDockerInstalled(serverConfig)
    if (!recheck.installed) {
      return {
        ready: false,
        installed: false,
        version: null,
        daemonHealthy: false,
        error: 'Docker installed but still not detected. Try reconnecting.',
      }
    }

    log(`Docker ${recheck.version} installed successfully.`)
  } else {
    log(`Docker ${version} already installed. ✓`)
  }

  // Step 2: Check daemon is running
  log('Verifying Docker daemon...')
  const { healthy, error: daemonError, daemonVersion } = await verifyDockerRunning(serverConfig)

  if (!healthy) {
    return {
      ready: false,
      installed: true,
      version,
      daemonHealthy: false,
      error: `Docker daemon not healthy: ${daemonError}`,
    }
  }

  log(`Docker daemon is running. ✓`)

  return {
    ready: true,
    installed: true,
    version: daemonVersion ?? version,
    daemonHealthy: true,
  }
}
