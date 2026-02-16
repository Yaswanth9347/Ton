#!/bin/bash
set -e

echo "Backup service started..."

while true; do
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="/backups/attendance_db_$TIMESTAMP.sql"
    
    echo "[$(date)] Starting backup..."
    export PGPASSWORD=$POSTGRES_PASSWORD
    
    # Use DB_HOST env var
    if pg_dump -h $DB_HOST -p $DB_PORT -U $POSTGRES_USER -d $POSTGRES_DB > $BACKUP_FILE; then
        echo "[$(date)] Backup successful: $BACKUP_FILE"
        # Keep only last 7 backups to save space
        ls -tp /backups/*.sql | grep -v '/$' | tail -n +8 | xargs -I {} rm -- {} 2>/dev/null || true
    else
        echo "[$(date)] Backup failed!"
    fi
    
    # Sleep for 24 hours (86400 seconds)
    echo "[$(date)] Sleeping for 24 hours..."
    sleep 86400
done
