import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sourcesApi } from '../services/sources.js'
import toast from 'react-hot-toast'

export const KEYS = {
  list:   () => ['sources', 'list'],
  detail: (id) => ['sources', id],
}

export function useSources() {
  return useQuery({ queryKey: KEYS.list(), queryFn: sourcesApi.list })
}

export function useSource(id) {
  return useQuery({
    queryKey: KEYS.detail(id),
    queryFn:  () => sourcesApi.get(id),
    enabled:  !!id,
  })
}

export function useCreateSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: sourcesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.list() })
      toast.success('GitHub source added successfully')
    },
    onError: (err) => toast.error(err.response?.data?.error || err.message || 'Failed to add source'),
  })
}

export function useInitiateAutomated() {
  return useMutation({
    mutationFn: sourcesApi.initiateAutomated,
    // success is handled in the component (form POST navigates to GitHub)
    onError: (err) => toast.error(err.response?.data?.error || err.message || 'Failed to initiate GitHub App creation'),
  })
}

export function useUpdateSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: sourcesApi.update,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: KEYS.list() })
      qc.setQueryData(KEYS.detail(data?.data?.id), data)
      toast.success('Source updated')
    },
    onError: (err) => toast.error(err.response?.data?.error || err.message || 'Update failed'),
  })
}

export function useDeleteSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: sourcesApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.list() })
      toast.success('Source deleted')
    },
    onError: (err) => toast.error(err.message || 'Delete failed'),
  })
}
