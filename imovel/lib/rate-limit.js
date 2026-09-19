// ============================================================
// Rate Limiting — Proteção contra abuso
// ============================================================
// Implementação simples em memória para Vercel Serverless.
// Em produção com alto volume, use Vercel KV ou Upstash Redis.
// ============================================================

const rateStore = new Map();

// Limpa entradas antigas a cada 5 minutos
const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, data] of rateStore) {
        if (now - data.windowStart > data.windowMs * 2) {
            rateStore.delete(key);
        }
    }
}, 5 * 60 * 1000);

if (cleanupInterval && typeof cleanupInterval.unref === 'function') {
    cleanupInterval.unref();
}

/**
 * Rate limiter por IP + endpoint
 * @param {Object} req - Request object
 * @param {Object} options - Configurações
 * @param {number} options.maxRequests - Máx. requests na janela (default: 20)
 * @param {number} options.windowMs - Tamanho da janela em ms (default: 60000 = 1 min)
 * @param {string} options.key - Chave customizada (default: IP + pathname)
 * @returns {{ allowed: boolean, remaining: number, retryAfter: number }}
 */
function rateLimit(req, options = {}) {
    const {
        maxRequests = 20,
        windowMs = 60 * 1000,
        key = null
    } = options;

    // Identifica o cliente por IP + endpoint
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.headers['x-real-ip']
        || req.socket?.remoteAddress
        || 'unknown';

    const endpoint = req.url?.split('?')[0] || '/';
    const rateLimitKey = key || `${clientIP}:${endpoint}`;

    const now = Date.now();
    const record = rateStore.get(rateLimitKey);

    if (!record || (now - record.windowStart) > windowMs) {
        // Nova janela
        rateStore.set(rateLimitKey, {
            count: 1,
            windowStart: now,
            windowMs
        });
        return { allowed: true, remaining: maxRequests - 1, retryAfter: 0 };
    }

    record.count++;

    if (record.count > maxRequests) {
        const retryAfter = Math.ceil((record.windowStart + windowMs - now) / 1000);
        return { allowed: false, remaining: 0, retryAfter };
    }

    return { allowed: true, remaining: maxRequests - record.count, retryAfter: 0 };
}

/**
 * Envia resposta de rate limit excedido
 */
function sendRateLimitResponse(res, retryAfter) {
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({
        error: 'Muitas requisições. Tente novamente em breve.',
        retryAfter
    });
}

module.exports = { rateLimit, sendRateLimitResponse };
