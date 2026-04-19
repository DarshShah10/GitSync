import { PrismaClient } from '@prisma/client'
import { config } from '../config/index.js'

const prisma = new PrismaClient({
  log: config.app.isDev
    ? ['query', 'info', 'warn', 'error']
    : ['warn', 'error'],
})

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})

export { prisma }
