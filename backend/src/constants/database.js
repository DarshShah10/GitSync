export const DB_CONFIGS = {
  MONGODB: {
    image: 'mongo:7',
    internalPort: 27017,
    dataPath: '/data/db',
    envVars: (cfg) => [
      `MONGO_INITDB_ROOT_USERNAME=${cfg.dbUser}`,
      `MONGO_INITDB_ROOT_PASSWORD=${cfg.dbPassword}`,
      ...(cfg.dbName ? [`MONGO_INITDB_DATABASE=${cfg.dbName}`] : []),
    ],
    healthCheck: () =>
      `mongosh -u "$$MONGO_INITDB_ROOT_USERNAME" -p "$$MONGO_INITDB_ROOT_PASSWORD" ` +
      `--authenticationDatabase admin --eval "db.adminCommand('ping')" --quiet`,
    connectionString: (cfg) =>
      `mongodb://${cfg.dbUser}:${encodeURIComponent(cfg.dbPassword)}@${cfg.ip}:${cfg.publicPort}/${cfg.dbName ?? ''}?authSource=admin`,
    internalConnectionString: (cfg) =>
      `mongodb://${cfg.dbUser}:${encodeURIComponent(cfg.dbPassword)}@localhost:${cfg.internalPort}/${cfg.dbName ?? ''}?authSource=admin`,
  },

  POSTGRESQL: {
    image: 'postgres:16-alpine',
    internalPort: 5432,
    dataPath: '/var/lib/postgresql/data',
    envVars: (cfg) => [
      `POSTGRES_USER=${cfg.dbUser}`,
      `POSTGRES_PASSWORD=${cfg.dbPassword}`,
      `POSTGRES_DB=${cfg.dbName ?? cfg.dbUser}`,
    ],
    healthCheck: () => `pg_isready -U $$POSTGRES_USER`,
    connectionString: (cfg) =>
      `postgresql://${cfg.dbUser}:${encodeURIComponent(cfg.dbPassword)}@${cfg.ip}:${cfg.publicPort}/${cfg.dbName ?? cfg.dbUser}`,
    internalConnectionString: (cfg) =>
      `postgresql://${cfg.dbUser}:${encodeURIComponent(cfg.dbPassword)}@localhost:${cfg.internalPort}/${cfg.dbName ?? cfg.dbUser}`,
  },

  MYSQL: {
    image: 'mysql:8.0',
    internalPort: 3306,
    dataPath: '/var/lib/mysql',
    envVars: (cfg) => [
      `MYSQL_ROOT_PASSWORD=${cfg.dbPassword}`,
      `MYSQL_DATABASE=${cfg.dbName ?? 'app'}`,
      `MYSQL_USER=${cfg.dbUser}`,
      `MYSQL_PASSWORD=${cfg.dbPassword}`,
    ],
    healthCheck: () => `mysqladmin ping -h localhost -u root -p"$$MYSQL_ROOT_PASSWORD"`,
    connectionString: (cfg) =>
      `mysql://${cfg.dbUser}:${encodeURIComponent(cfg.dbPassword)}@${cfg.ip}:${cfg.publicPort}/${cfg.dbName ?? 'app'}`,
    internalConnectionString: (cfg) =>
      `mysql://${cfg.dbUser}:${encodeURIComponent(cfg.dbPassword)}@localhost:${cfg.internalPort}/${cfg.dbName ?? 'app'}`,
  },

  MARIADB: {
    image: 'mariadb:11',
    internalPort: 3306,
    dataPath: '/var/lib/mysql',
    envVars: (cfg) => [
      `MARIADB_ROOT_PASSWORD=${cfg.dbPassword}`,
      `MARIADB_DATABASE=${cfg.dbName ?? 'app'}`,
      `MARIADB_USER=${cfg.dbUser}`,
      `MARIADB_PASSWORD=${cfg.dbPassword}`,
    ],
    healthCheck: () => `healthcheck.sh --connect`,
    connectionString: (cfg) =>
      `mysql://${cfg.dbUser}:${encodeURIComponent(cfg.dbPassword)}@${cfg.ip}:${cfg.publicPort}/${cfg.dbName ?? 'app'}`,
    internalConnectionString: (cfg) =>
      `mysql://${cfg.dbUser}:${encodeURIComponent(cfg.dbPassword)}@localhost:${cfg.internalPort}/${cfg.dbName ?? 'app'}`,
  },

  REDIS: {
    image: 'redis:7-alpine',
    internalPort: 6379,
    dataPath: '/data',
    envVars: () => [],
    composeCommand: (cfg) => ['redis-server', '--requirepass', cfg.dbPassword],
    healthCheck: (cfg) => `redis-cli -a ${shSingleQuote(cfg.dbPassword)} ping`,
    connectionString: (cfg) =>
      `redis://:${encodeURIComponent(cfg.dbPassword)}@${cfg.ip}:${cfg.publicPort}/0`,
    internalConnectionString: (cfg) =>
      `redis://:${encodeURIComponent(cfg.dbPassword)}@localhost:${cfg.internalPort}/0`,
  },

  KEYDB: {
    image: 'eqalpha/keydb:latest',
    internalPort: 6379,
    dataPath: '/data',
    envVars: () => [],
    composeCommand: (cfg) => ['keydb-server', '--requirepass', cfg.dbPassword],
    healthCheck: (cfg) => `keydb-cli -a ${shSingleQuote(cfg.dbPassword)} ping`,
    connectionString: (cfg) =>
      `redis://:${encodeURIComponent(cfg.dbPassword)}@${cfg.ip}:${cfg.publicPort}/0`,
    internalConnectionString: (cfg) =>
      `redis://:${encodeURIComponent(cfg.dbPassword)}@localhost:${cfg.internalPort}/0`,
  },

  DRAGONFLY: {
    image: 'docker.dragonflydb.io/dragonflydb/dragonfly:latest',
    internalPort: 6379,
    dataPath: '/data',
    envVars: () => [],
    composeCommand: (cfg) => ['dragonfly', '--requirepass', cfg.dbPassword],
    healthCheck: (cfg) => `redis-cli -a ${shSingleQuote(cfg.dbPassword)} ping`,
    connectionString: (cfg) =>
      `redis://:${encodeURIComponent(cfg.dbPassword)}@${cfg.ip}:${cfg.publicPort}/0`,
    internalConnectionString: (cfg) =>
      `redis://:${encodeURIComponent(cfg.dbPassword)}@localhost:${cfg.internalPort}/0`,
  },

  CLICKHOUSE: {
    image: 'clickhouse/clickhouse-server:latest',
    internalPort: 8123,
    dataPath: '/var/lib/clickhouse',
    envVars: (cfg) => [
      `CLICKHOUSE_USER=${cfg.dbUser}`,
      `CLICKHOUSE_PASSWORD=${cfg.dbPassword}`,
      `CLICKHOUSE_DB=${cfg.dbName ?? 'default'}`,
    ],
    healthCheck: () => `wget --spider -q http://localhost:8123/ping`,
    connectionString: (cfg) =>
      `clickhouse://${cfg.dbUser}:${encodeURIComponent(cfg.dbPassword)}@${cfg.ip}:${cfg.publicPort}/${cfg.dbName ?? 'default'}`,
    internalConnectionString: (cfg) =>
      `clickhouse://${cfg.dbUser}:${encodeURIComponent(cfg.dbPassword)}@localhost:${cfg.internalPort}/${cfg.dbName ?? 'default'}`,
  },
}

export function shSingleQuote(val) {
  return `'${String(val ?? '').replace(/'/g, "'\\''")}'`
}

export function yamlStr(val) {
  return `'${String(val ?? '').replace(/'/g, "''")}'`
}

export function yamlDqEscape(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}