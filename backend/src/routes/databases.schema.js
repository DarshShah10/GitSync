import { z } from 'zod'

// ── Shared ─────────────────────────────────────────────────────────────────

export const serviceIdSchema = z.object({
  id: z.string().uuid('Invalid service ID'),
})

// Keep backward-compat alias used by old imports
export const databaseIdSchema = serviceIdSchema

export const backupPolicyIdSchema = z.object({
  id: z.string().uuid('Invalid backup policy ID'),
})

// Keep backward-compat alias
export const backupConfigIdSchema = backupPolicyIdSchema

// ── Service / Database creation ────────────────────────────────────────────

const DATABASE_ENGINES = [
  'MONGODB', 'POSTGRESQL', 'MYSQL', 'MARIADB',
  'REDIS', 'KEYDB', 'DRAGONFLY', 'CLICKHOUSE',
]

export const createDatabaseSchema = z.object({
  serverId: z.string().uuid('Invalid server ID'),

  // Optional: if not provided, the route falls back to req.user's default env
  environmentId: z.string().uuid('Invalid environment ID').optional(),

  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(63, 'Name must be under 63 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Name can only contain letters, numbers, underscores, hyphens'),

  type: z.enum(DATABASE_ENGINES, {
    errorMap: () => ({ message: `Type must be one of: ${DATABASE_ENGINES.join(', ')}` }),
  }),

  dbPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128),

  dbUser: z.string().min(1).max(63).optional().default('dbshift'),
  dbName: z.string().min(1).max(63).optional(),
})

// ── Backup policy creation (inline S3 creds) ──────────────────────────────
// S3 creds are accepted inline here and stored as an S3Credential.
// The frontend doesn't need to manage S3Credential objects separately yet.

export const createBackupConfigSchema = z.object({
  s3Endpoint:  z.string().url('Must be a valid URL').optional().or(z.literal('')),
  s3Bucket:    z.string().min(1, 'Bucket name is required').max(255),
  s3AccessKey: z.string().min(1, 'Access key is required'),
  s3SecretKey: z.string().min(1, 'Secret key is required'),
  s3Region:    z.string().default('us-east-1'),
  s3Path:      z.string().optional(),
  schedule: z
    .string()
    .regex(
      /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/,
      'Invalid cron expression'
    )
    .optional(),
  triggerNow: z.boolean().default(false),
})

export const testS3Schema = z.object({
  s3Endpoint:  z.string().url().optional().or(z.literal('')),
  s3Bucket:    z.string().min(1),
  s3AccessKey: z.string().min(1),
  s3SecretKey: z.string().min(1),
  s3Region:    z.string().default('us-east-1'),
})
