// ============================================================
// GET /api/credits — Consultar créditos do usuário
// POST /api/credits — Descontar créditos (uso interno)
// ============================================================

const { verifyAuth, getSupabaseClient } = require('../lib/supabase');
const { setCorsHeaders, validateCSRF } = require('../lib/sanitize');
const { rateLimit, sendRateLimitResponse } = require('../lib/rate-limit');

module.exports = async function handler(req, res) {
    setCorsHeaders(res, req.headers.origin);
    if (req.method === 'OPTIONS') return res.status(200).end();

    // CSRF Protection (valida apenas requisições POST)
    if (!validateCSRF(req, res)) return;

    // Rate limit
    const { allowed, retryAfter } = rateLimit(req, { maxRequests: 30, windowMs: 60000 });
    if (!allowed) return sendRateLimitResponse(res, retryAfter);

    // Verificar autenticação
    const { user, error, token } = await verifyAuth(req, res);
    if (error) return res.status(401).json({ error });

    try {
        const userClient = getSupabaseClient(token);
        const isDemoUser = user?.email?.toLowerCase() === 'gabrielrsantana21@gmail.com' || user?.email?.toLowerCase() === 'demo@imobgrowth.com.br';

        if (req.method === 'GET') {
            if (isDemoUser) {
                return res.status(200).json({
                    credits_images: 999,
                    credits_videos: 999,
                    plan: 'incorporadora'
                });
            }

            // Consultar créditos
            const { data: profile, error: fetchError } = await userClient
                .from('profiles')
                .select('credits_images, credits_videos, plan')
                .eq('id', user.id)
                .single();

            if (fetchError) {
                return res.status(500).json({ error: 'Erro ao buscar créditos' });
            }

            return res.status(200).json({
                credits_images: profile.credits_images,
                credits_videos: profile.credits_videos,
                plan: profile.plan
            });
        }

        if (req.method === 'POST') {
            // Descontar crédito
            const { type } = req.body || {};
            if (!['image', 'video'].includes(type)) {
                return res.status(400).json({ error: 'Tipo deve ser "image" ou "video"' });
            }

            const column = type === 'image' ? 'credits_images' : 'credits_videos';

            if (isDemoUser) {
                return res.status(200).json({
                    success: true,
                    remaining: 999
                });
            }

            // Verificar se tem créditos disponíveis
            const { data: profile } = await userClient
                .from('profiles')
                .select(column)
                .eq('id', user.id)
                .single();

            if (!profile || profile[column] <= 0) {
                return res.status(403).json({
                    error: 'Créditos insuficientes',
                    message: type === 'image'
                        ? 'Seus créditos de imagem acabaram. Faça upgrade do plano.'
                        : 'Seus créditos de vídeo acabaram. Faça upgrade do plano.',
                    remaining: 0
                });
            }

            // Descontar 1 crédito atomicamente
            const { data: remaining, error: updateError } = await userClient
                .rpc('decrement_credit', {
                    p_user_id: user.id,
                    p_credit_type: column
                });

            if (updateError) {
                // Se o erro for de créditos insuficientes, retorna 403
                if (updateError.message?.includes('Créditos insuficientes')) {
                    return res.status(403).json({
                        error: 'Créditos insuficientes',
                        message: type === 'image'
                            ? 'Seus créditos de imagem acabaram. Faça upgrade do plano.'
                            : 'Seus créditos de vídeo acabaram. Faça upgrade do plano.',
                        remaining: 0
                    });
                }
                
                // Fallback apenas se a função não existir (código 42883 ou sem suporte a RPC)
                if (updateError.code === '42883' || updateError.message?.includes('does not exist')) {
                    // Executa update seguro com WHERE credits > 0 para evitar saldo negativo e race conditions
                    const { data: updatedProfile, error: fallbackErr } = await userClient
                        .from('profiles')
                        .update({ [column]: profile[column] - 1 })
                        .eq('id', user.id)
                        .gt(column, 0)
                        .select(column)
                        .maybeSingle();

                    if (fallbackErr || !updatedProfile) {
                        return res.status(403).json({
                            error: 'Créditos insuficientes',
                            message: type === 'image'
                                ? 'Seus créditos de imagem acabaram. Faça upgrade do plano.'
                                : 'Seus créditos de vídeo acabaram. Faça upgrade do plano.',
                            remaining: 0
                        });
                    }
                    
                    return res.status(200).json({
                        success: true,
                        remaining: updatedProfile[column]
                    });
                }

                return res.status(500).json({ error: 'Erro ao descontar créditos: ' + updateError.message });
            }

            return res.status(200).json({
                success: true,
                remaining: remaining
            });
        }

        return res.status(405).json({ error: 'Método não permitido' });

    } catch (err) {
        console.error('Credits error:', err);
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
};
