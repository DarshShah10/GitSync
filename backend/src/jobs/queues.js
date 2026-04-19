import { Queue } from 'bullmq'
import { createRedisConnection } from '../db/redis.js'

// ── Queue names — import these everywhere instead of raw strings ──────
export const QUEUE_NAMES = {
  SERVER_VERIFY: 'server-verify',
  DATABASE_CREATE: 'database-create',
  DATABASE_START: 'database-start',
  DATABASE_STOP: 'database-stop',
  BACKUP_RUN: 'backup-run',
}

// ── Queue instances ───────────────────────────────────────────────────
// Each queue gets its own Redis connection (BullMQ requirement)

export const serverVerifyQueue = new Queue(QUEUE_NAMES.SERVER_VERIFY, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail:     { count: 100 },
  },
})

export const databaseCreateQueue = new Queue(QUEUE_NAMES.DATABASE_CREATE, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail:     { count: 100 },
  },
})

export const backupQueue = new Queue(QUEUE_NAMES.BACKUP_RUN, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: { count: 50 },
    removeOnFail:     { count: 50 },
  },
})
