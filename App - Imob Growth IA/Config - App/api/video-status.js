// ============================================================
// GET /api/video-status?project_id=xxx — Polling de status do vídeo
// ============================================================

const { verifyAuth, supabaseAdmin } = require('../lib/supabase');
const { setCorsHeaders } = require('../lib/sanitize');
const { rateLimit, sendRateLimitResponse } = require('../lib/rate-limit');

module.exports = async function handler(req, res) {
    setCorsHeaders(res, req.headers.origin);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

    // Rate limit: 60/min (polling frequente é esperado)
    const { allowed, retryAfter } = rateLimit(req, { maxRequests: 60, windowMs: 60000 });
    if (!allowed) return sendRateLimitResponse(res, retryAfter);

    // Verificar autenticação
    const { user, error } = await verifyAuth(req, res);
    if (error) return res.status(401).json({ error });

    try {
        const { project_id } = req.query || {};
        if (!project_id) {
            return res.status(400).json({ error: 'project_id é obrigatório' });
        }

        // BOLA Fix: Verificar propriedade do project_id no banco de dados local
        const { data: videoRender, error: dbError } = await supabaseAdmin
            .from('video_renders')
            .select('user_id')
            .eq('json2video_project_id', project_id)
            .single();

        if (dbError || !videoRender) {
            return res.status(404).json({ error: 'Projeto de vídeo não encontrado' });
        }

        // Permitir bypass se o usuário autenticado for o dono ou o demo
        const isDemoUser = user.email?.toLowerCase() === 'demo@imobgrowth.com.br';
        if (videoRender.user_id !== user.id && !isDemoUser) {
            return res.status(403).json({ error: 'Acesso negado. Este projeto de vídeo pertence a outro usuário.' });
        }

        const JSON2VIDEO_API_KEY = process.env.JSON2VIDEO_API_KEY;
        if (!JSON2VIDEO_API_KEY) {
            return res.status(503).json({ error: 'Serviço indisponível' });
        }

        // Consultar status na JSON2Video
        const statusResponse = await fetch(`https://api.json2video.com/v2/movies?project=${project_id}`, {
            headers: {
                'x-api-key': JSON2VIDEO_API_KEY
            }
        });

        if (!statusResponse.ok) {
            return res.status(502).json({ error: 'Erro ao consultar status do vídeo' });
        }

        const result = await statusResponse.json();

        return res.status(200).json({
            status: result.status, // 'rendering', 'done', 'error'
            progress: result.progress || 0,
            video_url: result.url || null,
            duration: result.duration || null
        });

    } catch (err) {
        console.error('Video status error:', err);
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
};
