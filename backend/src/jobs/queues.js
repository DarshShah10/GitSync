import { Queue } from 'bullmq'
import { createRedisConnection } from '../db/redis.js'

// ── Queue names — import these everywhere instead of raw strings ──────────────
export const QUEUE_NAMES = {
  SERVER_VERIFY:  'server-verify',
  SERVER_CHECK:   'server-check',
  SERVICE_CREATE: 'service-create',   // was DATABASE_CREATE
  BACKUP_RUN:     'backup-run',
}

// Backward-compat alias — old code that imports DATABASE_CREATE still works
QUEUE_NAMES.DATABASE_CREATE = QUEUE_NAMES.SERVICE_CREATE

// ── Queue instances ───────────────────────────────────────────────────────────

export const serverVerifyQueue = new Queue(QUEUE_NAMES.SERVER_VERIFY, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts:          2,
    backoff:           { type: 'fixed', delay: 5000 },
    removeOnComplete:  { count: 100 },
    removeOnFail:      { count: 100 },
  },
})

export const serverCheckQueue = new Queue(QUEUE_NAMES.SERVER_CHECK, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    removeOnComplete: { count: 10 },
    removeOnFail:     { count: 10 },
  },
})

export const serviceCreateQueue = new Queue(QUEUE_NAMES.SERVICE_CREATE, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts:         2,
    backoff:          { type: 'fixed', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail:     { count: 100 },
  },
})

// Backward-compat alias
export const databaseCreateQueue = serviceCreateQueue

export const backupQueue = new Queue(QUEUE_NAMES.BACKUP_RUN, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts:         3,
    backoff:          { type: 'exponential', delay: 10000 },
    removeOnComplete: { count: 50 },
    removeOnFail:     { count: 50 },
  },
})
