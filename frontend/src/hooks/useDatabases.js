import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createDatabase,
  getDatabases,
  getDatabase,
  getDatabaseStatus,
  getDatabaseStats,
  getDatabaseLogs,
  startDatabase,
  stopDatabase,
  restartDatabase,
  deleteDatabase,
  createBackupConfig,
  getBackupConfigs,
  deleteBackupConfig,
  triggerBackup,
  getBackupExecutions,
  testS3,
} from '../services/databases.js'

const TERMINAL_STATUSES = ['RUNNING', 'STOPPED', 'ERROR']

// ── DATABASES ────────────────────────────────────────────────────────────────

export function useDatabases(serverId) {
  return useQuery({
    queryKey:        ['databases', serverId ?? 'all'],
    queryFn:         () => getDatabases(serverId),
    refetchInterval: 5000,
  })
}

export function useDatabase(id) {
  return useQuery({
    queryKey: ['database', id],
    queryFn:  () => getDatabase(id),
    enabled:  !!id,
  })
}

export function useDatabaseStatus(id) {
  return useQuery({
    queryKey: ['database-status', id],
    queryFn:  () => getDatabaseStatus(id),
    enabled:  !!id,
    refetchInterval: (data) => {
      const status = data?.data?.status
      if (!status || TERMINAL_STATUSES.includes(status)) return false
      return 2000
    },
  })
}

export function useDatabaseStats(id, enabled = true) {
  return useQuery({
    queryKey:        ['database-stats', id],
    queryFn:         () => getDatabaseStats(id),
    enabled:         !!id && enabled,
    refetchInterval: 10000,
  })
}

export function useDatabaseLogs(id, tail = 100, enabled = true) {
  return useQuery({
    queryKey:        ['database-logs', id, tail],
    queryFn:         () => getDatabaseLogs(id, tail),
    enabled:         !!id && enabled,
    refetchInterval: 15000,
  })
}

export function useCreateDatabase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createDatabase,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['databases'] }),
  })
}

export function useStartDatabase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => startDatabase(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['database', id] })
      qc.invalidateQueries({ queryKey: ['database-status', id] })
      qc.invalidateQueries({ queryKey: ['databases'] })
    },
  })
}

export function useStopDatabase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => stopDatabase(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['database', id] })
      qc.invalidateQueries({ queryKey: ['database-status', id] })
      qc.invalidateQueries({ queryKey: ['databases'] })
    },
  })
}

export function useRestartDatabase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => restartDatabase(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['database', id] })
      qc.invalidateQueries({ queryKey: ['databases'] })
    },
  })
}

export function useDeleteDatabase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => deleteDatabase(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['databases'] })
      qc.invalidateQueries({ queryKey: ['servers'] })
    },
  })
}

// ── BACKUP CONFIGS ────────────────────────────────────────────────────────────

export function useBackupConfigs(databaseId) {
  return useQuery({
    queryKey:        ['backup-configs', databaseId],
    queryFn:         () => getBackupConfigs(databaseId),
    enabled:         !!databaseId,
    refetchInterval: 10000,
  })
}

export function useCreateBackupConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ databaseId, ...data }) => createBackupConfig(databaseId, data),
    onSuccess: (_, { databaseId }) => {
      qc.invalidateQueries({ queryKey: ['backup-configs', databaseId] })
    },
  })
}

export function useDeleteBackupConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ configId }) => deleteBackupConfig(configId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backup-configs'] })
    },
  })
}

// ── BACKUP EXECUTIONS ─────────────────────────────────────────────────────────

export function useTriggerBackup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (configId) => triggerBackup(configId),
    onSuccess: (_, configId) => {
      qc.invalidateQueries({ queryKey: ['backup-executions', configId] })
      qc.invalidateQueries({ queryKey: ['backup-configs'] })
    },
  })
}

export function useBackupExecutions(configId, enabled = true) {
  return useQuery({
    queryKey:        ['backup-executions', configId],
    queryFn:         () => getBackupExecutions(configId),
    enabled:         !!configId && enabled,
    refetchInterval: 5000,
  })
}

// ── S3 ────────────────────────────────────────────────────────────────────────

export function useTestS3() {
  return useMutation({
    mutationFn: ({ databaseId, ...data }) => testS3(databaseId, data),
  })
}
