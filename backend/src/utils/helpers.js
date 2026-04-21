export function sanitizeServer(server) {
  const obj = server.toObject ? server.toObject() : { ...server }
  delete obj.credential
  obj.id = obj._id?.toString()   // ← fixes key warnings + create database modal
  return obj
}

export function buildServerConfig(server) {
  const cred = server.credential
  if (!cred) throw new Error(`Server ${server.id ?? server._id} has no credential record`)
  return {
    ip:         server.ip,
    port:       server.sshPort,
    username:   cred.sshUsername,
    authType:   cred.authType,
    password:   cred.sshPassword   ?? null,
    privateKey: cred.sshPrivateKey ?? null,
  }
}

export function sanitizeDatabase(svc) {
  const cfg = svc.config ?? {}
  return {
    id:               svc._id,
    name:             svc.name,
    type:             cfg.dbEngine ?? svc.type,
    status:           svc.status,
    containerId:      svc.containerId,
    containerName:    svc.containerName,
    volumeName:       svc.volumeName,
    internalPort:     svc.internalPort,
    isPublic:         svc.isPublic,
    publicPort:       svc.exposedPort,
    connectionString: svc.connectionString
      ? svc.connectionString.replace(/:([^@/]+)@/, ':****@')
      : null,
    dbUser:         cfg.dbUser,
    dbName:         cfg.dbName,
    errorMessage:   svc.errorMessage,
    server:         svc.serverId,   // ← was svc.server — populated via serverId field
    backupConfigs:  svc.backupConfigs,
    createdAt:      svc.createdAt,
    updatedAt:      svc.updatedAt,
  }
}

export function sanitizeBackupPolicy(policy) {
  const cred = policy.s3Credential ?? {}
  const { s3Credential, runs, ...rest } = policy
  return {
    ...rest,
    s3Endpoint: cred.endpoint  ?? null,
    s3Bucket:   cred.bucket    ?? '',
    s3Region:   cred.region    ?? 'us-east-1',
    s3Path:     policy.s3PathPrefix ?? '',
    executions: runs?.map(sanitizeRun) ?? undefined,
  }
}

export function sanitizeRun(run) {
  return run
}

// was returning just the environment — now returns { projectId, environmentId }
export async function getOrCreateDefaultEnv(Project, userId) {
  let project = await Project.findOne({
    userId,
    name: 'Default',
    'environments.slug': 'production',
  }).lean()

  if (!project) {
    const created = await Project.create({
      userId,
      name: 'Default',
      environments: [{ name: 'Production', slug: 'production' }],
    })
    project = created.toObject ? created.toObject() : created
  }

  return {
    projectId:     project._id,
    environmentId: project.environments[0]._id,
  }
}