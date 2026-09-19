const crypto = require('crypto');

// Chained Query Builder Mock para Supabase
const mockQueryBuilder = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockReturnThis(),
    then: jest.fn(function(resolve) {
        resolve({ data: this._data, error: this._error });
    }),
    _data: null,
    _error: null
};

// Mock do Supabase
jest.mock('../lib/supabase', () => {
    return {
        supabaseAdmin: {
            from: (table) => {
                // Preservar o estado do mockQueryBuilder definido no teste
                return mockQueryBuilder;
            }
        }
    };
});

const { supabaseAdmin } = require('../lib/supabase');
const paymentWebhookHandler = require('../api/webhooks/payment');

describe('Integração de Webhooks — Segurança & Idempotência', () => {
    let mockReq;
    let mockRes;
    const testSecret = 'whsec_payment_test_secret_12345';
    let headers = {};

    beforeAll(() => {
        process.env.PAYMENT_WEBHOOK_SECRET = testSecret;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockQueryBuilder._data = null;
        mockQueryBuilder._error = null;
        headers = {};

        mockReq = {
            method: 'POST',
            headers: {
                host: 'localhost:3000',
                origin: 'http://localhost:3000'
            },
            body: {}
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            setHeader: jest.fn((name, value) => { headers[name] = value; }),
            end: jest.fn()
        };
    });

    // Helper para gerar assinatura HMAC legítima
    function generateHmacSignature(payload, secret) {
        const bodyStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
        return crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');
    }

    test('deve rejeitar requisição caso a assinatura esteja ausente', async () => {
        mockReq.body = { event_id: 'evt_1', user_id: 'usr_1', payment_id: 'pay_1', plan_type: 'profissional' };
        mockReq.headers['x-payment-signature'] = ''; // Vazia

        await paymentWebhookHandler(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
            error: expect.stringContaining('Assinatura ausente')
        }));
    });

    test('deve rejeitar requisição caso a assinatura HMAC seja inválida/forjada', async () => {
        const payload = { event_id: 'evt_1', user_id: 'usr_1', payment_id: 'pay_1', plan_type: 'profissional' };
        mockReq.body = payload;
        mockReq.headers['x-payment-signature'] = 'a1b2c3d4e5f6forgedsignaturehere'; // Assinatura inválida

        await paymentWebhookHandler(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
            error: expect.stringContaining('Assinatura inválida')
        }));
    });

    test('deve processar com sucesso um webhook com assinatura legítima e novo ID de evento', async () => {
        const payload = { event_id: 'evt_success_123', user_id: 'usr_123', payment_id: 'pay_123', plan_type: 'profissional' };
        mockReq.body = payload;
        mockReq.headers['x-payment-signature'] = generateHmacSignature(payload, testSecret);

        // Mock 1: Inserção inicial de idempotência com sucesso
        mockQueryBuilder._error = null; // insert resolve com sucesso

        await paymentWebhookHandler(mockReq, mockRes);

        // Verifica inserção de idempotência
        expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
            event_id: 'evt_success_123',
            status: 'processing'
        });

        // Verifica o provisionamento dos créditos
        expect(mockQueryBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
            credits_images: 200,
            credits_videos: 50,
            plan: 'profissional'
        }));

        // Verifica que o status da idempotência foi completado
        expect(mockQueryBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
            status: 'completed',
            response_body: expect.objectContaining({
                payment_id: 'pay_123',
                plan: 'profissional'
            })
        }));

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            message: expect.stringContaining('créditos liberados')
        }));
    });

    test('deve garantir idempotência retornando a mesma resposta caso o evento já tenha sido processado anteriormente', async () => {
        const payload = { event_id: 'evt_already_processed', user_id: 'usr_123', payment_id: 'pay_123', plan_type: 'profissional' };
        mockReq.body = payload;
        mockReq.headers['x-payment-signature'] = generateHmacSignature(payload, testSecret);

        // 1. Simula falha por chave duplicada (código Postgres 23505)
        mockQueryBuilder.insert.mockImplementationOnce(() => {
            return {
                then: (resolve) => resolve({ data: null, error: { code: '23505', message: 'duplicate key' } })
            };
        });

        // 2. Simula retorno da chave de idempotência concluída com sucesso
        mockQueryBuilder._data = {
            event_id: 'evt_already_processed',
            status: 'completed',
            response_body: { payment_id: 'pay_123', plan: 'profissional', credits_added: { images: 200, videos: 50 } }
        };

        await paymentWebhookHandler(mockReq, mockRes);

        // Não deve realizar novas queries de atualização de perfil ou de idempotência
        expect(mockQueryBuilder.update).not.toHaveBeenCalled();

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            cached: true,
            message: expect.stringContaining('já processado')
        }));
    });

    test('deve retornar status 202 Accepted se o evento correspondente estiver sendo processado em outra thread', async () => {
        const payload = { event_id: 'evt_processing_thread', user_id: 'usr_123', payment_id: 'pay_123', plan_type: 'profissional' };
        mockReq.body = payload;
        mockReq.headers['x-payment-signature'] = generateHmacSignature(payload, testSecret);

        // 1. Simula erro de chave duplicada
        mockQueryBuilder.insert.mockImplementationOnce(() => {
            return {
                then: (resolve) => resolve({ data: null, error: { code: '23505', message: 'duplicate key' } })
            };
        });

        // 2. Simula retorno da chave de idempotência como 'processing'
        mockQueryBuilder._data = {
            event_id: 'evt_processing_thread',
            status: 'processing'
        };

        await paymentWebhookHandler(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(202);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('sendo processado')
        }));
    });

    test('deve falhar e marcar como failed caso a consulta à API do Provedor de Pagamento indique que o status não foi aprovado', async () => {
        // Envia payment_id especial 'mock_unapproved_id' simulando pagamento pendente no gateway
        const payload = { event_id: 'evt_unapproved', user_id: 'usr_123', payment_id: 'mock_unapproved_id', plan_type: 'profissional' };
        mockReq.body = payload;
        mockReq.headers['x-payment-signature'] = generateHmacSignature(payload, testSecret);

        mockQueryBuilder._error = null; // insert resolve com sucesso

        await paymentWebhookHandler(mockReq, mockRes);

        // Deve marcar como falha para permitir tentativas futuras de reenvio
        expect(mockQueryBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
            status: 'failed'
        }));

        // Não deve ter atualizado o perfil do usuário
        expect(mockQueryBuilder.update).not.toHaveBeenCalledWith(expect.objectContaining({
            plan: 'profissional'
        }));

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
            error: expect.stringContaining('não foi confirmado pelo provedor')
        }));
    });
});
