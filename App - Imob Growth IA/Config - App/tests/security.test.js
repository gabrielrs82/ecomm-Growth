// Mock do Resend SDK
const mockSend = jest.fn();
jest.mock('resend', () => {
    return {
        Resend: jest.fn().mockImplementation(() => {
            return {
                emails: {
                    send: mockSend
                }
            };
        })
    };
});

// Mock do email service
const mockSendEmail = jest.fn();
jest.mock('../lib/email', () => ({
    sendEmail: (args) => mockSendEmail(args),
    getPasswordRecoveryTemplate: (name, url) => `Recovery ${name} ${url}`,
    getWelcomeTemplate: (name, url) => `Welcome ${name} ${url}`
}));

// Chained Query Builder Mock para Supabase
const mockQueryBuilder = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
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
            auth: {
                admin: {
                    createUser: jest.fn(),
                    listUsers: jest.fn(),
                    updateUserById: jest.fn(),
                    signOut: jest.fn(),
                    generateLink: jest.fn()
                }
            },
            from: (table) => {
                return mockQueryBuilder;
            }
        }
    };
});

// Mock do rate limit
jest.mock('../lib/rate-limit', () => ({
    rateLimit: jest.fn(() => ({ allowed: true, retryAfter: 0 })),
    sendRateLimitResponse: jest.fn((res, retryAfter) => {
        return res.status(429).json({ error: 'Muitas requisições. Tente novamente em breve.', retryAfter });
    })
}));

const { supabaseAdmin } = require('../lib/supabase');
const registerHandler = require('../api/auth/register');
const loginHandler = require('../api/auth/login');
const forgotPasswordHandler = require('../api/auth/forgot-password');
const resetPasswordHandler = require('../api/auth/reset-password');
const { rateLimit } = require('../lib/rate-limit');

