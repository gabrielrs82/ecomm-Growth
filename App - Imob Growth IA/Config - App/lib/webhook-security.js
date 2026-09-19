// ============================================================
// Segurança de Webhooks — Validação HMAC e Idempotência
// ============================================================

const crypto = require('crypto');

/**
 * Valida a assinatura criptográfica HMAC de um webhook.
 * @param {string|Buffer} rawBody - O corpo bruto recebido na requisição.
 * @param {string} signature - A assinatura recebida no cabeçalho.
 * @param {string} secret - O segredo compartilhado (secret) armazenado no .env.
 * @param {string} [algorithm] - O algoritmo de hash (default: sha256).
 * @returns {boolean} True se a assinatura for válida, false caso contrário.
 */
function verifyHmacSignature(rawBody, signature, secret, algorithm = 'sha256') {
    if (!rawBody || !signature || !secret) return false;

    try {
        const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
        const hmac = crypto.createHmac(algorithm, secret);
        hmac.update(bodyStr);
        const expectedSignature = hmac.digest('hex');

        const expectedBuffer = Buffer.from(expectedSignature, 'hex');
        const signatureBuffer = Buffer.from(signature, 'hex');

        if (expectedBuffer.length !== signatureBuffer.length) {
            return false;
        }

        // timingSafeEqual previne timing attacks na comparação da assinatura
        return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
    } catch (err) {
        console.error('[WEBHOOK-SEC] Erro ao validar assinatura:', err);
        return false;
    }
}

/**
 * Verifica e registra o ID do evento para garantir idempotência.
 * @param {string} eventId - O ID único do evento enviado pelo provedor.
 * @param {object} supabaseAdmin - Cliente do Supabase com privilégios de Admin.
 * @returns {Promise<{ allowed: boolean, status: string, response: any }>}
 */
async function checkAndRegisterIdempotency(eventId, supabaseAdmin) {
    if (!eventId) return { allowed: false, status: 'invalid_id' };

    try {
        // Tenta inserir a chave de idempotência com status 'processing'
        const { error: insertError } = await supabaseAdmin
            .from('idempotency_keys')
            .insert({
                event_id: eventId,
                status: 'processing'
            });

        // Se a inserção falhar por restrição de chave única, o evento já existe
        if (insertError) {
            if (insertError.code === '23505' || insertError.message?.includes('duplicate key') || insertError.message?.includes('already exists')) {
                // Busca o registro existente para responder adequadamente
                const { data: record, error: fetchError } = await supabaseAdmin
                    .from('idempotency_keys')
                    .select('*')
                    .eq('event_id', eventId)
                    .maybeSingle();

                if (fetchError || !record) {
                    return { allowed: false, status: 'error', error: fetchError };
                }

                return {
                    allowed: false,
                    status: record.status,
                    response: record.response_body
                };
            }
            return { allowed: false, status: 'error', error: insertError };
        }

        return { allowed: true, status: 'processing' };
    } catch (err) {
        console.error('[WEBHOOK-IDEMPOTENCY] Erro ao checar idempotência:', err);
        return { allowed: false, status: 'error', error: err };
    }
}

/**
 * Marca a chave de idempotência como concluída e armazena o corpo da resposta em cache.
 * @param {string} eventId
 * @param {object} responseBody
 * @param {object} supabaseAdmin
 */
async function completeIdempotency(eventId, responseBody, supabaseAdmin) {
    try {
        await supabaseAdmin
            .from('idempotency_keys')
            .update({
                status: 'completed',
                response_body: responseBody,
                updated_at: new Date().toISOString()
            })
            .eq('event_id', eventId);
    } catch (err) {
        console.error('[WEBHOOK-IDEMPOTENCY] Erro ao completar chave:', err);
    }
}

/**
 * Marca a chave de idempotência como falha, permitindo que o provedor tente reenviar.
 * @param {string} eventId
 * @param {object} supabaseAdmin
 */
async function failIdempotency(eventId, supabaseAdmin) {
    try {
        await supabaseAdmin
            .from('idempotency_keys')
            .update({
                status: 'failed',
                updated_at: new Date().toISOString()
            })
            .eq('event_id', eventId);
    } catch (err) {
        console.error('[WEBHOOK-IDEMPOTENCY] Erro ao falhar chave:', err);
    }
}

module.exports = {
    verifyHmacSignature,
    checkAndRegisterIdempotency,
    completeIdempotency,
    failIdempotency
};
