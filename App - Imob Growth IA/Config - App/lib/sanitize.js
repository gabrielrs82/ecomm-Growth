// ============================================================
// Sanitização de Inputs — Proteção contra XSS e Injection
// ============================================================

/**
 * Remove tags HTML e caracteres perigosos de uma string.
 * @param {string} input - String a sanitizar
 * @param {number} maxLength - Comprimento máximo (default: 500)
 * @returns {string} String sanitizada
 */
function sanitizeString(input, maxLength = 500) {
    if (typeof input !== 'string') return '';

    return input
        .trim()
        .slice(0, maxLength)
        // Remove tags HTML
        .replace(/<[^>]*>/g, '')
        // Remove scripts inline
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        // Remove caracteres de controle (exceto newline e tab)
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Sanitiza um prompt de IA (mais permissivo, mas sem código).
 * @param {string} prompt
 * @param {number} maxLength - Comprimento máximo (default: 1000)
 * @returns {string}
 */
function sanitizePrompt(prompt, maxLength = 1000) {
    if (typeof prompt !== 'string') return '';

    return prompt
        .trim()
        .slice(0, maxLength)
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/javascript:/gi, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Valida e sanitiza um email.
 * @param {string} email
 * @returns {{ valid: boolean, email: string }}
 */
function sanitizeEmail(email) {
    if (typeof email !== 'string') return { valid: false, email: '' };

    const cleaned = email.trim().toLowerCase().slice(0, 254);
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    return {
        valid: emailRegex.test(cleaned),
        email: cleaned
    };
}

/**
 * Valida MIME type de upload.
 * @param {string} mimeType
 * @param {string[]} allowedTypes - Array de tipos permitidos
 * @returns {boolean}
 */
function isAllowedMimeType(mimeType, allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']) {
    return allowedTypes.includes(mimeType);
}

/**
 * Middleware helper: responde com CORS headers.
 */
function setCorsHeaders(res, origin) {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());

    // Em dev, permite localhost
    if (origin && (allowedOrigins.includes(origin) || origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
    res.setHeader('Access-Control-Max-Age', '86400');
}

/**
 * Validação de CSRF baseada em cabeçalhos Origin e Referer.
 * @param {object} req - Request HTTP
 * @param {object} res - Response HTTP
 * @returns {boolean} Retorna true se for válido, false se falhar (e envia 403)
 */
function validateCSRF(req, res) {
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        const origin = req.headers.origin || '';
        const referer = req.headers.referer || '';
        
        const host = req.headers.host || '';
        const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
        
        if (isLocal) {
            return true;
        }

        const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
            .split(',')
            .map(o => o.trim().toLowerCase())
            .filter(Boolean);

        // Se não houver origens configuradas em produção, bloqueia por padrão
        if (allowedOrigins.length === 0) {
            res.status(403).json({ error: 'Acesso negado. ALLOWED_ORIGINS não configurado.' });
            return false;
        }

        let isAllowed = false;
        
        if (origin) {
            isAllowed = allowedOrigins.some(allowed => origin.toLowerCase().startsWith(allowed));
        }
        
        if (!isAllowed && referer) {
            isAllowed = allowedOrigins.some(allowed => referer.toLowerCase().startsWith(allowed));
        }

        if (!isAllowed) {
            res.status(403).json({ error: 'Acesso negado. Falha na validação CSRF (origem inválida).' });
            return false;
        }
    }
    return true;
}

module.exports = { sanitizeString, sanitizePrompt, sanitizeEmail, isAllowedMimeType, setCorsHeaders, validateCSRF };
