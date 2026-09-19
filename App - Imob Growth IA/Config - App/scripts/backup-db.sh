#!/usr/bin/env bash

# ============================================================
# Script de Backup Automatizado Criptografado (pg_dump)
# ============================================================
# Requisitos: pg_dump, openssl, aws-cli
# ============================================================

set -euo pipefail

# Variáveis do Ambiente (com defaults)
DB_URL="${DATABASE_URL:-}"
S3_BUCKET="${BACKUP_S3_BUCKET:-imob-growth-backups}"
PASSPHRASE="${BACKUP_PASSPHRASE:-backup-super-secret-key-123}"

if [ -z "$DB_URL" ]; then
    echo "[ERRO] DATABASE_URL não está configurada."
    exit 1
fi

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/tmp/db_backups"
FILENAME="backup_${TIMESTAMP}.sql.gz"
ENC_FILENAME="${FILENAME}.enc"

mkdir -p "$BACKUP_DIR"

echo "[INFO] Iniciando o dump lógico do banco de dados..."
# Executa pg_dump e compacta
pg_dump "$DB_URL" | gzip > "${BACKUP_DIR}/${FILENAME}"

# Verifica integridade (se gerou arquivo com tamanho > 0)
if [ ! -s "${BACKUP_DIR}/${FILENAME}" ]; then
    echo "[ERRO] Falha ao gerar o arquivo de dump lógico."
    exit 1
fi

echo "[INFO] Criptografando o arquivo de backup com AES-256-CBC..."
# Criptografia simétrica com openssl
openssl enc -aes-256-cbc -salt -pbkdf2 \
    -in "${BACKUP_DIR}/${FILENAME}" \
    -out "${BACKUP_DIR}/${ENC_FILENAME}" \
    -k "$PASSPHRASE"

# Remover arquivo sem criptografia localmente imediatamente por privacidade
rm -f "${BACKUP_DIR}/${FILENAME}"

echo "[INFO] Enviando arquivo criptografado para o AWS S3..."
# Upload para o S3 (AWS CLI)
aws s3 cp "${BACKUP_DIR}/${ENC_FILENAME}" "s3://${S3_BUCKET}/${ENC_FILENAME}"

# Limpeza local
rm -f "${BACKUP_DIR}/${ENC_FILENAME}"

echo "[INFO] Backup concluído com sucesso e isolado no S3!"
echo "[DICA] Para descriptografar este backup execute:"
echo "openssl enc -d -aes-256-cbc -pbkdf2 -in <arquivo.enc> -out <arquivo.sql.gz> -k \$BACKUP_PASSPHRASE"
