const crypto = require('crypto');

// Chained Query Builder Mock para Supabase
const mockQueryBuilder = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
    rpc: jest.fn(),
    then: jest.fn(function(resolve) {
        resolve({ data: this._data, error: this._error });
    }),
    _data: null,
    _error: null
};

jest.mock('../lib/supabase', () => {
    return {
        verifyAuth: jest.fn().mockResolvedValue({
            user: { id: 'user-uuid-123', email: 'user@test.com' },
            error: null,
            token: 'valid-token'
        }),
        getSupabaseClient: jest.fn(() => mockQueryBuilder),
        supabaseAdmin: mockQueryBuilder
    };
});

// Mock do rate limit
jest.mock('../lib/rate-limit', () => ({
    rateLimit: jest.fn(() => ({ allowed: true, retryAfter: 0 })),
    sendRateLimitResponse: jest.fn()
}));

const { verifyAuth } = require('../lib/supabase');
const creditsHandler = require('../api/credits');
const generateImageHandler = require('../api/generate-image');

describe('Auditoria de Segurança — Lógica de Negócio (Race Conditions & Limites)', () => {
    let mockReq;
    let mockRes;
    let headers = {};

    beforeAll(() => {
        process.env.FAL_KEY = 'mock-fal-key-for-test-123';
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockQueryBuilder._data = null;
        mockQueryBuilder._error = null;
        headers = {};

        // Configura mocks padrão para evitar que as checagens iniciais retornem null
        mockQueryBuilder.single.mockResolvedValue({
            data: { credits_images: 5, credits_videos: 5 },
            error: null
        });
        mockQueryBuilder.maybeSingle.mockResolvedValue({
            data: { credits_images: 4, credits_videos: 4 },
            error: null
        });
        mockQueryBuilder.rpc.mockReset();

        mockReq = {
            method: 'POST',
            headers: {
                origin: 'http://localhost:3000',
                host: 'localhost:3000'
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

    describe('Race Conditions no consumo de créditos (api/credits)', () => {
        test('deve retornar 403 e NÃO executar o fallback vulnerável se o RPC retornar "Créditos insuficientes"', async () => {
            mockReq.body = { type: 'image' };

            // Simula erro de Créditos insuficientes lançado pela exceção Postgres no RPC
            mockQueryBuilder.rpc.mockResolvedValueOnce({
                data: null,
                error: { message: 'Créditos insuficientes', code: 'P0001' }
            });

            await creditsHandler(mockReq, mockRes);

            // Não deve tentar chamar o update de fallback direto inseguro
            expect(mockQueryBuilder.update).not.toHaveBeenCalled();

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Créditos insuficientes'
            }));
        });

        test('deve executar o fallback atômico limitado (.gt) caso o RPC não exista (code 42883)', async () => {
            mockReq.body = { type: 'image' };

            // Simula erro de função não existente
            mockQueryBuilder.rpc.mockResolvedValueOnce({
                data: null,
                error: { message: 'function decrement_credit does not exist', code: '42883' }
            });

            await creditsHandler(mockReq, mockRes);

            // Garante que o fallback executou e incluiu a restrição .gt() para evitar race conditions de saldo negativo
            expect(mockQueryBuilder.gt).toHaveBeenCalledWith('credits_images', 0);
            expect(mockQueryBuilder.update).toHaveBeenCalledWith({
                credits_images: 4
            });

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                remaining: 4
            }));
        });
    });

    describe('Fluxo Transacional de Reserva e Reembolso (api/generate-image)', () => {
        test('deve reservar créditos antes da API lenta e reembolsar (incrementar) caso a API externa fale', async () => {
            mockReq.body = {
                prompt: 'Linda casa moderna',
                style: 'classic',
                format: 'feed'
            };

            // 1. Reserva do crédito: decremento bem sucedido
            mockQueryBuilder.rpc.mockResolvedValueOnce({
                data: 4, // 5 -> 4 créditos restantes
                error: null
            });

            // Mock da chamada à API do Fal.ai falhando (retornando status 500)
            global.fetch = jest.fn().mockResolvedValueOnce({
                ok: false,
                text: () => Promise.resolve('Fal.ai Server Error')
            });

            // 2. Reembolso: simula incremento executando com sucesso
            mockQueryBuilder.rpc.mockResolvedValueOnce({
                data: 5, // reembolsado para 5
                error: null
            });

            await generateImageHandler(mockReq, mockRes);

            // Garante que tentou decrementar no início
            expect(mockQueryBuilder.rpc).toHaveBeenNthCalledWith(1, 'decrement_credit', {
                p_user_id: 'user-uuid-123',
                p_credit_type: 'credits_images'
            });

            // Garante que invocou o reembolso
            expect(mockQueryBuilder.rpc).toHaveBeenNthCalledWith(2, 'increment_credit', {
                p_user_id: 'user-uuid-123',
                p_credit_type: 'credits_images'
            });

            expect(mockRes.status).toHaveBeenCalledWith(502);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: expect.stringContaining('Falha na geração pela IA')
            }));
        });

        test('deve bloquear a geração imediatamente sem chamar a API lenta se o usuário não possuir créditos', async () => {
            mockReq.body = {
                prompt: 'Linda casa moderna',
                style: 'classic',
                format: 'feed'
            };

            // Simula erro de saldo insuficiente na reserva do crédito
            mockQueryBuilder.rpc.mockResolvedValueOnce({
                data: null,
                error: { message: 'Créditos insuficientes', code: 'P0001' }
            });

            // Redefine fetch mock para garantir que não seja invocado
            global.fetch = jest.fn();

            await generateImageHandler(mockReq, mockRes);

            // Não pode chamar a API lenta do Fal AI
            expect(global.fetch).not.toHaveBeenCalled();

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: expect.stringContaining('Créditos de imagem insuficientes')
            }));
        });
    });
});
