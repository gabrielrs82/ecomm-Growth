// ============================================================
// POST /api/auth/reset-password — Redefinição de senha
// ============================================================

const { supabaseAdmin } = require('../../lib/supabase');
const { sanitizeString, setCorsHeaders, validateCSRF } = require('../../lib/sanitize');
const { rateLimit, sendRateLimitResponse } = require('../../lib/rate-limit');
const { preventTimingAttack } = require('../../lib/security');

module.exports = async function handler(req, res) {
    const startTime = Date.now();

    // CORS
    setCorsHeaders(res, req.headers.origin);
    if (req.method === 'OPTIONS') return res.status(200).end();

    // CSRF Protection
    if (!validateCSRF(req, res)) return;

    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    // Rate limit: 3 tentativas a cada 10 min por IP
    const { allowed, retryAfter } = rateLimit(req, { maxRequests: 3, windowMs: 10 * 60 * 1000 });
    if (!allowed) return sendRateLimitResponse(res, retryAfter);

    try {
        const { token, password } = req.body || {};

        // Validação da senha
        if (!password || password.length < 6) {
            await preventTimingAttack(startTime, 600);
            return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
        }

        const sanitizedToken = sanitizeString(token, 128);
        if (!sanitizedToken) {
            await preventTimingAttack(startTime, 600);
            return res.status(400).json({ error: 'Token de redefinição inválido.' });
        }

        // Buscar token no banco de dados
        const { data: resetRecord, error: resetError } = await supabaseAdmin
            .from('password_resets')
            .select('*')
            .eq('token', sanitizedToken)
            .eq('used', false)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();

        if (resetError || !resetRecord) {
            console.error('Token inválido ou expirado:', resetError);
            await preventTimingAttack(startTime, 600);
            return res.status(400).json({ error: 'Token inválido, expirado ou já utilizado.' });
        }

        // Buscar usuário correspondente
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) {
            console.error('Erro ao listar usuários no reset:', listError);
            throw listError;
        }

        const user = users?.find(u => u.email === resetRecord.email);
        if (!user) {
            await preventTimingAttack(startTime, 600);
            return res.status(400).json({ error: 'Usuário associado a este token não foi encontrado.' });
        }

        // Atualizar senha do usuário e marcar e-mail como confirmado
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
            password: password,
            email_confirm: true
        });

        if (updateError) {
            console.error('Erro ao atualizar senha no Supabase:', updateError);
            throw updateError;
        }

        // Marcar o token como utilizado no banco
        const { error: markUsedError } = await supabaseAdmin
            .from('password_resets')
            .update({ used: true })
            .eq('id', resetRecord.id);

        if (markUsedError) {
            console.warn('Alerta: Erro ao marcar token como utilizado:', markUsedError);
        }

        // Revogar todas as sessões ativas do usuário globalmente (Logout global)
        const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(user.id, 'global');
        if (signOutError) {
            console.warn('Alerta: Erro ao efetuar logout global das sessões:', signOutError.message);
        }

        await preventTimingAttack(startTime, 600);
        return res.status(200).json({
            success: true,
            message: 'Senha redefinida com sucesso! Todas as sessões anteriores foram desconectadas por segurança.'
        });

    } catch (err) {
        console.error('Reset password error:', err);
        await preventTimingAttack(startTime, 600);
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
};
