// ============================================================
// POST /api/auth/login — Login de usuários
// ============================================================

const { supabaseAdmin } = require('../../lib/supabase');
const { sanitizeEmail, setCorsHeaders, validateCSRF } = require('../../lib/sanitize');
const { rateLimit, sendRateLimitResponse } = require('../../lib/rate-limit');
const { withObservability } = require('../../lib/middleware');
const { preventTimingAttack, verifyTurnstileToken } = require('../../lib/security');
const { createLogger } = require('../../lib/logger');

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

    // Rate limit: 5 tentativas/min por IP (proteção contra brute force)
    const { allowed, retryAfter } = rateLimit(req, { maxRequests: 5, windowMs: 60000 });
    if (!allowed) {
        logger.warn('ALERT_SUSPICIOUS_LOGIN_RATE_LIMIT_EXCEEDED', { clientIP, retryAfter });
        return sendRateLimitResponse(res, retryAfter);
    }

    try {
        const { email, password, turnstile_token } = req.body || {};

        // Anti-bot challenge validation
        const isBotCheckValid = await verifyTurnstileToken(turnstile_token, clientIP);
        if (!isBotCheckValid) {
            logger.warn('ALERT_SUSPICIOUS_BOT_LOGIN_ATTEMPT', { clientIP });
            await preventTimingAttack(startTime, 600);
            return res.status(400).json({ error: 'Desafio anti-bot inválido. Por favor, tente novamente.' });
        }

        // Validações
        const emailResult = sanitizeEmail(email);
        if (!emailResult.valid) {
            return res.status(400).json({ error: 'Email inválido' });
        }

        if (!password || password.length < 6) {
            return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
        }

        let sessionData = null;
        let userData = null;

        const crypto = require('crypto');
        
        // --- BYPASS PARA CONTA DEMO (Verificado via PBKDF2 ou senha padrao) ---
        let isDemoLogin = false;
        if (emailResult.email === 'demo@imobgrowth.com.br') {
            if (password && password.trim().toLowerCase() === 'growth123') {
                isDemoLogin = true;
            } else {
                const demoSalt = 'cc1b6d35597e379cda7b8d2e8db8a0c9';
                const demoHash = 'e573d857890287c7cac4834181685c8ea677c1ff03edfbce6b3f371ae29d0f733f797a4d8281a62db26a0fcce93cb3adbc17388feccb156453aac0d56ff18d55';
                const inputHash = crypto.pbkdf2Sync(password.trim(), demoSalt, 100000, 64, 'sha256').toString('hex');
                if (inputHash === demoHash) {
                    isDemoLogin = true;
                }
            }
        }

        if (isDemoLogin) {
            sessionData = {
                access_token: 'demo-token-12345',
                refresh_token: 'demo-refresh-12345',
                expires_at: Math.floor(Date.now() / 1000) + 86400
            };
            userData = {
                id: '00000000-0000-0000-0000-000000000000',
                email: 'demo@imobgrowth.com.br',
                full_name: 'Usuário Demo',
                role: 'admin',
                plan: 'pro',
                credits_images: 999,
                credits_videos: 999
            };
        } else {
            // Efetuar login no Supabase
            const { data, error } = await supabaseAdmin.auth.signInWithPassword({
                email: emailResult.email,
                password
            });

            if (error) {
                if (error.message?.toLowerCase().includes('confirm')) {
                    await preventTimingAttack(startTime, 600);
                    return res.status(403).json({ error: 'Por favor, confirme seu e-mail antes de fazer login.' });
                }
                await preventTimingAttack(startTime, 600);
                return res.status(401).json({ error: 'Credenciais inválidas' });
            }

            sessionData = data.session;

            // Buscar dados do perfil do usuário
            const { data: profile, error: profileError } = await supabaseAdmin
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .single();

            userData = {
                id: data.user.id,
                email: data.user.email,
                full_name: profile?.full_name || 'Usuário',
                role: profile?.role || 'corretor',
                plan: profile?.plan || 'starter',
                credits_images: profile?.credits_images ?? 50,
                credits_videos: profile?.credits_videos ?? 10
            };
        }

        // Configura os cookies HttpOnly
        const isProd = process.env.NODE_ENV === 'production';
        const secureFlag = isProd ? '; Secure' : '';
        
        res.setHeader('Set-Cookie', [
            `sb-access-token=${sessionData.access_token}; HttpOnly; Path=/; SameSite=Lax; MaxAge=3600${secureFlag}`,
            `sb-refresh-token=${sessionData.refresh_token}; HttpOnly; Path=/; SameSite=Lax; MaxAge=${30 * 24 * 3600}${secureFlag}`
        ]);

        await preventTimingAttack(startTime, 600);
        return res.status(200).json({
            success: true,
            user: userData
        });

    } catch (err) {
        console.error('Login error:', err);
        await preventTimingAttack(startTime, 600);
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
}, 'AUTH_LOGIN');
