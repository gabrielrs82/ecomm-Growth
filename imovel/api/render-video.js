// ============================================================
// POST /api/render-video — Proxy seguro para JSON2Video
// ============================================================

const { verifyAuth, getSupabaseClient } = require('../lib/supabase');
const { sanitizeString, setCorsHeaders, validateCSRF } = require('../lib/sanitize');
const { rateLimit, sendRateLimitResponse } = require('../lib/rate-limit');
const { validateUrlForSafeFetch } = require('../lib/security');

module.exports = async function handler(req, res) {
    setCorsHeaders(res, req.headers.origin);
    if (req.method === 'OPTIONS') return res.status(200).end();

    // CSRF Protection
    if (!validateCSRF(req, res)) return;

    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    // Rate limit: 10 vídeos/hora por IP
    const { allowed, retryAfter } = rateLimit(req, { maxRequests: 10, windowMs: 3600000 });
    if (!allowed) return sendRateLimitResponse(res, retryAfter);

    // Verificar autenticação
    const { user, error, token } = await verifyAuth(req, res);
    if (error) return res.status(401).json({ error });

    try {
        const { template_id, headline, subtitle, caption_style, media_url } = req.body || {};

        // Validar media_url contra SSRF se fornecido
        if (media_url) {
            try {
                await validateUrlForSafeFetch(media_url);
            } catch (urlErr) {
                console.error('[RENDER-VIDEO] Bloqueio SSRF detectado para media_url:', media_url, urlErr.message);
                return res.status(400).json({ error: 'URL da mídia fornecida é inválida ou insegura.' });
            }
        }

        // Sanitizar inputs
        const cleanHeadline = sanitizeString(headline, 200);
        const cleanSubtitle = sanitizeString(subtitle, 200);

        const userClient = getSupabaseClient(token);

        // Verificar e descontar créditos atomicamente (reserva)
        const isDemoUser = user?.email?.toLowerCase() === 'gabrielrsantana21@gmail.com' || user?.email?.toLowerCase() === 'demo@imobgrowth.com.br';
        let remainingCredits = 999;
        let hasDecremented = false;

        const refundCredits = async () => {
            if (!isDemoUser) {
                await userClient.rpc('increment_credit', {
                    p_user_id: user.id,
                    p_credit_type: 'credits_videos'
                }).catch(e => console.error('Falha ao reembolsar créditos:', e));
            }
        };
        
        if (!isDemoUser) {
            const { data: remaining, error: decError } = await userClient.rpc('decrement_credit', {
                p_user_id: user.id,
                p_credit_type: 'credits_videos'
            });

            if (decError) {
                // Fallback se o RPC não existir
                if (decError.code === '42883' || decError.message?.includes('does not exist')) {
                    const { data: profile } = await userClient
                        .from('profiles')
                        .select('credits_videos')
                        .eq('id', user.id)
                        .single();

                    if (!profile || profile.credits_videos <= 0) {
                        return res.status(403).json({
                            error: 'Créditos de vídeo insuficientes',
                            remaining: 0
                        });
                    }

                    const { data: updatedProfile, error: fallbackErr } = await userClient
                        .from('profiles')
                        .update({ credits_videos: profile.credits_videos - 1 })
                        .eq('id', user.id)
                        .gt('credits_videos', 0)
                        .select('credits_videos')
                        .maybeSingle();

                    if (fallbackErr || !updatedProfile) {
                        return res.status(403).json({
                            error: 'Créditos de vídeo insuficientes',
                            remaining: 0
                        });
                    }
                    remainingCredits = updatedProfile.credits_videos;
                    hasDecremented = true;
                } else {
                    return res.status(403).json({
                        error: 'Créditos de vídeo insuficientes',
                        remaining: 0
                    });
                }
            } else {
                remainingCredits = remaining;
                hasDecremented = true;
            }
        }

        // ===== JSON2VIDEO API CALL =====
        const JSON2VIDEO_API_KEY = process.env.JSON2VIDEO_API_KEY;
        if (!JSON2VIDEO_API_KEY) {
            return res.status(503).json({
                error: 'Renderização de vídeos estará disponível em breve!',
                status: 'coming_soon'
            });
        }

        // Montar o payload JSON2Video
        const videoPayload = {
            template: template_id || 'tour-legendas',
            resolution: 'full-hd',
            quality: 'high',
            scenes: [
                {
                    elements: [
                        {
                            type: 'text',
                            text: cleanHeadline || 'Conheça este imóvel',
                            style: 'title',
                            duration: 5
                        },
                        {
                            type: 'text',
                            text: cleanSubtitle || 'Agende sua visita!',
                            style: 'subtitle',
                            start: 3,
                            duration: 4
                        }
                    ]
                }
            ]
        };

        // Se tem mídia, adiciona ao scene
        if (media_url) {
            videoPayload.scenes[0].elements.unshift({
                type: 'video',
                src: media_url,
                duration: -1 // duração automática
            });
        }

        // Enviar para JSON2Video
        const j2vResponse = await fetch('https://api.json2video.com/v2/movies', {
            method: 'POST',
            headers: {
                'x-api-key': JSON2VIDEO_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(videoPayload)
        });

        if (!j2vResponse.ok) {
            const errData = await j2vResponse.text();
            console.error('JSON2Video error:', errData);
            await refundCredits();
            return res.status(502).json({ error: 'Erro na renderização. Tente novamente.' });
        }

        const result = await j2vResponse.json();
        const projectId = result.project;

        // Registrar no histórico (status: rendering)
        const { data: videoRecord } = await userClient.from('video_renders').insert({
            user_id: user.id,
            template_id: template_id || 'tour-legendas',
            status: 'rendering',
            json2video_project_id: projectId
        }).select().single();

        return res.status(200).json({
            success: true,
            project_id: projectId,
            render_id: videoRecord?.id,
            status: 'rendering',
            credits_remaining: remainingCredits
        });

    } catch (err) {
        console.error('Render video error:', err);
        if (hasDecremented) {
            await refundCredits();
        }
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
};
