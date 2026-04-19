import IORedis from 'ioredis'
import { config } from '../config/index.js'

// BullMQ requires a specific Redis connection config
export function createRedisConnection() {
  const connection = new IORedis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,    // required by BullMQ
  })

  connection.on('connect', () => {
    console.log('Redis connected')
  })

  connection.on('error', (err) => {
    console.error('Redis connection error:', err.message)
  })

  return connection
}

// Shared connection for general use (non-BullMQ)
export const redis = new IORedis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  lazyConnect: true,
})
