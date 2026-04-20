import api from './api.js'

// ── DATABASES ────────────────────────────────────────────────────────────────

export const createDatabase = (data) =>
  api.post('/api/databases', data).then((r) => r.data)

export const getDatabases = (serverId) =>
  api.get('/api/databases', { params: serverId ? { serverId } : {} }).then((r) => r.data)

export const getDatabase = (id) =>
  api.get(`/api/databases/${id}`).then((r) => r.data)

export const getDatabaseStatus = (id) =>
  api.get(`/api/databases/${id}/status`).then((r) => r.data)

export const getDatabaseStats = (id) =>
  api.get(`/api/databases/${id}/stats`).then((r) => r.data)

export const getDatabaseLogs = (id, tail = 100) =>
  api.get(`/api/databases/${id}/logs`, { params: { tail } }).then((r) => r.data)

export const startDatabase = (id) =>
  api.post(`/api/databases/${id}/start`).then((r) => r.data)

export const stopDatabase = (id) =>
  api.post(`/api/databases/${id}/stop`).then((r) => r.data)

export const restartDatabase = (id) =>
  api.post(`/api/databases/${id}/restart`).then((r) => r.data)

export const deleteDatabase = (id) =>
  api.delete(`/api/databases/${id}`).then((r) => r.data)

// ── BACKUP CONFIGS ────────────────────────────────────────────────────────────

export const createBackupConfig = (databaseId, data) =>
  api.post(`/api/databases/${databaseId}/backups`, data).then((r) => r.data)

export const getBackupConfigs = (databaseId) =>
  api.get(`/api/databases/${databaseId}/backups`).then((r) => r.data)

export const deleteBackupConfig = (configId) =>
  api.delete(`/api/backups/${configId}`).then((r) => r.data)

// ── BACKUP EXECUTIONS ─────────────────────────────────────────────────────────

export const triggerBackup = (configId) =>
  api.post(`/api/backups/${configId}/run`).then((r) => r.data)

export const getBackupExecutions = (configId) =>
  api.get(`/api/backups/${configId}/executions`).then((r) => r.data)

// ── S3 TEST ───────────────────────────────────────────────────────────────────

export const testS3 = (databaseId, data) =>
  api.post(`/api/databases/${databaseId}/backups/test-s3`, data).then((r) => r.data)
