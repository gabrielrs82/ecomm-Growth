const { verifyAuth } = require('../lib/supabase');
const { setCorsHeaders, validateCSRF } = require('../lib/sanitize');
const { rateLimit, sendRateLimitResponse } = require('../lib/rate-limit');
const { withObservability } = require('../lib/middleware');
const { validateUrlForSafeFetch } = require('../lib/security');

module.exports = withObservability(async function handler(req, res) {
    setCorsHeaders(res, req.headers.origin);
    if (req.method === 'OPTIONS') return res.status(200).end();

    // CSRF Protection
    if (!validateCSRF(req, res)) return;

    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    try {
        // Verificar autenticação (com bypass para desenvolvimento local)
        const isLocalDev = req.headers.host && (req.headers.host.includes('localhost') || req.headers.host.includes('127.0.0.1'));
        const { user, error } = await verifyAuth(req, res);
        if (error && !isLocalDev) {
            return res.status(401).json({ error });
        }

        // Rate limit: 20 requisições/hora por usuário ou IP
        const rateKey = user ? `remove-bg:${user.id}` : null;
        const { allowed, retryAfter } = rateLimit(req, { maxRequests: 20, windowMs: 3600000, key: rateKey });
        if (!allowed && !isLocalDev) {
            return sendRateLimitResponse(res, retryAfter);
        }

        const { image_data } = req.body || {};
        if (!image_data) {
            return res.status(400).json({ error: 'Nenhuma imagem fornecida para remover o fundo.' });
        }

        // Validação de formato Base64 e Magic Bytes no Servidor
        if (image_data.startsWith('data:image/svg+xml')) {
            // SVGs são permitidos e tratados como texto
        } else {
            const base64Pattern = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i;
            const matches = image_data.match(base64Pattern);
            if (!matches) {
                return res.status(400).json({ error: 'Formato de imagem inválido. Deve ser PNG, JPG, JPEG ou WEBP em Base64.' });
            }

            const format = matches[1].toLowerCase();
            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, 'base64');
            
            let isValid = false;
            if (format === 'png' && buffer.length >= 4) {
                isValid = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
            } else if ((format === 'jpg' || format === 'jpeg') && buffer.length >= 3) {
                isValid = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
            } else if (format === 'webp' && buffer.length >= 12) {
                const isRiff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
                const isWebp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
                isValid = isRiff && isWebp;
            }

            if (!isValid) {
                return res.status(400).json({ error: 'Assinatura binária do arquivo (magic bytes) inválida para a extensão declarada.' });
            }
        }

        const FAL_KEY = process.env.FAL_KEY;
        if (!FAL_KEY) {
            console.log('[BG-REMOVE] FAL_KEY não configurada. Retornando fallback de logo transparente simulado...');
            // Retorna um SVG estilizado transparente simulando o resultado da remoção de fundo
            const mockLogo = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="50" viewBox="0 0 160 50"><text x="10" y="32" font-family="'Space Grotesk', sans-serif" font-size="20" font-weight="800" fill="%23c8da42">IMOB</text><text x="70" y="32" font-family="'Space Grotesk', sans-serif" font-size="20" font-weight="300" fill="%23ffffff">GROWTH</text><circle cx="150" cy="25" r="4" fill="%23c8da42"/></svg>`;
            return res.status(200).json({ image_data: mockLogo, simulated: true });
        }

        const falEndpoint = 'https://fal.run/fal-ai/bria/background/remove';
        console.log('[BG-REMOVE] Enviando imagem para o Fal.ai...');

        const falResponse = await fetch(falEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${FAL_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image_url: image_data
            })
        });

        if (!falResponse.ok) {
            const errText = await falResponse.text();
            console.error('[BG-REMOVE] Fal.ai erro:', errText);
            return res.status(502).json({ error: 'Erro ao remover fundo via IA: ' + errText });
        }

        const result = await falResponse.json();
        const transparentImageUrl = result.image?.url;

        if (!transparentImageUrl) {
            return res.status(502).json({ error: 'FAL.ai não retornou URL da imagem processada.' });
        }

        console.log('[BG-REMOVE] Sucesso no Fal.ai. Baixando imagem transparente...');

        // Baixar a imagem transparente e converter para Base64 após validação de SSRF
        try {
            await validateUrlForSafeFetch(transparentImageUrl, ['fal.run', 'fal.media', 'fal.ai']);
        } catch (urlErr) {
            console.error('[BG-REMOVE] Bloqueio SSRF detectado para a URL:', transparentImageUrl, urlErr.message);
            return res.status(400).json({ error: 'URL da imagem gerada foi bloqueada por motivos de segurança.' });
        }

        const imgResponse = await fetch(transparentImageUrl);
        if (!imgResponse.ok) {
            return res.status(502).json({ error: 'Erro ao baixar imagem transparente gerada pela IA.' });
        }

        const arrayBuffer = await imgResponse.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const mimeType = imgResponse.headers.get('content-type') || 'image/png';
        const dataUrl = `data:${mimeType};base64,${base64}`;

        console.log('[BG-REMOVE] Conversão para Base64 concluída.');
        return res.status(200).json({ image_data: dataUrl });

    } catch (err) {
        console.error('[BG-REMOVE] Erro interno:', err);
        return res.status(500).json({ error: 'Erro interno ao processar imagem.' });
    }
}, 'IMAGE_REMOVE_BG');
