export function sanitizeServer(server) {
  const obj = server.toObject ? server.toObject() : server
  delete obj.credential
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
    password:  cred.sshPassword   ?? null,
    privateKey: cred.sshPrivateKey ?? null,
  }
}

export function sanitizeDatabase(svc) {
  const cfg = svc.config ?? {}
  return {
    id:              svc._id,
    name:            svc.name,
    type:            cfg.dbEngine ?? svc.type,
    status:          svc.status,
    containerId:     svc.containerId,
    containerName:  svc.containerName,
    volumeName:      svc.volumeName,
    internalPort:   svc.internalPort,
    isPublic:       svc.isPublic,
    publicPort:      svc.exposedPort,
    connectionString: svc.connectionString
      ? svc.connectionString.replace(/:([^@/]+)@/, ':****@')
      : null,
    dbUser:          cfg.dbUser,
    dbName:          cfg.dbName,
    errorMessage:   svc.errorMessage,
    server:         svc.server,
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
    s3Endpoint:  cred.endpoint  ?? null,
    s3Bucket:    cred.bucket    ?? '',
    s3Region:    cred.region    ?? 'us-east-1',
    s3Path:      policy.s3PathPrefix ?? '',
    executions:  runs?.map(sanitizeRun) ?? undefined,
  }
}

export function sanitizeRun(run) {
  return run
}

export async function getOrCreateDefaultEnv(Project, userId) {
  const existing = await Project.findOne({
    userId: userId,
    name: 'Default',
    'environments.slug': 'production'
  }).lean()

  if (existing) {
    return existing.environments[0]
  }

  const project = await Project.create({
    userId: userId,
    name: 'Default',
    environments: [{ name: 'Production', slug: 'production' }]
  })

  return project.environments[0]
}