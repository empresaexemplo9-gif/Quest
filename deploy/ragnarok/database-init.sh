#!/usr/bin/env bash
# Sourced by the official entrypoint, whose SQL helper accepts missing positional arguments.
set -eo pipefail
[[ "${MARIADB_PASSWORD:-}" =~ ^[a-f0-9]{64}$ && "${QUEST_INTER_PASSWORD:-}" =~ ^[a-f0-9]{22}$ ]] || { echo 'Generated service credentials are required.' >&2; exit 1; }
docker_process_sql <<SQL
CREATE DATABASE IF NOT EXISTS ragnarok_log CHARACTER SET utf8mb4;
GRANT ALL ON ragnarok_log.* TO 'quest'@'%';
SQL
for quest_sql in main.sql web.sql roulette_default_data.sql; do
  docker_process_sql --database=ragnarok < "/schema/$quest_sql"
done
docker_process_sql --database=ragnarok_log < /schema/logs.sql
docker_process_sql --database=ragnarok <<SQL
UPDATE login SET userid='quest_inter', user_pass='$QUEST_INTER_PASSWORD' WHERE account_id=1 AND sex='S';
SQL
