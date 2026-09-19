// ============================================================
// POST /api/auth/forgot-password — Recuperação de senha
// ============================================================

const crypto = require('crypto');
const { supabaseAdmin } = require('../../lib/supabase');
const { sanitizeEmail, setCorsHeaders, validateCSRF } = require('../../lib/sanitize');
const { rateLimit, sendRateLimitResponse } = require('../../lib/rate-limit');
const { sendEmail, getPasswordRecoveryTemplate } = require('../../lib/email');
const { preventTimingAttack, verifyTurnstileToken } = require('../../lib/security');
const { createLogger } = require('../../lib/logger');
const { withObservability } = require('../../lib/middleware');

module.exports = withObservability(async function handler(req, res) {
    const startTime = Date.now();

    // CORS
    setCorsHeaders(res, req.headers.origin);
    if (req.method === 'OPTIONS') return res.status(200).end();

    // CSRF Protection
    if (!validateCSRF(req, res)) return;

    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    const logger = createLogger(req);

    // Rate limit: 3 tentativas a cada 10 min por IP para mitigar abuso
    const { allowed, retryAfter } = rateLimit(req, { maxRequests: 3, windowMs: 10 * 60 * 1000 });
    if (!allowed) {
        logger.warn('ALERT_SUSPICIOUS_FORGOT_PASSWORD_RATE_LIMIT_EXCEEDED', { clientIP, retryAfter });
        return sendRateLimitResponse(res, retryAfter);
    }

    try {
        const { email, turnstile_token } = req.body || {};

        // Anti-bot challenge validation
        const isBotCheckValid = await verifyTurnstileToken(turnstile_token, clientIP);
        if (!isBotCheckValid) {
            logger.warn('ALERT_SUSPICIOUS_BOT_FORGOT_PASSWORD_ATTEMPT', { clientIP });
            await preventTimingAttack(startTime, 600);
            return res.status(400).json({ error: 'Desafio anti-bot inválido. Por favor, tente novamente.' });
        }

        // Valida e sanitiza email
        const emailResult = sanitizeEmail(email);
        if (!emailResult.valid) {
            await preventTimingAttack(startTime, 600);
            return res.status(200).json({
                success: true,
                message: 'Se este e-mail estiver cadastrado, enviaremos as instruções de redefinição.'
            });
        }

        // Buscar usuário na lista do Supabase
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) {
            console.error('Erro ao listar usuários:', listError);
            throw listError;
        }

        const user = users?.find(u => u.email === emailResult.email);

        if (user) {
            // Gerar token criptograficamente seguro e imprevisível (32 bytes = 64 chars hex)
            const token = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutos de expiração

            // Invalida todos os tokens anteriores não utilizados para este e-mail
            await supabaseAdmin
                .from('password_resets')
                .update({ used: true })
                .eq('email', emailResult.email)
                .eq('used', false);

            // Insere o novo token
            const { error: insertError } = await supabaseAdmin
                .from('password_resets')
                .insert({
                    email: emailResult.email,
                    token: token,
                    expires_at: expiresAt,
                    used: false
                });

            if (insertError) {
                console.error('Erro ao inserir token de reset:', insertError);
                throw insertError;
            }

            // Gerar URL de reset direcionando para o frontend
            const resetUrl = `${req.headers.origin || 'https://ecommgrowth.online'}/app?reset_token=${token}`;

            // Envia o e-mail de redefinição
            const fullName = user.user_metadata?.full_name || 'Usuário';
            sendEmail({
                to: emailResult.email,
                subject: 'Recuperação de Senha — Imob Growth AI',
                html: getPasswordRecoveryTemplate(fullName, resetUrl)
            });
        }

        // Resposta genérica para evitar enumeração de usuários
        await preventTimingAttack(startTime, 600);
        return res.status(200).json({
            success: true,
            message: 'Se este e-mail estiver cadastrado, enviaremos as instruções de redefinição.'
        });

    } catch (err) {
        console.error('Forgot password error:', err);
        await preventTimingAttack(startTime, 600);
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
}, 'AUTH_FORGOT_PASSWORD');
