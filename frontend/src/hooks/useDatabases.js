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
  createBackup,
  getBackups,
  triggerBackup,
  testS3,
} from '../services/databases.js'

const TERMINAL_STATUSES = ['RUNNING', 'STOPPED', 'ERROR']

// ── DATABASES ────────────────────────────────────────────────────────────────

export function useDatabases(serverId) {
  return useQuery({
    queryKey: ['databases', serverId ?? 'all'],
    queryFn:  () => getDatabases(serverId),
    refetchInterval: 5000, // poll for status changes
  })
}

export function useDatabase(id) {
  return useQuery({
    queryKey: ['database', id],
    queryFn:  () => getDatabase(id),
    enabled:  !!id,
  })
}

/**
 * Polls database status while it's in a non-terminal state (CREATING).
 * Stops polling once RUNNING / STOPPED / ERROR.
 */
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
    queryKey: ['database-stats', id],
    queryFn:  () => getDatabaseStats(id),
    enabled:  !!id && enabled,
    refetchInterval: 10000, // refresh every 10s
  })
}

export function useDatabaseLogs(id, tail = 100, enabled = true) {
  return useQuery({
    queryKey: ['database-logs', id, tail],
    queryFn:  () => getDatabaseLogs(id, tail),
    enabled:  !!id && enabled,
    refetchInterval: 15000,
  })
}

export function useCreateDatabase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createDatabase,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['databases'] })
    },
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
      qc.invalidateQueries({ queryKey: ['servers'] }) // update DB counts
    },
  })
}

// ── BACKUPS ──────────────────────────────────────────────────────────────────

export function useBackups(databaseId) {
  return useQuery({
    queryKey: ['backups', databaseId],
    queryFn:  () => getBackups(databaseId),
    enabled:  !!databaseId,
    refetchInterval: 10000,
  })
}

export function useCreateBackup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ databaseId, ...data }) => createBackup(databaseId, data),
    onSuccess: (_, { databaseId }) => {
      qc.invalidateQueries({ queryKey: ['backups', databaseId] })
    },
  })
}

export function useTriggerBackup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: triggerBackup,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backups'] })
    },
  })
}

export function useTestS3() {
  return useMutation({
    mutationFn: ({ databaseId, ...data }) => testS3(databaseId, data),
  })
}