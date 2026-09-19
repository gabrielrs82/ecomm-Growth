// ============================================================
// Script de Backup Multiplataforma (Node.js) com Criptografia
// ============================================================

const { exec } = require('child_process');
const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');
const path = require('path');

const dbUrl = process.env.DATABASE_URL;
const passphrase = process.env.BACKUP_PASSPHRASE || 'backup-super-secret-key-123';
const outputDir = process.env.BACKUP_DIR || path.join(__dirname, '../backups');

if (!dbUrl) {
    console.error('[ERRO] DATABASE_URL não está configurada nas variáveis de ambiente.');
    process.exit(1);
}

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const rawFile = path.join(outputDir, `backup_${timestamp}.sql`);
const encFile = path.join(outputDir, `backup_${timestamp}.sql.gz.enc`);

console.log('[INFO] Iniciando o dump lógico do PostgreSQL...');

exec(`pg_dump "${dbUrl}" > "${rawFile}"`, (error) => {
    if (error) {
        console.error('[ERRO] Falha ao executar pg_dump:', error.message);
        process.exit(1);
    }

    // Verificar se o dump gerou dados
    if (!fs.existsSync(rawFile) || fs.statSync(rawFile).size === 0) {
        console.error('[ERRO] O dump gerado está vazio. Abortando.');
        if (fs.existsSync(rawFile)) fs.unlinkSync(rawFile);
        process.exit(1);
    }

    console.log('[INFO] Compactando e criptografando o dump com AES-256-CBC...');
    
    try {
        const rawContent = fs.readFileSync(rawFile);
        const compressed = zlib.gzipSync(rawContent);
        
        // Criptografia AES-256-CBC
        const salt = crypto.randomBytes(16);
        const key = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
        const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(compressed);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        
        // Formato do arquivo: SALT (16 bytes) + IV (16 bytes) + Dados Criptografados
        const finalBuffer = Buffer.concat([salt, iv, encrypted]);
        fs.writeFileSync(encFile, finalBuffer);
        
        // Limpar o arquivo de texto plano imediatamente
        fs.unlinkSync(rawFile);
        
        console.log(`[INFO] Backup gerado com sucesso localmente: ${encFile}`);
        console.log('[INFO] Envie este arquivo para o S3 ou Storage externo isolado.');
    } catch (e) {
        console.error('[ERRO] Falha no processamento de compactação ou criptografia:', e.message);
        if (fs.existsSync(rawFile)) fs.unlinkSync(rawFile);
        process.exit(1);
    }
});
