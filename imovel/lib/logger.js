// ============================================================
// Logger Estruturado JSON — Observabilidade & Privacidade
// ============================================================

const crypto = require('crypto');

// Campos a serem mascarados nos logs (PII / Segredos)
const SENSITIVE_FIELDS = ['password', 'token', 'access_token', 'refresh_token', 'apikey', 'authorization', 'image_data', 'email', 'phone', 'full_name'];

function maskSecrets(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const copy = Array.isArray(obj) ? [...obj] : { ...obj };
    for (const key in copy) {
        if (typeof copy[key] === 'object') {
            copy[key] = maskSecrets(copy[key]);
        } else if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
            copy[key] = '***MASKED***';
        }
    }
    return copy;
}

function createLogger(req = null, userId = null) {
    const requestId = req?.headers?.['x-request-id'] || crypto.randomUUID();
    const clientIP = req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req?.socket?.remoteAddress || 'unknown';
    const method = req?.method || '';
    const path = req?.url?.split('?')[0] || '';

    const log = (level, message, context = {}) => {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            requestId,
            userId: userId || 'anonymous',
            path,
            method,
            ip: clientIP,
            ...maskSecrets(context)
        };
        console.log(JSON.stringify(logEntry));
    };

    return {
        info: (msg, ctx) => log('INFO', msg, ctx),
        warn: (msg, ctx) => log('WARN', msg, ctx),
        error: (msg, ctx, err) => {
            const errorCtx = err ? { 
                error: err.message, 
                stack: err.stack 
            } : {};
            log('ERROR', msg, { ...ctx, ...errorCtx });
        },
        fatal: (msg, ctx, err) => {
            const errorCtx = err ? { 
                error: err.message, 
                stack: err.stack 
            } : {};
            log('FATAL', msg, { ...ctx, ...errorCtx });
        },
        requestId
    };
}

module.exports = { createLogger };
