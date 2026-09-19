// ============================================================
// POST /api/fetch-ads — Integração com Meta Ads Library API
// ============================================================

const { verifyAuth } = require('../lib/supabase');
const { setCorsHeaders } = require('../lib/sanitize');
const { validateUrlForSafeFetch } = require('../lib/security');

// Dados simulados para fallback (se a API falhar ou não houver token)
const MOCK_ADS = [
    {
        id: "mock_1",
        titulo: "Apartamento na Planta em São Paulo",
        texto_copy: "Seu sonho de morar em São Paulo está mais próximo! Lindo apartamento na planta de 2 dormitórios com varanda gourmet, lazer de clube completo e vaga de garagem. Apenas R$ 280 mil com entrada facilitada e parcelas menores que um aluguel. Subsídio do governo de até R$ 55 mil. Fale com a nossa equipe hoje mesmo!",
        descricao: "Planta de 45m² · Varanda Gourmet · Lazer de Clube",
        caption: "Saiba mais",
        tipo_midia: "IMAGE",
        plataformas: ["FACEBOOK", "INSTAGRAM"],
        impressoes_faixa: "10K-50K",
        impressoes_rank: 4,
        gasto_faixa: "1K-5K",
        gasto_rank: 2,
        dias_ativo: 45,
        data_inicio: "2026-05-12",
        data_fim: null,
        snapshot_url: "https://www.facebook.com/ads/archive/render_ad/?id=1&access_token=mock",
        page_name: "MRV Engenharia",
        page_id: "123",
        segmento: "Minha Casa Minha Vida",
        pais: "BR",
        precoExtraido: 280000,
        metragemExtraida: 45,
        imageUrl: "Assets/real_estate_1.png",
        videoUrl: null
    },
    {
        id: "mock_2",
        titulo: "Residencial de Alto Padrão em Moema",
        texto_copy: "Viva no coração de Moema com o máximo conforto e sofisticação. Apartamentos de altíssimo padrão com 3 suítes, 140m² a 180m², 3 vagas de garagem e lazer exclusivo. Condições especiais de lançamento por R$ 1.850.000. Agende uma visita guiada ao decorado com nosso corretor especialista.",
        descricao: "Alto Padrão Moema · 3 Suítes · 140 a 180m²",
        caption: "Fale conosco",
        tipo_midia: "IMAGE",
        plataformas: ["FACEBOOK", "INSTAGRAM", "MESSENGER"],
        impressoes_faixa: "50K-100K",
        impressoes_rank: 5,
        gasto_faixa: "5K-10K",
        gasto_rank: 5,
        dias_ativo: 15,
        data_inicio: "2026-06-11",
        data_fim: null,
        snapshot_url: "https://www.facebook.com/ads/archive/render_ad/?id=2&access_token=mock",
        page_name: "Cyrela Select",
        page_id: "456",
        segmento: "Alto Padrão",
        pais: "BR",
        precoExtraido: 1850000,
        metragemExtraida: 180,
        imageUrl: "Assets/real_estate_2.png",
        videoUrl: null
    },
    {
        id: "mock_3",
        titulo: "Lançamento Studios no Jardins",
        texto_copy: "Ideal para investidores! Studios modernos de 28m² a 45m² localizados a apenas 200m da estação de metrô Consolação, no Jardins. Região com alta demanda de locação via Airbnb. Valor promocional de R$ 510.000 para as primeiras 10 unidades. Excelente rentabilidade estimada de até 1.2% ao mês. Clique no saiba mais.",
        descricao: "Studios Premium Jardins · 28 a 45m² · Investimento",
        caption: "Saiba mais",
        tipo_midia: "IMAGE",
        plataformas: ["INSTAGRAM"],
        impressoes_faixa: "5K-10K",
        impressoes_rank: 3,
        gasto_faixa: "<100",
        gasto_rank: 1,
        dias_ativo: 5,
        data_inicio: "2026-06-21",
        data_fim: null,
        snapshot_url: "https://www.facebook.com/ads/archive/render_ad/?id=3&access_token=mock",
        page_name: "Lopes Consultoria",
        page_id: "789",
        segmento: "Médio Padrão",
        pais: "BR",
        precoExtraido: 510000,
        metragemExtraida: 45,
        imageUrl: "Assets/real_estate_3.png",
        videoUrl: null
    },
    {
        id: "mock_4",
        titulo: "Minha Casa Minha Vida - Guarulhos",
        texto_copy: "Conquiste o seu próprio teto em Guarulhos! Apartamentos prontos para morar de 2 quartos, com segurança 24h, churrasqueira e playground. Subsídio garantido pelo programa Minha Casa Minha Vida. Preço fechado de R$ 220.000. Renda familiar a partir de R$ 2.500 já pode financiar. Use seu FGTS na entrada!",
        descricao: "Guarulhos MCMV · Subsídio e FGTS · Pronto para morar",
        caption: "Enviar mensagem",
        tipo_midia: "IMAGE",
        plataformas: ["FACEBOOK"],
        impressoes_faixa: "100K-200K",
        impressoes_rank: 6,
        gasto_faixa: "10K-50K",
        gasto_rank: 6,
        dias_ativo: 90,
        data_inicio: "2026-03-28",
        data_fim: null,
        snapshot_url: "https://www.facebook.com/ads/archive/render_ad/?id=4&access_token=mock",
        page_name: "Tenda Construtora",
        page_id: "321",
        segmento: "Minha Casa Minha Vida",
        pais: "BR",
        precoExtraido: 220000,
        metragemExtraida: 42,
        imageUrl: "Assets/real_estate_4.png",
        videoUrl: null
    },
    {
        id: "mock_5",
        titulo: "Apartamento Família na Vila Mariana",
        texto_copy: "Espaço e conforto para quem você ama. Apartamento de 3 dormitórios (1 suíte) com 95m² privativos, varanda integrada com churrasqueira a carvão e 2 vagas demarcadas na Vila Mariana. Área de lazer decorada e equipada com piscina aquecida e quadra de tênis. Venda direta de R$ 980.000. Entre em contato.",
        descricao: "Vila Mariana Premium · 95m² · 3 Quartos",
        caption: "Fale conosco",
        tipo_midia: "IMAGE",
        plataformas: ["FACEBOOK", "INSTAGRAM", "AUDIENCE_NETWORK"],
        impressoes_faixa: "10K-50K",
        impressoes_rank: 4,
        gasto_faixa: "1K-5K",
        gasto_rank: 2,
        dias_ativo: 10,
        data_inicio: "2026-06-16",
        data_fim: null,
        snapshot_url: "https://www.facebook.com/ads/archive/render_ad/?id=5&access_token=mock",
        page_name: "Even Construtora",
        page_id: "654",
        segmento: "Médio Padrão",
        pais: "BR",
        precoExtraido: 980000,
        metragemExtraida: 95,
        imageUrl: "Assets/real_estate_5.png",
        videoUrl: null
    },
    {
        id: "mock_6",
        titulo: "Smart Studios na Faria Lima",
        texto_copy: "More ou invista na avenida mais movimentada do Brasil. Smart studios mobiliados e conectados na região da Faria Lima. Áreas compartilhadas incríveis como coworking, lavanderia OMO, mercadinho e rooftop bar. Unidades selecionadas por R$ 640.000. Menos burocracia, mais liquidez. Veja detalhes.",
        descricao: "Studios Faria Lima · 32m² · Rentabilidade",
        caption: "Saiba mais",
        tipo_midia: "IMAGE",
        plataformas: ["FACEBOOK", "INSTAGRAM"],
        impressoes_faixa: "10K-50K",
        impressoes_rank: 4,
        gasto_faixa: "1K-5K",
        gasto_rank: 2,
        dias_ativo: 30,
        data_inicio: "2026-05-27",
        data_fim: null,
        snapshot_url: "https://www.facebook.com/ads/archive/render_ad/?id=6&access_token=mock",
        page_name: "Vitacon Inc.",
        page_id: "987",
        segmento: "Médio Padrão",
        pais: "BR",
        precoExtraido: 640000,
        metragemExtraida: 32,
        imageUrl: "Assets/real_estate_6.png",
        videoUrl: null
    },
    {
        id: "mock_7",
        titulo: "Cobertura Exclusiva em Pinheiros",
        texto_copy: "Uma obra de arte arquitetônica em Pinheiros. Cobertura linear espetacular de 250m² com piscina privativa no terraço, vista panorâmica de 360 graus para a cidade, automação completa e acabamentos em mármore importado. Valor de venda: R$ 3.200.000. Agende seu atendimento exclusivo e personalizado.",
        descricao: "Penthouse Pinheiros · 250m² · Piscina Privativa",
        caption: "Fale conosco",
        tipo_midia: "IMAGE",
        plataformas: ["FACEBOOK", "INSTAGRAM", "MESSENGER"],
        impressoes_faixa: "200K-500K",
        impressoes_rank: 7,
        gasto_faixa: "50K-100K",
        gasto_rank: 7,
        dias_ativo: 80,
        data_inicio: "2026-04-07",
        data_fim: null,
        snapshot_url: "https://www.facebook.com/ads/archive/render_ad/?id=7&access_token=mock",
        page_name: "Gafisa Premium",
        page_id: "147",
        segmento: "Alto Padrão",
        pais: "BR",
        precoExtraido: 3200000,
        metragemExtraida: 250,
        imageUrl: "Assets/real_estate_7.png",
        videoUrl: null
    },
    {
        id: "mock_8",
        titulo: "Apartamento Completo em Campinas",
        texto_copy: "Mude de vida com a melhor localização de Campinas. Apartamentos de 2 quartos com suíte, varanda e condomínio fechado com portaria 24 horas. Lazer completo para toda a família incluindo piscina e salão de festas. Garanta o seu por R$ 350.000 com ITBI e Registro grátis pelo construtor!",
        descricao: "Campinas Lançamento · 2 Quartos com Varanda",
        caption: "Saiba mais",
        tipo_midia: "IMAGE",
        plataformas: ["FACEBOOK", "INSTAGRAM"],
        impressoes_faixa: "5K-10K",
        impressoes_rank: 3,
        gasto_faixa: "<100",
        gasto_rank: 1,
        dias_ativo: 40,
        data_inicio: "2026-05-17",
        data_fim: null,
        snapshot_url: "https://www.facebook.com/ads/archive/render_ad/?id=8&access_token=mock",
        page_name: "Direcional Engenharia",
        page_id: "258",
        segmento: "Minha Casa Minha Vida",
        pais: "BR",
        precoExtraido: 350000,
        metragemExtraida: 48,
        imageUrl: "Assets/real_estate_8.png",
        videoUrl: null
    }
];

