import 'dotenv/config'

function requireEnv(key) {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

function optionalEnv(key, defaultValue = '') {
  return process.env[key] ?? defaultValue
}

export const config = {
  app: {
    env: optionalEnv('NODE_ENV', 'development'),
    port: parseInt(optionalEnv('PORT', '3001'), 10),
    host: optionalEnv('HOST', '0.0.0.0'),
    isDev: optionalEnv('NODE_ENV', 'development') === 'development',
    isProd: optionalEnv('NODE_ENV', 'development') === 'production',
  },

  database: {
    url: requireEnv('DATABASE_URL'),
  },

  redis: {
    host: optionalEnv('REDIS_HOST', 'localhost'),
    port: parseInt(optionalEnv('REDIS_PORT', '6379'), 10),
    password: optionalEnv('REDIS_PASSWORD') || undefined,
  },

  jwt: {
    secret: requireEnv('JWT_SECRET'),
  },

  ssh: {
    connectTimeout: parseInt(optionalEnv('SSH_CONNECT_TIMEOUT', '10000'), 10),
    commandTimeout: parseInt(optionalEnv('SSH_COMMAND_TIMEOUT', '30000'), 10),
  },
}
