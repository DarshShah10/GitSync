import { z } from 'zod'

// ── Shared ────────────────────────────────────────────────────────────────────

export const databaseIdSchema = z.object({
  id: z.string().uuid('Invalid database ID'),
})

export const backupIdSchema = z.object({
  id: z.string().uuid('Invalid backup ID'),
})

// ── Database schemas ──────────────────────────────────────────────────────────

const DATABASE_TYPES = [
  'MONGODB', 'POSTGRESQL', 'MYSQL', 'MARIADB',
  'REDIS', 'KEYDB', 'DRAGONFLY', 'CLICKHOUSE',
]

export const createDatabaseSchema = z.object({
  serverId: z.string().uuid('Invalid server ID'),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(63, 'Name must be under 63 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Name can only contain letters, numbers, underscores, hyphens'),
  type: z.enum(DATABASE_TYPES, {
    errorMap: () => ({ message: `Type must be one of: ${DATABASE_TYPES.join(', ')}` }),
  }),
  dbPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128),
  dbUser: z.string().min(1).max(63).optional().default('dbshift'),
  dbName: z.string().min(1).max(63).optional(),
})

export const updateDatabaseSchema = z.object({
  name: z.string().min(2).max(63).optional(),
}).strict()

// ── Backup schemas ────────────────────────────────────────────────────────────

export const createBackupSchema = z.object({
  databaseId: z.string().uuid('Invalid database ID'),
  s3Endpoint: z
    .string()
    .url('Must be a valid URL (e.g. https://storage.googleapis.com)')
    .optional()
    .or(z.literal('')),
  s3Bucket: z.string().min(1, 'Bucket name is required').max(255),
  s3AccessKey: z.string().min(1, 'Access key is required'),
  s3SecretKey: z.string().min(1, 'Secret key is required'),
  s3Region: z.string().default('us-east-1'),
  s3Path: z.string().optional(),
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
  s3Endpoint: z.string().url().optional().or(z.literal('')),
  s3Bucket: z.string().min(1),
  s3AccessKey: z.string().min(1),
  s3SecretKey: z.string().min(1),
  s3Region: z.string().default('us-east-1'),
})