// Rankings ordinais da API Graph da Meta
const IMPRESSIONS_RANK = {
    "<1000": 1, "1K-5K": 2, "5K-10K": 3,
    "10K-50K": 4, "50K-100K": 5, "100K-200K": 6,
    "200K-500K": 7, ">1M": 8, "unknown": 0
};

const SPEND_RANK = {
    "<100": 1, "100-499": 2, "500-999": 3,
    "1K-5K": 4, "5K-10K": 5, "10K-50K": 6,
    "50K-100K": 7, ">100K": 8, "unknown": 0
};

// Extrator de Preços Regex
function extrairPreco(texto) {
    if (!texto) return null;
    const txt = texto.toLowerCase();

    // R$ X.XXX.XXX ou R$ X.XXX
    const regexRealCompleto = /(?:r\$\s*)(\d{1,3}(?:\.\d{3})+)/i;
    let match = txt.match(regexRealCompleto);
    if (match) {
        const numStr = match[1].replace(/\./g, '');
        const val = parseInt(numStr, 10);
        if (val > 10000) return val;
    }

    // X mil ou X.XXX mil
    const regexMil = /(\d{1,3}(?:\.\d{3})?)\s*mil\b/i;
    match = txt.match(regexMil);
    if (match) {
        const numStr = match[1].replace(/\./g, '');
        const val = parseFloat(numStr.replace(',', '.')) * 1000;
        if (val > 10000) return val;
    }

    // X,X milhão ou X.X milhões
    const regexMilhao = /(\d+(?:[.,]\d+)?)\s*milh[õo]es\b/i;
    const regexMilhaoSing = /(\d+(?:[.,]\d+)?)\s*milh[ãa]o\b/i;
    match = txt.match(regexMilhao) || txt.match(regexMilhaoSing);
    if (match) {
        const numStr = match[1].replace(',', '.');
        return Math.round(parseFloat(numStr) * 1000000);
    }

    return null;
}

