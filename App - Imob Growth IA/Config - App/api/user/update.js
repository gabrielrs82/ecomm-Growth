// ============================================================
// POST /api/user/update — Direito de retificação/correção (LGPD)
// ============================================================

const { verifyAuth } = require('../../lib/supabase');
const { setCorsHeaders, sanitizeString } = require('../../lib/sanitize');
const { rateLimit, sendRateLimitResponse } = require('../../lib/rate-limit');
const { withObservability } = require('../../lib/middleware');
const { getSupabaseClient } = require('../../lib/supabase');

async function handler(req, res) {
    setCorsHeaders(res, req.headers.origin);
    if (req.method === 'OPTIONS') return res.status(200).end();

    // Rate Limit: 20 requisições/min
    const { allowed, retryAfter } = rateLimit(req, { maxRequests: 20, windowMs: 60000 });
    if (!allowed) return sendRateLimitResponse(res, retryAfter);

    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    try {
        const { user, error, token } = await verifyAuth(req, res);
        if (error || !user) {
            return res.status(401).json({ error: 'Não autorizado' });
        }

        const { full_name, phone } = req.body || {};

        const updateData = {};
        if (full_name) {
            const cleanName = sanitizeString(full_name, 100);
            if (cleanName.length < 2) {
                return res.status(400).json({ error: 'Nome inválido (mín. 2 caracteres).' });
            }
            updateData.full_name = cleanName;
        }

        if (phone !== undefined) {
            updateData.phone = sanitizeString(phone, 20);
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'Nenhum dado fornecido para atualização.' });
        }

        const supabase = getSupabaseClient(token);
        const { data, error: updateError } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', user.id)
            .select()
            .single();

        if (updateError) {
            console.error('Update error:', updateError);
            return res.status(400).json({ error: 'Erro ao atualizar dados do perfil.' });
        }

        return res.status(200).json({
            success: true,
            user: data
        });
    } catch (err) {
        console.error('[LGPD-UPDATE] Erro:', err);
        return res.status(500).json({ error: 'Erro interno ao processar retificação de dados.' });
    }
}

module.exports = withObservability(handler, 'USER_DATA_UPDATE');
