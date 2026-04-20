/**
 * Data Migration Script — DBShift v1 → v2
 *
 * Migrates existing data from the old flat schema to the new SaaS schema.
 * Run ONCE after `prisma migrate dev --name v2-merged-schema`.
 *
 * What it does:
 *   1. Creates a default admin user (from env vars or prompts)
 *   2. Creates a default team, project, and "Production" environment
 *   3. Migrates Server rows → splits credentials into ServerCredential
 *   4. Migrates Database rows → Service rows (type=DATABASE)
 *   5. Migrates BackupConfig rows → S3Credential + BackupPolicy
 *   6. Migrates BackupExecution rows → BackupRun rows
 *
 * Safe to run on a fresh DB (nothing to migrate, just seeds).
 * NOT safe to run twice — check for existing data first.
 *
 * Usage:
 *   ADMIN_EMAIL=admin@dbshift.local ADMIN_PASSWORD=changeme node scripts/migrate-v1-v2.js
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('DBShift v1 → v2 Data Migration')
  console.log('================================\n')

  // ── 1. Default user ────────────────────────────────────────────────────────
  const email    = process.env.ADMIN_EMAIL    ?? 'admin@dbshift.local'
  const password = process.env.ADMIN_PASSWORD ?? 'admin123456'

  let user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        name:         'Admin',
        email,
        passwordHash: await bcrypt.hash(password, 12),
        isVerified:   true,
      },
    })
    console.log(`✓ Created user: ${email}`)
  } else {
    console.log(`• User exists: ${email}`)
  }

  // ── 2. Default team + project + environment ────────────────────────────────
  let team = await prisma.team.findUnique({ where: { slug: 'default' } })
  if (!team) {
    team = await prisma.team.create({
      data: {
        name: 'Default',
        slug: 'default',
        members: { create: { userId: user.id, role: 'OWNER' } },
      },
    })
    console.log('✓ Created default team')
  }

  let project = await prisma.project.findFirst({ where: { userId: user.id, name: 'Default' } })
  if (!project) {
    project = await prisma.project.create({
      data: { userId: user.id, teamId: team.id, name: 'Default' },
    })
    console.log('✓ Created default project')
  }

  let defaultEnv = await prisma.environment.findUnique({
    where: { projectId_slug: { projectId: project.id, slug: 'production' } },
  })
  if (!defaultEnv) {
    defaultEnv = await prisma.environment.create({
      data: { projectId: project.id, name: 'Production', slug: 'production' },
    })
    console.log('✓ Created Production environment')
  }

  // ── 3. Check for legacy tables ─────────────────────────────────────────────
  // If the old tables don't exist (fresh install), nothing to migrate
  let legacyServers = []
  try {
    legacyServers = await prisma.$queryRaw`SELECT * FROM servers_legacy ORDER BY created_at ASC`
  } catch {
    console.log('\n• No legacy tables found — fresh install, migration complete.')
    console.log(`\nAdmin credentials:\n  Email:    ${email}\n  Password: ${password}`)
    return
  }

  console.log(`\nFound ${legacyServers.length} server(s) to migrate…\n`)

  // ── 4. Migrate servers ─────────────────────────────────────────────────────
  const serverIdMap = new Map() // oldId → newId

  for (const old of legacyServers) {
    // Check if already migrated
    const existing = await prisma.server.findFirst({
      where: { ip: old.ip, userId: user.id },
    })
    if (existing) {
      serverIdMap.set(old.id, existing.id)
      console.log(`  • Server already migrated: ${old.name}`)
      continue
    }

    const newServer = await prisma.server.create({
      data: {
        userId:        user.id,
        teamId:        team.id,
        name:          old.name,
        ip:            old.ip,
        sshPort:       old.port ?? 22,
        status:        old.status === 'READY' ? 'CONNECTED' : old.status,
        dockerVersion: old.docker_version,
        lastCheckedAt: old.last_checked_at,
        errorMessage:  old.error_message,
        credential: {
          create: {
            authType:      old.auth_type === 'KEY' ? 'SSH_KEY' : old.auth_type,
            sshUsername:   old.username ?? 'root',
            sshPrivateKey: old.auth_type === 'KEY'      ? old.private_key : null,
            sshPassword:   old.auth_type === 'PASSWORD' ? old.password    : null,
          },
        },
      },
    })

    serverIdMap.set(old.id, newServer.id)
    console.log(`  ✓ Migrated server: ${old.name} → ${newServer.id}`)
  }

  // ── 5. Migrate databases → services ───────────────────────────────────────
  let legacyDbs = []
  try {
    legacyDbs = await prisma.$queryRaw`SELECT * FROM databases_legacy ORDER BY created_at ASC`
  } catch {
    legacyDbs = []
  }

  console.log(`\nFound ${legacyDbs.length} database(s) to migrate…\n`)

  const dbIdMap = new Map() // oldId → newServiceId

  for (const db of legacyDbs) {
    const newServerId = serverIdMap.get(db.server_id)
    if (!newServerId) {
      console.warn(`  ! Skipping database ${db.name}: server not found in map`)
      continue
    }

    const existing = await prisma.service.findFirst({
      where: { name: db.name, serverId: newServerId, type: 'DATABASE' },
    })
    if (existing) {
      dbIdMap.set(db.id, existing.id)
      console.log(`  • Database already migrated: ${db.name}`)
      continue
    }

    const svc = await prisma.service.create({
      data: {
        environmentId:   defaultEnv.id,
        serverId:        newServerId,
        name:            db.name,
        type:            'DATABASE',
        status:          db.status,
        containerId:     db.container_id,
        containerName:   db.container_name,
        volumeName:      db.volume_name,
        internalPort:    db.internal_port,
        exposedPort:     db.public_port,
        isPublic:        db.is_public ?? false,
        connectionString: db.connection_string,
        errorMessage:    db.error_message,
        config: {
          dbEngine:   db.type,
          dbUser:     db.db_user,
          dbPassword: db.db_password,
          dbName:     db.db_name,
        },
      },
    })

    dbIdMap.set(db.id, svc.id)
    console.log(`  ✓ Migrated database: ${db.name} (${db.type}) → ${svc.id}`)
  }

  // ── 6. Migrate backup_configs → s3_credentials + backup_policies ──────────
  let legacyConfigs = []
  try {
    legacyConfigs = await prisma.$queryRaw`SELECT * FROM backup_configs_legacy ORDER BY created_at ASC`
  } catch {
    legacyConfigs = []
  }

  console.log(`\nFound ${legacyConfigs.length} backup config(s) to migrate…\n`)

  const configIdMap = new Map() // oldConfigId → newPolicyId

  for (const bc of legacyConfigs) {
    const newServiceId = dbIdMap.get(bc.database_id)
    if (!newServiceId) {
      console.warn(`  ! Skipping backup config for db ${bc.database_id}: not in map`)
      continue
    }

    const cred = await prisma.s3Credential.create({
      data: {
        userId:    user.id,
        name:      `Migrated — ${bc.s3_bucket}`,
        endpoint:  bc.s3_endpoint || null,
        bucket:    bc.s3_bucket,
        region:    bc.s3_region ?? 'us-east-1',
        accessKey: bc.s3_access_key,
        secretKey: bc.s3_secret_key,
      },
    })

    const policy = await prisma.backupPolicy.create({
      data: {
        serviceId:      newServiceId,
        s3CredentialId: cred.id,
        schedule:       bc.schedule || null,
        s3PathPrefix:   bc.s3_path || null,
        backupType:     'FULL',
        retentionDays:  30,
      },
    })

    configIdMap.set(bc.id, policy.id)
    console.log(`  ✓ Migrated backup config → policy ${policy.id}`)
  }

  // ── 7. Migrate backup_executions → backup_runs ────────────────────────────
  let legacyExecs = []
  try {
    legacyExecs = await prisma.$queryRaw`SELECT * FROM backup_executions_legacy ORDER BY created_at ASC`
  } catch {
    legacyExecs = []
  }

  console.log(`\nFound ${legacyExecs.length} backup execution(s) to migrate…\n`)

  for (const ex of legacyExecs) {
    const newPolicyId = configIdMap.get(ex.config_id)
    if (!newPolicyId) continue

    await prisma.backupRun.create({
      data: {
        backupPolicyId: newPolicyId,
        status:         ex.status,
        backupType:     'FULL',
        s3Key:          ex.s3_key,
        sizeBytes:      ex.size_bytes ? BigInt(ex.size_bytes) : null,
        errorMessage:   ex.error_message,
        startedAt:      ex.started_at,
        completedAt:    ex.completed_at,
        createdAt:      ex.created_at,
      },
    })
  }

  if (legacyExecs.length > 0) {
    console.log(`  ✓ Migrated ${legacyExecs.length} backup run(s)`)
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  console.log('\n================================')
  console.log('Migration complete. ✓')
  console.log(`\nAdmin credentials:\n  Email:    ${email}\n  Password: ${password}`)
  console.log('\nNext steps:')
  console.log('  1. Verify data in Prisma Studio: npx prisma studio')
  console.log('  2. Drop legacy tables: run the cleanup migration')
  console.log('  3. Restart the backend: npm run dev')
}

main()
  .catch((e) => {
    console.error('\nMigration failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