// Extrator de Metragem Regex
function extrairMetragem(texto) {
    if (!texto) return null;
    const txt = texto.toLowerCase();

    // Faixa de metragem como "55 a 75 m²", "70 a 110m²"
    const regexFaixaM2 = /(\d{2,3})\s*(?:a|à|e)\s*(\d{2,3})\s*(?:m²|m2|metros|mq)\b/i;
    let match = txt.match(regexFaixaM2);
    if (match) {
        return parseInt(match[2], 10); // Retorna o limite superior da faixa
    }

    // plantas a partir de 180 m² ou plantas de 120m² ou 120m² / 120 m²
    const regexM2 = /(\d{2,3})\s*(?:m²|m2|metros\s+quadrados|metros|mq)\b/i;
    match = txt.match(regexM2);
    if (match) {
        return parseInt(match[1], 10);
    }

    return null;
}

// Classificação NLP por Heurística e Pontuação
function classificarSegmento(texto, preco, metragem) {
    if (!texto) return "Não classificado";
    const txt = texto.toLowerCase();

    let scores = {
        mcmv: 0,
        medio: 0,
        alto: 0
    };

    // ── Termos Minha Casa Minha Vida ──
    const mcmvKeywords = [
        "saia do aluguel", "casa própria", "casa propria", "realize o sonho",
        "entrada facilitada", "entrada parcelada", "sem entrada",
        "parcelas que cabem no seu bolso", "a partir de r$", "por mês", "por mes",
        "use seu fgts", "subsídio do governo", "subsidio do governo",
        "use seu subsídio", "use seu subsidio", "documentação grátis", "documentacao gratis",
        "sem custo de documentação", "sem custo de documentacao", "renda a partir de",
        "aprovação na hora", "aprovacao na hora", "simule agora", "taxas reduzidas",
        "juros baixos", "últimas unidades", "ultimas unidades", "garanta o seu",
        "pronto pra morar", "na planta", "minha casa minha vida", "mcmv",
        "caixa econômica", "caixa economica", "programa habitacional", "popular", "econômico", "economico"
    ];

    // ── Termos Médio Padrão ──
    const medioKeywords = [
        "lançamento", "lancamento", "localização privilegiada", "localizacao privilegiada",
        "pertinho de tudo", "lazer completo", "área de lazer", "area de lazer",
        "varanda gourmet", "suíte", "suite", "quartos", "vaga de garagem",
        "apartamento decorado", "conheça o decorado", "conheca o decorado",
        "condições especiais", "condicoes especiais", "condições imperdíveis", "condicoes imperdiveis",
        "qualidade de vida", "segurança 24h", "seguranca 24h", "portaria",
        "valorização", "valorizacao", "ótimo investimento", "otimo investimento",
        "agende sua visita", "plantão de vendas", "plantao de vendas", "pronto para morar",
        "médio padrão", "medio padrao"
    ];

    // ── Termos Alto Padrão ──
    const altoKeywords = [
        "exclusivo", "exclusividade", "para poucos", "alto padrão", "alto padrao",
        "sofisticação", "sofisticacao", "requinte", "elegância", "elegancia",
        "acabamento premium", "de primeira", "vista deslumbrante", "vista panorâmica", "vista panoramica",
        "metragem generosa", "plantas amplas", "living amplo", "lazer de resort",
        "lazer assinado", "endereço exclusivo", "endereco exclusivo", "endereço dos sonhos", "endereco dos sonhos",
        "design assinado", "assinado por", "conceito", "experiência única", "experiencia unica",
        "privacidade", "conforto absoluto", "empreendimento único", "empreendimento unico",
        "luxo", "sofisticado", "cobertura", "penthouse", "infinity pool", "suíte máster", "suite master",
        "heliponto", "mansão", "mansao", "altíssimo padrão", "altissimo padrao"
    ];

    // Pontuar por ocorrência de palavras-chave
    mcmvKeywords.forEach(k => {
        if (txt.includes(k)) scores.mcmv += 2;
    });
    medioKeywords.forEach(k => {
        if (txt.includes(k)) scores.medio += 2;
    });
    altoKeywords.forEach(k => {
        if (txt.includes(k)) scores.alto += 2;
    });

    // Pontuar com base no Preço
    if (preco) {
        if (preco <= 500000) {
            scores.mcmv += 10;
        } else if (preco > 500000 && preco <= 1000000) {
            scores.medio += 10;
        } else if (preco > 1000000) {
            scores.alto += 10;
        }
    }

    // Pontuar com base na Metragem (m²)
    if (metragem) {
        if (metragem <= 55) {
            // Unidades pequenas favorecem MCMV, a não ser que tenha palavras de luxo explícitas
            if (scores.alto > 3) {
                scores.medio += 5; // Studios de luxo entram em Médio/Alto
            } else {
                scores.mcmv += 5;
            }
        } else if (metragem > 55 && metragem <= 110) {
            scores.medio += 5;
        } else if (metragem >= 120) {
            scores.alto += 10;
        }
    }

    // Determinar o vencedor
    if (scores.alto > scores.medio && scores.alto > scores.mcmv && scores.alto > 0) {
        return "Alto Padrão";
    }
    if (scores.medio > scores.mcmv && scores.medio > scores.alto && scores.medio > 0) {
        return "Médio Padrão";
    }
    if (scores.mcmv > scores.medio && scores.mcmv > scores.alto && scores.mcmv > 0) {
        return "Minha Casa Minha Vida";
    }

    // Fallbacks baseados na maior pontuação mesmo que empates
    const maxVal = Math.max(scores.mcmv, scores.medio, scores.alto);
    if (maxVal === 0) return "Não classificado";
    if (maxVal === scores.alto) return "Alto Padrão";
    if (maxVal === scores.medio) return "Médio Padrão";
    return "Minha Casa Minha Vida";
}

