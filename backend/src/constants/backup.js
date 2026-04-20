export const BACKUP_TOOLS = {
  MONGODB: {
    dumpCmd: (cfg) =>
      `docker exec ${cfg.containerName} mongodump ` +
      `--host=127.0.0.1 --port=27017 ` +
      `--username="${cfg.dbUser}" --password="${cfg.dbPassword}" ` +
      `--authenticationDatabase=admin ` +
      `--archive=/tmp/${cfg.backupFile} --gzip && ` +
      `docker cp ${cfg.containerName}:/tmp/${cfg.backupFile} /tmp/${cfg.backupFile}`,
    ext: '.archive.gz',
  },
  POSTGRESQL: {
    dumpCmd: (cfg) =>
      `docker exec -e PGPASSWORD="${cfg.dbPassword}" ${cfg.containerName} ` +
      `pg_dump -U ${cfg.dbUser} -d ${cfg.dbName} -F c -f /tmp/${cfg.backupFile} && ` +
      `docker cp ${cfg.containerName}:/tmp/${cfg.backupFile} /tmp/${cfg.backupFile}`,
    ext: '.dump',
  },
  MYSQL: {
    dumpCmd: (cfg) =>
      `docker exec ${cfg.containerName} mysqldump -u ${cfg.dbUser} -p"${cfg.dbPassword}" --databases ${cfg.dbName} 2>/dev/null | gzip > /tmp/${cfg.backupFile}`,
    ext: '.sql.gz',
  },
  MARIADB: {
    dumpCmd: (cfg) =>
      `docker exec ${cfg.containerName} mysqldump -u ${cfg.dbUser} -p"${cfg.dbPassword}" --databases ${cfg.dbName} 2>/dev/null | gzip > /tmp/${cfg.backupFile}`,
    ext: '.sql.gz',
  },
  REDIS: {
    dumpCmd: (cfg) =>
      `docker exec ${cfg.containerName} redis-cli -a "${cfg.dbPassword}" BGSAVE 2>/dev/null && sleep 3 && ` +
      `docker cp ${cfg.containerName}:/data/dump.rdb /tmp/${cfg.backupFile}`,
    ext: '.rdb',
  },
  KEYDB: {
    dumpCmd: (cfg) =>
      `docker exec ${cfg.containerName} keydb-cli -a "${cfg.dbPassword}" BGSAVE 2>/dev/null && sleep 3 && ` +
      `docker cp ${cfg.containerName}:/data/dump.rdb /tmp/${cfg.backupFile}`,
    ext: '.rdb',
  },
  DRAGONFLY: {
    dumpCmd: (cfg) =>
      `docker exec ${cfg.containerName} redis-cli -a "${cfg.dbPassword}" BGSAVE 2>/dev/null && sleep 3 && ` +
      `docker cp ${cfg.containerName}:/data/dump.rdb /tmp/${cfg.backupFile}`,
    ext: '.rdb',
  },
  CLICKHOUSE: {
    dumpCmd: (cfg) =>
      `docker exec ${cfg.containerName} clickhouse-client ` +
      `--user=${cfg.dbUser} --password="${cfg.dbPassword}" ` +
      `--query="BACKUP DATABASE \`${cfg.dbName}\` TO File('/var/lib/clickhouse/backup/${cfg.backupFile}')" && ` +
      `docker cp ${cfg.containerName}:/var/lib/clickhouse/backup/${cfg.backupFile} /tmp/${cfg.backupFile}`,
    ext: '.zip',
  },
}

export const AWS_CLI_VERSION = '2.13.0'
export const AWS_CLI_URL = `https://awscli.amazonaws.com/awscli-exe-linux-x86_64-${AWS_CLI_VERSION}.zip`