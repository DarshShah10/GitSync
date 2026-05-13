/**
 * frontend/src/hooks/useDomains.js
 *
 * React Query hook — mirrors the pattern used in useServers / useDatabases.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchDomains,
  createDomain  as apiCreate,
  updateDomain  as apiUpdate,
  deleteDomain  as apiDelete,
} from '../services/domains.js'


const QUERY_KEY = ['domains']


export function useDomains() {
  const qc = useQueryClient()

  // ── Fetch ────────────────────────────────────────────────────────────────
  const { data, isLoading, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchDomains,
    select: (res) => res.data ?? [],
  })

  // ── Create ───────────────────────────────────────────────────────────────
  const { mutate: createDomain, isPending: isCreating } = useMutation({
    mutationFn: apiCreate,
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  // ── Update IP / IPv6 ─────────────────────────────────────────────────────
  const { mutate: updateDomain, isPending: isUpdating } = useMutation({
    mutationFn: apiUpdate,
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  // ── Delete ───────────────────────────────────────────────────────────────
  const { mutate: deleteDomain, isPending: isDeleting } = useMutation({
    mutationFn: apiDelete,
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  return {
    domains:   data ?? [],
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    refetch,
    createDomain,
    updateDomain,
    deleteDomain,
  }
}