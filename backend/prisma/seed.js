/**
 * Seed script — creates the default admin user, team, project, and environment.
 *
 * Run:  npx prisma db seed
 * Or:   node prisma/seed.js
 *
 * Safe to run multiple times — uses upsert/findFirst so it won't duplicate data.
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('[seed] Seeding default admin user…')

  // ── Default admin user ─────────────────────────────────────────────────────
  const email    = process.env.ADMIN_EMAIL    ?? 'admin@dbshift.local'
  const password = process.env.ADMIN_PASSWORD ?? 'admin123456'

  const passwordHash = await bcrypt.hash(password, 12)

  let user = await prisma.user.findUnique({ where: { email } })

  if (!user) {
    user = await prisma.user.create({
      data: {
        name:         'Admin',
        email,
        passwordHash,
        isVerified:   true,
      },
    })
    console.log(`[seed] Created user: ${email}`)
  } else {
    console.log(`[seed] User already exists: ${email}`)
  }

  // ── Default team ───────────────────────────────────────────────────────────
  let team = await prisma.team.findUnique({ where: { slug: 'default' } })

  if (!team) {
    team = await prisma.team.create({
      data: {
        name: 'Default',
        slug: 'default',
        members: {
          create: { userId: user.id, role: 'OWNER' },
        },
      },
    })
    console.log(`[seed] Created team: ${team.name}`)
  } else {
    // Ensure the admin is a member
    await prisma.teamMember.upsert({
      where:  { teamId_userId: { teamId: team.id, userId: user.id } },
      create: { teamId: team.id, userId: user.id, role: 'OWNER' },
      update: {},
    })
    console.log(`[seed] Team already exists: ${team.slug}`)
  }

  // ── Default project ────────────────────────────────────────────────────────
  let project = await prisma.project.findFirst({
    where: { userId: user.id, name: 'Default' },
  })

  if (!project) {
    project = await prisma.project.create({
      data: {
        userId:      user.id,
        teamId:      team.id,
        name:        'Default',
        description: 'Auto-created default project',
      },
    })
    console.log(`[seed] Created project: ${project.name}`)
  } else {
    console.log(`[seed] Project already exists: ${project.name}`)
  }

  // ── Default environment ────────────────────────────────────────────────────
  let environment = await prisma.environment.findUnique({
    where: { projectId_slug: { projectId: project.id, slug: 'production' } },
  })

  if (!environment) {
    environment = await prisma.environment.create({
      data: {
        projectId: project.id,
        name:      'Production',
        slug:      'production',
      },
    })
    console.log(`[seed] Created environment: ${environment.name}`)
  } else {
    console.log(`[seed] Environment already exists: ${environment.slug}`)
  }

  console.log('\n[seed] ─────────────────────────────────────────────────')
  console.log('[seed] Default credentials:')
  console.log(`[seed]   Email:    ${email}`)
  console.log(`[seed]   Password: ${password}`)
  console.log(`[seed]   User ID:  ${user.id}`)
  console.log(`[seed]   Env ID:   ${environment.id}`)
  console.log('[seed] ─────────────────────────────────────────────────')
  console.log('[seed] Done. ✓')
}

main()
  .catch((e) => {
    console.error('[seed] Error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
