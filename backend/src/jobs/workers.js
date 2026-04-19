import { startServerVerifyWorker } from './server-verify.job.js'

/**
 * Starts all background job workers.
 * Called once from src/index.js at app startup.
 *
 * Returns an array of worker instances so they can be
 * gracefully shut down on SIGTERM/SIGINT.
 *
 * @returns {import('bullmq').Worker[]}
 */
export function startAllWorkers() {
  console.log('[workers] Starting background job workers...')

  const workers = [
    startServerVerifyWorker(),
    // Phase 2: startDatabaseCreateWorker(),
    // Phase 4: startBackupWorker(),
  ]

  console.log(`[workers] ${workers.length} worker(s) running.`)
  return workers
}

/**
 * Gracefully shuts down all workers.
 * Waits for in-progress jobs to finish before closing.
 *
 * @param {import('bullmq').Worker[]} workers
 */
export async function stopAllWorkers(workers) {
  console.log('[workers] Shutting down workers...')
  await Promise.all(workers.map((w) => w.close()))
  console.log('[workers] All workers stopped.')
}
