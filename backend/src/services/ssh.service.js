import { Client } from 'ssh2'
import { config } from '../config/index.js'

export class SSHError extends Error {
  constructor(message, code = 'SSH_ERROR') {
    super(message)
    this.name = 'SSHError'
    this.code = code
  }
}

/**
 * Builds the ssh2 connect config from a server record.
 * Supports both password and private key authentication.
 */
function buildConnectConfig(serverConfig) {
  const base = {
    host:              serverConfig.ip,
    port:              serverConfig.port ?? 22,
    username:          serverConfig.username ?? 'root',
    readyTimeout:      config.ssh.connectTimeout,
    keepaliveInterval: 10000,
    algorithms: {
      serverHostKey: [
        'ssh-rsa',
        'rsa-sha2-256',
        'rsa-sha2-512',
        'ecdsa-sha2-nistp256',
        'ecdsa-sha2-nistp384',
        'ecdsa-sha2-nistp521',
        'ssh-ed25519',
      ],
    },
  }

  // Password auth
  if (serverConfig.authType === 'PASSWORD') {
    return { ...base, password: serverConfig.password }
  }

  // SSH key auth (default)
  return { ...base, privateKey: serverConfig.privateKey }
}

/**
 * Executes a single command on a remote server over SSH.
 *
 * @param {object} serverConfig
 * @param {string} serverConfig.ip
 * @param {number} serverConfig.port
 * @param {string} serverConfig.username
 * @param {string} serverConfig.authType   — 'PASSWORD' | 'KEY'
 * @param {string} [serverConfig.password] — required if authType is PASSWORD
 * @param {string} [serverConfig.privateKey] — required if authType is KEY
 * @param {string} command
 * @param {object} [opts]
 * @param {number} [opts.timeout]
 * @param {function} [opts.onStdout]
 * @param {function} [opts.onStderr]
 *
 * @returns {Promise<{ stdout: string, stderr: string, code: number }>}
 */
export function runCommand(serverConfig, command, opts = {}) {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    const timeout = opts.timeout ?? config.ssh.commandTimeout

    let stdout = ''
    let stderr = ''
    let settled = false
    let timer = null

    function settle(fn, value) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { conn.end() } catch (_) {}
      fn(value)
    }

    timer = setTimeout(() => {
      settle(reject, new SSHError(
        `Command timed out after ${timeout}ms: ${command}`,
        'TIMEOUT'
      ))
    }, timeout)

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          return settle(reject, new SSHError(
            `Failed to execute command: ${err.message}`,
            'EXEC_ERROR'
          ))
        }

        stream.on('data', (data) => {
          const chunk = data.toString('utf8')
          stdout += chunk
          opts.onStdout?.(chunk)
        })

        stream.stderr.on('data', (data) => {
          const chunk = data.toString('utf8')
          stderr += chunk
          opts.onStderr?.(chunk)
        })

        stream.on('close', (code) => {
          settle(resolve, { stdout: stdout.trim(), stderr: stderr.trim(), code })
        })

        stream.on('error', (err) => {
          settle(reject, new SSHError(`Stream error: ${err.message}`, 'STREAM_ERROR'))
        })
      })
    })

    conn.on('error', (err) => {
      let code = 'CONNECTION_ERROR'
      let message = err.message

      if (err.message.includes('ECONNREFUSED')) {
        code = 'CONNECTION_REFUSED'
        message = `Connection refused at ${serverConfig.ip}:${serverConfig.port ?? 22}. Is SSH running?`
      } else if (err.message.includes('ETIMEDOUT') || err.message.includes('ENOTFOUND')) {
        code = 'CONNECTION_TIMEOUT'
        message = `Cannot reach ${serverConfig.ip}. Check the IP address.`
      } else if (
        err.message.includes('All configured authentication methods failed') ||
        err.message.includes('Authentication failed')
      ) {
        code = 'AUTH_FAILED'
        message = serverConfig.authType === 'PASSWORD'
          ? 'Authentication failed. Check your password.'
          : 'Authentication failed. Check your SSH private key.'
      } else if (err.message.includes('Host key verification failed')) {
        code = 'HOST_KEY_ERROR'
        message = 'Host key verification failed.'
      }

      settle(reject, new SSHError(message, code))
    })

    conn.on('timeout', () => {
      settle(reject, new SSHError(
        `SSH connection timed out connecting to ${serverConfig.ip}`,
        'CONNECT_TIMEOUT'
      ))
    })

    try {
      conn.connect(buildConnectConfig(serverConfig))
    } catch (err) {
      settle(reject, new SSHError(
        `Failed to initiate SSH connection: ${err.message}`,
        'INIT_ERROR'
      ))
    }
  })
}

/**
 * Runs multiple commands in sequence on the same server.
 */
export async function runCommands(serverConfig, commands, opts = {}) {
  const results = []

  for (const command of commands) {
    const result = await runCommand(serverConfig, command, {
      timeout:   opts.timeout,
      onStdout:  opts.onStdout,
      onStderr:  opts.onStderr,
    })

    const entry = { command, ...result }
    results.push(entry)
    opts.onLog?.(entry)

    if (result.code !== 0 && !opts.ignoreErrors) break
  }

  return results
}

/**
 * Tests whether SSH credentials are valid by running a harmless echo.
 */
export async function testConnection(serverConfig) {
  const start = Date.now()

  try {
    const { stdout, code } = await runCommand(
      serverConfig,
      'echo __gitsync_ok__',
      { timeout: config.ssh.connectTimeout }
    )

    const ok = code === 0 && stdout.includes('__gitsync_ok__')
    return { ok, latencyMs: Date.now() - start }
  } catch (err) {
    return {
      ok:         false,
      latencyMs:  Date.now() - start,
      error:      err.message,
      code:       err.code,
    }
  }
}

/**
 * Validates a PEM private key string.
 */
export function validatePrivateKey(privateKey) {
  if (!privateKey || typeof privateKey !== 'string') {
    return { valid: false, error: 'Private key is required.' }
  }

  const trimmed = privateKey.trim()
  const validHeaders = [
    '-----BEGIN RSA PRIVATE KEY-----',
    '-----BEGIN OPENSSH PRIVATE KEY-----',
    '-----BEGIN EC PRIVATE KEY-----',
    '-----BEGIN DSA PRIVATE KEY-----',
  ]

  if (!validHeaders.some((h) => trimmed.startsWith(h))) {
    return {
      valid: false,
      error: 'Invalid private key format. Must be a PEM key starting with -----BEGIN ... PRIVATE KEY-----',
    }
  }

  if (!trimmed.includes('-----END')) {
    return { valid: false, error: 'Private key appears to be truncated.' }
  }

  return { valid: true }
}