// ============================================================
// POST /api/generate-image — Proxy seguro para FAL.ai (Flux Dev)
// ============================================================
// Fase 3: Este endpoint será ativado quando a conta FAL.ai estiver pronta.
// Até lá, retorna um placeholder indicando que a funcionalidade está em desenvolvimento.
// ============================================================

const { verifyAuth, supabaseAdmin, getSupabaseClient } = require('../lib/supabase');
const { sanitizePrompt, setCorsHeaders, validateCSRF } = require('../lib/sanitize');
const { rateLimit, sendRateLimitResponse } = require('../lib/rate-limit');
const https = require('https');

function safeHttpsPost(url, headers, body) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: headers
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    text: () => Promise.resolve(data),
                    json: () => {
                        try {
                            return Promise.resolve(JSON.parse(data));
                        } catch (e) {
                            return Promise.reject(new Error("Invalid JSON: " + data));
                        }
                    }
                });
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.write(JSON.stringify(body));
        req.end();
    });
}

module.exports = async function handler(req, res) {
    setCorsHeaders(res, req.headers.origin);
    if (req.method === 'OPTIONS') return res.status(200).end();

    // CSRF Protection
    if (!validateCSRF(req, res)) return;

    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    try {
        // Rate limit: 20 gerações/hora por IP
        const { allowed, retryAfter } = rateLimit(req, { maxRequests: 20, windowMs: 3600000 });
        if (!allowed) return sendRateLimitResponse(res, retryAfter);

        // Verificar autenticação
        const { user, error, token } = await verifyAuth(req, res);
        if (error) return res.status(401).json({ error });

        const { prompt, style, format, category, template_prompt, custom_fields, headline, text, location, desc, color, use_brand_kit, brand_colors, brand_fonts, image_data, is_adjustment } = req.body || {};

        // Sanitizar prompt (pode ser vazio agora)
        const cleanPrompt = sanitizePrompt(prompt || "");

        // Criar userClient para operações no banco (respeita RLS e funciona sem Service Key)
        const userClient = getSupabaseClient(token);

        // Verificar e descontar créditos atomicamente (reserva)
        const isDemoUser = user?.email?.toLowerCase() === 'gabrielrsantana21@gmail.com' || user?.email?.toLowerCase() === 'demo@imobgrowth.com.br';
        let remainingCredits = 999;
        let hasDecremented = false;

        const refundCredits = async () => {
            if (!isDemoUser) {
                await userClient.rpc('increment_credit', {
                    p_user_id: user.id,
                    p_credit_type: 'credits_images'
                }).catch(e => console.error('Falha ao reembolsar créditos:', e));
            }
        };
        
        if (!isDemoUser) {
            const { data: remaining, error: decError } = await userClient.rpc('decrement_credit', {
                p_user_id: user.id,
                p_credit_type: 'credits_images'
            });

            if (decError) {
                // Fallback se o RPC não existir
                if (decError.code === '42883' || decError.message?.includes('does not exist')) {
                    const { data: profile } = await userClient
                        .from('profiles')
                        .select('credits_images')
                        .eq('id', user.id)
                        .single();

                    if (!profile || profile.credits_images <= 0) {
                        return res.status(403).json({
                            error: `Créditos de imagem insuficientes (Email detectado: ${user?.email || 'Nenhum'})`,
                            remaining: 0
                        });
                    }

                    const { data: updatedProfile, error: fallbackErr } = await userClient
                        .from('profiles')
                        .update({ credits_images: profile.credits_images - 1 })
                        .eq('id', user.id)
                        .gt('credits_images', 0)
                        .select('credits_images')
                        .maybeSingle();

                    if (fallbackErr || !updatedProfile) {
                        return res.status(403).json({
                            error: `Créditos de imagem insuficientes (Email detectado: ${user?.email || 'Nenhum'})`,
                            remaining: 0
                        });
                    }
                    remainingCredits = updatedProfile.credits_images;
                    hasDecremented = true;
                } else {
                    return res.status(403).json({
                        error: `Créditos de imagem insuficientes (Email detectado: ${user?.email || 'Nenhum'})`,
                        remaining: 0
                    });
                }
            } else {
                remainingCredits = remaining;
                hasDecremented = true;
            }
        }

        // ===== FAL.ai API CALL =====
        const FAL_KEY = process.env.FAL_KEY;
        if (!FAL_KEY) {
            return res.status(503).json({
                error: 'Geração de imagens com IA estará disponível em breve!',
                status: 'coming_soon'
            });
        }

        // Determinar dimensões pelo formato
        const isPlanta = style === 'planta-mcmv' || style === 'lar-feliz';
        let width = 1080, height = 1080;
        if (format === 'story') { width = 1080; height = 1920; }
        else if (format === 'carrossel') { width = 1080; height = 566; }
        else if (format === 'portrait') { width = 1080; height = 1350; }
        else if (isPlanta) { width = 1080; height = 1350; }

        // Não usamos mais INSPIRACOES visuais para a IA. 
        // As imagens do template são apenas ilustrativas para o usuário no frontend.

        let baseText = template_prompt || "Por favor, crie uma arte baseada nas instruções adicionais e na paleta de cores fornecida.";
        
        // Injetar variáveis dinâmicas (se houver)
        if (custom_fields && Object.keys(custom_fields).length > 0) {
            for (const [key, value] of Object.entries(custom_fields)) {
                const safeVal = value ? value.toString().trim() : '';
                if (!safeVal) {
                    // Se o usuário deixou vazio, remove a linha toda do prompt para a IA não gerar lixo
                    const regexLine = new RegExp(`.*\\{\\{?${key}\\}\\}?.*\\n?`, 'g');
                    baseText = baseText.replace(regexLine, '');
                } else {
                    // Suporta tanto {key} quanto {{key}}
                    const regex = new RegExp(`\\{\\{?${key}\\}\\}?`, 'g');
                    baseText = baseText.replace(regex, safeVal);
                }
            }
        }

        // Injetar variáveis antigas (fallback)
        baseText = baseText.replace('{{HEADLINE}}', custom_fields?.headline || headline || 'Imóvel Exclusivo');
        baseText = baseText.replace('{{TITULO}}', custom_fields?.text || text || 'Lançamento Imperdível');
        baseText = baseText.replace('{{LOCALIZACAO}}', custom_fields?.location || location || '');
        baseText = baseText.replace('{{DESCRICAO}}', custom_fields?.desc || desc || 'Consulte condições de pagamento.');
        baseText = baseText.replace('{{CTA}}', custom_fields?.cta || 'AGENDE SUA VISITA');
        baseText = baseText.replace('{{COR_PRIMARIA}}', color || '#c8da42');
        baseText = baseText.replace('{{COR_SECUNDARIA}}', '#ffffff');

        // Adiciona regra estrita sobre as imagens de inspiração para evitar alucinações arquitetônicas
        baseText += `\n\nATENÇÃO MÁXIMA: Algumas imagens adicionais foram enviadas junto com a foto principal. Use essas imagens adicionais EXCLUSIVAMENTE como inspiração para o ESTILO DAS FONTES e o LOCAL DA ESCRITA. NUNCA copie a arquitetura, os móveis, as paredes ou as cores dessas imagens adicionais para a foto principal. A foto do imóvel é sagrada.`;

        // Reforço brutal para a cor / Brand Kit
        let brandRule = `\n\nREGRA DE IDENTIDADE VISUAL:\n`;
        
        if (use_brand_kit && brand_colors) {
            brandRule += `- CORES OBRIGATÓRIAS: Utilize EXCLUSIVAMENTE a seguinte paleta para textos, botões e elementos de destaque: ${brand_colors}.\n`;
        } else if (!use_brand_kit && color) {
            brandRule += `- COR OBRIGATÓRIA: Utilize EXCLUSIVAMENTE a cor HEX ${color} para os textos e botões principais. Não ignore esta cor!\n`;
        } else {
            brandRule += `- CORES: Livre (em vazio). O usuário não definiu cores. Você tem total liberdade criativa para escolher as melhores cores que combinem perfeitamente com a foto e a estética.\n`;
        }

        if (use_brand_kit && brand_fonts) {
            brandRule += `- FONTES OBRIGATÓRIAS: Utilize rigorosamente a tipografia: ${brand_fonts}.\n`;
        } else {
            brandRule += `- FONTES: Livre (em vazio). O usuário não definiu tipografia. Escolha a fonte profissional que melhor se adeque à composição solicitada.\n`;
        }
        
        brandRule += `- IMPORTANTE: Mantenha as áreas reservadas para a logomarca da construtora completamente VAZIAS e LIMPAS. Nosso sistema aplicará a logo oficial posteriormente.\n`;
        
        baseText += brandRule;

        if (cleanPrompt) {
            baseText += `\nInstrução adicional do usuário: "${cleanPrompt}".`;
        }

        const w = width;
        const h = height;
        const txtFormat = format === 'story' ? '1080x1920 (9:16)' : ((format === 'portrait' || isPlanta) ? '1080x1350 (4:5)' : (format === 'carrossel' ? '1080x566 (carrossel)' : '1080x1080 (1:1)'));

        let falEndpoint = category === 'editor-livre' ? 'https://fal.run/fal-ai/nano-banana-pro' : 'https://fal.run/fal-ai/nano-banana';
        let finalPrompt = "";
        
        if (category === 'editor-livre') {
            finalPrompt = prompt;
        } else if (is_adjustment) {
            // Adiciona um contexto base para o modelo de imagem entender que é um anúncio imobiliário,
            // caso o usuário digite apenas uma instrução coloquial.
            finalPrompt = "A professional real estate advertisement image. Follow exactly this adjustment instruction: " + prompt;
        } else {
            finalPrompt = baseText.replace('{{FORMATO}}', txtFormat);
        }
        
        const reqPayload = {
            prompt: finalPrompt,
            image_size: { width: w, height: h },
            num_images: 1,
            enable_safety_checker: !is_adjustment
        };

        if (image_data) {
            // Roteamento para Image-to-Image no FAL (Text-to-Image puro ignora image_url)
            if (category === 'editor-livre') {
                falEndpoint = 'https://fal.run/fal-ai/flux-pro/kontext';
            } else {
                falEndpoint = is_adjustment ? 'https://fal.run/fal-ai/flux-pro/kontext' : 'https://fal.run/fal-ai/flux/dev/image-to-image';
            }
            
            reqPayload.image_url = image_data; // I2I requer esse parâmetro no flux-pro
            reqPayload.strength = is_adjustment ? 0.85 : 0.65; // Força moderada para manter o aspecto original mas aplicar a direção do prompt
        }

        console.log("=== SENDING TO FAL ===");
        console.log("Endpoint:", falEndpoint);
        console.log("Payload:", JSON.stringify(reqPayload, null, 2));

        const falResponse = await safeHttpsPost(falEndpoint, {
            'Authorization': `Key ${FAL_KEY}`,
            'Content-Type': 'application/json'
        }, reqPayload);

        if (!falResponse.ok) {
            const errData = await falResponse.text();
            console.error('FAL erro:', errData);
            await refundCredits();
            return res.status(502).json({ error: 'Falha na geração pela IA. ' + errData });
        }

        const result = await falResponse.json();
        console.log("FAL Result:", JSON.stringify(result, null, 2));
        const imageUrls = result.images?.map(i => i.url) || [];

        if (imageUrls.length === 0) {
            await refundCredits();
            return res.status(502).json({ error: 'Nenhuma imagem retornada pela IA. Tente novamente.' });
        }

        await userClient.from('generations').insert({
            user_id: user.id,
            template_id: style || null,
            prompt: cleanPrompt,
            image_url: imageUrls[0],
            used_ai: true
        });

        return res.status(200).json({
            success: true,
            image_urls: imageUrls,
            credits_remaining: remainingCredits
        });
    } catch (err) {
        console.error('API Error:', err);
        if (hasDecremented) {
            await refundCredits();
        }
        return res.status(500).json({ error: 'Erro interno do servidor.' });
    }
};
