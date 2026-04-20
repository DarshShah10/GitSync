import {
  createDatabase,
  listDatabases,
  getDatabase,
  getDatabaseStatus,
  getDatabaseStats,
  getDatabaseLogs,
  startDatabase,
  stopDatabase,
  restartDatabase,
  deleteDatabase,
  createBackupConfig,
  listBackupConfigs,
  listBackupExecutions,
  triggerBackup,
  deleteBackupConfig,
  testS3ConnectionHandler,
} from '../controllers/database.controller.js'
import { databaseIdSchema, backupConfigIdSchema } from '../schemas/database.schema.js'
import { handleResult } from '../utils/index.js'

export async function databaseRoutes(app) {

  app.post('/api/databases', async (request, reply) => {
    const result = await createDatabase(request)
    return handleResult(reply, result)
  })

  app.get('/api/databases', async (request, reply) => {
    const result = await listDatabases(request)
    return reply.send(result)
  })

  app.get('/api/databases/:id', async (request, reply) => {
    const result = await getDatabase(request)
    return handleResult(reply, result)
  })

  app.get('/api/databases/:id/status', async (request, reply) => {
    const result = await getDatabaseStatus(request)
    return handleResult(reply, result)
  })

  app.get('/api/databases/:id/stats', async (request, reply) => {
    const result = await getDatabaseStats(request)
    return handleResult(reply, result)
  })

  app.get('/api/databases/:id/logs', async (request, reply) => {
    const result = await getDatabaseLogs(request)
    return handleResult(reply, result)
  })

  app.post('/api/databases/:id/start', async (request, reply) => {
    const result = await startDatabase(request)
    return handleResult(reply, result)
  })

  app.post('/api/databases/:id/stop', async (request, reply) => {
    const result = await stopDatabase(request)
    return handleResult(reply, result)
  })

  app.post('/api/databases/:id/restart', async (request, reply) => {
    const result = await restartDatabase(request)
    return handleResult(reply, result)
  })

  app.delete('/api/databases/:id', async (request, reply) => {
    const result = await deleteDatabase(request, app)
    return handleResult(reply, result)
  })

  app.post('/api/databases/:id/backups', async (request, reply) => {
    const result = await createBackupConfig(request)
    return handleResult(reply, result)
  })

  app.get('/api/databases/:id/backups', async (request, reply) => {
    const result = await listBackupConfigs(request)
    return handleResult(reply, result)
  })

  app.get('/api/backups/:id/executions', async (request, reply) => {
    const result = await listBackupExecutions(request)
    return handleResult(reply, result)
  })

  app.post('/api/backups/:id/run', async (request, reply) => {
    const result = await triggerBackup(request)
    return handleResult(reply, result)
  })

  app.delete('/api/backups/:id', async (request, reply) => {
    const result = await deleteBackupConfig(request)
    return handleResult(reply, result)
  })

  app.post('/api/databases/:id/backups/test-s3', async (request, reply) => {
    const result = await testS3ConnectionHandler(request)
    return handleResult(reply, result)
  })
}