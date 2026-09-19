const { rateLimit, sendRateLimitResponse } = require('../lib/rate-limit');

describe('Testes Unitários — Rate Limiter', () => {
    
    test('deve permitir requisições abaixo do limite máximo', () => {
        const req = {
            headers: { 'x-forwarded-for': '1.2.3.4' },
            url: '/api/some-endpoint'
        };

        const res1 = rateLimit(req, { maxRequests: 3, windowMs: 10000 });
        expect(res1.allowed).toBe(true);
        expect(res1.remaining).toBe(2);

        const res2 = rateLimit(req, { maxRequests: 3, windowMs: 10000 });
        expect(res2.allowed).toBe(true);
        expect(res2.remaining).toBe(1);
    });

    test('deve bloquear requisições acima do limite máximo (Erro 429)', () => {
        const req = {
            headers: { 'x-forwarded-for': '9.8.7.6' },
            url: '/api/limited-endpoint'
        };

        const config = { maxRequests: 2, windowMs: 5000, key: 'custom-user-ip-key' };

        // Req 1 e 2: permitidas
        expect(rateLimit(req, config).allowed).toBe(true);
        expect(rateLimit(req, config).allowed).toBe(true);

        // Req 3: bloqueada
        const res3 = rateLimit(req, config);
        expect(res3.allowed).toBe(false);
        expect(res3.retryAfter).toBeGreaterThan(0);
    });

    test('deve retornar resposta estruturada JSON no sendRateLimitResponse', () => {
        const mockHeaders = {};
        const mockJson = jest.fn();
        const mockStatus = jest.fn().mockReturnValue({ json: mockJson });

        const res = {
            setHeader: (key, val) => { mockHeaders[key] = val; },
            status: mockStatus
        };

        sendRateLimitResponse(res, 30);

        expect(mockHeaders['Retry-After']).toBe(30);
        expect(mockStatus).toHaveBeenCalledWith(429);
        expect(mockJson).toHaveBeenCalledWith({
            error: 'Muitas requisições. Tente novamente em breve.',
            retryAfter: 30
        });
    });
});
