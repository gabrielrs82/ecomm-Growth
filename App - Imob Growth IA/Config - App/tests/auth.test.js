const registerHandler = require('../api/auth/register');

// Mock das dependências externas
jest.mock('../lib/supabase', () => {
    return {
        supabaseAdmin: {
            auth: {
                admin: {
                    createUser: jest.fn(),
                    generateLink: jest.fn()
                },
                signInWithPassword: jest.fn()
            },
            from: jest.fn().mockReturnThis(),
            insert: jest.fn()
        }
    };
});

jest.mock('../lib/rate-limit', () => ({
    rateLimit: jest.fn(() => ({ allowed: true, retryAfter: 0 })),
    sendRateLimitResponse: jest.fn()
}));

const mockSendEmail = jest.fn();
jest.mock('../lib/email', () => ({
    sendEmail: (args) => mockSendEmail(args),
    getWelcomeTemplate: (name, url) => `Bem-vindo ${name} ${url}`
}));

const { supabaseAdmin } = require('../lib/supabase');

describe('Testes de Integração (Mocked) — Registro de Usuário e Consentimento', () => {
    let mockReq;
    let mockRes;
    let headers = {};

    beforeEach(() => {
        jest.clearAllMocks();
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

    test('deve rejeitar se os Termos de Uso não forem aceitos (LGPD)', async () => {
        mockReq.body = {
            email: 'test@imobgrowth.com',
            password: 'secret_password_123',
            full_name: 'Gabriel Santana',
            accepted_terms: false
        };

        await registerHandler(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
            error: 'Você precisa aceitar os Termos de Uso e a Política de Privacidade.'
        });
    });

    test('deve rejeitar se o e-mail for inválido', async () => {
        mockReq.body = {
            email: 'invalid-email',
            password: 'secret_password_123',
            full_name: 'Gabriel Santana',
            accepted_terms: true
        };

        await registerHandler(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Email inválido' });
    });

    test('deve registrar usuário com sucesso no caminho feliz', async () => {
        mockReq.body = {
            email: 'newuser@imobgrowth.com',
            password: 'secure_password_123',
            full_name: 'Novo Usuario',
            phone: '11999999999',
            accepted_terms: true
        };

        // Mock do Supabase createUser bem sucedido
        supabaseAdmin.auth.admin.createUser.mockResolvedValueOnce({
            data: { user: { id: 'mocked-uuid-1234', email: 'newuser@imobgrowth.com' } },
            error: null
        });

        // Mock do insert na tabela profiles bem sucedido
        supabaseAdmin.insert.mockResolvedValueOnce({ error: null });

        // Mock do generateLink bem sucedido
        supabaseAdmin.auth.admin.generateLink.mockResolvedValueOnce({
            data: { properties: { action_link: 'https://ecommgrowth.online/verify-email-link' } },
            error: null
        });

        await registerHandler(mockReq, mockRes);

        expect(supabaseAdmin.auth.admin.createUser).toHaveBeenCalledWith(
            expect.objectContaining({
                email: 'newuser@imobgrowth.com',
                email_confirm: false
            })
        );
        expect(supabaseAdmin.auth.admin.generateLink).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'signup',
                email: 'newuser@imobgrowth.com'
            })
        );
        expect(supabaseAdmin.insert).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'mocked-uuid-1234',
                full_name: 'Novo Usuario',
                accepted_terms_version: 'v1.0'
            })
        );
        expect(mockRes.status).toHaveBeenCalledWith(201);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                message: expect.stringContaining('confirmação')
            })
        );
        expect(headers['Set-Cookie']).toBeUndefined();
        expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({
            to: 'newuser@imobgrowth.com',
            subject: 'Ative sua conta no Imob Growth AI!',
            html: expect.stringContaining('https://ecommgrowth.online/verify-email-link')
        }));
    });

    test('deve responder com 201 sucesso (prevenção de enumeração) se o e-mail já estiver cadastrado', async () => {
        mockReq.body = {
            email: 'existing@imobgrowth.com',
            password: 'secure_password_123',
            full_name: 'Nome Sobrenome',
            accepted_terms: true
        };

        supabaseAdmin.auth.admin.createUser.mockResolvedValueOnce({
            data: { user: null },
            error: { message: 'email is already registered' }
        });

        await registerHandler(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(201);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            message: expect.stringContaining('confirmação')
        }));
    });
});
