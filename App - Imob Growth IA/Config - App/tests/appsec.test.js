// Mock do Supabase
jest.mock('../lib/supabase', () => {
    const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn()
    };
    return {
        verifyAuth: jest.fn().mockResolvedValue({
            user: { id: 'user-uuid-123', email: 'user@test.com' },
            error: null,
            token: 'valid-token'
        }),
        getSupabaseClient: jest.fn(() => mockSupabase),
        supabaseAdmin: mockSupabase
    };
});

// Mock do rate limit
jest.mock('../lib/rate-limit', () => ({
    rateLimit: jest.fn(() => ({ allowed: true, retryAfter: 0 })),
    sendRateLimitResponse: jest.fn()
}));

const { supabaseAdmin, verifyAuth } = require('../lib/supabase');
const { isPrivateIp, validateUrlForSafeFetch } = require('../lib/security');
const userUpdateHandler = require('../api/user/update');

describe('AppSec Audit — SSRF & Mass Assignment Verification', () => {
    
    describe('SSRF Protection (validateUrlForSafeFetch)', () => {
        test('deve permitir URLs públicas válidas', async () => {
            const safeUrls = [
                'https://www.google.com/',
                'https://graph.facebook.com/v21.0/ads_archive',
                'https://fal.run/fal-ai/flux-pro'
            ];
            
            for (const url of safeUrls) {
                await expect(validateUrlForSafeFetch(url)).resolves.toBe(url);
            }
        });

        test('deve rejeitar URLs com IPs privados, loopback ou link-local', async () => {
            const unsafeUrls = [
                'http://127.0.0.1/admin',
                'http://localhost:5432',
                'http://10.0.0.1',
                'http://192.168.1.100/config',
                'http://169.254.169.254/latest/meta-data',
                'http://[::1]/abc',
                'http://[fe80::1]/admin'
            ];
            
            for (const url of unsafeUrls) {
                await expect(validateUrlForSafeFetch(url)).rejects.toThrow();
            }
        });

        test('deve enforcar allowlist de domínios quando especificada', async () => {
            const allowed = ['facebook.com', 'fbcdn.net'];
            
            // Domínio permitido
            await expect(validateUrlForSafeFetch('https://video.xx.fbcdn.net/v/file.mp4', allowed)).resolves.toBe('https://video.xx.fbcdn.net/v/file.mp4');
            
            // Domínio não permitido
            await expect(validateUrlForSafeFetch('https://evil.com/file.mp4', allowed)).rejects.toThrow(/não autorizado/);
        });

        test('deve rejeitar domínios maliciosos que resolvem para IP local (DNS Rebinding)', async () => {
            // "local.test.com" ou domínios similares fictícios que resolvam para 127.0.0.1
            // Podemos testar isso simulando a resolução DNS ou passando 'localhost'
            await expect(validateUrlForSafeFetch('http://localhost')).rejects.toThrow();
        });
    });

    describe('Mass Assignment Protection', () => {
        let mockReq;
        let mockRes;

        beforeEach(() => {
            jest.clearAllMocks();
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
                setHeader: jest.fn()
            };
        });

        test('Update de Usuário: deve atualizar apenas campos da whitelist (nome, telefone) e ignorar campos sensíveis', async () => {
            // payload contendo campos válidos e campos sensíveis maliciosos
            mockReq.body = {
                full_name: 'Novo Nome',
                phone: '11999999999',
                role: 'admin', // Invasão de privilégio (tentativa de alterar role)
                credits_images: 9999, // Tentativa de fraudar créditos
                plan: 'profissional', // Tentativa de alterar plano
                is_admin: true // Tentativa de se tornar admin
            };

            // Simula retorno do Supabase com os dados atualizados
            supabaseAdmin.single.mockResolvedValueOnce({
                data: {
                    id: 'user-uuid-123',
                    full_name: 'Novo Nome',
                    phone: '11999999999',
                    role: 'corretor', // Mantido como original
                    credits_images: 50, // Mantido como original
                    plan: 'starter' // Mantido como original
                },
                error: null
            });

            await userUpdateHandler(mockReq, mockRes);

            // Verifica se o Supabase Update foi chamado APENAS com a whitelist permitida
            expect(supabaseAdmin.update).toHaveBeenCalledWith({
                full_name: 'Novo Nome',
                phone: '11999999999'
            });

            // Garante que os campos sensíveis não foram repassados para a query
            const updatePayload = supabaseAdmin.update.mock.calls[0][0];
            expect(updatePayload.role).toBeUndefined();
            expect(updatePayload.credits_images).toBeUndefined();
            expect(updatePayload.plan).toBeUndefined();
            expect(updatePayload.is_admin).toBeUndefined();
            expect(updatePayload.user_id).toBeUndefined();

            expect(mockRes.status).toHaveBeenCalledWith(200);
        });
    });
});
