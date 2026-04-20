import { startServerVerifyWorker } from './server-verify.job.js'
import { startServerCheckWorker } from './server-check.job.js'
import { startServiceCreateWorker } from './database-create.job.js'
import { startBackupWorker } from './backup-run.job.js'
import { serverCheckQueue } from './queues.js'

/**
 * Starts all background job workers and schedules repeatable jobs.
 * Called once from src/index.js at app startup.
 */
export async function startAllWorkers() {
  console.log('[workers] Starting background job workers…')

  // Schedule the server-check repeatable job (every 60 seconds).
  // BullMQ deduplicates by jobId, so multiple restarts won't create duplicates.
  await serverCheckQueue.add(
    'check-all-servers',
    {},
    {
      repeat: { every: 60_000 },
      jobId:  'server-check-repeatable',
    }
  )
  console.log('[workers] Server health check scheduled every 60s.')

  const workers = [
    startServerVerifyWorker(),
    startServerCheckWorker(),
    startServiceCreateWorker(),
    startBackupWorker(),
  ]

  console.log(`[workers] ${workers.length} worker(s) running.`)
  return workers
}

/**
 * Gracefully shuts down all workers.
 */
export async function stopAllWorkers(workers) {
  console.log('[workers] Shutting down workers…')
  await Promise.all(workers.map((w) => w.close()))
  console.log('[workers] All workers stopped.')
}
