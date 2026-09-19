// ============================================================
// DELETE /api/user/delete — Direito à exclusão/eliminação de dados (LGPD)
// ============================================================

const { verifyAuth, supabaseAdmin } = require('../../lib/supabase');
const { setCorsHeaders } = require('../../lib/sanitize');
const { rateLimit, sendRateLimitResponse } = require('../../lib/rate-limit');
const { withObservability } = require('../../lib/middleware');

async function handler(req, res) {
    setCorsHeaders(res, req.headers.origin);
    if (req.method === 'OPTIONS') return res.status(200).end();

    // Rate Limit: 5 requisições/min
    const { allowed, retryAfter } = rateLimit(req, { maxRequests: 5, windowMs: 60000 });
    if (!allowed) return sendRateLimitResponse(res, retryAfter);

    if (req.method !== 'DELETE') return res.status(405).json({ error: 'Método não permitido' });

    try {
        const { user, error } = await verifyAuth(req, res);
        if (error || !user) {
            return res.status(401).json({ error: 'Não autorizado' });
        }

        // Evitar deletar o usuário de demonstração
        if (user.email === 'demo@imobgrowth.com.br') {
            return res.status(403).json({ error: 'A conta de demonstração não pode ser excluída.' });
        }

        // LGPD: Eliminação de dados do titular.
        // A deleção no auth.users do Supabase Auth apagará em cascata (ON DELETE CASCADE)
        // o registro correspondente na tabela "profiles" e as tabelas "generations" e "video_renders".
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

        if (deleteError) {
            console.error('Delete error:', deleteError);
            return res.status(400).json({ error: 'Falha ao excluir a conta do banco de dados.' });
        }

        // Limpar cookies HTTP-only de autenticação
        const isProd = process.env.NODE_ENV === 'production';
        const secureFlag = isProd ? '; Secure' : '';

        res.setHeader('Set-Cookie', [
            `sb-access-token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secureFlag}`,
            `sb-refresh-token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secureFlag}`
        ]);

        return res.status(200).json({
            success: true,
            message: 'Sua conta e todos os dados associados foram completamente excluídos em conformidade com a LGPD.'
        });
    } catch (err) {
        console.error('[LGPD-DELETE] Erro:', err);
        return res.status(500).json({ error: 'Erro interno ao processar exclusão de conta.' });
    }
}

module.exports = withObservability(handler, 'USER_DATA_DELETE');
