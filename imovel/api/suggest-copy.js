const { verifyAuth, getSupabaseClient } = require('../lib/supabase');
const { setCorsHeaders, validateCSRF } = require('../lib/sanitize');
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

    if (!validateCSRF(req, res)) return;

    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    try {
        const { allowed, retryAfter } = rateLimit(req, { maxRequests: 50, windowMs: 3600000 });
        if (!allowed) return sendRateLimitResponse(res, retryAfter);

        const { error } = await verifyAuth(req, res);
        if (error) return res.status(401).json({ error });

        const { image_data } = req.body || {};
        if (!image_data) {
            return res.status(400).json({ error: 'Nenhuma imagem fornecida.' });
        }

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            // Se não houver chave, retorna dados mockados para o usuário testar a UI
            console.warn('[GEMINI] Chave GEMINI_API_KEY não configurada. Retornando dados mock.');
            return res.status(200).json({
                success: true,
                is_mock: true,
                nomeEmpreendimento: 'Residencial Jabuticabeiras',
                incorporadora: 'Fibra Experts',
                tipoImovel: 'Apartamento',
                localizacao: 'Pinheiros, São Paulo - SP',
                areaPrivativa: '68',
                dormitorios: '2 Quartos',
                suites: '1 Suíte',
                vagas: '1 Vaga',
                condicoesPreco: 'Entrada de R$ 50.000 + parcelas mensais',
                banheiros: '2 Banheiros',
                publicoAlvo: 'Casais Jovens',
                tomVoz: 'Persuasivo / Vendedor',
                objetivo: 'Lançamento',
                diferenciais: ['Varanda Gourmet', 'Fechadura Eletrônica', 'Academia Equipada', 'Próximo ao Metrô']
            });
        }

        // Remover prefixo base64 (data:image/jpeg;base64, etc.)
        const match = image_data.match(/^data:(image\/\w+);base64,(.+)$/);
        if (!match) {
            return res.status(400).json({ error: 'Formato de imagem inválido. Deve ser base64 data URL.' });
        }
        const mimeType = match[1];
        const base64Data = match[2];

        const promptText = `Você é um especialista sênior em design gráfico e copywriting voltado especificamente para a criação de peças e anúncios de alto impacto para o mercado imobiliário.
Analise a foto deste imóvel e sugira a melhor estratégia de texto, atributos e diferenciais de anúncio de alta conversão para redes sociais.
Retorne estritamente um JSON no formato JSON válido (sem blocos de código markdown) que respeite exatamente o seguinte esquema de chaves:
{
  "nomeEmpreendimento": "nome sugerido para o condomínio/empreendimento baseado na foto ou região (ex: Condomínio Jardim das Flores)",
  "incorporadora": "nome de incorporadora fictícia ou plausível se detectado (ex: Incorporadora Alto Padrão)",
  "tipoImovel": "uma das opções exatas: Apartamento, Casa, Sobrado, Terreno, Cobertura, Studio, Chácara",
  "localizacao": "localização sugerida ou detectada (ex: São Paulo, SP)",
  "areaPrivativa": "área sugerida em m² apenas número (ex: 62)",
  "dormitorios": "uma das opções exatas: 1 Quarto, 2 Quartos, 3 Quartos, 4+ Quartos, Nenhum",
  "suites": "uma das opções exatas: Sem Suíte, 1 Suíte, 2 Suítes, 3+ Suítes",
  "vagas": "uma das opções exatas: Sem Vaga, 1 Vaga, 2 Vagas, 3+ Vagas",
  "condicoesPreco": "condição comercial curta sem o R$ (ex: Entrada facilitada de 20.000)",
  "banheiros": "uma das opções exatas: 1 Banheiro, 2 Banheiros, 3 Banheiros, 4+ Banheiros",
  "publicoAlvo": "uma das opções exatas: Casais Jovens, Profissionais / Solteiros, Famílias Grandes, Investidores, Aposentados",
  "tomVoz": "uma das opções exatas: Persuasivo / Vendedor, Sofisticado / Luxo, Amigável / Confiável, Urgente / Promocional",
  "objetivo": "uma das opções exatas: Lançamento, Venda Prontos, Condições Especiais, Visita Decorado",
  "diferenciais": ["Varanda Gourmet", "Piscina com Borda Infinita", "Fechadura Eletrônica", "Academia Equipada", "Pet Place / Espaço Pet", "Coworking / Home Office", "Próximo ao Metrô", "Portaria 24h Facial", "Recarga Carro Elétrico", "Energia Solar", "Quadra de Beach Tennis", "Rooftop Gourmet"]
}
Nota: No campo "diferenciais", retorne um array com até 5 elementos selecionados da lista acima que façam sentido de acordo com o que é visto ou provável na imagem.
Escreva as respostas em português do Brasil, de forma persuasiva, altamente comercial e profissional.`;

        const geminiPayload = {
            contents: [
                {
                    parts: [
                        { text: promptText },
                        {
                            inlineData: {
                                mimeType: mimeType,
                                data: base64Data
                            }
                        }
                    ]
                }
            ],
            generationConfig: {
                responseMimeType: "application/json"
            }
        };

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const response = await safeHttpsPost(geminiUrl, {
            'Content-Type': 'application/json'
        }, geminiPayload);

        if (!response.ok) {
            const errText = await response.text();
            console.error('[GEMINI] Erro na API do Gemini:', errText);
            return res.status(502).json({ error: 'Erro ao consultar a IA do Gemini.' });
        }

        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) {
            return res.status(502).json({ error: 'Nenhuma resposta válida retornada pelo Gemini.' });
        }

        const resultJson = JSON.parse(responseText.trim());
        return res.status(200).json({
            success: true,
            is_mock: false,
            nomeEmpreendimento: resultJson.nomeEmpreendimento,
            incorporadora: resultJson.incorporadora,
            tipoImovel: resultJson.tipoImovel,
            localizacao: resultJson.localizacao,
            areaPrivativa: resultJson.areaPrivativa,
            dormitorios: resultJson.dormitorios,
            suites: resultJson.suites,
            vagas: resultJson.vagas,
            condicoesPreco: resultJson.condicoesPreco,
            banheiros: resultJson.banheiros,
            publicoAlvo: resultJson.publicoAlvo,
            tomVoz: resultJson.tomVoz,
            objetivo: resultJson.objetivo,
            diferenciais: resultJson.diferenciais
        });

    } catch (err) {
        console.error('[GEMINI] Erro interno:', err);
        return res.status(500).json({ error: 'Erro interno ao processar a copy com Gemini.' });
    }
};
