// ============================================================
// GET /api/auth/me — Dados do usuário autenticado
// ============================================================

const { verifyAuth, getSupabaseClient } = require('../../lib/supabase');
const { setCorsHeaders } = require('../../lib/sanitize');
const { rateLimit, sendRateLimitResponse } = require('../../lib/rate-limit');

module.exports = async function handler(req, res) {
    setCorsHeaders(res, req.headers.origin);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

    // Rate limit: 30 requests/min
    const { allowed, retryAfter } = rateLimit(req, { maxRequests: 30, windowMs: 60000 });
    if (!allowed) return sendRateLimitResponse(res, retryAfter);

    try {
        // Verificar autenticação
        const { user, error, token } = await verifyAuth(req, res);
        if (error) return res.status(401).json({ error });

        // --- BYPASS PARA CONTA DEMO ---
        if (user.email?.toLowerCase() === 'demo@imobgrowth.com.br') {
            return res.status(200).json({
                user: {
                    id: user.id,
                    email: user.email,
                    full_name: 'Usuário Demo',
                    role: 'admin',
                    plan: 'pro',
                    credits_images: 999,
                    credits_videos: 999,
                    created_at: new Date().toISOString()
                }
            });
        }
        // ------------------------------

        // Buscar perfil completo (respeitando RLS)
        const supabase = getSupabaseClient(token);
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.error('Profile fetch error:', profileError);
        }

        return res.status(200).json({
            user: {
                id: user.id,
                email: user.email,
                full_name: profile?.full_name || user.user_metadata?.full_name || '',
                role: profile?.role || 'corretor',
                plan: profile?.plan || 'starter',
                credits_images: profile?.credits_images ?? 50,
                credits_videos: profile?.credits_videos ?? 10,
                created_at: profile?.created_at || user.created_at
            }
        });

    } catch (err) {
        console.error('Me error:', err);
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
};
