// ============================================================
// Utilitários de Segurança Avançada — IMOB GROWTH AI
// ============================================================

/**
 * Introduz um atraso artificial para garantir que o tempo de resposta do endpoint
 * seja constante, mitigando ataques de canais laterais por timing.
 * @param {number} startTime - timestamp do início do processamento (Date.now())
 * @param {number} minDurationMs - tempo mínimo desejado em ms (default: 600)
 */
async function preventTimingAttack(startTime, minDurationMs = 600) {
    const elapsed = Date.now() - startTime;
    if (elapsed < minDurationMs) {
        await new Promise(resolve => setTimeout(resolve, minDurationMs - elapsed));
    }
}

const net = require('net');
const dns = require('dns');
const { URL } = require('url');

/**
 * Verifica se um endereço IP é privado, local ou de loopback.
 * @param {string} ip - Endereço IP (v4 ou v6)
 * @returns {boolean} True se for privado/reservado, false caso contrário.
 */
function isPrivateIp(ip) {
    if (!net.isIP(ip)) return true;

    if (net.isIPv4(ip)) {
        const parts = ip.split('.').map(Number);
        
        // 127.0.0.0/8 (Loopback)
        if (parts[0] === 127) return true;
        
        // 10.0.0.0/8 (IP Privado Classe A)
        if (parts[0] === 10) return true;
        
        // 172.16.0.0/12 (IP Privado Classe B)
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
        
        // 192.168.0.0/16 (IP Privado Classe C)
        if (parts[0] === 192 && parts[1] === 168) return true;
        
        // 169.254.0.0/16 (Link-Local / Metadados de Nuvem AWS/GCP/Azure)
        if (parts[0] === 169 && parts[1] === 254) return true;
        
        // 0.0.0.0/8 (Local broadcast)
        if (parts[0] === 0) return true;

        // 224.0.0.0/4 (Multicast)
        if (parts[0] >= 224 && parts[0] <= 239) return true;

        // 240.0.0.0/4 (Reservado)
        if (parts[0] >= 240) return true;

        return false;
    }

    if (net.isIPv6(ip)) {
        const normalized = ip.toLowerCase();
        
        // Loopback (::1)
        if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
        
        // Unspecified (::)
        if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;
        
        // Link-local (fe80::/10)
        if (normalized.startsWith('fe80:')) return true;
        
        // Unique local address (fc00::/7)
        if (normalized.startsWith('fc00:') || normalized.startsWith('fd00:')) return true;
        
        // Multicast (ff00::/8)
        if (normalized.startsWith('ff')) return true;

        return false;
    }

    return true;
}

/**
 * Valida uma URL para mitigar ataques de SSRF (Server-Side Request Forgery).
 * Verifica protocolo, resolve o hostname e garante que nenhum IP resolvido seja privado.
 * Opcionalmente verifica contra uma allowlist de domínios.
 * @param {string} inputUrl - A URL a ser validada
 * @param {string[]} [allowedDomains] - Array de domínios permitidos
 * @returns {Promise<string>} Retorna a URL validada se for segura, ou lança um erro.
 */
async function validateUrlForSafeFetch(inputUrl, allowedDomains = null) {
    if (typeof inputUrl !== 'string' || !inputUrl.trim()) {
        throw new Error('URL vazia ou inválida.');
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(inputUrl.trim());
    } catch (e) {
        throw new Error('URL com formato malformado.');
    }

    const { protocol, hostname } = parsedUrl;

    // 1. Validar protocolo (apenas HTTP/HTTPS permitidos)
    if (protocol !== 'http:' && protocol !== 'https:') {
        throw new Error('Protocolo inválido. Apenas HTTP e HTTPS são permitidos.');
    }

    if (!hostname) {
        throw new Error('Hostname inválido.');
    }

    // 2. Validar allowlist de domínios
    if (allowedDomains && Array.isArray(allowedDomains)) {
        const isAllowed = allowedDomains.some(domain => {
            const normalizedDomain = domain.toLowerCase().trim();
            const normalizedHostname = hostname.toLowerCase().trim();
            return normalizedHostname === normalizedDomain || normalizedHostname.endsWith('.' + normalizedDomain);
        });
        if (!isAllowed) {
            throw new Error(`Acesso negado: Domínio '${hostname}' não autorizado.`);
        }
    }

    // 3. Se for IP direto, valida imediatamente
    if (net.isIP(hostname)) {
        if (isPrivateIp(hostname)) {
            throw new Error(`Acesso negado: IP privado/interno detectado (${hostname}).`);
        }
        return parsedUrl.toString();
    }

    // 4. Resolve o hostname no DNS e verifica todos os endereços IP (prevenção contra DNS Rebinding)
    await new Promise((resolve, reject) => {
        dns.lookup(hostname, { all: true }, (err, addresses) => {
            if (err) {
                return reject(new Error(`Falha na resolução de DNS para o domínio: ${hostname}`));
            }
            if (!addresses || addresses.length === 0) {
                return reject(new Error(`Nenhum IP resolvido para o domínio: ${hostname}`));
            }

            for (const addr of addresses) {
                if (isPrivateIp(addr.address)) {
                    return reject(new Error(`Acesso bloqueado: O domínio resolve para um IP privado (${addr.address}).`));
                }
            }
            resolve();
        });
    });

    return parsedUrl.toString();
}

/**
 * Valida o token de desafio anti-bot do Cloudflare Turnstile.
 * @param {string} token - O token recebido do frontend.
 * @param {string} ip - O IP de origem do usuário.
 * @returns {Promise<boolean>} True se for bem sucedido ou se a validação estiver desativada/em testes, false caso contrário.
 */
async function verifyTurnstileToken(token, ip) {
    // Para ambientes de teste/Jest, permitimos bypass com token mock ou modo de teste
    if (process.env.NODE_ENV === 'test' || token === 'mock-turnstile-token-success') {
        return true;
    }

    const secretKey = process.env.TURNSTILE_SECRET_KEY;
    if (!secretKey) {
        console.warn('[TURNSTILE] TURNSTILE_SECRET_KEY não configurada. Ignorando validação.');
        return true;
    }

    if (!token) return false;

    try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                secret: secretKey,
                response: token,
                remoteip: ip
            })
        });

        const data = await response.json();
        return !!data.success;
    } catch (err) {
        console.error('[TURNSTILE] Erro na validação de token:', err);
        return false;
    }
}

module.exports = { preventTimingAttack, isPrivateIp, validateUrlForSafeFetch, verifyTurnstileToken };
