import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { User, Team, Project } from '../models/index.js'
import { connect } from './mongo.js'

async function main() {
  await connect()
  console.log('[seed] Seeding default admin user…')

  const email    = process.env.ADMIN_EMAIL    ?? 'admin@gitsync.local'
  const password = process.env.ADMIN_PASSWORD ?? 'admin123456'

  const passwordHash = await bcrypt.hash(password, 12)

  let user = await User.findOne({ email })

  if (!user) {
    user = await User.create({
      name:         'Admin',
      email,
      passwordHash,
      isVerified:   true,
    })
    console.log(`[seed] Created user: ${email}`)
  } else {
    console.log(`[seed] User already exists: ${email}`)
  }

  let team = await Team.findOne({ slug: 'default' })

  if (!team) {
    team = await Team.create({
      name: 'Default',
      slug: 'default',
      members: [{ userId: user._id, role: 'OWNER', joinedAt: new Date() }],
    })
    console.log(`[seed] Created team: ${team.name}`)
  } else {
    const hasMember = team.members?.some(m => m.userId?.toString() === user._id.toString())
    if (!hasMember) {
      team.members = team.members || []
      team.members.push({ userId: user._id, role: 'OWNER', joinedAt: new Date() })
      await team.save()
    }
    console.log(`[seed] Team already exists: ${team.slug}`)
  }

  let project = await Project.findOne({ userId: user._id, name: 'Default' })

  if (!project) {
    project = await Project.create({
      userId:      user._id,
      teamId:      team._id,
      name:        'Default',
      description: 'Auto-created default project',
      environments: [{ name: 'Production', slug: 'production' }],
    })
    console.log(`[seed] Created project: ${project.name}`)
  } else {
    if (!project.environments?.some(e => e.slug === 'production')) {
      project.environments = project.environments || []
      project.environments.push({ name: 'Production', slug: 'production' })
      await project.save()
    }
    console.log(`[seed] Project already exists: ${project.name}`)
  }

  let environment = project.environments?.find(e => e.slug === 'production')

  console.log('\n[seed] ─────────────────────────────────────────────────')
  console.log('[seed] Default credentials:')
  console.log(`[seed]   Email:    ${email}`)
  console.log(`[seed]   Password: ${password}`)
  console.log(`[seed]   User ID:  ${user._id}`)
  console.log(`[seed]   Env ID:   ${environment?._id}`)
  console.log('[seed] ─────────────────────────────────────────────────')
  console.log('[seed] Done.')

  await mongoose.disconnect()
}

main()
  .catch((e) => {
    console.error('[seed] Error:', e)
    process.exit(1)
  })