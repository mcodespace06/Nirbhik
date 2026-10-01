# CampusVoice (Nirbhik) — Database Backup & Disaster Recovery Guide

> Operational runbook for backing up and restoring PostgreSQL with **pgvector** and the isolated **Vault** schema. Complies with **ARCHITECTURE.md §11** and **§14**.

---

## 1. Architecture Overview & Recovery Targets

CampusVoice utilizes a dual-schema PostgreSQL deployment:
1. **`public` schema**: Contains operational complaints, messages, rule embeddings, notifications, and user profiles. Accessible by the primary application role (`campus_app`).
2. **`vault` schema**: Contains encrypted reporter identity links (`reporter_links`) and trust scores (`reporter_scores`). Accessible **strictly** by the restricted vault role (`campus_vault`).

### SLA Targets
- **Recovery Point Objective (RPO)**: < 15 minutes (via continuous WAL archiving).
- **Recovery Time Objective (RTO)**: < 30 minutes for complete disaster recovery.

---

## 2. Automated Dual-Schema Backup Script

Save as `/opt/campusvoice/scripts/backup-db.sh` on the database host:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Configuration
BACKUP_DIR="/var/backups/campusvoice"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
GPG_RECIPIENT="security@campusvoice.edu"
S3_BUCKET="s3://campusvoice-encrypted-backups"

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting CampusVoice dual-schema database backup..."

# 1. Backup Public Schema (Operational Data)
echo "[1/4] Dumping public schema..."
pg_dump "${DATABASE_URL}" \
  --schema=public \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="${BACKUP_DIR}/public_${TIMESTAMP}.dump"

# 2. Backup Vault Schema (Isolated Restricted Cryptographic Ledger)
echo "[2/4] Dumping vault schema with restricted credentials..."
pg_dump "${VAULT_DATABASE_URL}" \
  --schema=vault \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="${BACKUP_DIR}/vault_${TIMESTAMP}.dump"

# 3. Encrypt dumps using GPG asymmetric public key
echo "[3/4] Encrypting dumps with GPG..."
gpg --encrypt --recipient "${GPG_RECIPIENT}" --output "${BACKUP_DIR}/public_${TIMESTAMP}.dump.gpg" "${BACKUP_DIR}/public_${TIMESTAMP}.dump"
gpg --encrypt --recipient "${GPG_RECIPIENT}" --output "${BACKUP_DIR}/vault_${TIMESTAMP}.dump.gpg" "${BACKUP_DIR}/vault_${TIMESTAMP}.dump"

# Clean up unencrypted local dumps
rm -f "${BACKUP_DIR}/public_${TIMESTAMP}.dump" "${BACKUP_DIR}/vault_${TIMESTAMP}.dump"

# 4. Offsite sync to encrypted S3 / Cloudflare R2 bucket
echo "[4/4] Syncing encrypted backups offsite..."
aws s3 cp "${BACKUP_DIR}/public_${TIMESTAMP}.dump.gpg" "${S3_BUCKET}/public/"
aws s3 cp "${BACKUP_DIR}/vault_${TIMESTAMP}.dump.gpg" "${S3_BUCKET}/vault/"

# Retain local backups for 7 days
find "${BACKUP_DIR}" -type f -name "*.dump.gpg" -mtime +7 -delete

echo "[$(date)] Backup completed successfully."
```

---

## 3. Disaster Recovery & Restoration Runbook

### Step 1: Provision Clean Database with pgvector
```bash
# Connect as superuser
psql "${ADMIN_DATABASE_URL}" -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql "${ADMIN_DATABASE_URL}" -c "CREATE SCHEMA IF NOT EXISTS public;"
psql "${ADMIN_DATABASE_URL}" -c "CREATE SCHEMA IF NOT EXISTS vault;"
```

### Step 2: Decrypt Backups
```bash
gpg --decrypt --output public_restore.dump public_20261001_120000.dump.gpg
gpg --decrypt --output vault_restore.dump vault_20261001_120000.dump.gpg
```

### Step 3: Restore Schemas
```bash
# Restore operational public schema
pg_restore \
  --dbname="${DATABASE_URL}" \
  --clean \
  --if-exists \
  --no-owner \
  --schema=public \
  public_restore.dump

# Restore cryptographic vault schema
pg_restore \
  --dbname="${VAULT_DATABASE_URL}" \
  --clean \
  --if-exists \
  --no-owner \
  --schema=vault \
  vault_restore.dump

# Securely shred plaintext dump files
shred -u public_restore.dump vault_restore.dump
```

### Step 4: Verify Schema Isolation & Integrity
```bash
# Ensure standard app user cannot query vault
psql "${DATABASE_URL}" -c "SELECT count(*) FROM vault.reporter_links;"
# EXPECTED OUTPUT: ERROR: permission denied for schema vault

# Ensure vault user can query vault
psql "${VAULT_DATABASE_URL}" -c "SELECT count(*) FROM vault.reporter_links;"
# EXPECTED OUTPUT: Returns row count
```

---

## 4. Vault Key Rotation Procedure

The cryptographic pepper and AES-256 key (`VAULT_KEY`) can be rotated annually or after any potential administrative breach without downtime:

1. Deploy new key version: Set `VAULT_KEY_NEXT="<new-32-byte-base64>"` alongside `VAULT_KEY`.
2. Run re-encryption migration script:
   ```bash
   npm run vault:rotate-keys
   ```
3. Update production environment: Set `VAULT_KEY` to the new key and decommission `VAULT_KEY_NEXT`.