// Scraper em paralelo para extrair o vídeo/imagem real da render_ad HTML do Facebook
async function extrairMidiaDoSnapshot(snapshotUrl) {
    if (!snapshotUrl || snapshotUrl.includes('access_token=mock')) {
        return { videoUrl: null, imageUrl: null };
    }
    try {
        // Validação de SSRF na URL do snapshot
        await validateUrlForSafeFetch(snapshotUrl, ['facebook.com', 'fbcdn.net', 'instagram.com']);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s max por request

        const res = await fetch(snapshotUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        clearTimeout(timeoutId);

        if (!res.ok) return { videoUrl: null, imageUrl: null };
        const html = await res.text();

        // ── EXTRAÇÃO DE VÍDEO (Padrão mp4 do Facebook CDN) ──
        // O player armazena as URLs de vídeo no HTML ou em JSON de script, as quais se parecem com:
        // "video_url":"https:\/\/video.fxxx-x.fna.fbcdn.net\/v\/..."
        // OU no iframe como <video src="...">
        const videoRegex = /"video_url"\s*:\s*"([^"]+)"/i;
        const videoRegexCDN = /https?:\\?\/\\?\/video\.[a-z0-9-]+\.fna\.fbcdn\.net\\?\/[^"']+\.mp4[^"']*/gi;
        const videoRegexRaw = /https?:\/\/video\.[a-z0-9-]+\.fna\.fbcdn\.net\/[^"']+\.mp4[^"']*/gi;

        let videoUrl = null;
        let match = html.match(videoRegex);
        if (match) {
            videoUrl = match[1].replace(/\\/g, '');
        } else {
            match = html.match(videoRegexCDN) || html.match(videoRegexRaw);
            if (match) {
                videoUrl = match[0].replace(/\\/g, '');
            }
        }

        // ── EXTRAÇÃO DE IMAGEM ──
        // Imagens são hospedadas na CDN scontent do facebook
        const imgRegex = /"image_url"\s*:\s*"([^"]+)"/i;
        const imgRegexCDN = /https?:\\?\/\\?\/scontent\.[a-z0-9-]+\.fna\.fbcdn\.net\\?\/[^"']+\.(?:jpg|png|jpeg)[^"']*/gi;
        const imgRegexRaw = /https?:\/\/scontent\.[a-z0-9-]+\.fna\.fbcdn\.net\/[^"']+\.(?:jpg|png|jpeg)[^"']*/gi;

        let imageUrl = null;
        match = html.match(imgRegex);
        if (match) {
            imageUrl = match[1].replace(/\\/g, '');
        } else {
            match = html.match(imgRegexCDN) || html.match(imgRegexRaw);
            if (match) {
                imageUrl = match[0].replace(/\\/g, '');
            }
        }

        return { videoUrl, imageUrl };
    } catch (e) {
        // Ignora erros de abort / timeout e retorna nulo graciosamente
        return { videoUrl: null, imageUrl: null };
    }
}

module.exports = async function handler(req, res) {
    setCorsHeaders(res, req.headers.origin);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    try {
        // 1. Validar autenticação do usuário logado na plataforma
        const { user, error } = await verifyAuth(req);
        if (error) return res.status(401).json({ error });

        // 2. Extrair parâmetros da requisição
        const { search_terms, meta_token, limit = 25, after } = req.body || {};

        // 3. Resolver Token do Meta (Front-end Token ou Back-end Env)
        const activeToken = meta_token || process.env.META_ADS_TOKEN;

        // Se não houver token ativo ou o token for de teste, retornar os dados mockados
        if (!activeToken || activeToken === 'mock' || activeToken.trim() === '') {
            console.log("Nenhum token fornecido ou token mock configurado. Retornando dados demonstrativos.");
            return res.status(200).json({
                data: MOCK_ADS,
                is_mock: true,
                warning: "Demonstração ativa. Configure seu Token da API do Meta nas configurações do Espião para ver anúncios em tempo real."
            });
        }

        // 4. Formular os Termos de Busca
        const queryTerms = search_terms && search_terms.trim() !== ""
            ? search_terms.trim()
            : "imóvel OR apartamento OR lançamento OR construtora OR incorporadora OR empreendimento";

        // 5. Query na Graph API do Meta
        const metaApiUrl = new URL("https://graph.facebook.com/v21.0/ads_archive");
        metaApiUrl.searchParams.append("ad_reached_countries", JSON.stringify(["BR"]));
        metaApiUrl.searchParams.append("ad_type", "HOUSING_ADS");
        metaApiUrl.searchParams.append("search_terms", queryTerms);
        metaApiUrl.searchParams.append("search_type", "KEYWORD_UNORDERED");
        metaApiUrl.searchParams.append("languages", JSON.stringify(["pt"]));
        metaApiUrl.searchParams.append("ad_active_status", "ALL");
        metaApiUrl.searchParams.append("limit", limit.toString());
        metaApiUrl.searchParams.append("access_token", activeToken);
        metaApiUrl.searchParams.append("fields", "id,ad_creation_time,ad_delivery_start_time,ad_delivery_stop_time,ad_creative_bodies,ad_creative_link_titles,ad_creative_link_descriptions,ad_creative_link_captions,ad_snapshot_url,page_id,page_name,publisher_platforms,languages,impressions,spend,currency");

        if (after) {
            metaApiUrl.searchParams.append("after", after);
        }

        const metaResponse = await fetch(metaApiUrl.toString());
        
        if (!metaResponse.ok) {
            const errData = await metaResponse.json().catch(() => ({}));
            console.error("Meta Ads API Error details:", errData);
            return res.status(200).json({
                data: MOCK_ADS,
                is_mock: true,
                warning: `Falha ao consultar a API da Meta (${metaResponse.status}). Exibindo dados simulados. Detalhe: ${errData?.error?.message || 'Sem detalhes'}`
            });
        }

        const metaJson = await metaResponse.json();
        const adsList = metaJson.data || [];
        const paging = metaJson.paging || {};

        // 6. Processar anúncios em paralelo
        const processedAds = await Promise.all(adsList.map(async (ad) => {
            // Juntar todos os textos
            const bodies = ad.ad_creative_bodies || [];
            const titles = ad.ad_creative_link_titles || [];
            const descs = ad.ad_creative_link_descriptions || [];
            const captions = ad.ad_creative_link_captions || [];

            const combinedText = [
                ...bodies,
                ...titles,
                ...descs
            ].join(" ");

            // Preço e Metragem
            const preco = extrairPreco(combinedText);
            const metragem = extrairMetragem(combinedText);

            // Classificar
            const segmento = classificarSegmento(combinedText, preco, metragem);

            // Calcular dias ativo
            const inicio = new Date(ad.ad_delivery_start_time);
            const fim = ad.ad_delivery_stop_time ? new Date(ad.ad_delivery_stop_time) : new Date();
            const dias_ativo = Math.max(0, Math.ceil((fim - inicio) / (1000 * 60 * 60 * 24)));

            // Calcular ordinais de visualização e gasto
            let impressions_val = "unknown";
            let impressions_rank = 0;
            if (ad.impressions && ad.impressions.lower_bound) {
                const lower = ad.impressions.lower_bound;
                if (lower < 1000) { impressions_val = "<1000"; impressions_rank = 1; }
                else if (lower < 5000) { impressions_val = "1K-5K"; impressions_rank = 2; }
                else if (lower < 10000) { impressions_val = "5K-10K"; impressions_rank = 3; }
                else if (lower < 50000) { impressions_val = "10K-50K"; impressions_rank = 4; }
                else if (lower < 100000) { impressions_val = "50K-100K"; impressions_rank = 5; }
                else if (lower < 200000) { impressions_val = "100K-200K"; impressions_rank = 6; }
                else if (lower < 1000000) { impressions_val = "200K-500K"; impressions_rank = 7; }
                else { impressions_val = ">1M"; impressions_rank = 8; }
            }

            let spend_val = "unknown";
            let spend_rank = 0;
            if (ad.spend && ad.spend.lower_bound) {
                const lower = ad.spend.lower_bound;
                if (lower < 100) { spend_val = "<100"; spend_rank = 1; }
                else if (lower < 500) { spend_val = "100-499"; spend_rank = 2; }
                else if (lower < 1000) { spend_val = "500-999"; spend_rank = 3; }
                else if (lower < 5000) { spend_val = "1K-5K"; spend_rank = 4; }
                else if (lower < 10000) { spend_val = "5K-10K"; spend_rank = 5; }
                else if (lower < 50000) { spend_val = "10K-50K"; spend_rank = 6; }
                else if (lower < 100000) { spend_val = "50K-100K"; spend_rank = 7; }
                else { spend_val = ">100K"; spend_rank = 8; }
            }

            // Tipo de mídia básico
            let tipo_midia = "IMAGE";
            if (bodies.length > 1 || titles.length > 1) {
                tipo_midia = "CAROUSEL";
            }

            // Scraping para obter mídias diretas
            const mediaSources = await extrairMidiaDoSnapshot(ad.ad_snapshot_url);
            if (mediaSources.videoUrl) {
                tipo_midia = "VIDEO";
            }

            return {
                id: ad.id,
                titulo: titles[0] || ad.page_name || "Lançamento Imobiliário",
                texto_copy: bodies[0] || "",
                descricao: descs[0] || "",
                caption: captions[0] || "Saiba mais",
                tipo_midia: tipo_midia,
                plataformas: ad.publisher_platforms || ["FACEBOOK", "INSTAGRAM"],
                impressoes_faixa: impressions_val,
                impressoes_rank: impressions_rank,
                gasto_faixa: spend_val,
                gasto_rank: spend_rank,
                dias_ativo: dias_ativo,
                data_inicio: ad.ad_delivery_start_time ? ad.ad_delivery_start_time.split("T")[0] : "",
                data_fim: ad.ad_delivery_stop_time ? ad.ad_delivery_stop_time.split("T")[0] : null,
                snapshot_url: ad.ad_snapshot_url,
                page_name: ad.page_name || "Construtora",
                page_id: ad.page_id || "",
                segmento: segmento,
                pais: "BR",
                precoExtraido: preco || (segmento === "Minha Casa Minha Vida" ? 280000 : segmento === "Médio Padrão" ? 650000 : 1800000),
                metragemExtraida: metragem || (segmento === "Minha Casa Minha Vida" ? 45 : segmento === "Médio Padrão" ? 85 : 180),
                imageUrl: mediaSources.imageUrl || "Assets/real_estate_1.png", // default fallback image
                videoUrl: mediaSources.videoUrl
            };
        }));

        return res.status(200).json({
            data: processedAds,
            paging: paging,
            is_mock: false
        });

    } catch (err) {
        console.error("Critical error in fetch-ads handler:", err);
        return res.status(500).json({ error: "Erro interno no servidor: " + err.message });
    }
};
