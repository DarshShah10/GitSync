import { z } from 'zod'

export const healthResponseSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
  uptime: z.number(),
  version: z.string().optional(),
})

export const readyResponseSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
  checks: z.record(z.string(), z.boolean()),
})