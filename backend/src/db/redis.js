import IORedis from 'ioredis'
import { config } from '../constants/index.js'

function parseRedisUrl(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    return {
      host:     u.hostname,
      port:     parseInt(u.port, 10) || (u.protocol === 'rediss:' ? 6380 : 6379),
      password: u.password || undefined,
      username: u.username || undefined,
      tls:      u.protocol === 'rediss:' ? {} : undefined,
    }
  } catch {
    return null
  }
}

function makeOptions(overrides = {}) {
  // If a full URL is provided, parse it; otherwise fall back to host/port/pass
  const fromUrl = parseRedisUrl(config.redis.url)

  return {
    ...(fromUrl ?? {
      host:     config.redis.host,
      port:     config.redis.port,
      password: config.redis.password,
    }),
    maxRetriesPerRequest: null,   // required by BullMQ
    enableReadyCheck:     false,  // required by BullMQ
    retryStrategy(times) {
      return Math.min(times * 200, 5_000)
    },
    ...overrides,
  }
}

export function createRedisConnection() {
  const conn = new IORedis(makeOptions())

  conn.on('error', (err) => {
    console.error('[redis] connection error:', err.message)
  })

  return conn
}

export const redis = new IORedis(makeOptions({ lazyConnect: true }))

redis.on('error', (err) => {
  console.error('[redis] shared connection error:', err.message)
})