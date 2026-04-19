import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { serversApi } from '../services/servers.js'
import toast from 'react-hot-toast'

export const KEYS = {
  list:   () => ['servers', 'list'],
  detail: (id) => ['servers', id],
  status: (id) => ['servers', id, 'status'],
}

export function useServers() {
  return useQuery({ queryKey: KEYS.list(), queryFn: serversApi.list })
}

export function useServer(id) {
  return useQuery({ queryKey: KEYS.detail(id), queryFn: () => serversApi.get(id), enabled: !!id })
}

export function useServerStatus(id, enabled = true) {
  return useQuery({
    queryKey: KEYS.status(id),
    queryFn: () => serversApi.getStatus(id),
    enabled: !!id && enabled,
    refetchInterval: (query) => {
      const s = query.state.data?.status
      return (s === 'PENDING' || s === 'VERIFYING') ? 2000 : false
    },
  })
}

export function useCreateServer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: serversApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.list() })
      toast.success('Server added — verification starting…')
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || err.message || 'Failed to add server')
    },
  })
}

export function useDeleteServer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: serversApi.remove,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: KEYS.list() })
      toast.success(data.message || 'Server deleted')
    },
    onError: (err) => toast.error(err.message || 'Failed to delete'),
  })
}

export function useReverifyServer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: serversApi.reverify,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: KEYS.list() })
      qc.invalidateQueries({ queryKey: KEYS.status(id) })
      toast.success('Verification re-queued')
    },
    onError: (err) => toast.error(err.message || 'Failed to reverify'),
  })
}

export function useTestConnection() {
  return useMutation({
    mutationFn: (id) => serversApi.testConnection(id),
    onError: (err) => toast.error(err.message || 'Connection test failed'),
  })
}
