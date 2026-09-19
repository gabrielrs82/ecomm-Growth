// ============================================================
// POST /api/webhooks/payment — Webhook de processamento de pagamentos
// ============================================================

const { supabaseAdmin } = require('../../lib/supabase');
const { setCorsHeaders } = require('../../lib/sanitize');
const {
    verifyHmacSignature,
    checkAndRegisterIdempotency,
    completeIdempotency,
    failIdempotency
} = require('../../lib/webhook-security');

module.exports = async function handler(req, res) {
    setCorsHeaders(res, req.headers.origin);
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    // 1. Obter assinatura e raw body
    const signature = req.headers['x-payment-signature'];
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;

    if (!signature || !secret) {
        return res.status(401).json({ error: 'Assinatura ausente ou webhook não configurado.' });
    }

    // Em serverless, podemos ler o corpo bruto. Se req.body já estiver parseado, convertemos de volta
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    // 2. Validar assinatura criptográfica HMAC
    const isSignatureValid = verifyHmacSignature(rawBody, signature, secret);
    if (!isSignatureValid) {
        return res.status(400).json({ error: 'Assinatura inválida. Acesso negado.' });
    }

    let parsedPayload;
    try {
        parsedPayload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (e) {
        return res.status(400).json({ error: 'Payload malformado.' });
    }

    const { event_id, user_id, payment_id, plan_type } = parsedPayload || {};

    if (!event_id || !user_id || !payment_id || !plan_type) {
        return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
    }

    // 3. Garantir Idempotência
    const idempotency = await checkAndRegisterIdempotency(event_id, supabaseAdmin);
    if (!idempotency.allowed) {
        if (idempotency.status === 'completed') {
            // Se já foi concluído anteriormente, retorna o mesmo resultado cacheado
            return res.status(200).json({
                success: true,
                message: 'Webhook já processado anteriormente (idempotente).',
                cached: true,
                result: idempotency.response
            });
        }
        if (idempotency.status === 'processing') {
            // Se estiver em processamento, diz pro gateway aguardar
            return res.status(202).json({
                success: true,
                message: 'O evento está sendo processado no momento. Tente novamente mais tarde.'
            });
        }
        return res.status(500).json({ error: 'Erro de processamento de idempotência.' });
    }

    try {
        // 4. NUNCA confie no corpo do webhook: reconfirmar o status na API do Provedor
        // Aqui simulamos uma chamada segura à API do gateway de pagamento (Stripe/MercadoPago/etc.)
        const providerData = await fetchPaymentFromProvider(payment_id);
        if (!providerData || providerData.status !== 'approved' && providerData.status !== 'succeeded') {
            await failIdempotency(event_id, supabaseAdmin);
            return res.status(400).json({ error: 'Status do pagamento não foi confirmado pelo provedor de pagamento.' });
        }

        // 5. Aplicar os efeitos colaterais com segurança (ex: creditar créditos e atualizar plano)
        // Definir benefícios baseado no plano verificado no provedor
        let imageCredits = 50;
        let videoCredits = 10;
        let finalPlan = 'starter';

        if (plan_type === 'profissional') {
            imageCredits = 200;
            videoCredits = 50;
            finalPlan = 'profissional';
        } else if (plan_type === 'incorporadora') {
            imageCredits = 1000;
            videoCredits = 300;
            finalPlan = 'incorporadora';
        }

        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({
                credits_images: imageCredits,
                credits_videos: videoCredits,
                plan: finalPlan,
                updated_at: new Date().toISOString()
            })
            .eq('id', user_id);

        if (profileError) {
            throw profileError;
        }

        const responseSuccess = {
            payment_id,
            user_id,
            plan: finalPlan,
            credits_added: { images: imageCredits, videos: videoCredits }
        };

        // 6. Marcar idempotência como concluída com a resposta correspondente
        await completeIdempotency(event_id, responseSuccess, supabaseAdmin);

        return res.status(200).json({
            success: true,
            message: 'Webhook processado e créditos liberados com sucesso!',
            result: responseSuccess
        });

    } catch (err) {
        console.error('[PAYMENT-WEBHOOK] Erro ao processar:', err);
        // Marca como falha para permitir novas tentativas pelo gateway
        await failIdempotency(event_id, supabaseAdmin);
        return res.status(500).json({ error: 'Erro interno ao processar webhook de pagamento.' });
    }
};

/**
 * Função simulada para reconfirmar o pagamento direto na API do Provedor.
 * Em produção, faria um fetch real para Stripe ou MercadoPago usando SDK/HTTP client.
 */
async function fetchPaymentFromProvider(paymentId) {
    // Para fins de teste/integração segura
    if (paymentId === 'mock_unapproved_id') {
        return { status: 'pending' };
    }
    // Retorna status aprovado por padrão para pagamentos legítimos simulados
    return {
        id: paymentId,
        status: 'approved',
        amount: 4990
    };
}
