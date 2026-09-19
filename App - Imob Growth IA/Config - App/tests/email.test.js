// Mock do Resend SDK antes de carregar o módulo
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

// Força chave no environment para habilitar a execução real do SDK mockado nos testes
process.env.RESEND_API_KEY = 're_test_key_1234';

const { sendWithRetry, getWelcomeTemplate, getPasswordRecoveryTemplate, getSystemAlertTemplate } = require('../lib/email');

describe('Testes Unitários — Módulo de E-mails Transacionais (Resend)', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Templates HTML', () => {
        test('deve renderizar o template de boas-vindas com o nome correto', () => {
            const html = getWelcomeTemplate('Gabriel Santana');
            expect(html).toContain('Gabriel Santana');
            expect(html).toContain('Bem-vindo');
            expect(html).toContain('créditos');
        });

        test('deve renderizar o template de recuperação com o link correto', () => {
            const html = getPasswordRecoveryTemplate('Gabriel', 'https://imobgrowth.com.br/reset?token=123');
            expect(html).toContain('Gabriel');
            expect(html).toContain('https://imobgrowth.com.br/reset?token=123');
        });

        test('deve renderizar o template de alertas do sistema', () => {
            const html = getSystemAlertTemplate('Uso de CPU Elevado', 'A máquina de produção atingiu 90% de consumo.');
            expect(html).toContain('Uso de CPU Elevado');
            expect(html).toContain('90%');
        });
    });

    describe('sendWithRetry (Lógica de Retentativas)', () => {
        test('deve retornar id do email no primeiro envio com sucesso', async () => {
            mockSend.mockResolvedValueOnce({
                data: { id: 'email_success_1' },
                error: null
            });

            const payload = { to: ['user@test.com'], subject: 'Oi', html: '<p>Teste</p>' };
            const res = await sendWithRetry(payload, 3, 10);

            expect(mockSend).toHaveBeenCalledTimes(1);
            expect(res.success).toBe(true);
            expect(res.id).toBe('email_success_1');
        });

        test('deve realizar retentativas e ter sucesso na segunda tentativa', async () => {
            // Falha na primeira, sucesso na segunda
            mockSend
                .mockRejectedValueOnce(new Error('Erro de conexão temporário'))
                .mockResolvedValueOnce({
                    data: { id: 'email_success_2' },
                    error: null
                });

            const payload = { to: ['user@test.com'], subject: 'Oi', html: '<p>Teste</p>' };
            const res = await sendWithRetry(payload, 2, 5); // 2 retentativas, 5ms delay

            expect(mockSend).toHaveBeenCalledTimes(2);
            expect(res.success).toBe(true);
            expect(res.id).toBe('email_success_2');
        });

        test('deve esgotar as retentativas e disparar erro após falhas sucessivas', async () => {
            mockSend.mockRejectedValue(new Error('API Resend Indisponível (500)'));

            const payload = { to: ['user@test.com'], subject: 'Oi', html: '<p>Teste</p>' };

            await expect(sendWithRetry(payload, 2, 5)).rejects.toThrow('API Resend Indisponível (500)');
            expect(mockSend).toHaveBeenCalledTimes(3); // 1 inicial + 2 retentativas
        });
    });
});
