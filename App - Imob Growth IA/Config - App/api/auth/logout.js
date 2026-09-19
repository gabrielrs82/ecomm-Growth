// ============================================================
// POST /api/auth/logout — Logout do usuário e limpeza dos cookies
// ============================================================

const { setCorsHeaders, validateCSRF } = require('../../lib/sanitize');
const { rateLimit, sendRateLimitResponse } = require('../../lib/rate-limit');

module.exports = async function handler(req, res) {
    setCorsHeaders(res, req.headers.origin);
    if (req.method === 'OPTIONS') return res.status(200).end();

    // CSRF Protection
    if (!validateCSRF(req, res)) return;

    // Rate limit: 10 logouts/min
    const { allowed, retryAfter } = rateLimit(req, { maxRequests: 10, windowMs: 60000 });
    if (!allowed) return sendRateLimitResponse(res, retryAfter);

    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    try {
        const isProd = process.env.NODE_ENV === 'production';
        const secureFlag = isProd ? '; Secure' : '';

        // Limpa os cookies definindo Max-Age como 0 e data retroativa
        res.setHeader('Set-Cookie', [
            `sb-access-token=; HttpOnly; Path=/; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0${secureFlag}`,
            `sb-refresh-token=; HttpOnly; Path=/; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0${secureFlag}`
        ]);

        return res.status(200).json({ success: true, message: 'Sessão encerrada com sucesso' });
    } catch (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
};
