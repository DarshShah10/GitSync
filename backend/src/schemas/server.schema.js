import { z } from 'zod'

export const createServerSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(64, 'Name must be 64 characters or less')
    .trim(),

  ip: z
    .string()
    .min(1, 'IP address is required')
    .trim()
    .refine((val) => {
      const ipv4     = /^(\d{1,3}\.){3}\d{1,3}$/
      const hostname = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/
      return ipv4.test(val) || hostname.test(val)
    }, 'Must be a valid IP address or hostname'),

  port: z
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(22),

  username: z
    .string()
    .min(1, 'Username is required')
    .max(64)
    .trim()
    .default('root'),

  authType: z
    .enum(['PASSWORD', 'SSH_KEY'])
    .default('SSH_KEY'),

  password: z
    .string()
    .min(1)
    .trim()
    .optional(),

  privateKey: z
    .string()
    .min(1)
    .trim()
    .optional(),

}).refine((data) => {
  if (data.authType === 'PASSWORD') return !!data.password
  return !!data.privateKey
}, {
  message: 'Provide a password (for password auth) or a private key (for key auth)',
  path: ['authType'],
}).refine((data) => {
  if (data.authType === 'SSH_KEY' && data.privateKey) {
    const validHeaders = [
      '-----BEGIN RSA PRIVATE KEY-----',
      '-----BEGIN OPENSSH PRIVATE KEY-----',
      '-----BEGIN EC PRIVATE KEY-----',
      '-----BEGIN DSA PRIVATE KEY-----',
    ]
    return validHeaders.some((h) => data.privateKey.trim().startsWith(h))
  }
  return true
}, {
  message: 'Invalid SSH private key format. Must be a PEM key.',
  path: ['privateKey'],
})

export const updateServerSchema = z.object({
  name:       z.string().min(1).max(64).trim().optional(),
  port:      z.number().int().min(1).max(65535).optional(),
  username:  z.string().min(1).max(64).trim().optional(),
  authType:  z.enum(['PASSWORD', 'SSH_KEY']).optional(),
  password:  z.string().min(1).trim().optional(),
  privateKey: z.string().min(1).trim().optional(),
})

export const serverIdSchema = z.object({
  id: z.string().min(1, 'Invalid server ID'),
})