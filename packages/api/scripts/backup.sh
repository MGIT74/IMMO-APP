#!/bin/sh
# Sauvegarde quotidienne MySQL d'IMMO-APP (mysqldump compressé, rétention 14 jours).
#
# Installation sur le VPS (une seule fois) :
#   chmod +x /var/www/api.ambassadeur-immo.com/packages/api/scripts/backup.sh
#   crontab -e  puis ajouter :
#   15 3 * * * /var/www/api.ambassadeur-immo.com/packages/api/scripts/backup.sh >> /var/www/api.ambassadeur-immo.com/backups/backup.log 2>&1
#
# Test manuel : ./backup.sh — crée backups/immo-YYYYmmdd-HHMMSS.sql.gz
set -eu

BASE="$(cd "$(dirname "$0")/../.." && pwd)"   # racine du repo
ENV_FILE="$BASE/.env"
[ -f "$ENV_FILE" ] || ENV_FILE="$BASE/packages/api/.env"

DATABASE_URL=$(grep -m1 '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")
[ -n "$DATABASE_URL" ] || { echo "DATABASE_URL introuvable dans $ENV_FILE"; exit 1; }

# mysql://user:pass@host:port/db?option=...
REST=$(printf '%s' "$DATABASE_URL" | sed 's|^mysql://||')
CREDS=$(printf '%s' "$REST" | sed 's|@[^@]*$||')
HOSTPORT=$(printf '%s' "$REST" | sed 's|^[^@]*@||; s|/.*||')
DB=$(printf '%s' "$REST" | sed 's|^[^@]*@||; s|.*/||; s|?.*||')
USER=$(printf '%s' "$CREDS" | sed 's|:.*||')
PASS=$(printf '%s' "$CREDS" | sed 's|^[^:]*:||')
HOST=$(printf '%s' "$HOSTPORT" | cut -d: -f1)

BACKUPS="$BASE/backups"
mkdir -p "$BACKUPS"
FICHE="$BACKUPS/immo-$(date +%Y%m%d-%H%M%S).sql.gz"

mysqldump --host="$HOST" --user="$USER" --password="$PASS" \
  --single-transaction --quick --default-character-set=utf8mb4 "$DB" | gzip > "$FICHE"

find "$BACKUPS" -name 'immo-*.sql.gz' -mtime +14 -delete
echo "$(date '+%F %T') OK -> $FICHE ($(du -h "$FICHE" | cut -f1))"