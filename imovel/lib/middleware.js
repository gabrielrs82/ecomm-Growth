// ============================================================
// Middleware de Observabilidade — Correlação, Performance e Sentry
// ============================================================

const { createLogger } = require('./logger');

// Inicialização opcional do Sentry
let Sentry = null;
if (process.env.SENTRY_DSN) {
    try {
        Sentry = require('@sentry/node');
        Sentry.init({
            dsn: process.env.SENTRY_DSN,
            environment: process.env.NODE_ENV || 'production'
        });
    } catch (e) {
        console.error('[SENTRY-INIT] Falha ao inicializar:', e.message);
    }
}

function withObservability(handler, actionName = 'API_ACTION') {
    return async (req, res) => {
        // ID de Correlação (Correlation ID)
        const crypto = require('crypto');
        const requestId = req.headers['x-request-id'] || crypto.randomUUID();
        res.setHeader('X-Request-ID', requestId);
        req.headers['x-request-id'] = requestId;

        // Criar logger básico
        const logger = createLogger(req);

        // Métricas de performance iniciais
        const startUsage = process.cpuUsage();
        const startTime = process.hrtime();
        const startMem = process.memoryUsage().heapUsed;

        logger.info(`Iniciando ação: ${actionName}`, { action: actionName });

        try {
            const result = await handler(req, res);

            // Métricas finais
            const diffTime = process.hrtime(startTime);
            const durationMs = (diffTime[0] * 1e3 + diffTime[1] * 1e-6).toFixed(2);
            const endMem = process.memoryUsage().heapUsed;
            const memDiff = endMem - startMem;
            const cpuUsage = process.cpuUsage(startUsage);

            logger.info(`Concluído: ${actionName}`, {
                action: actionName,
                duration_ms: parseFloat(durationMs),
                memory_diff_bytes: memDiff,
                cpu_user_time_ms: cpuUsage.user / 1000,
                cpu_system_time_ms: cpuUsage.system / 1000
            });

            return result;
        } catch (err) {
            const diffTime = process.hrtime(startTime);
            const durationMs = (diffTime[0] * 1e3 + diffTime[1] * 1e-6).toFixed(2);

            logger.error(`Falha na ação: ${actionName}`, {
                action: actionName,
                duration_ms: parseFloat(durationMs)
            }, err);

            // Enviar exceção ao Sentry se ativo
            if (Sentry) {
                Sentry.withScope((scope) => {
                    scope.setTag("action", actionName);
                    scope.setExtra("request_id", requestId);
                    Sentry.captureException(err);
                });
            }

            // Garante resposta padrão segura e evita vazamentos
            if (!res.writableEnded) {
                res.status(500).json({ error: 'Erro interno do servidor.' });
            }
        }
    };
}

module.exports = { withObservability };
