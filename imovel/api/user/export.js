// ============================================================
// GET /api/user/export — Direito à portabilidade de dados (LGPD)
// ============================================================

const { verifyAuth } = require('../../lib/supabase');
const { setCorsHeaders } = require('../../lib/sanitize');
const { rateLimit, sendRateLimitResponse } = require('../../lib/rate-limit');
const { withObservability } = require('../../lib/middleware');
const { getSupabaseClient } = require('../../lib/supabase');

async function handler(req, res) {
    setCorsHeaders(res, req.headers.origin);
    if (req.method === 'OPTIONS') return res.status(200).end();

    // Rate Limit: 10 requisições/min
    const { allowed, retryAfter } = rateLimit(req, { maxRequests: 10, windowMs: 60000 });
    if (!allowed) return sendRateLimitResponse(res, retryAfter);

    if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

    try {
        const { user, error, token } = await verifyAuth(req, res);
        if (error || !user) {
            return res.status(401).json({ error: 'Não autorizado' });
        }

        const supabase = getSupabaseClient(token);

        // Buscar dados do perfil
        const { data: profile, error: pErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        // Buscar histórico de imagens geradas
        const { data: generations } = await supabase
            .from('generations')
            .select('*')
            .eq('user_id', user.id);

        // Buscar histórico de vídeos renderizados
        const { data: videoRenders } = await supabase
            .from('video_renders')
            .select('*')
            .eq('user_id', user.id);

        return res.status(200).json({
            success: true,
            export_timestamp: new Date().toISOString(),
            data: {
                profile,
                generations,
                video_renders: videoRenders
            }
        });
    } catch (err) {
        console.error('[LGPD-EXPORT] Erro:', err);
        return res.status(500).json({ error: 'Erro interno ao processar exportação de dados.' });
    }
}

module.exports = withObservability(handler, 'USER_DATA_EXPORT');
