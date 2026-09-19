// ============================================================
// POST /api/auth/register — Registro de novos usuários
// ============================================================

const { supabaseAdmin } = require('../../lib/supabase');
const { sanitizeString, sanitizeEmail, setCorsHeaders, validateCSRF } = require('../../lib/sanitize');
const { rateLimit, sendRateLimitResponse } = require('../../lib/rate-limit');
const { sendEmail, getWelcomeTemplate } = require('../../lib/email');
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

    // Rate limit: 3 cadastros a cada 10 min por IP para prevenir abuso
    const { allowed, retryAfter } = rateLimit(req, { maxRequests: 3, windowMs: 10 * 60 * 1000 });
    if (!allowed) {
        logger.warn('ALERT_SUSPICIOUS_REGISTRATION_RATE_LIMIT_EXCEEDED', {
            message: 'Múltiplas tentativas de cadastro a partir de um mesmo IP em curto período.',
            clientIP,
            retryAfter
        });
        return sendRateLimitResponse(res, retryAfter);
    }

    try {
        const { email, password, full_name, phone, accepted_terms, is_over_18, turnstile_token } = req.body || {};

        // Anti-bot challenge validation
        const isBotCheckValid = await verifyTurnstileToken(turnstile_token, clientIP);
        if (!isBotCheckValid) {
            logger.warn('ALERT_SUSPICIOUS_BOT_REGISTRATION_ATTEMPT', {
                message: 'Tentativa de cadastro com desafio anti-bot inválido ou ausente.',
                clientIP
            });
            await preventTimingAttack(startTime, 600);
            return res.status(400).json({ error: 'Desafio anti-bot inválido. Por favor, tente novamente.' });
        }

        if (!accepted_terms) {
            return res.status(400).json({ error: 'Você precisa aceitar os Termos de Uso e a Política de Privacidade.' });
        }

        if (!is_over_18) {
            return res.status(400).json({ error: 'O cadastro na plataforma é restrito a maiores de 18 anos.' });
        }

        // Validações
        const emailResult = sanitizeEmail(email);
        if (!emailResult.valid) {
            return res.status(400).json({ error: 'Email inválido' });
        }

        if (!password || password.length < 6) {
            return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
        }

        const cleanName = sanitizeString(full_name, 100);
        if (!cleanName || cleanName.length < 2) {
            return res.status(400).json({ error: 'Nome completo é obrigatório (mín. 2 caracteres)' });
        }

        const cleanPhone = phone ? sanitizeString(phone, 20) : '';

        // Criar usuário no Supabase Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: emailResult.email,
            password,
            email_confirm: false, // Exige confirmação de e-mail antes do login
            user_metadata: { full_name: cleanName, is_over_18: true }
        });

        if (authError) {
            if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
                // Prevenção de Enumeração: responder como se o cadastro tivesse ocorrido com sucesso
                await preventTimingAttack(startTime, 600);
                return res.status(201).json({
                    success: true,
                    message: 'Cadastro realizado com sucesso! Enviamos um e-mail de confirmação para você ativar sua conta.',
                    user: {
                        id: 'dummy-uuid',
                        email: emailResult.email,
                        full_name: cleanName
                    }
                });
            }
            console.error('Auth error:', authError);
            await preventTimingAttack(startTime, 600);
            return res.status(500).json({ error: 'Erro ao criar conta. Tente novamente.' });
        }

        // Criar perfil na tabela profiles
        const { error: profileError } = await supabaseAdmin.from('profiles').insert({
            id: authData.user.id,
            full_name: cleanName,
            phone: cleanPhone,
            role: 'corretor',
            credits_images: 50,
            credits_videos: 10,
            plan: 'starter',
            accepted_terms_at: new Date().toISOString(),
            accepted_terms_ip: clientIP,
            accepted_terms_version: 'v1.0'
        });

        if (profileError) {
            console.error('Profile error:', profileError);
        }

        // Gerar link de confirmação do email via Supabase Admin
        let verificationUrl = `${req.headers.origin || 'https://ecommgrowth.online'}/app`;
        try {
            const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
                type: 'signup',
                email: emailResult.email,
                password,
                options: {
                    redirectTo: `${req.headers.origin || 'https://ecommgrowth.online'}/app`
                }
            });
            if (linkError) {
                console.error('Erro ao gerar link de ativação:', linkError);
            } else if (linkData?.properties?.action_link) {
                verificationUrl = linkData.properties.action_link;
            }
        } catch (linkErr) {
            console.error('Exceção ao gerar link de ativação:', linkErr);
        }

        // Enviar e-mail de boas-vindas com o link de ativação em background
        sendEmail({
            to: emailResult.email,
            subject: 'Ative sua conta no Imob Growth AI!',
            html: getWelcomeTemplate(cleanName, verificationUrl)
        });

        await preventTimingAttack(startTime, 600);
        return res.status(201).json({
            success: true,
            message: 'Cadastro realizado com sucesso! Enviamos um e-mail de confirmação para você ativar sua conta.',
            user: {
                id: authData.user.id,
                email: authData.user.email,
                full_name: cleanName
            }
        });

    } catch (err) {
        console.error('Register error:', err);
        await preventTimingAttack(startTime, 600);
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
}, 'AUTH_REGISTER');
