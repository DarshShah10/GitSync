import { z } from 'zod'

export const projectIdSchema = z.object({ id: z.string() })

export const envIdSchema = z.object({
  id: z.string(),
  envId: z.string()
})

export const createProjectSchema = z.object({
  name:        z.string().min(1).max(64).trim(),
  description: z.string().max(256).optional(),
  teamId:      z.string().optional(),
})

export const createEnvironmentSchema = z.object({
  name: z.string().min(1).max(64).trim(),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens')
    .trim(),
})