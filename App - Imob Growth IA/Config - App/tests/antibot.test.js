// Set dummy environment variables to prevent supabase.js from throwing during loading
process.env.SUPABASE_URL = 'http://dummy-supabase-url.supabase.co';
process.env.SUPABASE_ANON_KEY = 'dummy-anon-key-12345';

const mockUserClient = {
    auth: {
        getUser: jest.fn()
    }
};

const mockAdminClient = {
    auth: {
        admin: {
            createUser: jest.fn(),
            generateLink: jest.fn(),
            listUsers: jest.fn()
        },
        signInWithPassword: jest.fn(),
        refreshSession: jest.fn()
    },
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ error: null }),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis()
};

// Mock @supabase/supabase-js at the very top
jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn((url, key, options) => {
        if (options?.global?.headers?.Authorization) {
            return mockUserClient;
        }
        return mockAdminClient;
    })
}));

// Mock do rate limit
jest.mock('../lib/rate-limit', () => ({
    rateLimit: jest.fn(() => ({ allowed: true, retryAfter: 0 })),
    sendRateLimitResponse: jest.fn()
}));

const mockSendEmail = jest.fn();
jest.mock('../lib/email', () => ({
    sendEmail: (args) => mockSendEmail(args),
    getWelcomeTemplate: (name, url) => `Welcome ${name}`,
    getPasswordRecoveryTemplate: (name, url) => `Recovery ${name}`
}));

const registerHandler = require('../api/auth/register');
const loginHandler = require('../api/auth/login');
const forgotHandler = require('../api/auth/forgot-password');
const { verifyAuth } = require('../lib/supabase');

describe('Auditoria Anti-Bot & Email Verification Flow', () => {
    let mockReq;
    let mockRes;
    let headers = {};

    beforeEach(() => {
        jest.clearAllMocks();
        headers = {};
        process.env.TURNSTILE_SECRET_KEY = 'real-secret-key-configured';
        process.env.NODE_ENV = 'production'; // Força a verificação Turnstile real no teste

        // Limpa mocks específicos
        mockAdminClient.from.mockReturnThis();
        mockAdminClient.insert.mockResolvedValue({ error: null });
        mockAdminClient.update.mockReturnThis();
        mockAdminClient.eq.mockReturnThis();

        mockReq = {
            method: 'POST',
            headers: {
                host: 'localhost:3000',
                origin: 'http://localhost:3000',
                'x-forwarded-for': '12.34.56.78'
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

    afterAll(() => {
        process.env.NODE_ENV = 'test';
        delete process.env.TURNSTILE_SECRET_KEY;
    });

    describe('Desafio Anti-Bot (Turnstile) no Registro', () => {
        test('deve rejeitar cadastro se turnstile_token estiver ausente ou inválido', async () => {
            mockReq.body = {
                email: 'bot@spam.com',
                password: 'password123',
                full_name: 'Robot Client',
                accepted_terms: true,
                turnstile_token: '' // Ausente
            };

            await registerHandler(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: expect.stringContaining('Desafio anti-bot inválido')
            }));
            expect(mockAdminClient.auth.admin.createUser).not.toHaveBeenCalled();
        });

        test('deve aceitar cadastro se turnstile_token for mock-turnstile-token-success', async () => {
            mockReq.body = {
                email: 'newuser@imobgrowth.com',
                password: 'secure_password_123',
                full_name: 'Novo Usuario',
                accepted_terms: true,
                turnstile_token: 'mock-turnstile-token-success'
            };

            mockAdminClient.auth.admin.createUser.mockResolvedValueOnce({
                data: { user: { id: 'mocked-uuid-1234', email: 'newuser@imobgrowth.com' } },
                error: null
            });
            mockAdminClient.auth.admin.generateLink.mockResolvedValueOnce({
                data: { properties: { action_link: 'http://verify.link' } },
                error: null
            });

            await registerHandler(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true
            }));
        });
    });

    describe('Desafio Anti-Bot (Turnstile) no Login', () => {
        test('deve rejeitar login se turnstile_token for inválido', async () => {
            mockReq.body = {
                email: 'someuser@test.com',
                password: 'secret_password_123',
                turnstile_token: 'invalid-token'
            };

            // Simula o mock do Cloudflare fetch falhando
            global.fetch = jest.fn().mockResolvedValueOnce({
                json: () => Promise.resolve({ success: false })
            });

            await loginHandler(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: expect.stringContaining('Desafio anti-bot inválido')
            }));
        });
    });

    describe('Desafio Anti-Bot (Turnstile) na Recuperação de Senha', () => {
        test('deve rejeitar recuperação de senha se turnstile_token for inválido', async () => {
            mockReq.body = {
                email: 'someuser@test.com',
                turnstile_token: 'invalid-token'
            };

            global.fetch = jest.fn().mockResolvedValueOnce({
                json: () => Promise.resolve({ success: false })
            });

            await forgotHandler(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: expect.stringContaining('Desafio anti-bot inválido')
            }));
        });
    });

    describe('Defesa em camadas e Email Verification Enforcer', () => {
        test('verifyAuth deve bloquear acesso a usuários com e-mail não confirmado', async () => {
            const req = {
                headers: {
                    cookie: 'sb-access-token=token-usuario-nao-confirmado'
                }
            };
            const res = {
                setHeader: jest.fn()
            };

            mockUserClient.auth.getUser.mockResolvedValueOnce({
                data: {
                    user: {
                        id: 'unconfirmed-uuid-456',
                        email: 'unconfirmed@test.com',
                        email_confirmed_at: null,
                        confirmed_at: null
                    }
                },
                error: null
            });

            const result = await verifyAuth(req, res);

            expect(result.user).toBeNull();
            expect(result.error).toContain('confirme seu e-mail');
        });

        test('verifyAuth deve permitir acesso a usuários com e-mail confirmado', async () => {
            const req = {
                headers: {
                    cookie: 'sb-access-token=token-usuario-confirmado'
                }
            };
            const res = {
                setHeader: jest.fn()
            };

            mockUserClient.auth.getUser.mockResolvedValueOnce({
                data: {
                    user: {
                        id: 'confirmed-uuid-456',
                        email: 'confirmed@test.com',
                        email_confirmed_at: '2026-07-08T12:00:00Z',
                        confirmed_at: '2026-07-08T12:00:00Z'
                    }
                },
                error: null
            });

            const result = await verifyAuth(req, res);

            expect(result.user).not.toBeNull();
            expect(result.error).toBeNull();
        });
    });
});
