const { sanitizeString, sanitizePrompt, sanitizeEmail, isAllowedMimeType, validateCSRF } = require('../lib/sanitize');

describe('Testes Unitários — Sanitização e Validação', () => {
    
    describe('sanitizeString', () => {
        test('deve remover tags HTML simples', () => {
            const bad = "Olá <script>alert(1)</script> <b>Mundo</b>";
            expect(sanitizeString(bad)).toBe("Olá alert(1) Mundo");
        });

        test('deve truncar strings acima do limite configurado', () => {
            const longString = "a".repeat(200);
            expect(sanitizeString(longString, 50).length).toBe(50);
        });

        test('deve retornar string vazia para tipos inválidos', () => {
            expect(sanitizeString(null)).toBe('');
            expect(sanitizeString(undefined)).toBe('');
            expect(sanitizeString(1234)).toBe('');
        });

        test('deve remover scripts javascript inline', () => {
            const inline = "javascript:alert(123)";
            expect(sanitizeString(inline)).toBe("alert(123)");
        });
    });

    describe('sanitizePrompt', () => {
        test('deve higienizar scripts mantendo prompts longos', () => {
            const prompt = "Gere uma imagem de casa moderna <script>evil()</script> no pôr do sol";
            expect(sanitizePrompt(prompt)).toBe("Gere uma imagem de casa moderna  no pôr do sol");
        });
    });

    describe('sanitizeEmail', () => {
        test('deve aceitar emails válidos e formatar para minúsculo', () => {
            const res = sanitizeEmail(" GABRIEL@ImobGrowth.com.br ");
            expect(res.valid).toBe(true);
            expect(res.email).toBe("gabriel@imobgrowth.com.br");
        });

        test('deve rejeitar emails inválidos estruturalmente', () => {
            expect(sanitizeEmail("invalid-email").valid).toBe(false);
            expect(sanitizeEmail("invalid@").valid).toBe(false);
            expect(sanitizeEmail("@invalid.com").valid).toBe(false);
        });
    });

    describe('isAllowedMimeType', () => {
        test('deve aceitar tipos de imagens padrão', () => {
            expect(isAllowedMimeType('image/png')).toBe(true);
            expect(isAllowedMimeType('image/jpeg')).toBe(true);
            expect(isAllowedMimeType('image/webp')).toBe(true);
        });

        test('deve recusar tipos perigosos ou não autorizados', () => {
            expect(isAllowedMimeType('application/x-sh')).toBe(false);
            expect(isAllowedMimeType('text/html')).toBe(false);
        });
    });

    describe('validateCSRF', () => {
        test('deve permitir requisições locais (localhost)', () => {
            const req = {
                method: 'POST',
                headers: {
                    host: 'localhost:3000',
                    origin: 'http://localhost:3000'
                }
            };
            const res = {};
            expect(validateCSRF(req, res)).toBe(true);
        });
    });
});