describe('Auditoria de Segurança — Autenticação e Redefinição', () => {
    let mockReq;
    let mockRes;
    let headers = {};

    beforeEach(() => {
        jest.clearAllMocks();
        supabaseAdmin.auth.admin.listUsers.mockReset();
        supabaseAdmin.auth.admin.updateUserById.mockReset();
        supabaseAdmin.auth.admin.signOut.mockReset();
        supabaseAdmin.auth.admin.createUser.mockReset();
        mockQueryBuilder._data = null;
        mockQueryBuilder._error = null;
        headers = {};
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

    describe('Enumeração de Usuários & Timing Attacks', () => {
        test('Registro: deve responder exatamente o mesmo 201 sucesso se o email já estiver cadastrado', async () => {
            mockReq.body = {
                email: 'exists@test.com',
                password: 'secure_password',
                full_name: 'Usuario Teste',
                accepted_terms: true
            };

            // Simula erro de email já existente no Supabase
            supabaseAdmin.auth.admin.createUser.mockResolvedValueOnce({
                data: {},
                error: { message: 'email is already registered' }
            });

            const start = Date.now();
            await registerHandler(mockReq, mockRes);
            const duration = Date.now() - start;

            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                message: expect.stringContaining('confirmação')
            }));
            // Verifica que o tempo de resposta mínimo (Timing delay) de 600ms foi respeitado
            expect(duration).toBeGreaterThanOrEqual(580); 
        });

        test('Login: deve respeitar tempo de resposta mínimo sob falha nas credenciais', async () => {
            mockReq.body = {
                email: 'nonexistent@test.com',
                password: 'wrong_password'
            };

            // Simula erro de login (credenciais inválidas) no Supabase
            supabaseAdmin.auth.signInWithPassword = jest.fn().mockResolvedValueOnce({
                data: {},
                error: { message: 'Invalid login credentials' }
            });

            const start = Date.now();
            await loginHandler(mockReq, mockRes);
            const duration = Date.now() - start;

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Credenciais inválidas' });
            expect(duration).toBeGreaterThanOrEqual(580);
        });

        test('Forgot Password: deve retornar a mesma resposta e demorar o mesmo tempo caso usuário não exista', async () => {
            mockReq.body = { email: 'nonexistent@test.com' };

            // Retorna lista vazia de usuários no sistema
            supabaseAdmin.auth.admin.listUsers.mockResolvedValueOnce({
                data: { users: [] },
                error: null
            });

            const start = Date.now();
            await forgotPasswordHandler(mockReq, mockRes);
            const duration = Date.now() - start;

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                message: expect.stringContaining('Se este e-mail estiver cadastrado')
            }));
            expect(duration).toBeGreaterThanOrEqual(580);
            expect(mockSendEmail).not.toHaveBeenCalled();
        });
    });

    describe('Redefinição de Senha (Fluxo Forgot & Reset)', () => {
        test('Forgot: deve criar token com sucesso no banco e disparar e-mail se o usuário existir', async () => {
            mockReq.body = { email: 'registered@test.com' };

            // Mock de usuário encontrado
            supabaseAdmin.auth.admin.listUsers.mockResolvedValueOnce({
                data: {
                    users: [{
                        id: 'user-uuid-1',
                        email: 'registered@test.com',
                        user_metadata: { full_name: 'Usuário Real' }
                    }]
                },
                error: null
            });

            await forgotPasswordHandler(mockReq, mockRes);

            expect(mockQueryBuilder.update).toHaveBeenCalled(); // Invalidação de tokens anteriores
            expect(mockQueryBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
                email: 'registered@test.com',
                token: expect.any(String),
                expires_at: expect.any(String),
                used: false
            }));
            expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({
                to: 'registered@test.com',
                subject: expect.stringContaining('Recuperação de Senha')
            }));
            expect(mockRes.status).toHaveBeenCalledWith(200);
        });

        test('Reset: deve aceitar token válido, atualizar senha, marcar token como usado e invalidar sessões globalmente', async () => {
            mockReq.body = {
                token: 'mock-valid-token-32bytes-long-string-123',
                password: 'new_secure_password_123'
            };

            // Mock do token encontrado, ativo e não utilizado
            mockQueryBuilder._data = {
                email: 'registered@test.com',
                id: 'token-uuid-1',
                used: false,
                expires_at: new Date(Date.now() + 100000).toISOString()
            };

            // Mock de usuários para mapear o id
            supabaseAdmin.auth.admin.listUsers.mockResolvedValueOnce({
                data: {
                    users: [{
                        id: 'user-uuid-1234',
                        email: 'registered@test.com'
                    }]
                },
                error: null
            });

            // Mocks do update de senha e logout global
            supabaseAdmin.auth.admin.updateUserById.mockResolvedValueOnce({ data: {}, error: null });
            supabaseAdmin.auth.admin.signOut.mockResolvedValueOnce({ error: null });

            await resetPasswordHandler(mockReq, mockRes);

            expect(supabaseAdmin.auth.admin.updateUserById).toHaveBeenCalledWith(
                'user-uuid-1234',
                expect.objectContaining({ password: 'new_secure_password_123' })
            );
            expect(mockQueryBuilder.update).toHaveBeenCalled(); // Marcar token como utilizado
            expect(supabaseAdmin.auth.admin.signOut).toHaveBeenCalledWith('user-uuid-1234', 'global'); // Invalidação das sessões
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                message: expect.stringContaining('sessões anteriores foram desconectadas')
            }));
        });
    });

    describe('Rate Limiting', () => {
        test('deve bloquear requisições caso o Rate Limiter negue o acesso (forgot-password)', async () => {
            mockReq.body = { email: 'registered@test.com' };

            // Mock do Rate Limit bloqueando a rota
            rateLimit.mockReturnValueOnce({ allowed: false, retryAfter: 45 });

            await forgotPasswordHandler(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(429);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: expect.stringContaining('Muitas requisições')
            }));
        });
    });
});
