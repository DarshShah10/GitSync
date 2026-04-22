export const config = {
  app: {
    env:       process.env.NODE_ENV ?? 'development',
    isDev:     process.env.NODE_ENV !== 'production',
    isProd:    process.env.NODE_ENV === 'production',
    port:      parseInt(process.env.PORT ?? '3000', 10),
    host:      process.env.HOST ?? '0.0.0.0',
  },
  ssh: {
    connectTimeout:  parseInt(process.env.SSH_CONNECT_TIMEOUT ?? '15000', 10),
    commandTimeout: parseInt(process.env.SSH_COMMAND_TIMEOUT ?? '300000', 10),
  },
  db: {
    uri: process.env.MONGO_URI ?? process.env.MONGODB_URI ?? 'mongodb://localhost:27017/gitsync',
  },
  redis: (() => {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379'
    const parsed = new URL(url)
    return {
      url,
      host: parsed.hostname,
      port: parseInt(parsed.port, 10) || 6379,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    }
  })(),
}
