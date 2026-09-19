// ============================================================
// GET /api/health — Endpoint de Health Check
// ============================================================

const { setCorsHeaders } = require('../lib/sanitize');
const { rateLimit, sendRateLimitResponse } = require('../lib/rate-limit');

module.exports = async function handler(req, res) {
    setCorsHeaders(res, req.headers.origin);
    if (req.method === 'OPTIONS') return res.status(200).end();

    // Limite de 60 requisições/minuto
    const { allowed, retryAfter } = rateLimit(req, { maxRequests: 60, windowMs: 60000 });
    if (!allowed) return sendRateLimitResponse(res, retryAfter);

    if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

    const memory = process.memoryUsage();
    
    return res.status(200).json({
        status: 'UP',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        system: {
            memory_heap_used_mb: (memory.heapUsed / 1024 / 1024).toFixed(2),
            memory_rss_mb: (memory.rss / 1024 / 1024).toFixed(2),
            node_version: process.version
        }
    });
};
