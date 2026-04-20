import { startServerVerifyWorker } from './server-verify.job.js'
import { startDatabaseCreateWorker } from './database-create.job.js'
import { startBackupWorker } from './backup-run.job.js'

/**
 * Starts all background job workers.
 * Called once from src/index.js at app startup.
 *
 * @returns {import('bullmq').Worker[]}
 */
export function startAllWorkers() {
  console.log('[workers] Starting background job workers...')

  const workers = [
    startServerVerifyWorker(),
    startDatabaseCreateWorker(),
    startBackupWorker(),
  ]

  console.log(`[workers] ${workers.length} worker(s) running.`)
  return workers
}

/**
 * Gracefully shuts down all workers.
 *
 * @param {import('bullmq').Worker[]} workers
 */
export async function stopAllWorkers(workers) {
  console.log('[workers] Shutting down workers...')
  await Promise.all(workers.map((w) => w.close()))
  console.log('[workers] All workers stopped.')
}