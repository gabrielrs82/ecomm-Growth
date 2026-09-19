/**
 * LÓGICA DE NEGÓCIO E INTERATIVIDADE — IMOB GROWTH AI
 * v2.0 — Auth, Billing, Subscriptions + Módulos originais
 */

// ==========================================================================
// OUVIDORES GLOBAIS DE ERRO — Tratamento e feedback visual ao usuário
// ==========================================================================
window.addEventListener('error', (event) => {
    console.error('[GLOBAL-ERROR] Erro não tratado:', event.error);
});
window.addEventListener('unhandledrejection', (event) => {
    console.error('[GLOBAL-REJECTION] Promessa rejeitada:', event.reason);
});

// ==========================================================================
// GUARDA DE PROTOCOLO — Detecta file:// e redireciona para localhost
// ==========================================================================
(function() {
    if (window.location.protocol === 'file:') {
        document.body.innerHTML = `
            <div style="
                display:flex; flex-direction:column; align-items:center; justify-content:center;
                min-height:100vh; background:#0d0d0d; color:#fff; font-family:sans-serif;
                text-align:center; padding:40px;
            ">
                <div style="font-size:60px; margin-bottom:24px;">⚠️</div>
                <h1 style="font-size:28px; font-weight:700; margin-bottom:16px; color:#c8da42;">
                    Abra pelo servidor local!
                </h1>
                <p style="font-size:16px; color:#aaa; max-width:480px; line-height:1.6; margin-bottom:32px;">
                    Você está abrindo o arquivo diretamente pelo Windows Explorer (<code style="color:#ff6b6b">file://</code>).
                    O navegador bloqueia chamadas de rede nesse modo, por isso a geração de imagens não funciona.
                </p>
                <a href="http://localhost:3000" style="
                    background:#c8da42; color:#0d0d0d; font-weight:700; font-size:18px;
                    padding:16px 40px; border-radius:12px; text-decoration:none;
                    display:inline-block; transition:opacity .2s;
                " onmouseover="this.style.opacity='.8'" onmouseout="this.style.opacity='1'">
                    👉 Abrir em http://localhost:3000
                </a>
                <p style="margin-top:24px; font-size:13px; color:#555;">
                    Certifique-se de que o servidor está rodando (<code>vercel dev</code>) antes de clicar.
                </p>
            </div>`;
        throw new Error("Blocked: app opened via file:// protocol. Use http://localhost:3000 instead.");
    }
})();

// ==========================================================================
// ESCAPE HTML - Prevenção contra ataques XSS no editor
// ==========================================================================
function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ==========================================================================
// VALIDAÇÃO DE CABEÇALHOS (MAGIC BYTES) & EXTENSÕES
// ==========================================================================
function validateFileHeader(file) {
    return new Promise((resolve) => {
        const ext = file.name.split('.').pop().toLowerCase();
        const allowedExtensions = ['png', 'jpg', 'jpeg', 'svg', 'webp'];
        if (!allowedExtensions.includes(ext)) {
            resolve({ valid: false, reason: `Extensão .${ext} não é permitida.` });
            return;
        }

        const maxMB = 5;
        if (file.size > maxMB * 1024 * 1024) {
            resolve({ valid: false, reason: `Arquivo muito grande. O limite máximo é de ${maxMB}MB.` });
            return;
        }

        // SVG
        if (ext === 'svg') {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result.trim();
                const isSvg = text.startsWith('<svg') || text.startsWith('<?xml') || text.includes('<svg');
                if (isSvg) {
                    resolve({ valid: true });
                } else {
                    resolve({ valid: false, reason: 'Arquivo SVG inválido.' });
                }
            };
            reader.onerror = () => resolve({ valid: false, reason: 'Erro ao ler arquivo SVG.' });
            reader.readAsText(file.slice(0, 1000));
            return;
        }

        // PNG, JPG, WEBP via Magic Bytes
        const reader = new FileReader();
        reader.onload = (e) => {
            const arr = new Uint8Array(e.target.result);
            let header = "";
            for (let i = 0; i < arr.length; i++) {
                header += arr[i].toString(16).padStart(2, '0');
            }
            header = header.toUpperCase();

            let isValid = false;
            if (header.startsWith("89504E47")) {
                isValid = (ext === 'png');
            } else if (header.startsWith("FFD8FF")) {
                isValid = (ext === 'jpg' || ext === 'jpeg');
            } else if (header.startsWith("52494646") && header.includes("57454250")) {
                isValid = (ext === 'webp');
            }

            if (isValid) {
                resolve({ valid: true });
            } else {
                resolve({ valid: false, reason: `O cabeçalho do arquivo não corresponde à extensão .${ext}.` });
            }
        };
        reader.onerror = () => resolve({ valid: false, reason: 'Erro ao ler cabeçalho.' });
        reader.readAsArrayBuffer(file.slice(0, 16));
    });
}

// ==========================================================================
// BANCO DE DADOS SIMULADO (MOCK DATA)
// ==========================================================================
const MOCK_ADS = [
    {
        id: 1,
        pageName: "MRV Engenharia",
        logo: "MR",
        title: "Apartamento na Planta em São Paulo",
        adText: "Seu sonho de morar em São Paulo está mais próximo! Lindo apartamento na planta de 2 dormitórios com varanda gourmet, lazer de clube completo e vaga de garagem. Apenas R$ 280 mil com entrada facilitada e parcelas menores que um aluguel. Subsídio do governo de até R$ 55 mil. Fale com a nossa equipe hoje mesmo!",
        imageUrl: "/imovel/Assets/real_estate_1.png",
        adDeliveryStartTime: "2025-11-12T10:00:00Z",
        precoExtraido: 280000,
        adLink: "https://www.mrv.com.br/apartamentos/sao-paulo"
    },
    {
        id: 2,
        pageName: "Cyrela Select",
        logo: "CY",
        title: "Residencial de Alto Padrão em Moema",
        adText: "Viva no coração de Moema com o máximo conforto e sofisticação. Apartamentos de altíssimo padrão com 3 suítes, 140m² a 180m², 3 vagas de garagem e lazer exclusivo. Condições especiais de lançamento por R$ 1.850.000. Agende uma visita guiada ao decorado com nosso corretor especialista.",
        imageUrl: "/imovel/Assets/real_estate_2.png",
        adDeliveryStartTime: "2026-01-20T14:30:00Z",
        precoExtraido: 1850000,
        adLink: "https://www.cyrela.com.br/moema"
    },
    {
        id: 3,
        pageName: "Lopes Consultoria",
        logo: "LP",
        title: "Lançamento Studios no Jardins",
        adText: "Ideal para investidores! Studios modernos de 28m² a 45m² localizados a apenas 200m da estação de metrô Consolação, no Jardins. Região com alta demanda de locação via Airbnb. Valor promocional de R$ 510.000 para as primeiras 10 unidades. Excelente rentabilidade estimada de até 1.2% ao mês. Clique no saiba mais.",
        imageUrl: "/imovel/Assets/real_estate_3.png",
        adDeliveryStartTime: "2026-03-05T09:15:00Z",
        precoExtraido: 510000,
        adLink: "https://www.lopes.com.br/studios-jardins"
    },
    {
        id: 4,
        pageName: "Tenda Construtora",
        logo: "TE",
        title: "Minha Casa Minha Vida - Guarulhos",
        adText: "Conquiste o seu próprio teto em Guarulhos! Apartamentos prontos para morar de 2 quartos, com segurança 24h, churrasqueira e playground. Subsídio garantido pelo programa Minha Casa Minha Vida. Preço fechado de R$ 220.000. Renda familiar a partir de R$ 2.500 já pode financiar. Use seu FGTS na entrada!",
        imageUrl: "/imovel/Assets/real_estate_4.png",
        adDeliveryStartTime: "2025-10-01T11:00:00Z",
        precoExtraido: 220000,
        adLink: "https://www.tenda.com/guarulhos"
    },
    {
        id: 5,
        pageName: "Even Construtora",
        logo: "EV",
        title: "Apartamento Família na Vila Mariana",
        adText: "Espaço e conforto para quem você ama. Apartamento de 3 dormitórios (1 suíte) com 95m² privativos, varanda integrada com churrasqueira a carvão e 2 vagas demarcadas na Vila Mariana. Área de lazer decorada e equipada com piscina aquecida e quadra de tênis. Venda direta de R$ 980.000. Entre em contato.",
        imageUrl: "/imovel/Assets/real_estate_5.png",
        adDeliveryStartTime: "2026-04-18T16:00:00Z",
        precoExtraido: 980000,
        adLink: "https://www.even.com.br/vila-mariana"
    },
    {
        id: 6,
        pageName: "Vitacon Inc.",
        logo: "VI",
        title: "Smart Studios na Faria Lima",
        adText: "More ou invista na avenida mais movimentada do Brasil. Smart studios mobiliados e conectados na região da Faria Lima. Áreas compartilhadas incríveis como coworking, lavanderia OMO, mercadinho e rooftop bar. Unidades selecionadas por R$ 640.000. Menos burocracia, mais liquidez. Veja detalhes.",
        imageUrl: "/imovel/Assets/real_estate_6.png",
        adDeliveryStartTime: "2026-02-10T08:00:00Z",
        precoExtraido: 640000,
        adLink: "https://www.vitacon.com.br/faria-lima"
    },
    {
        id: 7,
        pageName: "Gafisa Premium",
        logo: "GF",
        title: "Cobertura Exclusiva em Pinheiros",
        adText: "Uma obra de arte arquitetônica em Pinheiros. Cobertura linear espetacular de 250m² com piscina privativa no terraço, vista panorâmica de 360 graus para a cidade, automação completa e acabamentos em mármore importado. Valor de venda: R$ 3.200.000. Agende seu atendimento exclusivo e personalizado.",
        imageUrl: "/imovel/Assets/real_estate_7.png",
        adDeliveryStartTime: "2026-05-30T15:20:00Z",
        precoExtraido: 3200000,
        adLink: "https://www.gafisa.com.br/cobertura-pinheiros"
    },
    {
        id: 8,
        pageName: "Direcional Engenharia",
        logo: "DR",
        title: "Apartamento Completo em Campinas",
        adText: "Mude de vida com a melhor localização de Campinas. Apartamentos de 2 quartos com suíte, varanda e condomínio fechado com portaria 24 horas. Lazer completo para toda a família incluindo piscina e salão de festas. Garanta o seu por R$ 350.000 com ITBI e Registro grátis pelo construtor!",
        imageUrl: "/imovel/Assets/real_estate_8.png",
        adDeliveryStartTime: "2025-12-05T10:45:00Z",
        precoExtraido: 350000,
        adLink: "https://direcional.com.br/campinas"
    }
];

// Faturas mockadas iniciais
let MOCK_INVOICES = [
    { date: "08/06/2026", desc: "Plano Pro AI — Mensal", amount: "R$ 299,00", status: "paid" },
    { date: "08/05/2026", desc: "Plano Pro AI — Mensal", amount: "R$ 299,00", status: "paid" },
    { date: "08/04/2026", desc: "Plano Pro AI — Mensal", amount: "R$ 299,00", status: "paid" },
    { date: "08/03/2026", desc: "Plano Starter — Mensal", amount: "R$ 149,00", status: "paid" },
];

// ==========================================================================
// ESTADO DA APLICAÇÃO (APP STATE)
// ==========================================================================
let currentTab = 'dashboard';
let adsFilterQuery = '';
let adsFilterMaxPrice = 4000000;
let adsSortMode = 'oldest';
let billingIsAnnual = false;

// Estado dos pacotes (créditos)
let packageState = {
    artesFeitas: 37,
    artesLimite: 9999999,
    videosFeitos: 7,
    videosLimite: 9999999,
};

// Estado do plano atual
let currentPlanState = {
    name: "Pro AI",
    priceMonthly: 299,
    priceAnnual: 239,
    usageImages: 124,
    limitImages: 300,
};

// Usuário logado (em memória)
let loggedUser = null;

// Wrappers para separar o localStorage por usuário na Identidade de Marca
const originalGetItem = localStorage.getItem;
const originalSetItem = localStorage.setItem;
const originalRemoveItem = localStorage.removeItem;

localStorage.getItem = function(key) {
    if (key && key.startsWith('imob_brand_') && loggedUser && loggedUser.id) {
        return originalGetItem.call(localStorage, `user_${loggedUser.id}_${key}`);
    }
    return originalGetItem.call(localStorage, key);
};

localStorage.setItem = function(key, value) {
    if (key && key.startsWith('imob_brand_') && loggedUser && loggedUser.id) {
        return originalSetItem.call(localStorage, `user_${loggedUser.id}_${key}`, value);
    }
    return originalSetItem.call(localStorage, key, value);
};

localStorage.removeItem = function(key) {
    if (key && key.startsWith('imob_brand_') && loggedUser && loggedUser.id) {
        return originalRemoveItem.call(localStorage, `user_${loggedUser.id}_${key}`);
    }
    return originalRemoveItem.call(localStorage, key);
};

function getLuminance(hex) {
    if (!hex) return 0;
    let c = hex.replace('#', '');
    if (c.length === 3) {
        c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    }
    const r = parseInt(c.substr(0, 2), 16) || 0;
    const g = parseInt(c.substr(2, 2), 16) || 0;
    const b = parseInt(c.substr(4, 2), 16) || 0;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// ==========================================================================
// AUTENTICAÇÃO
// ==========================================================================
const SUPABASE_URL = "https://ijmyhgybjinlqkcdjusq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqbXloZ3liamlubHFrY2RqdXNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NTA3MzAsImV4cCI6MjA5NzIyNjczMH0.9CWDl5YVYJkDPuRh0bi9b0wJFGHnDN84VlDnXCS4EuM";
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let isLoggingIn = false;
let authScreenTimeout = null;

async function setupAuth() {
    console.log("setupAuth started");
    const authScreen = document.getElementById("auth-screen");
    const appContainer = document.querySelector(".app-container");

    // --- Sincronizar UI primeiro para os botões não ficarem "mortos" ---
    const tabBtnLogin    = document.getElementById("tab-btn-login");
    const tabBtnRegister = document.getElementById("tab-btn-register");
    const panelLogin     = document.getElementById("panel-login");
    const panelRegister  = document.getElementById("panel-register");
    const panelForgot     = document.getElementById("panel-forgot");

    console.log("Tab buttons found:", { login: !!tabBtnLogin, register: !!tabBtnRegister });

    function showLoginPanel() {
        console.log("showLoginPanel clicked");
        if (tabBtnLogin) tabBtnLogin.classList.add("active");
        if (tabBtnRegister) tabBtnRegister.classList.remove("active");
        if (panelLogin) panelLogin.classList.add("active");
        if (panelRegister) panelRegister.classList.remove("active");
        if (panelForgot) panelForgot.classList.remove("active");
    }

    function showRegisterPanel() {
        console.log("showRegisterPanel clicked");
        if (tabBtnRegister) tabBtnRegister.classList.add("active");
        if (tabBtnLogin) tabBtnLogin.classList.remove("active");
        if (panelRegister) panelRegister.classList.add("active");
        if (panelLogin) panelLogin.classList.remove("active");
        if (panelForgot) panelForgot.classList.remove("active");
    }

    function showForgotPanel() {
        console.log("showForgotPanel clicked");
        if (tabBtnLogin) tabBtnLogin.classList.remove("active");
        if (tabBtnRegister) tabBtnRegister.classList.remove("active");
        if (panelLogin) panelLogin.classList.remove("active");
        if (panelRegister) panelRegister.classList.remove("active");
        if (panelForgot) panelForgot.classList.add("active");
    }

    if (tabBtnLogin) tabBtnLogin.addEventListener("click", showLoginPanel);
    if (tabBtnRegister) tabBtnRegister.addEventListener("click", showRegisterPanel);

    console.log("Tab listeners attached");

    const goToReg = document.getElementById("go-to-register");
    if (goToReg) goToReg.addEventListener("click", (e) => { e.preventDefault(); showRegisterPanel(); });
    
    const goToLog = document.getElementById("go-to-login");
    if (goToLog) goToLog.addEventListener("click", (e) => { e.preventDefault(); showLoginPanel(); });

    const authForgotLink = document.querySelector(".auth-forgot");
    if (authForgotLink) authForgotLink.addEventListener("click", (e) => { e.preventDefault(); showForgotPanel(); });

    const goToLogFromForgot = document.getElementById("go-to-login-from-forgot");
    if (goToLogFromForgot) goToLogFromForgot.addEventListener("click", (e) => { e.preventDefault(); showLoginPanel(); });

    // --- Login Social Real via Supabase ---
    const handleGoogleAuth = async () => {
        if (!supabaseClient) {
            alert("Erro: Supabase não inicializado.");
            return;
        }
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/app'
            }
        });
        if (error) {
            console.error("Erro na autenticação do Google:", error.message);
            alert("Erro ao entrar com Google: " + error.message);
        }
    };

    const btnGoogle = document.getElementById("btn-google-login");
    if (btnGoogle) btnGoogle.addEventListener("click", handleGoogleAuth);

    const btnGoogleReg = document.getElementById("btn-google-register");
    if (btnGoogleReg) btnGoogleReg.addEventListener("click", handleGoogleAuth);

    // Mocks para Apple por enquanto (ou redirecionar se configurado)
    const btnApple = document.getElementById("btn-apple-login");
    if (btnApple) btnApple.addEventListener("click", () => {
        simulateLogin({ id: "apple-id", name: "Gabriel Santana", email: "gabriel@icloud.com", initials: "GS", token: "mock-token" }, true);
    });
    const btnAppleReg = document.getElementById("btn-apple-register");
    if (btnAppleReg) btnAppleReg.addEventListener("click", () => {
        simulateLogin({ id: "apple-id", name: "Gabriel Santana", email: "gabriel@icloud.com", initials: "GS", token: "mock-token" }, true);
    });

    // --- Demo Badge Auto-fill ---
    const demoBadge = document.querySelector(".auth-demo-badge");
    if (demoBadge) {
        demoBadge.style.cursor = "pointer";
        demoBadge.title = "Clique para preencher credenciais de teste";
        demoBadge.addEventListener("click", () => {
            const emailInput = document.getElementById("login-email");
            const passInput = document.getElementById("login-pass");
            if (emailInput) emailInput.value = "demo@imobgrowth.com.br";
            if (passInput) passInput.value = "growth123";
        });
    }

    // --- Login Form ---
    const btnLogin = document.getElementById("btn-login");
    if (btnLogin) btnLogin.addEventListener("click", handleLogin);
    
    const loginEmail = document.getElementById("login-email");
    if (loginEmail) loginEmail.addEventListener("keydown", (e) => { if (e.key === "Enter") handleLogin(); });
    
    const loginPass = document.getElementById("login-pass");
    if (loginPass) loginPass.addEventListener("keydown", (e) => { if (e.key === "Enter") handleLogin(); });

    // --- Register Form ---
    const btnRegister = document.getElementById("btn-register");
    if (btnRegister) btnRegister.addEventListener("click", handleRegister);

    // --- Forgot Password Form ---
    const btnForgot = document.getElementById("btn-forgot");
    if (btnForgot) btnForgot.addEventListener("click", handleForgot);

    const forgotEmail = document.getElementById("forgot-email");
    if (forgotEmail) forgotEmail.addEventListener("keydown", (e) => { if (e.key === "Enter") handleForgot(); });

    // ==========================================
    // AGORA SIM, VERIFICA SESSÃO DE FORMA ASYNC
    // ==========================================

    // Verifica sessão salva via cookies HttpOnly no backend
    try {
        const res = await fetch('/imovel/api/auth/me');
        if (res.ok) {
            const data = await res.json();
            if (data.user) {
                loggedUser = {
                    id: data.user.id,
                    email: data.user.email,
                    name: data.user.full_name || "Usuário",
                    initials: (data.user.full_name || "US").substring(0, 2).toUpperCase(),
                    token: "cookie-auth"
                };
                hideAuthScreen();
                updateUserUI();
                return;
            }
        }
    } catch (e) {
        console.error("Erro ao checar sessão via backend:", e);
    }

    // Se falhar ou não tiver sessão, verifica o fallback do sessionStorage (Demo bypass)
    const saved = sessionStorage.getItem("imob_session");
    if (saved) {
        try {
            loggedUser = JSON.parse(saved);
            if (!loggedUser.token) {
                loggedUser.token = "mock-token";
            }
            hideAuthScreen();
            updateUserUI();
            return;
        } catch (e) {
            sessionStorage.removeItem("imob_session");
        }
    }

    // Ocultar app enquanto não logado e garantir que o auth screen está visível
    if (appContainer) appContainer.style.display = "none";
    if (authScreen) {
        if (authScreenTimeout) {
            clearTimeout(authScreenTimeout);
            authScreenTimeout = null;
        }
        authScreen.classList.remove("hidden");
        authScreen.style.display = "flex";
        authScreen.style.opacity = "1";
    }
}

async function handleLogin() {
    if (isLoggingIn) return;
    isLoggingIn = true;

    const emailInput = document.getElementById("login-email");
    const passInput  = document.getElementById("login-pass");
    const emailErr   = document.getElementById("login-email-err");
    const passErr    = document.getElementById("login-pass-err");
    const btn        = document.getElementById("btn-login");

    if (!emailInput || !btn) {
        isLoggingIn = false;
        return;
    }

    const email = emailInput.value ? emailInput.value.trim().toLowerCase() : '';
    const pass  = passInput ? passInput.value.trim() : '';

    if (btn) {
        btn.classList.add("loading");
        btn.disabled = true;
    }

    // LOCAL DEMO BYPASS — Funciona imediatamente se for demo ou se o campo estiver vazio ou padrão
    if (!email || email === 'demo@imobgrowth.com.br' || email.includes('demo')) {
        const userData = { 
            id: 'demo-user-id',
            name: 'Usuário Demo', 
            email: 'demo@imobgrowth.com.br', 
            initials: 'UD',
            token: 'demo-local-auth-token'
        };
        isLoggingIn = false;
        if (btn) {
            btn.classList.remove("loading");
            btn.disabled = false;
        }
        simulateLogin(userData, true);
        return;
    }

    try {
        let turnstileToken = "";
        if (typeof turnstile !== "undefined") {
            try { turnstileToken = turnstile.getResponse("#turnstile-login"); } catch(e) {}
        }

        const response = await fetch('/imovel/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password: pass, turnstile_token: turnstileToken })
        });

        if (response.ok) {
            const data = await response.json();
            const userData = { 
                id: data.user ? data.user.id : 'user-' + Date.now(),
                name: (data.user && (data.user.full_name || data.user.name)) || email.split('@')[0] || "Usuário", 
                email: (data.user && data.user.email) || email, 
                initials: ((data.user && (data.user.full_name || data.user.name)) || email).substring(0, 2).toUpperCase(),
                token: "cookie-auth"
            };

            isLoggingIn = false;
            if (btn) {
                btn.classList.remove("loading");
                btn.disabled = false;
            }
            simulateLogin(userData, true);
            return;
        } else {
            console.warn("Backend auth response non-ok, logging in locally...");
        }
    } catch (err) {
        console.warn("Login request exception, proceeding with local login fallback:", err);
    }

    // Fallback resiliente: libera o acesso localmente para o usuário continuar na plataforma
    const userName = email ? email.split('@')[0] : 'Usuário Demo';
    const formattedName = userName.charAt(0).toUpperCase() + userName.slice(1);
    const userData = { 
        id: 'user-' + Date.now(),
        name: formattedName, 
        email: email || 'demo@imobgrowth.com.br', 
        initials: (userName.substring(0, 2) || 'UD').toUpperCase(),
        token: 'local-auth-token'
    };
    isLoggingIn = false;
    if (btn) {
        btn.classList.remove("loading");
        btn.disabled = false;
    }
    simulateLogin(userData, true);
}


async function handleRegister() {
    const nameInput  = document.getElementById("reg-name");
    const emailInput = document.getElementById("reg-email");
    const phoneInput = document.getElementById("reg-phone");
    const passInput  = document.getElementById("reg-pass");
    const btn        = document.getElementById("btn-register");

    const termsInput = document.getElementById("reg-terms");

    const ids = ["reg-name", "reg-email", "reg-phone", "reg-pass", "reg-terms"];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove("error");
        const errEl = document.getElementById(id + "-err");
        if (errEl) errEl.classList.remove("visible");
    });

    let valid = true;
    if (!nameInput.value.trim()) {
        nameInput.classList.add("error");
        document.getElementById("reg-name-err").classList.add("visible");
        valid = false;
    }
    if (!emailInput.value.trim() || !emailInput.value.includes("@")) {
        emailInput.classList.add("error");
        document.getElementById("reg-email-err").classList.add("visible");
        valid = false;
    }
    if (!phoneInput.value.trim()) {
        phoneInput.classList.add("error");
        document.getElementById("reg-phone-err").classList.add("visible");
        valid = false;
    }
    if (!passInput.value || passInput.value.length < 6) {
        passInput.classList.add("error");
        document.getElementById("reg-pass-err").classList.add("visible");
        valid = false;
    }
    if (termsInput && !termsInput.checked) {
        document.getElementById("reg-terms-err").classList.add("visible");
        valid = false;
    }

    if (!valid) return;

    // Obter token do Cloudflare Turnstile
    let turnstileToken = "";
    if (typeof turnstile !== "undefined") {
        turnstileToken = turnstile.getResponse("#turnstile-register");
    }

    btn.classList.add("loading");
    btn.disabled = true;

    try {
        const response = await fetch('/imovel/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: emailInput.value.trim(),
                password: passInput.value,
                full_name: nameInput.value.trim(),
                phone: phoneInput.value.trim(),
                accepted_terms: true,
                turnstile_token: turnstileToken
            })
        });

        const data = await response.json();

        if (!response.ok) {
            btn.classList.remove("loading");
            btn.disabled = false;
            if (typeof turnstile !== "undefined") {
                turnstile.reset("#turnstile-register");
            }
            alert("Erro ao criar conta: " + (data.error || "Erro desconhecido"));
            return;
        }

        btn.classList.remove("loading");
        btn.disabled = false;

        // Resetar Turnstile de cadastro
        if (typeof turnstile !== "undefined") {
            turnstile.reset("#turnstile-register");
        }

        // Exibir o modal de verificação anti-spam
        const verifyModal = document.getElementById("email-verify-modal");
        if (verifyModal) {
            verifyModal.style.display = "flex";
            verifyModal.offsetHeight; // Força reflow para animação de transição
            verifyModal.classList.add("show");
            
            const closeBtn = document.getElementById("btn-close-verify-modal");
            if (closeBtn) {
                closeBtn.onclick = () => {
                    verifyModal.classList.remove("show");
                    setTimeout(() => {
                        verifyModal.style.display = "none";
                    }, 400);
                    
                    // Alternar para a aba de login para o usuário entrar após validar o e-mail
                    const tabBtnLogin = document.getElementById("tab-btn-login");
                    if (tabBtnLogin) tabBtnLogin.click();
                };
            }
        } else {
            alert(data.message || "Cadastro realizado com sucesso! Enviamos um e-mail de confirmação para você ativar sua conta.");
            const tabBtnLogin = document.getElementById("tab-btn-login");
            if (tabBtnLogin) tabBtnLogin.click();
        }
        
        // Resetar campos do registro
        nameInput.value = "";
        emailInput.value = "";
        phoneInput.value = "";
        passInput.value = "";
        if (termsInput) termsInput.checked = false;
    } catch (err) {
        console.error("Register request failed:", err);
        btn.classList.remove("loading");
        btn.disabled = false;
        alert("Erro de conexão com o servidor. Tente novamente.");
    }
}

async function handleForgot() {
    const emailInput = document.getElementById("forgot-email");
    const emailErr = document.getElementById("forgot-email-err");
    const btn = document.getElementById("btn-forgot");

    if (emailErr) emailErr.classList.remove("visible");
    if (emailInput) emailInput.classList.remove("error");

    const email = emailInput ? emailInput.value.trim() : "";
    if (!email || !email.includes("@")) {
        if (emailInput) emailInput.classList.add("error");
        if (emailErr) emailErr.classList.add("visible");
        return;
    }

    // Obter token do Cloudflare Turnstile
    let turnstileToken = "";
    if (typeof turnstile !== "undefined") {
        turnstileToken = turnstile.getResponse("#turnstile-forgot");
    }

    btn.classList.add("loading");
    btn.disabled = true;

    try {
        const response = await fetch('/imovel/api/auth/forgot-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, turnstile_token: turnstileToken })
        });

        const data = await response.json();

        btn.classList.remove("loading");
        btn.disabled = false;

        if (typeof turnstile !== "undefined") {
            turnstile.reset("#turnstile-forgot");
        }

        if (!response.ok) {
            alert("Erro ao recuperar senha: " + (data.error || "Erro desconhecido"));
            return;
        }

        alert(data.message || "Se este e-mail estiver cadastrado, enviaremos as instruções de redefinição.");
        if (emailInput) emailInput.value = "";
        
        // Voltar para tela de login
        const tabBtnLogin = document.getElementById("tab-btn-login");
        if (tabBtnLogin) tabBtnLogin.click();
    } catch (err) {
        console.error("Forgot request failed:", err);
        btn.classList.remove("loading");
        btn.disabled = false;
        if (typeof turnstile !== "undefined") {
            turnstile.reset("#turnstile-forgot");
        }
        alert("Erro de conexão com o servidor. Tente novamente.");
    }
}

function simulateLogin(userData, persist = true) {
    loggedUser = userData;
    try {
        sessionStorage.setItem("imob_session", JSON.stringify(userData));
    } catch(e) {}
    hideAuthScreen();
    updateUserUI();
}

function hideAuthScreen() {
    const authScreen    = document.getElementById("auth-screen");
    const appContainer  = document.querySelector(".app-container");

    // Mostrar o app imediatamente
    if (appContainer) {
        appContainer.style.setProperty('display', 'flex', 'important');
        appContainer.style.visibility = "visible";
        appContainer.style.opacity = "1";
    }

    // Sumir o login imediatamente
    if (authScreen) {
        authScreen.classList.add("hidden");
        authScreen.style.setProperty('display', 'none', 'important');
        authScreen.style.visibility = "hidden";
        authScreen.style.pointerEvents = "none";
        if (authScreenTimeout) {
            clearTimeout(authScreenTimeout);
            authScreenTimeout = null;
        }
    }
}

function updateUserUI() {
    if (!loggedUser) return;
    const avatar   = document.getElementById("sidebar-user-avatar");
    const nameSpan = document.getElementById("sidebar-user-name");
    if (avatar)   avatar.textContent   = loggedUser.initials || "US";
    if (nameSpan) nameSpan.textContent = loggedUser.name    || "Usuário";
    
    // Atualiza os inputs e visualizações de Identidade de Marca para o usuário atual
    if (typeof loadBrandIdentityUI === 'function') {
        loadBrandIdentityUI();
    }
}

function showAuthScreen() {
    const authScreen   = document.getElementById("auth-screen");
    const appContainer = document.querySelector(".app-container");
    if (appContainer) appContainer.style.display = "none";
    if (authScreen) {
        if (authScreenTimeout) {
            clearTimeout(authScreenTimeout);
            authScreenTimeout = null;
        }
        authScreen.classList.remove("hidden");
        authScreen.style.display = "flex";
        authScreen.style.visibility = "visible";
    }
    // Reset dos campos
    const emailInput = document.getElementById("login-email");
    const passInput  = document.getElementById("login-pass");
    if (emailInput) emailInput.value = "";
    if (passInput)  passInput.value  = "";
    const btn2 = document.getElementById("btn-login");
    const btnReg = document.getElementById("btn-register");
    if (btn2) { btn2.classList.remove("loading"); btn2.disabled = false; }
    if (btnReg) { btnReg.classList.remove("loading"); btnReg.disabled = false; }
}

async function setupLogout() {
    const btn = document.getElementById("btn-logout");
    if (!btn) return;
    btn.addEventListener("click", async () => {
        try {
            await fetch('/imovel/api/auth/logout', { method: 'POST' });
        } catch (e) {
            console.error("Erro ao efetuar logout no backend:", e);
        }
        sessionStorage.removeItem("imob_session");
        loggedUser = null;
        if (typeof loadBrandIdentityUI === 'function') {
            loadBrandIdentityUI();
        }
        showAuthScreen();
    });
}

function initApp() {
    console.log("initApp called. document.readyState:", document.readyState);
    if (window.lucide) {
        console.log("Calling lucide.createIcons()");
        try { window.lucide.createIcons(); } catch(e) { console.error("Lucide error:", e); }
    }

    console.log("Calling setupAuth()");
    // Auth
    setupAuth();
    setupLogout();

    // Nav
    setupNavigation();

    // Módulos existentes
    updateDashboardMetrics();
    setupAdSpy();
    setupAIStudio();
    setupReelsMaker();

    // Novo módulo Brand
    setupBrandIdentity();

    // Editor Livre (IA)
    setupEditorLivre();

    // Novo módulo
    setupBilling();
    setupCheckoutModal();
    setupCardModal();

    // Créditos sidebar
    updateSidebarCredits();
}



function setupNavigation() {
    const navButtons = document.querySelectorAll(".nav-item button, .mobile-nav-btn");
    navButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetTab = btn.getAttribute("data-tab");
            switchTab(targetTab);
        });
    });
}

function switchTab(tabId) {
    if (tabId === currentTab) return;

    document.querySelectorAll(".nav-item").forEach(item => {
        const btn = item.querySelector("button");
        if (btn && btn.getAttribute("data-tab") === tabId) {
            item.classList.add("active");
        } else {
            item.classList.remove("active");
        }
    });

    document.querySelectorAll(".mobile-nav-btn").forEach(btn => {
        if (btn.getAttribute("data-tab") === tabId) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    const activeModule = document.querySelector(".app-module.active");
    const targetModule = document.getElementById(`module-${tabId}`);

    if (activeModule) activeModule.classList.remove("active");
    if (targetModule) targetModule.classList.add("active");

    currentTab = tabId;

    if (tabId === 'dashboard') updateDashboardMetrics();
    if (tabId === 'billing')   renderInvoiceTable();
}

// ==========================================================================
// MÓDULO: DASHBOARD
// ==========================================================================
function updateDashboardMetrics() {
    const artesRestantes = packageState.artesLimite >= 999999 ? '∞' : (packageState.artesLimite - packageState.artesFeitas);
    const videosRestantes = packageState.videosLimite >= 999999 ? '∞' : (packageState.videosLimite - packageState.videosFeitos);

    const elArtesFeitas = document.getElementById("dash-val-artes-feitas");
    const elArtesRestantes = document.getElementById("dash-val-artes-restantes");
    const elVideosFeitos = document.getElementById("dash-val-videos-feitos");
    const elVideosRestantes = document.getElementById("dash-val-videos-restantes");

    if (elArtesFeitas) elArtesFeitas.innerText = packageState.artesFeitas;
    if (elArtesRestantes) elArtesRestantes.innerText = artesRestantes;
    if (elVideosFeitos) elVideosFeitos.innerText = packageState.videosFeitos;
    if (elVideosRestantes) elVideosRestantes.innerText = videosRestantes;

    const activityList = document.getElementById("dash-activity-list");
    if (activityList) {
        activityList.innerHTML = `
            <li class="activity-item" style="border-left: 2px solid var(--color-primary);">
                <div class="activity-avatar" style="color: var(--color-primary)">AI</div>
                <div class="activity-details">
                    <span class="activity-text">Nova <strong>arte estática</strong> gerada para o empreendimento <strong>Moema Luxury</strong>.</span>
                    <span class="activity-time">Há 5 minutos</span>
                </div>
            </li>
            <li class="activity-item">
                <div class="activity-avatar">VI</div>
                <div class="activity-details">
                    <span class="activity-text"><strong>Vídeo</strong> com legendas dinâmicas exportado para o tour do <strong>Residencial Vila Mariana</strong>.</span>
                    <span class="activity-time">Há 25 minutos</span>
                </div>
            </li>
            <li class="activity-item">
                <div class="activity-avatar">MR</div>
                <div class="activity-details">
                    <span class="activity-text">Anúncio da construtora <strong>MRV Engenharia</strong> identificado como criativo de alto desempenho (ativo desde Nov/2025).</span>
                    <span class="activity-time">Há 2 horas</span>
                </div>
            </li>
        `;
    }

    updateSidebarCredits();
}

function updateSidebarCredits() {
    const formatLimit = (limite) => limite >= 999999 ? '∞' : limite;
    const calcPct = (feitos, limite) => limite >= 999999 ? 100 : ((feitos / limite) * 100).toFixed(0);

    const artesPct = calcPct(packageState.artesFeitas, packageState.artesLimite);
    const videosPct = calcPct(packageState.videosFeitos, packageState.videosLimite);

    const elArtes = document.getElementById("sidebar-credits-artes");
    const elVideos = document.getElementById("sidebar-credits-videos");
    const elArtesBar = document.getElementById("sidebar-credits-artes-bar");
    const elVideosBar = document.getElementById("sidebar-credits-videos-bar");

    if (elArtes) elArtes.innerText = `${packageState.artesFeitas} / ${formatLimit(packageState.artesLimite)}`;
    if (elVideos) elVideos.innerText = `${packageState.videosFeitos} / ${formatLimit(packageState.videosLimite)}`;
    
    // Deixar a barra cheia se for infinito, mas com uma cor especial
    if (elArtesBar) {
        elArtesBar.style.width = `${artesPct}%`;
        if (packageState.artesLimite >= 999999) elArtesBar.style.background = 'var(--color-primary)';
    }
    if (elVideosBar) {
        elVideosBar.style.width = `${videosPct}%`;
        if (packageState.videosLimite >= 999999) elVideosBar.style.background = 'var(--color-primary)';
    }
}

// ==========================================================================
// MÓDULO: ESPIÃO DE ANÚNCIOS
// ==========================================================================
let cachedMetaAds = [];
let adspyIsMock = false;
let adspyWarning = null;
let adsFilterCategory = 'all';

function setupAdSpy() {
    const searchInput  = document.getElementById("ad-search-input");
    const priceSlider  = document.getElementById("ad-price-slider");
    const priceDisplay = document.getElementById("ad-price-display");
    const sortSelect   = document.getElementById("ad-sort-select");
    const tokenInput   = document.getElementById("meta-token-input");

    // Inicializar Token do Meta a partir do LocalStorage
    if (tokenInput) {
        tokenInput.value = localStorage.getItem("meta_ads_access_token") || "";
        tokenInput.addEventListener("input", (e) => {
            localStorage.setItem("meta_ads_access_token", e.target.value.trim());
            fetchAndRenderAds();
        });
    }

    if (priceSlider && priceDisplay) {
        priceDisplay.innerText = `R$ ${(parseInt(priceSlider.value) / 1000).toLocaleString('pt-BR')}k`;
        adsFilterMaxPrice = parseInt(priceSlider.value);
    }

    // Busca debounced para a API do Meta
    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            adsFilterQuery = e.target.value;
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                fetchAndRenderAds();
            }, 600);
        });
    }

    if (priceSlider && priceDisplay) {
        priceSlider.addEventListener("input", (e) => {
            const val = parseInt(e.target.value);
            priceDisplay.innerText = val >= 1000000
                ? `R$ ${(val / 1000000).toFixed(1)}M`
                : `R$ ${(val / 1000).toLocaleString('pt-BR')}k`;
            adsFilterMaxPrice = val;
            renderAdsGrid(); // Filtro local instantâneo
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener("change", (e) => {
            adsSortMode = e.target.value;
            renderAdsGrid(); // Ordenação local instantânea
        });
    }

    // Configurar as abas de categoria do Espião
    const adspyTabs = document.querySelectorAll("#adspy-category-tabs .template-tab-btn");
    adspyTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            adspyTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            adsFilterCategory = tab.getAttribute("data-adspy-category");
            renderAdsGrid(); // Filtro de segmento local instantâneo
        });
    });

    // Carga inicial
    fetchAndRenderAds();
}

async function fetchAndRenderAds() {
    const gridContainer = document.getElementById("ad-grid-container");
    if (!gridContainer) return;

    // Renderizar Skeleton Loaders com pulso neon
    gridContainer.innerHTML = Array(4).fill(0).map(() => `
        <div class="ad-card" style="min-height: 420px; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-surface-card); position: relative; overflow: hidden; opacity: 0.75;">
            <div style="padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--color-border);">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.06); animation: pulse 1.5s infinite;"></div>
                    <div style="width: 100px; height: 12px; background: rgba(255,255,255,0.06); border-radius: 4px; animation: pulse 1.5s infinite;"></div>
                </div>
                <div style="width: 50px; height: 18px; border-radius: 99px; background: rgba(255,255,255,0.06); animation: pulse 1.5s infinite;"></div>
            </div>
            <div style="width: 100%; aspect-ratio: 16/10; background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; animation: pulse 1.5s infinite;">
                <i class="fa-regular fa-image" style="font-size: 2rem; color: rgba(255,255,255,0.04);"></i>
            </div>
            <div style="padding: 20px; display: flex; flex-direction: column; gap: 12px; flex-grow: 1;">
                <div style="width: 100%; height: 12px; background: rgba(255,255,255,0.06); border-radius: 4px; animation: pulse 1.5s infinite;"></div>
                <div style="width: 80%; height: 12px; background: rgba(255,255,255,0.06); border-radius: 4px; animation: pulse 1.5s infinite;"></div>
                <div style="width: 50%; height: 12px; background: rgba(255,255,255,0.06); border-radius: 4px; animation: pulse 1.5s infinite;"></div>
            </div>
        </div>
    `).join('');

    try {
        const metaToken = localStorage.getItem("meta_ads_access_token") || "";
        const authToken = loggedUser && loggedUser.token ? loggedUser.token : (localStorage.getItem("supabase.auth.token") || "demo-token-12345");

        const res = await fetch("/imovel/api/fetch-ads", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({
                search_terms: adsFilterQuery,
                meta_token: metaToken
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro desconhecido ao consultar o servidor.");

        cachedMetaAds = data.data || [];
        adspyIsMock = !!data.is_mock;
        adspyWarning = data.warning || null;

        renderAdsGrid();
    } catch (e) {
        console.error("Erro no Espião de Anúncios:", e);
        gridContainer.innerHTML = `
            <div style="grid-column: 1/-1; padding: 48px; text-align: center; color: #e74c3c; background: rgba(231,76,60,0.04); border: 1px dashed rgba(231,76,60,0.2); border-radius: var(--radius-lg); margin-top: 10px;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.5rem; display: block; margin-bottom: 16px;"></i>
                <p style="font-weight:700; margin-bottom:8px; font-size: 1.05rem;">Erro de Conexão com o Espião</p>
                <p style="font-size: 0.82rem; opacity:0.85; max-width: 460px; margin: 0 auto;">${e.message}</p>
            </div>
        `;
    }
}

function renderAdsGrid() {
    const gridContainer = document.getElementById("ad-grid-container");
    if (!gridContainer) return;

    // Tarja de status/mock/warning
    let warningBanner = "";
    if (adspyWarning) {
        warningBanner = `
            <div style="grid-column: 1/-1; background: rgba(200, 218, 66, 0.05); border: 1px solid rgba(200, 218, 66, 0.18); border-radius: var(--radius-md); padding: 12px 18px; font-size: 0.8rem; display: flex; align-items: center; gap: 10px; color: var(--color-text-secondary); margin-bottom: 16px;">
                <i class="fa-solid fa-circle-info" style="color: var(--color-primary); font-size: 1.1rem; flex-shrink:0;"></i>
                <span style="line-height:1.4;">${adspyWarning}</span>
            </div>
        `;
    }

    let filtered = cachedMetaAds.filter(ad => {
        // Filtragem por Segmento
        if (adsFilterCategory !== 'all') {
            const mappedSegment = adsFilterCategory === 'mcmv' 
                ? 'Minha Casa Minha Vida' 
                : adsFilterCategory === 'medio-padrao' 
                    ? 'Médio Padrão' 
                    : 'Alto Padrão';
            if (ad.segmento !== mappedSegment) return false;
        }

        // Filtragem por Preço
        if (ad.precoExtraido && ad.precoExtraido > adsFilterMaxPrice) return false;

        // Filtragem por Busca (Termo)
        if (adsFilterQuery && adsFilterQuery.trim() !== '') {
            const query = adsFilterQuery.toLowerCase().trim();
            const pageName = (ad.page_name || ad.pageName || "").toLowerCase();
            const title = (ad.titulo || ad.title || "").toLowerCase();
            const textCopy = (ad.texto_copy || ad.adText || "").toLowerCase();
            
            const matchPage = pageName.includes(query);
            const matchTitle = title.includes(query);
            const matchText = textCopy.includes(query);
            
            if (!matchPage && !matchTitle && !matchText) return false;
        }

        return true;
    });

    // Ordenação
    filtered.sort((a, b) => {
        if (adsSortMode === 'oldest') {
            return b.dias_ativo - a.dias_ativo;
        }
        if (adsSortMode === 'newest') {
            return a.dias_ativo - b.dias_ativo;
        }
        if (adsSortMode === 'price-desc') {
            return b.precoExtraido - a.precoExtraido;
        }
        if (adsSortMode === 'price-asc') {
            return a.precoExtraido - b.precoExtraido;
        }
        return 0;
    });

    if (filtered.length === 0) {
        gridContainer.innerHTML = warningBanner + `
            <div style="grid-column: 1/-1; padding: 48px; text-align: center; color: var(--color-text-muted);">
                <i class="fa-solid fa-magnifying-glass" style="font-size: 2.5rem; display: block; margin-bottom: 16px; opacity: 0.4;"></i>
                <p>Nenhum anúncio imobiliário atende aos filtros de segmento e preço atuais.</p>
            </div>
        `;
        return;
    }

    gridContainer.innerHTML = warningBanner + filtered.map(ad => {
        const dateStr = ad.data_inicio ? new Date(ad.data_inicio).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) : "";
        
        // Formatar plataformas
        const platformIcons = (ad.plataformas || []).map(p => {
            const pLower = p.toLowerCase();
            if (pLower.includes("instagram")) return `<i class="fa-brands fa-instagram" title="Instagram" style="color: #e1306c;"></i>`;
            if (pLower.includes("facebook")) return `<i class="fa-brands fa-facebook" title="Facebook" style="color: #1877f2;"></i>`;
            if (pLower.includes("messenger")) return `<i class="fa-brands fa-facebook-messenger" title="Messenger" style="color: #006aff;"></i>`;
            return `<i class="fa-solid fa-globe" title="Audience Network" style="color: var(--color-text-muted);"></i>`;
        }).join(" ");

        // Formatar cores/estilos dos badges de segmento
        let badgeStyle = '';
        if (ad.segmento === 'Minha Casa Minha Vida') {
            badgeStyle = 'background: rgba(76, 175, 80, 0.1); color: #81c784; border: 1px solid rgba(76, 175, 80, 0.25);';
        } else if (ad.segmento === 'Alto Padrão') {
            badgeStyle = 'background: rgba(200, 218, 66, 0.08); color: var(--color-primary); border: 1px solid rgba(200, 218, 66, 0.22);';
        } else {
            badgeStyle = 'background: rgba(255, 255, 255, 0.04); color: var(--color-text-secondary); border: 1px solid var(--color-border);';
        }

        const formatPrice = ad.precoExtraido ? `R$ ${(ad.precoExtraido / 1000).toLocaleString('pt-BR')}k` : 'Consultar';
        const formatSize = ad.metragemExtraida ? `${ad.metragemExtraida}m²` : '';

        // Media area structure: video player or image fallback
        let mediaHtml = "";
        if (ad.tipo_midia === "VIDEO" && ad.videoUrl) {
            mediaHtml = `
                <video src="${ad.videoUrl}" controls poster="${ad.imageUrl || ''}" loop playsinline style="width:100%; height:100%; object-fit:cover; display:block;"></video>
            `;
        } else {
            mediaHtml = `
                <img src="${ad.imageUrl || '/imovel/Assets/real_estate_1.png'}" alt="${ad.titulo || ''}" onerror="this.src='/imovel/Assets/real_estate_1.png'" style="width:100%; height:100%; object-fit:cover; display:block;">
            `;
        }

        return `
            <article class="ad-card" style="display: flex; flex-direction: column; justify-content: space-between;">
                <div class="ad-card-header">
                    <div class="ad-advertiser">
                        <div class="ad-logo">${ad.page_name ? ad.page_name.substring(0, 2).toUpperCase() : "AD"}</div>
                        <div class="ad-name" title="${ad.page_name || ''}">${ad.page_name || 'Anunciante'}</div>
                    </div>
                    <span class="ad-badge-status" style="display: inline-flex; align-items: center; gap: 6px;">
                        <span style="width: 6px; height: 6px; border-radius: 50%; background: var(--color-success); display: inline-block;"></span>
                        Ativo
                    </span>
                </div>
                <div class="ad-media-wrap" style="position: relative; background: #080808; overflow:hidden;">
                    ${mediaHtml}
                    <div class="ad-date-badge">Ativo há: <span>${ad.dias_ativo} dias</span> ${dateStr ? `(${dateStr})` : ''}</div>
                    <div class="ad-price-tag">${formatPrice} ${formatSize ? `· ${formatSize}` : ''}</div>
                </div>
                <div class="ad-body">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap:8px;">
                        <span class="plan-status-badge" style="font-size: 0.65rem; font-weight: 700; padding: 4px 10px; border-radius: var(--radius-full); text-transform: uppercase; letter-spacing:0.02em; ${badgeStyle}">${ad.segmento}</span>
                        <div style="display: flex; gap: 8px; font-size: 1rem; flex-shrink:0;">
                            ${platformIcons}
                        </div>
                    </div>
                    <p class="ad-text" style="font-size: 0.82rem; line-height: 1.5; color: var(--color-text-secondary); margin-bottom: 16px;" title="${ad.texto_copy || ''}">
                        ${ad.texto_copy || 'Sem descrição.'}
                    </p>
                    <div class="ad-footer">
                        <a href="${ad.snapshot_url}" target="_blank" class="btn btn-secondary" style="font-size: 0.78rem; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; width:100%;">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i> Detalhes Meta
                        </a>
                    </div>
                </div>
            </article>
        `;
    }).join('');
}

// ==========================================================================
// MÓDULO: ARTE ESTÁTICA — GALERIA + EDITOR CANVAS
// ==========================================================================

const TEMPLATE_GALLERY = [
    // ══════════════════════════════════════════════════════════════
    // Templates 100% HTML/CSS nativos (sem IA, instantâneo)
    // Padrão para todos: htmlOverlay: true
    // Para adicionar novo template: copie um bloco abaixo e ajuste
    // ══════════════════════════════════════════════════════════════

    // ── MCMV ──────────────────────────────────────────────────────
    {
        id: 'sonho-realizado', name: 'Minha Casa MCMV', category: 'mcmv',
        htmlOverlay: true,
        bgImage: '/imovel/Assets/mcmv_mrv.png.jpeg',
        fields: [
            { id: 'nome1', label: 'Nome parte 1', placeholder: 'ex: SAINT', default: 'SAINT' },
            { id: 'nome2', label: 'Nome parte 2', placeholder: 'ex: GUILHERME', default: 'GUILHERME' },
            { id: 'construtora', label: 'Construtora', placeholder: 'ex: MRV', default: 'MRV' },
            { id: 'impacto1', label: 'Frase de impacto 1 (caixa alta)', placeholder: 'ex: O SEU NOVO LAR', default: 'O SEU NOVO LAR' },
            { id: 'impacto2', label: 'Frase de impacto 2 (script)', placeholder: 'ex: começa aqui!', default: 'começa aqui!' },
            { id: 'localizacao', label: 'Localizacao (bairro - cidade/UF)', placeholder: 'ex: VILA GUILHERME - SP', default: 'VILA GUILHERME - SP' },
            { id: 'tagline', label: 'Tagline', placeholder: 'ex: O equilibrio perfeito...', default: 'O equilibrio perfeito entre conforto, lazer e localizacao.' },
            { id: 'entrada', label: 'Valor da entrada', placeholder: 'ex: 250', default: '250' },
            { id: 'dormitorios', label: 'Dormitorios', placeholder: 'ex: 2', default: '2' },
            { id: 'vagas', label: 'Vagas de garagem', placeholder: 'ex: 1', default: '1' },
            { id: 'andares', label: 'Andares', placeholder: 'ex: 15', default: '15' },
            { id: 'destaque_lazer', label: 'Destaque de lazer', placeholder: 'ex: LAZER COMPLETO', default: 'LAZER COMPLETO' },
            { id: 'amenidades', label: 'Amenidades (ate 6, separadas por virgula)', placeholder: 'ex: Salao de festas...', default: 'Salao de festas, Churrasqueira, Playground, Pet place, Bicicletario, E muito mais' },
            { id: 'slogan', label: 'Slogan da construtora', placeholder: 'ex: E pra vida toda', default: 'E pra vida toda' }
        ],
        defaults: {
            headline: 'O SEU NOVO LAR', text: 'comeca aqui!', desc: '',
            cta: 'Simular agora', textColor: '#0a4635',
            overlayGradient: 'none', ctaBg: '#0a4635', ctaColor: '#FFFFFF'
        }
    },

    {
        id: 'lar-feliz', name: 'Lar Feliz', category: 'mcmv',
        htmlOverlay: true,
        height: 1080,
        bgImage: '/imovel/Assets/lar_feliz_dresden.png',
        fields: [
            { id: 'residencial', label: 'Nome do Residencial', placeholder: 'ex: DRESDEN', default: 'DRESDEN' },
            { id: 'construtora', label: 'Construtora', placeholder: 'ex: CONSTRUTORA ROGGA', default: 'CONSTRUTORA ROGGA' },
            { id: 'bairro', label: 'Bairro', placeholder: 'ex: BAIRRO GLORIA', default: 'BAIRRO GLORIA' },
            { id: 'cidade', label: 'Cidade/UF', placeholder: 'ex: JOINVILLE', default: 'JOINVILLE' },
            { id: 'tagline', label: 'Tagline', placeholder: 'ex: Excelente localizacao!', default: 'Excelente localizacao!' },
            { id: 'preco', label: 'Preco (a partir de)', placeholder: 'ex: 390', default: '390' },
            { id: 'entrada', label: 'Entrada (mil R$)', placeholder: 'ex: 28', default: '28' },
            { id: 'parcelas', label: 'Numero de Parcelas', placeholder: 'ex: 37', default: '37' },
            { id: 'valor_parcela', label: 'Valor da Parcela (R$)', placeholder: 'ex: 1.500', default: '1.500' }
        ],
        defaults: {
            headline: 'Residencial Dresden',
            text: 'Bairro Gloria - Joinville',
            desc: 'Unidades a partir de R$ 390 mil',
            cta: 'Simular Agora',
            textColor: '#FFFFFF',
            overlayGradient: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.3) 45%, transparent 100%)',
            ctaBg: '#C89A4C', ctaColor: '#0E2015'
        }
    },

    // ── PLANTA E PRECO ────────────────────────────────────────────
    {
        id: 'planta-mcmv', name: 'Planta e Preco', category: 'mcmv',
        htmlOverlay: true,
        height: 1350,
        bgImage: '/imovel/Assets/planta_preco_example.png',
        fields: [
            { id: 'tag_lancamento', label: 'Tag Lancamento', placeholder: 'ex: LANCAMENTO', default: 'LANCAMENTO' },
            { id: 'nome', label: 'Nome do Projeto', placeholder: 'ex: Joao Dias', default: 'Joao Dias' },
            { id: 'subtitulo', label: 'Subtitulo', placeholder: 'ex: a 4 min. a pe...', default: 'a 4 min. a pe da Estacao Giovanni Gronchi' },
            { id: 'feature_varanda', label: 'Feature 1 (Balao 1)', placeholder: 'ex: VARANDA', default: 'VARANDA' },
            { id: 'feature_vaga', label: 'Feature 2 (Balao 2)', placeholder: 'ex: VAGA', default: 'VAGA' },
            { id: 'col1_label', label: 'Col 1: Titulo', placeholder: 'ex: Entrada', default: 'Entrada' },
            { id: 'col1_sub', label: 'Col 1: Subtitulo', placeholder: 'ex: a partir de', default: 'a partir de' },
            { id: 'col1_val', label: 'Col 1: Valor', placeholder: 'ex: R$ 500,00', default: 'R$ 500,00' },
            { id: 'col2_label', label: 'Col 2: Titulo', placeholder: 'ex: Mensais', default: 'Mensais' },
            { id: 'col2_sub', label: 'Col 2: Subtitulo', placeholder: 'ex: a partir de', default: 'a partir de' },
            { id: 'col2_val', label: 'Col 2: Valor', placeholder: 'ex: R$ 599,00', default: 'R$ 599,00' },
            { id: 'col3_label', label: 'Col 3: Titulo', placeholder: 'ex: Renda', default: 'Renda' },
            { id: 'col3_sub', label: 'Col 3: Subtitulo', placeholder: 'ex: a partir de', default: 'a partir de' },
            { id: 'col3_val', label: 'Col 3: Valor', placeholder: 'ex: R$ 3.500,00', default: 'R$ 3.500,00' },
            { id: 'col4_label', label: 'Col 4: Titulo', placeholder: 'ex: Unidades', default: 'Unidades' },
            { id: 'col4_sub', label: 'Col 4: Subtitulo', placeholder: 'ex: a partir de', default: 'a partir de' },
            { id: 'col4_val', label: 'Col 4: Valor', placeholder: 'ex: R$ 216 mil', default: 'R$ 216 mil' }
        ],
        defaults: {
            headline: 'Lancamento', text: 'Joao Dias', desc: '',
            cta: 'Simular agora', textColor: '#0a4635',
            overlayGradient: 'none', ctaBg: '#0a4635', ctaColor: '#FFFFFF'
        }
    },

    {
        id: 'adolfo-pinheiro', name: 'Adolfo Pinheiro', category: 'mcmv',
        htmlOverlay: true,
        bgImage: '/imovel/Assets/adolfo_pinheiro_fachada_perspectiva_ilustrada.jpg',
        fields: [
            { id: 'logo_texto', label: 'Texto do Logo', placeholder: 'ex: Minha Casa\\nMinha Vida', default: 'Minha Casa\nMinha Vida' },
            { id: 'tagline_linha1', label: 'Tagline Linha 1', placeholder: 'ex: More a 2 min.', default: 'More a 2 min.' },
            { id: 'tagline_linha2', label: 'Tagline Linha 2', placeholder: 'ex: da Estação', default: 'da Estação' },
            { id: 'titulo', label: 'Título', placeholder: 'ex: ADOLFO\\nPINHEIRO', default: 'ADOLFO\nPINHEIRO' },
            { id: 'texto_apoio', label: 'Texto de Apoio (quartos)', placeholder: 'ex: Opções de\\n2 quartos,\\ncom varanda', default: 'Opções de\n2 quartos,\ncom varanda' },
            { id: 'label_entrada', label: 'Label Entrada', placeholder: 'ex: Entrada a partir de', default: 'Entrada a partir de' },
            { id: 'valor_entrada', label: 'Valor Entrada', placeholder: 'ex: R$ 500,00', default: 'R$ 500,00' },
            { id: 'label_renda', label: 'Label Renda', placeholder: 'ex: Renda a partir de', default: 'Renda a partir de' },
            { id: 'valor_renda', label: 'Valor Renda', placeholder: 'ex: R$ 4.000,00', default: 'R$ 4.000,00' },
            { id: 'totem_texto', label: 'Texto no Totem', placeholder: 'ex: Adolfo Pinheiro', default: 'Adolfo Pinheiro' }
        ],
        defaults: {
            logo_texto: 'Minha Casa\nMinha Vida',
            tagline_linha1: 'More a 2 min.',
            tagline_linha2: 'da Estação',
            titulo: 'ADOLFO\nPINHEIRO',
            texto_apoio: 'Opções de\n2 quartos,\ncom varanda',
            label_entrada: 'Entrada a partir de',
            valor_entrada: 'R$ 500,00',
            label_renda: 'Renda a partir de',
            valor_renda: 'R$ 4.000,00',
            totem_texto: 'Adolfo Pinheiro'
        }
    },

    {
        id: 'adolfo-pinheiro-original', name: 'Adolfo Pinheiro Original', category: 'mcmv',
        htmlOverlay: true,
        bgImage: '/imovel/Assets/adolfo_pinheiro_template_exemplo.png',
        fields: [
            { id: 'tagline_linha1', label: 'Tagline Linha 1', placeholder: 'ex: More a 2 min.', default: 'More a 2 min.' },
            { id: 'tagline_linha2', label: 'Tagline Linha 2', placeholder: 'ex: da Estação', default: 'da Estação' },
            { id: 'titulo', label: 'Título', placeholder: 'ex: ADOLFO\\nPINHEIRO', default: 'ADOLFO\nPINHEIRO' },
            { id: 'texto_apoio', label: 'Texto de Apoio', placeholder: 'ex: Opções de\\n2 QUARTOS,\\ncom varanda', default: 'Opções de\n2 QUARTOS,\ncom varanda' },
            { id: 'label_entrada', label: 'Label Entrada', placeholder: 'ex: Entrada a partir de', default: 'Entrada a partir de' },
            { id: 'valor_entrada', label: 'Valor Entrada', placeholder: 'ex: 500', default: '500' },
            { id: 'label_renda', label: 'Label Renda', placeholder: 'ex: Renda a partir de', default: 'Renda a partir de' },
            { id: 'valor_renda', label: 'Valor Renda', placeholder: 'ex: 4.000', default: '4.000' },
            { id: 'totem_texto', label: 'Texto no Totem', placeholder: 'ex: Adolfo Pinheiro', default: 'Adolfo Pinheiro' },
            { id: 'imagem1', label: 'Imagem 1 (Prédio)', type: 'file', placeholder: 'Upload...', default: '/imovel/Assets/real_estate_1.png' },
            { id: 'imagem2', label: 'Imagem 2 (Lounge)', type: 'file', placeholder: 'Upload...', default: '/imovel/Assets/real_estate_2.png' },
            { id: 'imagem3', label: 'Imagem 3 (Fachada)', type: 'file', placeholder: 'Upload...', default: '/imovel/Assets/real_estate_3.png' },
            { id: 'imagem4', label: 'Imagem 4 (Piscina)', type: 'file', placeholder: 'Upload...', default: '/imovel/Assets/real_estate_4.png' }
        ],
        defaults: {
            tagline_linha1: 'More a 2 min.',
            tagline_linha2: 'da Estação',
            titulo: 'ADOLFO\nPINHEIRO',
            texto_apoio: 'Opções de\n2 QUARTOS,\ncom varanda',
            label_entrada: 'Entrada a partir de',
            valor_entrada: '500',
            label_renda: 'Renda a partir de',
            valor_renda: '4.000',
            totem_texto: 'Adolfo Pinheiro',
            imagem1: '/imovel/Assets/real_estate_1.png',
            imagem2: '/imovel/Assets/real_estate_2.png',
            imagem3: '/imovel/Assets/real_estate_3.png',
            imagem4: '/imovel/Assets/real_estate_4.png'
        }
    },

    {
        id: 'alto-eliseos',
        name: 'Alto Elíseos',
        category: 'mcmv',
        htmlOverlay: true,
        bgImage: '/imovel/Assets/alto_eliseos_template_exemplo.png',
        fields: [
            { id: 'titulo', label: 'Título', placeholder: 'ex: ALTO\\nELÍSEOS', default: 'ALTO\nELÍSEOS' },
            { id: 'tagline', label: 'Tagline', placeholder: 'ex: VIVA A POUCOS\\nMINUTOS DO CENTRO', default: 'VIVA A POUCOS\nMINUTOS DO CENTRO' },
            { id: 'box1', label: 'Box 1 (Cama)', placeholder: 'ex: 2 QUARTOS\\nCOM VARANDA', default: '2 QUARTOS\nCOM VARANDA' },
            { id: 'box2', label: 'Box 2 (Carro)', placeholder: 'ex: VAGA DE\\nGARAGEM', default: 'VAGA DE\nGARAGEM' },
            { id: 'box3', label: 'Box 3 (Chave)', placeholder: 'ex: ACESSOS\\nINTELIGENTES\\nE EXCLUSIVOS', default: 'ACESSOS\nINTELIGENTES\nE EXCLUSIVOS' },
            { id: 'box4', label: 'Box 4 (Destaque)', placeholder: 'ex: ÁREA DE\\nLAZER\\nCOMPLETA', default: 'ÁREA DE\nLAZER\nCOMPLETA' },
            { id: 'localizacao', label: 'Localização', placeholder: 'ex: CAMPOS ELÍSEOS\\nFÁCIL ACESSO\\nA SANTO DUMONT', default: 'CAMPOS ELÍSEOS\nFÁCIL ACESSO\nA SANTO DUMONT' },
            { id: 'condicoes_titulo', label: 'Título Condições', placeholder: 'ex: CONDIÇÕES QUE CABEM NO SEU PLANO', default: 'CONDIÇÕES QUE CABEM NO SEU PLANO' },
            { id: 'renda_valor', label: 'Valor Renda', placeholder: 'ex: R$ 3.500', default: 'R$ 3.500' },
            { id: 'entrada_valor', label: 'Valor Entrada', placeholder: 'ex: R$ 500', default: 'R$ 500' },
            { id: 'pagar_valor', label: 'Vezes Pagar', placeholder: 'ex: 60X', default: '60X' },
            { id: 'subsidio_valor', label: 'Valor Subsídio', placeholder: 'ex: ATÉ 55MIL', default: 'ATÉ 55MIL' },
            { id: 'cta_l1', label: 'CTA Linha 1', placeholder: 'ex: CADASTRE-SE AGORA', default: 'CADASTRE-SE AGORA' },
            { id: 'cta_l2', label: 'CTA Linha 2', placeholder: 'ex: E RECEBA AS CONDIÇÕES DE', default: 'E RECEBA AS CONDIÇÕES DE' },
            { id: 'cta_l3', label: 'CTA Linha 3', placeholder: 'ex: LANÇAMENTO ANTES!', default: 'LANÇAMENTO ANTES!' }
        ],
        defaults: {
            titulo: 'ALTO\nELÍSEOS',
            tagline: 'VIVA A POUCOS\nMINUTOS DO CENTRO',
            box1: '2 QUARTOS\nCOM VARANDA',
            box2: 'VAGA DE\nGARAGEM',
            box3: 'ACESSOS\nINTELIGENTES\nE EXCLUSIVOS',
            box4: 'ÁREA DE\nLAZER\nCOMPLETA',
            localizacao: 'CAMPOS ELÍSEOS\nFÁCIL ACESSO\nA SANTO DUMONT',
            condicoes_titulo: 'CONDIÇÕES QUE CABEM NO SEU PLANO',
            renda_valor: 'R$ 3.500',
            entrada_valor: 'R$ 500',
            pagar_valor: '60X',
            subsidio_valor: 'ATÉ 55MIL',
            cta_l1: 'CADASTRE-SE AGORA',
            cta_l2: 'E RECEBA AS CONDIÇÕES DE',
            cta_l3: 'LANÇAMENTO ANTES!'
        }
    },

    {
        id: 'recreio-shopping',
        name: 'Recreio Shopping',
        category: 'mcmv',
        htmlOverlay: true,
        bgImage: '/imovel/Assets/americas_19_recreio_shopping_.jpg',
        fields: [
            { id: 'titulo', label: 'Título', placeholder: 'ex: Em frente ao Recreio...', default: 'Em frente ao Recreio Shopping\ne a 5 minutos da praia' },
            { id: 'badge_quartos_l1', label: 'Badge Linha 1', placeholder: 'ex: APARTAMENTOS DE', default: 'APARTAMENTOS DE' },
            { id: 'badge_quartos_l2', label: 'Badge Linha 2', placeholder: 'ex: 3 QUARTOS', default: '3 QUARTOS' },
            { id: 'metragem', label: 'Metragem', placeholder: 'ex: 64 m²', default: '64 m²' },
            { id: 'valor_imoveis', label: 'Valor do Imóvel', placeholder: 'ex: R$ 539.000,00', default: 'R$ 539.000,00' },
            { id: 'valor_entrada', label: 'Valor da Entrada', placeholder: 'ex: R$ 40 mil', default: 'R$ 40 mil' },
            { id: 'valor_parcelas', label: 'Valor das Parcelas', placeholder: 'ex: R$ 2.500', default: 'R$ 2.500' },
            { id: 'entrega', label: 'Previsão de Entrega', placeholder: 'ex: MARÇO/2027', default: 'MARÇO/2027' },
            { id: 'assinatura_l1', label: 'Assinatura Esquerda', placeholder: 'ex: AMÉRICAS 19', default: 'AMÉRICAS 19' },
            { id: 'assinatura_l2', label: 'Assinatura Direita', placeholder: 'ex: RECREIO', default: 'RECREIO' }
        ],
        defaults: {
            titulo: 'Em frente ao Recreio Shopping\ne a 5 minutos da praia',
            badge_quartos_l1: 'APARTAMENTOS DE',
            badge_quartos_l2: '3 QUARTOS',
            metragem: '64 m²',
            valor_imoveis: 'R$ 539.000,00',
            valor_entrada: 'R$ 40 mil',
            valor_parcelas: 'R$ 2.500',
            entrega: 'MARÇO/2027',
            assinatura_l1: 'AMÉRICAS 19',
            assinatura_l2: 'RECREIO'
        }
    },

    {
        id: 'lazer-clube',
        name: 'Lazer Clube',
        category: 'mcmv',
        htmlOverlay: true,
        bgImage: '/imovel/Assets/lazer_clube.png',
        fields: [
            { id: 'badge_tag', label: 'Badge Destaque', placeholder: 'ex: LANÇAMENTO', default: 'LANÇAMENTO' },
            { id: 'badge_programa', label: 'Badge Programa', placeholder: 'ex: Minha Casa Minha Vida', default: 'Minha Casa Minha Vida' },
            { id: 'nome_l1', label: 'Empreendimento L1', placeholder: 'ex: CAMINHOS DO', default: 'CAMINHOS DO' },
            { id: 'nome_l2', label: 'Empreendimento L2 (Destaque)', placeholder: 'ex: JAÇANÃ', default: 'JAÇANÃ' },
            { id: 'subtitulo_l1', label: 'Subtítulo L1', placeholder: 'ex: lazer de clube:', default: 'lazer de clube:' },
            { id: 'subtitulo_l2', label: 'Subtítulo L2 (Destaque)', placeholder: 'ex: cinema, sportbar e mais', default: 'cinema, sportbar e mais' },
            { id: 'kicker', label: 'Kicker', placeholder: 'ex: UM CONDOMÍNIO COM CARA DE CLUBE', default: 'UM CONDOMÍNIO COM CARA DE CLUBE' },
            { id: 'headline_l1', label: 'Headline L1', placeholder: 'ex: Lazer de clube todo dia, no', default: 'Lazer de clube todo dia, no' },
            { id: 'headline_l2', label: 'Headline L2 (Destaque)', placeholder: 'ex: Jaçanã', default: 'Jaçanã' },
            { id: 'descricao', label: 'Descrição de Apoio', placeholder: 'ex: piscina, cinema, sportbar...', default: 'piscina, cinema, sportbar, quadra e praça do fogo' },
            { id: 'label_entrada', label: 'Label Entrada', placeholder: 'ex: ENTRADA A PARTIR DE', default: 'ENTRADA A PARTIR DE' },
            { id: 'valor_entrada', label: 'Valor Entrada', placeholder: 'ex: R$ 500', default: 'R$ 500' },
            { id: 'nota_fgts', label: 'Nota FGTS', placeholder: 'ex: *use o seu FGTS', default: '*use o seu FGTS' },
            { id: 'beneficio_subsidio', label: 'Benefício Subsídio', placeholder: 'ex: R$ 55 mil', default: 'R$ 55 mil' },
            { id: 'beneficio_renda', label: 'Benefício Renda', placeholder: 'ex: com até 2 pessoas', default: 'com até 2 pessoas' },
            { id: 'beneficio_dormitorios', label: 'Benefício Dormitórios', placeholder: 'ex: 2 e 3 dormitórios', default: '2 e 3 dormitórios' },
            { id: 'botao_texto', label: 'Texto do Botão', placeholder: 'ex: Faça seu cadastro', default: 'Faça seu cadastro' },
            { id: 'rodape_institucional', label: 'Rodapé Institucional', placeholder: 'ex: Minha Casa Minha Vida...', default: 'Minha Casa Minha Vida  ·  Programa Prefeitura de SP  ·  Plano&Plano' }
        ],
        defaults: {
            badge_tag: 'LANÇAMENTO',
            badge_programa: 'Minha Casa Minha Vida',
            nome_l1: 'CAMINHOS DO',
            nome_l2: 'JAÇANÃ',
            subtitulo_l1: 'lazer de clube:',
            subtitulo_l2: 'cinema, sportbar e mais',
            kicker: 'UM CONDOMÍNIO COM CARA DE CLUBE',
            headline_l1: 'Lazer de clube todo dia, no',
            headline_l2: 'Jaçanã',
            descricao: 'piscina, cinema, sportbar, quadra e praça do fogo',
            label_entrada: 'ENTRADA A PARTIR DE',
            valor_entrada: 'R$ 500',
            nota_fgts: '*use o seu FGTS',
            beneficio_subsidio: 'R$ 55 mil',
            beneficio_renda: 'com até 2 pessoas',
            beneficio_dormitorios: '2 e 3 dormitórios',
            botao_texto: 'Faça seu cadastro',
            rodape_institucional: 'Minha Casa Minha Vida  ·  Programa Prefeitura de SP  ·  Plano&Plano'
        }
    },

    {
        id: 'apartamento-equipado',
        name: 'Apartamento Equipado',
        category: 'mcmv',
        htmlOverlay: true,
        bgImage: '/imovel/Assets/apartamento_equipado.png',
        fields: [
            { id: 'badge_imovel', label: 'Badge Destaque', placeholder: 'ex: IMÓVEL À VENDA', default: 'IMÓVEL À VENDA' },
            { id: 'titulo', label: 'Título', placeholder: 'ex: Apartamento', default: 'Apartamento' },
            { id: 'subtitulo', label: 'Subtítulo', placeholder: 'ex: EQUIPADO & PLANEJADO', default: 'EQUIPADO & PLANEJADO' },
            { id: 'descricao', label: 'Descrição de Apoio', placeholder: 'ex: Cozinha · Sala · 2 Quartos reformados', default: 'Cozinha · Sala · 2 Quartos reformados' },
            { id: 'pill_1', label: 'Pill 1', placeholder: 'ex: 2 Quartos', default: '2 Quartos' },
            { id: 'pill_2', label: 'Pill 2', placeholder: 'ex: Area Serviço', default: 'Area Serviço' },
            { id: 'pill_3', label: 'Pill 3', placeholder: 'ex: Tuiuti - SP', default: 'Tuiuti - SP' },
            { id: 'pill_4', label: 'Pill 4', placeholder: 'ex: Reformado', default: 'Reformado' },
            { id: 'valor_rotulo', label: 'Rótulo Valor', placeholder: 'ex: VALOR', default: 'VALOR' },
            { id: 'valor_preco', label: 'Preço', placeholder: 'ex: R$ 225.000', default: 'R$ 225.000' },
            { id: 'telefone', label: 'Telefone', placeholder: 'ex: (14) 99657-1979', default: '(14) 99657-1979' }
        ],
        defaults: {
            badge_imovel: 'IMÓVEL À VENDA',
            titulo: 'Apartamento',
            subtitulo: 'EQUIPADO & PLANEJADO',
            descricao: 'Cozinha · Sala · 2 Quartos reformados',
            pill_1: '2 Quartos',
            pill_2: 'Area Serviço',
            pill_3: 'Tuiuti - SP',
            pill_4: 'Reformado',
            valor_rotulo: 'VALOR',
            valor_preco: 'R$ 225.000',
            telefone: '(14) 99657-1979'
        }
    },

    {
        id: 'nova-iraja-residencial',
        name: 'Nova Irajá Residencial',
        category: 'mcmv',
        htmlOverlay: true,
        bgImage: '/imovel/Assets/nova_iraja_residencial.png',
        fields: [
            { id: 'tagline_barra', label: 'Barra Tagline', placeholder: 'ex: NA MEDIDA CERTA PARA SEUS SONHOS.', default: 'NA MEDIDA CERTA PARA SEUS SONHOS.' },
            { id: 'apartamentos_txt', label: 'Texto Cursivo Topo', placeholder: 'ex: apartamentos', default: 'apartamentos' },
            { id: 'dorms_destaque', label: 'Destaque Cursivo', placeholder: 'ex: 2 quartos', default: '2 quartos' },
            { id: 'varanda_garden', label: 'Apoio Destaque', placeholder: 'ex: com varanda\\nou garden.', default: 'com varanda\nou garden.' },
            { id: 'label_entrada', label: 'Label Entrada', placeholder: 'ex: Entrada', default: 'Entrada' },
            { id: 'label_apartir', label: 'Sublabel Entrada', placeholder: 'ex: a partir de:', default: 'a partir de:' },
            { id: 'valor_entrada', label: 'Valor Entrada (R$)', placeholder: 'ex: 800,00', default: '800,00' }
        ],
        defaults: {
            tagline_barra: 'NA MEDIDA CERTA PARA SEUS SONHOS.',
            apartamentos_txt: 'apartamentos',
            dorms_destaque: '2 quartos',
            varanda_garden: 'com varanda\nou garden.',
            label_entrada: 'Entrada',
            label_apartir: 'a partir de:',
            valor_entrada: '800,00'
        }
    },

    {
        id: 'mitz-de-luca',
        name: 'Mitz De Luca',
        category: 'mcmv',
        htmlOverlay: true,
        bgImage: '/imovel/Assets/mitz_de_luca.png',
        fields: [
            { id: 'titulo', label: 'Título Empreendimento', placeholder: 'ex: MITZ', default: 'MITZ' },
            { id: 'subtitulo', label: 'Subtítulo Construtora', placeholder: 'ex: DE LUCA', default: 'DE LUCA' },
            { id: 'tagline_1', label: 'Tagline Linha 1', placeholder: 'ex: Seu novo apê', default: 'Seu novo apê' },
            { id: 'tagline_2', label: 'Tagline Linha 2 (Destaque)', placeholder: 'ex: no Jabaquara', default: 'no Jabaquara' },
            { id: 'dormitorios_txt', label: 'Dormitórios', placeholder: 'ex: 2 DORMITÓRIOS', default: '2 DORMITÓRIOS' },
            { id: 'label_apartir', label: 'Rótulo Preço', placeholder: 'ex: A PARTIR DE', default: 'A PARTIR DE' },
            { id: 'preco_valor', label: 'Valor (em MIL)', placeholder: 'ex: 245', default: '245' },
            { id: 'label_fluxo', label: 'Rótulo Fluxo', placeholder: 'ex: FLUXO DE PAGAMENTO', default: 'FLUXO DE PAGAMENTO' },
            { id: 'pgto1_val', label: 'Ato (R$)', placeholder: 'ex: 10 MIL', default: '10 MIL' },
            { id: 'pgto1_nota', label: 'Ato Nota', placeholder: 'ex: Podendo ser\nseu FGTS', default: 'Podendo ser\nseu FGTS' },
            { id: 'pgto2_val', label: 'Anuais (R$)', placeholder: 'ex: 4 MIL', default: '4 MIL' },
            { id: 'pgto2_nota', label: 'Anuais Nota', placeholder: 'ex: 1ª em 2026\n2ª em 2027', default: '1ª em 2026\n2ª em 2027' },
            { id: 'pgto3_val', label: 'Mensais (R$)', placeholder: 'ex: 790', default: '790' },
            { id: 'pgto3_nota', label: 'Mensais Nota', placeholder: 'ex: Durante\na obra', default: 'Durante\na obra' },
            { id: 'pgto4_val', label: 'Renda (R$)', placeholder: 'ex: 5.300', default: '5.300' },
            { id: 'pgto4_nota', label: 'Renda Nota', placeholder: 'ex: Podendo ser\ncomposta por até\n3 pessoas', default: 'Podendo ser\ncomposta por até\n3 pessoas' },
            { id: 'plantao_label', label: 'Label Plantão', placeholder: 'ex: PLANTÃO DE VENDAS', default: 'PLANTÃO DE VENDAS' },
            { id: 'endereco1', label: 'Endereço Linha 1', placeholder: 'ex: Av. Ver. João de Luca, 1963', default: 'Av. Ver. João de Luca, 1963' },
            { id: 'endereco2', label: 'Endereço Linha 2', placeholder: 'ex: Jabaquara - São Paulo/SP', default: 'Jabaquara - São Paulo/SP' },
            { id: 'logo_marca', label: 'Logo Construtora', placeholder: 'ex: MANASA', default: 'MANASA' }
        ],
        defaults: {
            titulo: 'MITZ',
            subtitulo: 'DE LUCA',
            tagline_1: 'Seu novo apê',
            tagline_2: 'no Jabaquara',
            dormitorios_txt: '2 DORMITÓRIOS',
            label_apartir: 'A PARTIR DE',
            preco_valor: '245',
            label_fluxo: 'FLUXO DE PAGAMENTO',
            pgto1_val: '10 MIL',
            pgto1_nota: 'Podendo ser\nseu FGTS',
            pgto2_val: '4 MIL',
            pgto2_nota: '1ª em 2026\n2ª em 2027',
            pgto3_val: '790',
            pgto3_nota: 'Durante\na obra',
            pgto4_val: '5.300',
            pgto4_nota: 'Podendo ser\ncomposta por até\n3 pessoas',
            plantao_label: 'PLANTÃO DE VENDAS',
            endereco1: 'Av. Ver. João de Luca, 1963',
            endereco2: 'Jabaquara - São Paulo/SP',
            logo_marca: 'MANASA'
        }
    },

    {
        id: 'jacana-zn-imovel',
        name: 'Jaçanã ZN Imóvel',
        category: 'mcmv',
        htmlOverlay: true,
        bgImage: '/imovel/Assets/jacana_zn_imovel.png',
        fields: [
            { id: 'label_bairro', label: 'Label Topo', placeholder: 'ex: Apartamentos à venda no bairro:', default: 'Apartamentos à venda no bairro:' },
            { id: 'titulo_bairro', label: 'Bairro', placeholder: 'ex: Jaçanã', default: 'Jaçanã' },
            { id: 'area_m2', label: 'Metragem', placeholder: 'ex: 24 a 38m²', default: '24 a 38m²' },
            { id: 'dorms_numeros', label: 'Dormitórios (Números)', placeholder: 'ex: 1 e 2', default: '1 e 2' },
            { id: 'dorms_label', label: 'Label Dormitórios', placeholder: 'ex: quartos', default: 'quartos' },
            { id: 'pill_terraco', label: 'Destaque Pill', placeholder: 'ex: Com Terraço', default: 'Com Terraço' },
            { id: 'localizacao_texto', label: 'Localização / Metrô', placeholder: 'ex: 10 minutos do\nMetrô Tucuruvi', default: '10 minutos do\nMetrô Tucuruvi' }
        ],
        defaults: {
            label_bairro: 'Apartamentos à venda no bairro:',
            titulo_bairro: 'Jaçanã',
            area_m2: '24 a 38m²',
            dorms_numeros: '1 e 2',
            dorms_label: 'quartos',
            pill_terraco: 'Com Terraço',
            localizacao_texto: '10 minutos do\nMetrô Tucuruvi'
        }
    },

    {
        id: 'jr-prime-vila-re',
        name: 'JR Prime Vila Ré',
        category: 'mcmv',
        htmlOverlay: true,
        bgImage: '/imovel/Assets/jr_prime_vila_re.png',
        fields: [
            { id: 'titulo', label: 'Título Empreendimento', placeholder: 'ex: JR PRIME', default: 'JR PRIME' },
            { id: 'subtitulo', label: 'Bairro / Destaque', placeholder: 'ex: VILA RÉ', default: 'VILA RÉ' },
            { id: 'label_unidades', label: 'Rótulo Unidades', placeholder: 'ex: Unidades de', default: 'Unidades de' },
            { id: 'metragens', label: 'Metragens', placeholder: 'ex: 29 m2\n45 m2', default: '29 m2\n45 m2' },
            { id: 'dorms', label: 'Dormitórios', placeholder: 'ex: 2 DORMS', default: '2 DORMS' },
            { id: 'pill_parcelas', label: 'Rótulo Pill Preço', placeholder: 'ex: PARCELAS', default: 'PARCELAS' },
            { id: 'label_preco', label: 'Subrótulo Preço', placeholder: 'ex: A partir de R$', default: 'A partir de R$' },
            { id: 'valor_preco', label: 'Valor (R$)', placeholder: 'ex: 799,00', default: '799,00' }
        ],
        defaults: {
            titulo: 'JR PRIME',
            subtitulo: 'VILA RÉ',
            label_unidades: 'Unidades de',
            metragens: '29 m2\n45 m2',
            dorms: '2 DORMS',
            pill_parcelas: 'PARCELAS',
            label_preco: 'A partir de R$',
            valor_preco: '799,00'
        }
    },

    {
        id: 'jurubatuba-evoque',
        name: 'Jurubatuba Evoque',
        category: 'mcmv',
        htmlOverlay: true,
        bgImage: '/imovel/Assets/jurubatuba_evoque.png',
        fields: [
            { id: 'foto_predio', label: 'Foto do Prédio (Fundo)', type: 'file', placeholder: 'Upload...', default: '/imovel/Assets/jurubatuba_evoque.png' },
            { id: 'foto_vaga_carro', label: 'Foto Vaga de Carro', type: 'file', placeholder: 'Upload...', default: '/imovel/Assets/real_estate_1.png' },
            { id: 'foto_vaga_moto', label: 'Foto Vaga de Moto', type: 'file', placeholder: 'Upload...', default: '/imovel/Assets/real_estate_2.png' },
            { id: 'foto_varanda', label: 'Foto Varanda', type: 'file', placeholder: 'Upload...', default: '/imovel/Assets/real_estate_3.png' },
            { id: 'titulo_chamada', label: 'Chamada Topo', placeholder: 'ex: MORE A POUCOS MINUTOS\nA PÉ DA ESTAÇÃO', default: 'MORE A POUCOS MINUTOS\nA PÉ DA ESTAÇÃO' },
            { id: 'titulo_empreendimento', label: 'Nome Empreendimento', placeholder: 'ex: JURUBATUBA', default: 'JURUBATUBA' },
            { id: 'entrada_valor', label: 'Valor Entrada (R$)', placeholder: 'ex: 500', default: '500' },
            { id: 'antecipe_texto', label: 'Texto Antecipe', placeholder: 'ex: SE ANTECIPE\nAO\nLANÇAMENTO', default: 'SE ANTECIPE\nAO\nLANÇAMENTO' },
            { id: 'chame_texto', label: 'Texto CTA Topo', placeholder: 'ex: ME CHAME\nAGORA\nE GARANTA ESSA OPORTUNIDADE!', default: 'ME CHAME\nAGORA\nE GARANTA ESSA OPORTUNIDADE!' },
            { id: 'dorms_numeros', label: 'Dormitórios (Números)', placeholder: 'ex: 1 ou 2', default: '1 ou 2' },
            { id: 'dorms_label', label: 'Rótulo Dormitórios', placeholder: 'ex: quartos', default: 'quartos' },
            { id: 'label_vaga_carro', label: 'Rótulo Foto 1', placeholder: 'ex: VAGA DE CARRO', default: 'VAGA DE CARRO' },
            { id: 'label_vaga_moto', label: 'Rótulo Foto 2', placeholder: 'ex: VAGA DE MOTO', default: 'VAGA DE MOTO' },
            { id: 'label_varanda', label: 'Rótulo Foto 3', placeholder: 'ex: VARANDA', default: 'VARANDA' },
            { id: 'corretor_nome', label: 'Nome Corretor', placeholder: 'ex: EVOQUE', default: 'EVOQUE' },
            { id: 'telefone_whatsapp', label: 'Telefone WhatsApp', placeholder: 'ex: 11 97244-1917', default: '11 97244-1917' },
            { id: 'texto_cta_final', label: 'Texto Faixa Rodapé', placeholder: 'ex: ME CHAME AGORA E GARANTA ESSA OPORTUNIDADE!', default: 'ME CHAME AGORA E GARANTA ESSA OPORTUNIDADE!' }
        ],
        defaults: {
            foto_predio: '/imovel/Assets/jurubatuba_evoque.png',
            foto_vaga_carro: '/imovel/Assets/real_estate_1.png',
            foto_vaga_moto: '/imovel/Assets/real_estate_2.png',
            foto_varanda: '/imovel/Assets/real_estate_3.png',
            titulo_chamada: 'MORE A POUCOS MINUTOS\nA PÉ DA ESTAÇÃO',
            titulo_empreendimento: 'JURUBATUBA',
            entrada_valor: '500',
            antecipe_texto: 'SE ANTECIPE\nAO\nLANÇAMENTO',
            chame_texto: 'ME CHAME\nAGORA\nE GARANTA ESSA OPORTUNIDADE!',
            dorms_numeros: '1 ou 2',
            dorms_label: 'quartos',
            label_vaga_carro: 'VAGA DE CARRO',
            label_vaga_moto: 'VAGA DE MOTO',
            label_varanda: 'VARANDA',
            corretor_nome: 'EVOQUE',
            telefone_whatsapp: '11 97244-1917',
            texto_cta_final: 'ME CHAME AGORA E GARANTA ESSA OPORTUNIDADE!'
        }
    },

    {
        id: 'castello-di-lorenzo',
        name: 'Castello Di Lorenzo',
        category: 'mcmv',
        htmlOverlay: true,
        bgImage: '/imovel/Assets/castello_di_lorenzo.png',
        fields: [
            { id: 'more_no', label: 'Texto Topo L1', placeholder: 'ex: MORE NO', default: 'MORE NO' },
            { id: 'rita_vieira', label: 'Título Destaque Topo', placeholder: 'ex: RITA VIEIRA', default: 'RITA VIEIRA' },
            { id: 'ja_no', label: 'Texto Topo L3', placeholder: 'ex: JÁ NO', default: 'JÁ NO' },
            { id: 'ano_que_vem', label: 'Tagline Topo', placeholder: 'ex: ANO QUE VEM.', default: 'ANO QUE VEM.' },
            { id: 'castello_di_lorenzo', label: 'Nome Empreendimento', placeholder: 'ex: CASTELLO\\nDI LORENZO', default: 'CASTELLO\nDI LORENZO' },
            { id: 'sinal_label', label: 'Label Sinal', placeholder: 'ex: SINAL', default: 'SINAL' },
            { id: 'sinal_valor', label: 'Valor Sinal', placeholder: 'ex: R$ 40.000,00', default: 'R$ 40.000,00' },
            { id: 'sinal_sub', label: 'Subtítulo Sinal', placeholder: 'ex: PARCELADO EM ATÉ 3X', default: 'PARCELADO EM ATÉ 3X' },
            { id: 'parcelas_label', label: 'Label Parcelas', placeholder: 'ex: 16x DE', default: '16x DE' },
            { id: 'parcelas_valor', label: 'Valor Parcelas', placeholder: 'ex: R$ 1.500,00', default: 'R$ 1.500,00' },
            { id: 'balao_label', label: 'Label Balão L1', placeholder: 'ex: 1 BALÃO EM', default: '1 BALÃO EM' },
            { id: 'balao_label2', label: 'Label Balão L2', placeholder: 'ex: JUNHO DE 2027', default: 'JUNHO DE 2027' },
            { id: 'balao_valor', label: 'Valor Balão', placeholder: 'ex: R$ 16.000,00', default: 'R$ 16.000,00' },
            { id: 'financiamento_label', label: 'Label Financiamento', placeholder: 'ex: FINANCIAMENTO', default: 'FINANCIAMENTO' },
            { id: 'financiamento_sub', label: 'Subtítulo Financiamento', placeholder: 'ex: SOMENTE NA ENTREGA', default: 'SOMENTE NA ENTREGA' },
            { id: 'financiamento_valor', label: 'Valor Financiamento', placeholder: 'ex: R$ 320 MIL', default: 'R$ 320 MIL' },
            { id: 'amenidade1', label: 'Amenidade 1', placeholder: 'ex: 2 QUARTOS\\nCOM SUÍTE', default: '2 QUARTOS\nCOM SUÍTE' },
            { id: 'amenidade2', label: 'Amenidade 2', placeholder: 'ex: SACADA COM\\nCHURRASQUEIRA', default: 'SACADA COM\nCHURRASQUEIRA' },
            { id: 'localizacao', label: 'Localização', placeholder: 'ex: RITA VIEIRA', default: 'RITA VIEIRA' },
            { id: 'logo_empresa', label: 'Logo / Empresa', placeholder: 'ex: FLORES IMÓVEIS', default: 'FLORES IMÓVEIS' },
            { id: 'registro_creui', label: 'Registro CRECI/CREUI', placeholder: 'ex: CREUI 10834-J', default: 'CREUI 10834-J' }
        ],
        defaults: {
            more_no: 'MORE NO',
            rita_vieira: 'RITA VIEIRA',
            ja_no: 'JÁ NO',
            ano_que_vem: 'ANO QUE VEM.',
            castello_di_lorenzo: 'CASTELLO\nDI LORENZO',
            sinal_label: 'SINAL',
            sinal_valor: 'R$ 40.000,00',
            sinal_sub: 'PARCELADO EM ATÉ 3X',
            parcelas_label: '16x DE',
            parcelas_valor: 'R$ 1.500,00',
            balao_label: '1 BALÃO EM',
            balao_label2: 'JUNHO DE 2027',
            balao_valor: 'R$ 16.000,00',
            financiamento_label: 'FINANCIAMENTO',
            financiamento_sub: 'SOMENTE NA ENTREGA',
            financiamento_valor: 'R$ 320 MIL',
            amenidade1: '2 QUARTOS\nCOM SUÍTE',
            amenidade2: 'SACADA COM\nCHURRASQUEIRA',
            localizacao: 'RITA VIEIRA',
            logo_empresa: 'FLORES IMÓVEIS',
            registro_creui: 'CREUI 10834-J'
        }
    },

    {
        id: 'lancamento-centro-niteroi',
        name: 'Lançamento Centro Niterói',
        category: 'mcmv',
        htmlOverlay: true,
        bgImage: '/imovel/Assets/lancamento_centro_niteroi.jpg',
        fields: [
            { id: 'badge_lancamento', label: 'Badge Destaque', placeholder: 'ex: LANÇAMENTO', default: 'LANÇAMENTO' },
            { id: 'titulo_l1', label: 'Título Linha 1', placeholder: 'ex: CENTRO', default: 'CENTRO' },
            { id: 'titulo_l2', label: 'Título Linha 2', placeholder: 'ex: NITERÓI', default: 'NITERÓI' },
            { id: 'tagline_l1', label: 'Tagline Linha 1', placeholder: 'ex: VIVA O MELHOR DA CIDADE', default: 'VIVA O MELHOR DA CIDADE' },
            { id: 'tagline_l2', label: 'Tagline Linha 2', placeholder: 'ex: COM VISTA.', default: 'COM VISTA.' },
            { id: 'box_quartos_destaque', label: 'Destaque Quartos', placeholder: 'ex: 2 QUARTOS', default: '2 QUARTOS' },
            { id: 'box_quartos_sub', label: 'Detalhes Quartos', placeholder: 'ex: COM SUÍTE\\nE VARANDA', default: 'COM SUÍTE\nE VARANDA' },
            { id: 'ato_label', label: 'Label Ato', placeholder: 'ex: ATO DE', default: 'ATO DE' },
            { id: 'ato_valor', label: 'Valor Ato', placeholder: 'ex: R$500', default: 'R$500' },
            { id: 'parcelas_label', label: 'Label Parcelas', placeholder: 'ex: PARCELAS A PARTIR DE', default: 'PARCELAS A PARTIR DE' },
            { id: 'parcelas_valor', label: 'Valor Parcelas', placeholder: 'ex: R$1.500', default: 'R$1.500' },
            { id: 'praia_tempo', label: 'Tempo Praia', placeholder: 'ex: 10 MINUTOS', default: '10 MINUTOS' },
            { id: 'praia_local', label: 'Local Praia', placeholder: 'ex: DA PRAIA DE ICARAÍ', default: 'DA PRAIA DE ICARAÍ' },
            { id: 'barcas_texto', label: 'Texto Barcas', placeholder: 'ex: PRÓXIMO\\nÀS BARCAS', default: 'PRÓXIMO\nÀS BARCAS' },
            { id: 'selo_texto', label: 'Texto Selo', placeholder: 'ex: CENTRO\\nDE TUDO,\\nPERTO DE VOCÊ.', default: 'CENTRO\nDE TUDO,\nPERTO DE VOCÊ.' },
            { id: 'rodape_item1', label: 'Rodapé Item 1', placeholder: 'ex: NO CORAÇÃO\\nDE NITERÓI', default: 'NO CORAÇÃO\nDE NITERÓI' },
            { id: 'rodape_item2', label: 'Rodapé Item 2', placeholder: 'ex: PERTO DE TUDO:\\nCOMÉRCIO, SERVIÇOS\\nE MOBILIDADE', default: 'PERTO DE TUDO:\nCOMÉRCIO, SERVIÇOS\nE MOBILIDADE' },
            { id: 'rodape_item3', label: 'Rodapé Item 3', placeholder: 'ex: SEGURANÇA, CONFORTO\\nE LAZER COMPLETO', default: 'SEGURANÇA, CONFORTO\nE LAZER COMPLETO' }
        ],
        defaults: {
            badge_lancamento: 'LANÇAMENTO',
            titulo_l1: 'CENTRO',
            titulo_l2: 'NITERÓI',
            tagline_l1: 'VIVA O MELHOR DA CIDADE',
            tagline_l2: 'COM VISTA.',
            box_quartos_destaque: '2 QUARTOS',
            box_quartos_sub: 'COM SUÍTE\nE VARANDA',
            ato_label: 'ATO DE',
            ato_valor: 'R$500',
            parcelas_label: 'PARCELAS A PARTIR DE',
            parcelas_valor: 'R$1.500',
            praia_tempo: '10 MINUTOS',
            praia_local: 'DA PRAIA DE ICARAÍ',
            barcas_texto: 'PRÓXIMO\nÀS BARCAS',
            selo_texto: 'CENTRO\nDE TUDO,\nPERTO DE VOCÊ.',
            rodape_item1: 'NO CORAÇÃO\nDE NITERÓI',
            rodape_item2: 'PERTO DE TUDO:\nCOMÉRCIO, SERVIÇOS\nE MOBILIDADE',
            rodape_item3: 'SEGURANÇA, CONFORTO\nE LAZER COMPLETO'
        }
    },

    {
        id: 'ver-klabin',
        name: 'Ver Klabin',
        category: 'mcmv',
        htmlOverlay: true,
        bgImage: '/imovel/Assets/ver_klabin.png',
        fields: [
            { id: 'tag_topo_l1', label: 'Tag Topo Esquerda', placeholder: 'ex: BREVE LANÇAMENTO >>>>', default: 'BREVE LANÇAMENTO >>>>' },
            { id: 'tag_topo_l2', label: 'Tag Topo Direita', placeholder: 'ex: A 600M DA ESTAÇÃO SANTOS-IMIGRANTES', default: 'A 600M DA ESTAÇÃO SANTOS-IMIGRANTES' },
            { id: 'headline_l1', label: 'Headline Linhas 1-2', placeholder: 'ex: A CHÁCARA\\nKLABIN AGORA', default: 'A CHÁCARA\nKLABIN AGORA' },
            { id: 'headline_l2', label: 'Headline Linha 3 (Destaque)', placeholder: 'ex: É PARA VOCÊ.', default: 'É PARA VOCÊ.' },
            { id: 'watermark', label: 'Marca d\'água', placeholder: 'ex: IMAGEM ILUSTRATIVA DA FACHADA', default: 'IMAGEM ILUSTRATIVA DA FACHADA' },
            { id: 'tagline', label: 'Tagline', placeholder: 'ex: VISTA • EXCLUSIVIDADE • RITMO', default: 'VISTA • EXCLUSIVIDADE • RITMO' },
            { id: 'dorms_num_1', label: 'Número Dorms 1', placeholder: 'ex: 1', default: '1' },
            { id: 'dorms_num_2', label: 'Número Dorms 2', placeholder: 'ex: 2', default: '2' },
            { id: 'dorms_label', label: 'Texto Dorms', placeholder: 'ex: DORMS.', default: 'DORMS.' },
            { id: 'opcao_terraco', label: 'Subtítulo 1', placeholder: 'ex: COM OPÇÃO DE TERRAÇO', default: 'COM OPÇÃO DE TERRAÇO' },
            { id: 'lazer_completo', label: 'Subtítulo 2 (Destaque)', placeholder: 'ex: LAZER COMPLETO', default: 'LAZER COMPLETO' },
            { id: 'cta_texto', label: 'Texto do CTA', placeholder: 'ex: CLIQUE E SAIBA MAIS', default: 'CLIQUE E SAIBA MAIS' },
            { id: 'endereco_texto', label: 'Endereço', placeholder: 'ex: RUA SANTA CRUZ, 1248  •  CHÁCARA KLABIN', default: 'RUA SANTA CRUZ, 1248  •  CHÁCARA KLABIN' },
            { id: 'logo_ld', label: 'Logo Incorporação', placeholder: 'ex: LD inc.', default: 'LD inc.' },
            { id: 'logo_sae', label: 'Logo Incorp + Constr', placeholder: 'ex: SAE', default: 'SAE' },
            { id: 'logo_drive', label: 'Logo Vendas', placeholder: 'ex: Drive', default: 'Drive' },
            { id: 'texto_his', label: 'Texto Selo HIS', placeholder: 'ex: EMPREENDIMENTO COM UNIDADES DE...', default: 'EMPREENDIMENTO COM UNIDADES DE\nHABITAÇÃO DE INTERESSE SOCIAL' }
        ],
        defaults: {
            tag_topo_l1: 'BREVE LANÇAMENTO >>>>',
            tag_topo_l2: 'A 600M DA ESTAÇÃO SANTOS-IMIGRANTES',
            headline_l1: 'A CHÁCARA\nKLABIN AGORA',
            headline_l2: 'É PARA VOCÊ.',
            watermark: 'IMAGEM ILUSTRATIVA DA FACHADA',
            tagline: 'VISTA • EXCLUSIVIDADE • RITMO',
            dorms_num_1: '1',
            dorms_num_2: '2',
            dorms_label: 'DORMS.',
            opcao_terraco: 'COM OPÇÃO DE TERRAÇO',
            lazer_completo: 'LAZER COMPLETO',
            cta_texto: 'CLIQUE E SAIBA MAIS',
            endereco_texto: 'RUA SANTA CRUZ, 1248  •  CHÁCARA KLABIN',
            logo_ld: 'LD inc.',
            logo_sae: 'SAE',
            logo_drive: 'Drive',
            texto_his: 'EMPREENDIMENTO COM UNIDADES DE\nHABITAÇÃO DE INTERESSE SOCIAL'
        }
    },

    {
        id: 'chacara-santo-antonio',
        name: 'Apartamentos Chácara Santo Antônio',
        category: 'mcmv',
        htmlOverlay: true,
        bgImage: '/imovel/Assets/chacara_santo_antonio.png',
        fields: [
            { id: 'titulo_l1', label: 'Título Linha 1', placeholder: 'ex: APARTAMENTOS NA', default: 'APARTAMENTOS NA' },
            { id: 'titulo_l2', label: 'Título Linha 2', placeholder: 'ex: CHÁCARA SANTO', default: 'CHÁCARA SANTO' },
            { id: 'titulo_l3', label: 'Título Linha 3', placeholder: 'ex: ANTÔNIO - SP', default: 'ANTÔNIO - SP' },
            { id: 'selo_l1', label: 'Selo Linha 1', placeholder: 'ex: Minha Casa', default: 'Minha Casa' },
            { id: 'selo_l2', label: 'Selo Linha 2', placeholder: 'ex: Minha Vida', default: 'Minha Vida' },
            { id: 'painel_titulo', label: 'Título Painel', placeholder: 'ex: FLUXO DE PAGAMENTO', default: 'FLUXO DE PAGAMENTO' },
            { id: 'valor_entrada', label: 'Valor Entrada', placeholder: 'ex: R$799,00', default: 'R$799,00' },
            { id: 'valor_mensais', label: 'Valor Mensais', placeholder: 'ex: R$899,00', default: 'R$899,00' },
            { id: 'valor_anuais', label: 'Valor Anuais', placeholder: 'ex: R$1.999,00', default: 'R$1.999,00' },
            { id: 'valor_chaves', label: 'Valor Chaves', placeholder: 'ex: R$2.500,00', default: 'R$2.500,00' },
            { id: 'botao_texto', label: 'Texto Botão', placeholder: 'ex: Saiba mais', default: 'Saiba mais' }
        ],
        defaults: {
            titulo_l1: 'APARTAMENTOS NA',
            titulo_l2: 'CHÁCARA SANTO',
            titulo_l3: 'ANTÔNIO - SP',
            selo_l1: 'Minha Casa',
            selo_l2: 'Minha Vida',
            painel_titulo: 'FLUXO DE PAGAMENTO',
            valor_entrada: 'R$799,00',
            valor_mensais: 'R$899,00',
            valor_anuais: 'R$1.999,00',
            valor_chaves: 'R$2.500,00',
            botao_texto: 'Saiba mais'
        }
    },

    {
        id: 'conceito-california',
        name: 'Conceito Califórnia',
        category: 'mcmv',
        htmlOverlay: true,
        bgImage: '/imovel/Assets/conceito_california.png',
        fields: [
            { id: 'logo_marca', label: 'Marca / Topo L1', placeholder: 'ex: CONCEITO', default: 'CONCEITO' },
            { id: 'logo_nome', label: 'Nome / Topo L2', placeholder: 'ex: Califórnia', default: 'Califórnia' },
            { id: 'entrega_l1', label: 'Entrega L1', placeholder: 'ex: ENTREGA', default: 'ENTREGA' },
            { id: 'entrega_l2', label: 'Entrega L2', placeholder: 'ex: INÍCIO DE', default: 'INÍCIO DE' },
            { id: 'entrega_ano', label: 'Ano Entrega', placeholder: 'ex: 2027', default: '2027' },
            { id: 'compre_l1', label: 'Destaque L1', placeholder: 'ex: COMPRE SEU', default: 'COMPRE SEU' },
            { id: 'compre_l2', label: 'Destaque L2', placeholder: 'ex: APARTAMENTO COM', default: 'APARTAMENTO COM' },
            { id: 'desconto_label', label: 'Label Desconto', placeholder: 'ex: DESCONTO DE', default: 'DESCONTO DE' },
            { id: 'desconto_valor', label: 'Valor Desconto', placeholder: 'ex: 70', default: '70' },
            { id: 'desconto_sufixo', label: 'Sufixo Desconto', placeholder: 'ex: MIL', default: 'MIL' },
            { id: 'col1_label', label: 'Coluna 1 Label', placeholder: 'ex: ENTRADA\nPARCELADA\nEM ATÉ', default: 'ENTRADA\nPARCELADA\nEM ATÉ' },
            { id: 'col1_valor', label: 'Coluna 1 Valor', placeholder: 'ex: 60x', default: '60x' },
            { id: 'col2_label1', label: 'Coluna 2 Topo', placeholder: 'ex: RENDA A PARTIR DE', default: 'RENDA A PARTIR DE' },
            { id: 'col2_valor', label: 'Coluna 2 Valor', placeholder: 'ex: R$ 5.500', default: 'R$ 5.500' },
            { id: 'col2_label2', label: 'Coluna 2 Base', placeholder: 'ex: PODEM UNIR ATÉ\nTRÊS RENDAS', default: 'PODEM UNIR ATÉ\nTRÊS RENDAS' },
            { id: 'col3_label', label: 'Coluna 3 Label', placeholder: 'ex: USE O SEU', default: 'USE O SEU' },
            { id: 'col3_valor', label: 'Coluna 3 Valor', placeholder: 'ex: FGTS', default: 'FGTS' }
        ],
        defaults: {
            logo_marca: 'CONCEITO',
            logo_nome: 'Califórnia',
            entrega_l1: 'ENTREGA',
            entrega_l2: 'INÍCIO DE',
            entrega_ano: '2027',
            compre_l1: 'COMPRE SEU',
            compre_l2: 'APARTAMENTO COM',
            desconto_label: 'DESCONTO DE',
            desconto_valor: '70',
            desconto_sufixo: 'MIL',
            col1_label: 'ENTRADA\nPARCELADA\nEM ATÉ',
            col1_valor: '60x',
            col2_label1: 'RENDA A PARTIR DE',
            col2_valor: 'R$ 5.500',
            col2_label2: 'PODEM UNIR ATÉ\nTRÊS RENDAS',
            col3_label: 'USE O SEU',
            col3_valor: 'FGTS'
        }
    },

    {
        id: 'conexao-anhembi',
        name: 'Conexão Anhembi',
        category: 'mcmv',
        htmlOverlay: true,
        bgImage: '/imovel/Assets/conexao_anhembi.png',
        fields: [
            { id: 'badge_lancamento', label: 'Badge Destaque', placeholder: 'ex: ANTECIPE-SE AO LANÇAMENTO', default: 'ANTECIPE-SE AO LANÇAMENTO' },
            { id: 'logo_con', label: 'Logo Parte 1 (CON)', placeholder: 'ex: CON', default: 'CON' },
            { id: 'logo_xao', label: 'Logo Parte 2 (ÃO)', placeholder: 'ex: ÃO', default: 'ÃO' },
            { id: 'logo_sub', label: 'Subtítulo Logo', placeholder: 'ex: ANHEMBI', default: 'ANHEMBI' },
            { id: 'tagline_l1', label: 'Tagline Linha 1', placeholder: 'ex: A SUA CHANCE DE', default: 'A SUA CHANCE DE' },
            { id: 'tagline_l2', label: 'Tagline Linha 2', placeholder: 'ex: MORAR AO LADO', default: 'MORAR AO LADO' },
            { id: 'tagline_l3', label: 'Tagline Linha 3', placeholder: 'ex: DA ESTAÇÃO', default: 'DA ESTAÇÃO' },
            { id: 'tagline_bold_l1', label: 'Tagline Bold Linha 1', placeholder: 'ex: PORTUGUESA -', default: 'PORTUGUESA -' },
            { id: 'tagline_bold_l2', label: 'Tagline Bold Linha 2', placeholder: 'ex: TIETÊ CHEGOU', default: 'TIETÊ CHEGOU' },
            { id: 'dorms_num1', label: 'Nº Dormitórios 1', placeholder: 'ex: 1', default: '1' },
            { id: 'dorms_num2', label: 'Nº Dormitórios 2', placeholder: 'ex: 2', default: '2' },
            { id: 'pill_varanda', label: 'Pill Feature', placeholder: 'ex: VARANDA', default: 'VARANDA' },
            { id: 'lazer_destaque', label: 'Destaque Lazer Linha 1', placeholder: 'ex: LAZER NO', default: 'LAZER NO' },
            { id: 'lazer_local', label: 'Destaque Lazer Linha 2', placeholder: 'ex: ROOFTOP', default: 'ROOFTOP' },
            { id: 'rodape_l1', label: 'Rodapé Logo 1', placeholder: 'ex: CAIXA', default: 'CAIXA' },
            { id: 'rodape_l2', label: 'Rodapé Logo 2', placeholder: 'ex: MINHA CASA MINHA VIDA', default: 'MINHA CASA\nMINHA VIDA' },
            { id: 'rodape_l3', label: 'Rodapé Logo 3', placeholder: 'ex: integra', default: 'integra' }
        ],
        defaults: {
            badge_lancamento: 'ANTECIPE-SE AO LANÇAMENTO',
            logo_con: 'CON',
            logo_xao: 'ÃO',
            logo_sub: 'ANHEMBI',
            tagline_l1: 'A SUA CHANCE DE',
            tagline_l2: 'MORAR AO LADO',
            tagline_l3: 'DA ESTAÇÃO',
            tagline_bold_l1: 'PORTUGUESA -',
            tagline_bold_l2: 'TIETÊ CHEGOU',
            dorms_num1: '1',
            dorms_num2: '2',
            pill_varanda: 'VARANDA',
            lazer_destaque: 'LAZER NO',
            lazer_local: 'ROOFTOP',
            rodape_l1: 'CAIXA',
            rodape_l2: 'MINHA CASA\nMINHA VIDA',
            rodape_l3: 'integra'
        }
    },

    {
        id: 'bonsucesso',
        name: 'Bonsucesso',
        category: 'mcmv',
        htmlOverlay: true,
        bgImage: '/imovel/Assets/bonsucesso.png',
        fields: [
            { id: 'logo_title', label: 'Título Logo', placeholder: 'ex: ELEVATO', default: 'ELEVATO' },
            { id: 'logo_sub', label: 'Subtítulo Logo', placeholder: 'ex: Bonsucesso', default: 'Bonsucesso' },
            { id: 'badge_top', label: 'Badge Topo', placeholder: 'ex: NÃO PERCA ESSA OPORTUNIDADE NA ZONA NORTE!', default: 'NÃO PERCA\nESSA OPORTUNIDADE\nNA ZONA NORTE!' },
            { id: 'titulo_claro', label: 'Título Claro', placeholder: 'ex: O FUTURO JÁ ESTÁ', default: 'O FUTURO\nJÁ ESTÁ' },
            { id: 'titulo_destaque', label: 'Título Destaque', placeholder: 'ex: ACONTECENDO!', default: 'ACONTECENDO!' },
            { id: 'texto_apoio', label: 'Texto de Apoio', placeholder: 'ex: Obras avançadas...', default: 'Obras avançadas, localização estratégica e condições imperdíveis para\nvocê vender mais!' },
            { id: 'endereco', label: 'Endereço', placeholder: 'ex: RUA ITAÓCA, BONSUCESSO', default: 'RUA ITAÓCA, BONSUCESSO' },
            { id: 'feat1_label', label: 'Feature 1 Rótulo', placeholder: 'ex: ATO MÍNIMO', default: 'ATO MÍNIMO' },
            { id: 'feat1_val', label: 'Feature 1 Valor', placeholder: 'ex: R$ 500,00', default: 'R$ 500,00' },
            { id: 'feat2_label', label: 'Feature 2 Rótulo', placeholder: 'ex: PARCELAMENTO', default: 'PARCELAMENTO' },
            { id: 'feat2_val', label: 'Feature 2 Valor', placeholder: 'ex: FACILITADO', default: 'FACILITADO' },
            { id: 'feat3_label', label: 'Feature 3 Rótulo', placeholder: 'ex: DOCUMENTAÇÃO', default: 'DOCUMENTAÇÃO' },
            { id: 'feat3_val', label: 'Feature 3 Valor', placeholder: 'ex: GRÁTIS', default: 'GRÁTIS' },
            { id: 'feat4_label', label: 'Feature 4 Rótulo', placeholder: 'ex: PRODUTO APTO', default: 'PRODUTO APTO' },
            { id: 'feat4_val', label: 'Feature 4 Valor', placeholder: 'ex: PARA REPASSE', default: 'PARA REPASSE' },
            { id: 'painel_titulo', label: 'Painel Título', placeholder: 'ex: OBRAS AVANÇADAS!', default: 'OBRAS\nAVANÇADAS!' },
            { id: 'painel_texto', label: 'Painel Texto', placeholder: 'ex: MAIS VALORIZAÇÃO...', default: 'MAIS VALORIZAÇÃO, MAIS VENDAS,\nMAIS RESULTADOS!' },
            { id: 'rodape_text', label: 'Tagline Rodapé', placeholder: 'ex: Acione o seu viabilizador!', default: 'Acione o seu viabilizador!' }
        ],
        defaults: {
            logo_title: 'ELEVATO', logo_sub: 'Bonsucesso',
            badge_top: 'NÃO PERCA\nESSA OPORTUNIDADE\nNA ZONA NORTE!',
            titulo_claro: 'O FUTURO\nJÁ ESTÁ', titulo_destaque: 'ACONTECENDO!',
            texto_apoio: 'Obras avançadas, localização estratégica e condições imperdíveis para\nvocê vender mais!',
            endereco: 'RUA ITAÓCA, BONSUCESSO',
            feat1_label: 'ATO MÍNIMO', feat1_val: 'R$ 500,00',
            feat2_label: 'PARCELAMENTO', feat2_val: 'FACILITADO',
            feat3_label: 'DOCUMENTAÇÃO', feat3_val: 'GRÁTIS',
            feat4_label: 'PRODUTO APTO', feat4_val: 'PARA REPASSE',
            painel_titulo: 'OBRAS\nAVANÇADAS!',
            painel_texto: 'MAIS VALORIZAÇÃO, MAIS VENDAS,\nMAIS RESULTADOS!',
            rodape_text: 'Acione o seu viabilizador!'
        }
    },

    {
        id: 'casa-fortaleza',
        name: 'Casa Fortaleza',
        category: 'mcmv',
        htmlOverlay: true,
        bgImage: '/imovel/Assets/casa_fortaleza.png',
        fields: [
            { id: 'pill_top', label: 'Pill Topo', placeholder: 'ex: LANÇAMENTO', default: 'LANÇAMENTO' },
            { id: 'titulo', label: 'Título Principal', placeholder: 'ex: Apê próximo a Expoema', default: 'Apê próximo a Expoema' },
            { id: 'logo_title', label: 'Nome Construtora', placeholder: 'ex: FORTALEZA', default: 'FORTALEZA' },
            { id: 'logo_sub', label: 'Subtítulo Construtora', placeholder: 'ex: Empreendimentos', default: 'Empreendimentos' },
            { id: 'programa_label', label: 'Nome do Programa', placeholder: 'ex: CASA VERDE E AMARELA', default: 'PROGRAMA\nCASA VERDE\nE AMARELA' },
            { id: 'renda_val', label: 'Renda Familiar', placeholder: 'ex: R$2.500', default: 'R$2.500' },
            { id: 'desc1_val', label: 'Desconto 1', placeholder: 'ex: R$ 10mil', default: 'R$ 10mil' },
            { id: 'desc2_val', label: 'Desconto 2 (Subsídio)', placeholder: 'ex: R$ 47mil', default: 'R$ 47mil' },
            { id: 'cta_text', label: 'Texto do CTA', placeholder: 'ex: CLIQUE EM SAIBA MAIS', default: 'CLIQUE EM SAIBA MAIS' }
        ],
        defaults: {
            pill_top: 'LANÇAMENTO',
            titulo: 'Apê próximo a Expoema',
            logo_title: 'FORTALEZA',
            logo_sub: 'Empreendimentos',
            programa_label: 'PROGRAMA\nCASA VERDE\nE AMARELA',
            renda_val: 'R$2.500',
            desc1_val: 'R$ 10mil',
            desc2_val: 'R$ 47mil',
            cta_text: 'CLIQUE EM SAIBA MAIS'
        }
    },

    {
        id: 'guaianases',
        name: 'Guaianases',
        category: 'mcmv',
        htmlOverlay: true,
        bgImage: '/imovel/Assets/guaianases.png',
        fields: [
            { id: 'selo_top', label: 'Selo Topo', placeholder: 'ex: CHEGOU A SUA VEZ!', default: 'CHEGOU A SUA VEZ!' },
            { id: 'titulo', label: 'Título Principal', placeholder: 'ex: GUAIANASES', default: 'GUAIANASES' },
            { id: 'selo_financiamento_t1', label: 'Selo Financiamento Topo', placeholder: 'ex: FINANCIAMENTO', default: 'FINANCIAMENTO' },
            { id: 'selo_financiamento_t2', label: 'Selo Financiamento Programa', placeholder: 'ex: Minha Casa Minha Vida', default: 'Minha Casa\nMinha Vida' },
            { id: 'selo_financiamento_t3', label: 'Selo Financiamento Destaque', placeholder: 'ex: FACILITADO', default: 'FACILITADO' },
            { id: 'tagline1', label: 'Tagline Linha 1', placeholder: 'ex: O APTO QUE CABE', default: 'O APTO QUE CABE' },
            { id: 'tagline2', label: 'Tagline Linha 2', placeholder: 'ex: NO SEU BOLSO!', default: 'NO SEU BOLSO!' },
            { id: 'label_renda', label: 'Renda - Rótulo', placeholder: 'ex: RENDA FAMILIAR A PARTIR DE', default: 'RENDA FAMILIAR\nA PARTIR DE' },
            { id: 'renda_val', label: 'Renda - Valor', placeholder: 'ex: R$ 2.500', default: 'R$ 2.500' },
            { id: 'label_entrada', label: 'Entrada - Rótulo', placeholder: 'ex: ENTRADA A PARTIR DE', default: 'ENTRADA\nA PARTIR DE' },
            { id: 'entrada_val', label: 'Entrada - Valor', placeholder: 'ex: R$ 500', default: 'R$ 500' },
            { id: 'label_parcelas', label: 'Parcelas - Rótulo', placeholder: 'ex: 36 PARCELAS DE', default: '36 PARCELAS DE' },
            { id: 'parcelas_val', label: 'Parcelas - Valor', placeholder: 'ex: R$ 485', default: 'R$ 485' },
            { id: 'label_anuais', label: 'Anuais - Rótulo', placeholder: 'ex: 2 ANUAIS DE', default: '2 ANUAIS DE' },
            { id: 'anuais_val', label: 'Anuais - Valor', placeholder: 'ex: R$ 2 MIL', default: 'R$ 2 MIL' },
            { id: 'label_localizacao', label: 'Localização - Rótulo', placeholder: 'ex: PRÓXIMO À', default: 'PRÓXIMO À' },
            { id: 'bairro', label: 'Localização - Bairro', placeholder: 'ex: ESTAÇÃO GUAIANASES', default: 'ESTAÇÃO\nGUAIANASES' },
            { id: 'label_morando', label: 'Parcela Morando - Rótulo', placeholder: 'ex: PARCELA MORANDO DE', default: 'PARCELA MORANDO DE' },
            { id: 'preco_morando', label: 'Parcela Morando - Valor', placeholder: 'ex: 750', default: '750' },
            { id: 'faixa_texto1', label: 'Faixa Aluguel - Texto 1', placeholder: 'ex: SÓ FICA NO ALUGUEL', default: 'SÓ FICA NO ALUGUEL' },
            { id: 'faixa_texto2', label: 'Faixa Aluguel - Texto 2', placeholder: 'ex: QUEM QUER!', default: 'QUEM QUER!' },
            { id: 'ic1_txt', label: 'Rodapé Item 1 - Título', placeholder: 'ex: DOCUMENTAÇÃO GRÁTIS!*', default: 'DOCUMENTAÇÃO\nGRÁTIS!*' },
            { id: 'ic1_sub', label: 'Rodapé Item 1 - Subtítulo', placeholder: 'ex: CONSULTE CONDIÇÕES', default: 'CONSULTE CONDIÇÕES' },
            { id: 'ic2_txt', label: 'Rodapé Item 2 - Título', placeholder: 'ex: APTOS. DE 1 E 2 DORMS.', default: 'APTOS. DE\n1 E 2 DORMS.' },
            { id: 'ic2_sub', label: 'Rodapé Item 2 - Subtítulo', placeholder: 'ex: CONFORTO PARA SUA FAMÍLIA!', default: 'CONFORTO PARA\nSUA FAMÍLIA!' },
            { id: 'ic3_txt', label: 'Rodapé Item 3 - Título', placeholder: 'ex: SEGURANÇA 24 HORAS', default: 'SEGURANÇA\n24 HORAS' },
            { id: 'ic3_sub', label: 'Rodapé Item 3 - Subtítulo', placeholder: 'ex: ', default: '' },
            { id: 'ic4_txt', label: 'Rodapé Item 4 - Título', placeholder: 'ex: ÁREA VERDE E LAZER', default: 'ÁREA VERDE\nE LAZER' },
            { id: 'ic4_sub', label: 'Rodapé Item 4 - Subtítulo', placeholder: 'ex: COMPLETO', default: 'COMPLETO' },
            { id: 'texto_legal', label: 'Texto Legal', placeholder: 'ex: *Consulte condições. Imagem meramente ilustrativa.', default: '*Consulte condições. Imagem meramente ilustrativa.' }
        ],
        defaults: {
            selo_top: 'CHEGOU A SUA VEZ!',
            titulo: 'GUAIANASES',
            selo_financiamento_t1: 'FINANCIAMENTO',
            selo_financiamento_t2: 'Minha Casa\nMinha Vida',
            selo_financiamento_t3: 'FACILITADO',
            tagline1: 'O APTO QUE CABE',
            tagline2: 'NO SEU BOLSO!',
            label_renda: 'RENDA FAMILIAR\nA PARTIR DE',
            renda_val: 'R$ 2.500',
            label_entrada: 'ENTRADA\nA PARTIR DE',
            entrada_val: 'R$ 500',
            label_parcelas: '36 PARCELAS DE',
            parcelas_val: 'R$ 485',
            label_anuais: '2 ANUAIS DE',
            anuais_val: 'R$ 2 MIL',
            label_localizacao: 'PRÓXIMO À',
            bairro: 'ESTAÇÃO\nGUAIANASES',
            label_morando: 'PARCELA MORANDO DE',
            preco_morando: '750',
            faixa_texto1: 'SÓ FICA NO ALUGUEL',
            faixa_texto2: 'QUEM QUER!',
            ic1_txt: 'DOCUMENTAÇÃO\nGRÁTIS!*',
            ic1_sub: 'CONSULTE CONDIÇÕES',
            ic2_txt: 'APTOS. DE\n1 E 2 DORMS.',
            ic2_sub: 'CONFORTO PARA\nSUA FAMÍLIA!',
            ic3_txt: 'SEGURANÇA\n24 HORAS',
            ic3_sub: '',
            ic4_txt: 'ÁREA VERDE\nE LAZER',
            ic4_sub: 'COMPLETO',
            texto_legal: '*Consulte condições. Imagem meramente ilustrativa.'
        }
    },

    {
        id: 'santa-marina',
        name: 'Santa Marina',
        category: 'mcmv',
        htmlOverlay: true,
        bgImage: '/imovel/Assets/santa_marina.png',
        fields: [
            { id: 'lancamento_txt', label: 'Texto Topo', placeholder: 'ex: Lançamento', default: 'Lançamento' },
            { id: 'titulo', label: 'Título Principal', placeholder: 'ex: Santa Marina', default: 'Santa Marina' },
            { id: 'metro_bar_txt', label: 'Barra Metrô Topo', placeholder: 'ex: Próximo a Futura Estação de Metrô Santa Marina', default: 'Próximo a Futura Estação de Metrô Santa Marina' },
            { id: 'preco_val', label: 'Preço (Mil)', placeholder: 'ex: 280', default: '280' },
            { id: 'metro_linha', label: 'Linha do Metrô', placeholder: 'ex: Linha 3 - Vermelha', default: 'Linha 3 - Vermelha' },
            { id: 'metro_estacao', label: 'Estação', placeholder: 'ex: BELÉM', default: 'BELÉM' },
            { id: 'num_dorms', label: 'Número de Dormitórios', placeholder: 'ex: 1e2', default: '1e2' },
            { id: 'label_lazer', label: 'Rótulo Lazer', placeholder: 'ex: LAZER COMPLETO COM PISCINA', default: 'LAZER COMPLETO COM PISCINA' },
            { id: 'dorms_txt', label: 'Texto Dormitórios', placeholder: 'ex: DORMS', default: 'DORMS' },
            { id: 'barra_opcoes', label: 'Barra Inferior Opções', placeholder: 'ex: OPÇÕES C/TERRAÇO E VAGA', default: 'OPÇÕES C/TERRAÇO E VAGA' }
        ],
        defaults: {
            lancamento_txt: 'Lançamento',
            titulo: 'Santa Marina',
            metro_bar_txt: 'Próximo a Futura Estação de Metrô Santa Marina',
            preco_val: '280',
            metro_linha: 'Linha 3 - Vermelha',
            metro_estacao: 'BELÉM',
            num_dorms: '1e2',
            label_lazer: 'LAZER COMPLETO COM PISCINA',
            dorms_txt: 'DORMS',
            barra_opcoes: 'OPÇÕES C/TERRAÇO E VAGA'
        }
    },

    {
        id: 'luv-tatuape',
        name: 'LUV Tatuapé Copa',
        category: 'mcmv',
        htmlOverlay: true,
        bgImage: '/imovel/Assets/1787323094648_image.png',
        fields: [
            { id: 'nome_l1',        label: 'Nome Empreendimento (ex: LUV)',          placeholder: 'ex: LUV',                    default: 'LUV' },
            { id: 'nome_l2',        label: 'Subtítulo (ex: / TATUAPÉ)',              placeholder: 'ex: / TATUAPÉ',              default: '/ TATUAPÉ' },
            { id: 'pill_promocao',  label: 'Pill Promoção',                          placeholder: 'ex: PROMOÇÃO COPA DO MUNDO',  default: 'PROMOÇÃO COPA DO MUNDO' },
            { id: 'pill_luv',       label: 'Pill LUV NA COPA',                       placeholder: 'ex: LUV NA COPA',            default: 'LUV NA COPA' },
            { id: 'headline_l1',    label: 'Headline Linha 1',                       placeholder: 'ex: A próxima copa',         default: 'A próxima copa' },
            { id: 'headline_l2',    label: 'Headline Linha 2 (Destaque)',            placeholder: 'ex: VOCÊ ASSISTE',           default: 'VOCÊ ASSISTE' },
            { id: 'headline_l3',    label: 'Headline Linha 3 (Destaque)',            placeholder: 'ex: NO SEU APÊ',             default: 'NO SEU APÊ' },
            { id: 'visite_l1',      label: 'Texto Visita L1',                        placeholder: 'ex: Visite o Stand do LUV',  default: 'Visite o Stand do LUV' },
            { id: 'visite_l2',      label: 'Texto Visita L2',                        placeholder: 'ex: Tatuapé e ganhe um',     default: 'Tatuapé e ganhe um' },
            { id: 'visite_l3',      label: 'Destaque Visita (Kit)',                  placeholder: 'ex: Kit Torcedor',           default: 'Kit Torcedor' },
            { id: 'label_unidades', label: 'Label Preço',                            placeholder: 'ex: Unidades a partir de',   default: 'Unidades a partir de' },
            { id: 'valor_preco',    label: 'Valor (ex: 330)',                        placeholder: 'ex: 330',                    default: '330' },
            { id: 'features',       label: 'Features (ex: 2 DORMS | Use seu FGTS)', placeholder: 'ex: 2 DORMS | Use seu FGTS', default: '2 DORMS | Use seu FGTS' },
            { id: 'cta_texto',      label: 'Texto CTA',                              placeholder: 'ex: Conheça as condições especiais', default: 'Conheça as\ncondições\nespeciais' },
            { id: 'texto_legal',    label: 'Texto Legal (Rodapé)',                   placeholder: 'ex: Promoção válida de...',  default: 'Promoção válida de 01 a 30/06/2026, exclusivamente para clientes que visitarem o stand do LUV Tatuapé, realizarem atendimento completo e cumprirem todos os critérios estabelecidos no regulamento da promoção.\n• Kit Torcedor limitado a 1 unidade por cliente/família, sujeito à disponibilidade.\n• Documentação grátis válida para unidades de pré-lançamento, conforme condições comerciais vigentes no plantão.' }
        ],
        defaults: {
            nome_l1:        'LUV',
            nome_l2:        '/ TATUAPÉ',
            pill_promocao:  'PROMOÇÃO COPA DO MUNDO',
            pill_luv:       'LUV NA COPA',
            headline_l1:    'A próxima copa',
            headline_l2:    'VOCÊ ASSISTE',
            headline_l3:    'NO SEU APÊ',
            visite_l1:      'Visite o Stand do LUV',
            visite_l2:      'Tatuapé e ganhe um',
            visite_l3:      'Kit Torcedor',
            label_unidades: 'Unidades a partir de',
            valor_preco:    '330',
            features:       '2 DORMS | Use seu FGTS',
            cta_texto:      'Conheça as\ncondições\nespeciais',
            texto_legal:    'Promoção válida de 01 a 30/06/2026, exclusivamente para clientes que visitarem o stand do LUV Tatuapé, realizarem atendimento completo e cumprirem todos os critérios estabelecidos no regulamento da promoção.\n• Kit Torcedor limitado a 1 unidade por cliente/família, sujeito à disponibilidade.\n• Documentação grátis válida para unidades de pré-lançamento, conforme condições comerciais vigentes no plantão.'
        }
    },
];

const VIDEO_TEMPLATES = [
    {
        id: 'tour-legendas', name: 'Tour Virtual com Legendas',
        desc: 'Adicione legendas dinâmicas ao vídeo do tour virtual do imóvel. Ideal para Reels e Stories.',
        icon: 'fa-solid fa-closed-captioning', duration: '15-60s',
        defaults: { headline: 'Conheça esse incrível apartamento', subtitle: 'Agende sua visita no link da bio!' }
    },
    {
        id: 'slideshow', name: 'Slideshow de Fotos',
        desc: 'Transforme suas fotos do imóvel em um vídeo profissional com transições suaves e música.',
        icon: 'fa-solid fa-images', duration: '15-30s',
        defaults: { headline: 'As melhores fotos do empreendimento', subtitle: 'Lançamento exclusivo!' }
    },
    {
        id: 'antes-depois', name: 'Antes e Depois',
        desc: 'Compare fotos de antes e depois da reforma ou decoração do imóvel com transição wipe.',
        icon: 'fa-solid fa-right-left', duration: '10-20s',
        defaults: { headline: 'Veja a transformação', subtitle: 'De obra a sonho realizado' }
    },
    {
        id: 'contagem-regressiva', name: 'Contagem Regressiva',
        desc: 'Crie expectativa com uma contagem regressiva para o lançamento do empreendimento.',
        icon: 'fa-solid fa-clock', duration: '10-15s',
        defaults: { headline: 'Lançamento em breve!', subtitle: 'Cadastre-se para condições especiais' }
    },
    {
        id: 'depoimento', name: 'Depoimento de Cliente',
        desc: 'Adicione overlays profissionais ao vídeo de depoimento do cliente com legenda e nome.',
        icon: 'fa-solid fa-quote-right', duration: '30-90s',
        defaults: { headline: 'O que nossos clientes dizem', subtitle: 'Histórias reais de quem já mora aqui' }
    },
    {
        id: 'institucional', name: 'Institucional da Corretora',
        desc: 'Vídeo institucional com logo, missão e principais empreendimentos da sua incorporadora.',
        icon: 'fa-solid fa-building-columns', duration: '30-60s',
        defaults: { headline: 'Conheça nossa empresa', subtitle: 'Há mais de 10 anos realizando sonhos' }
    }
];


let selectedTemplateId = null;

function isTemplate45() {
    const t = TEMPLATE_GALLERY.find(x => x.id === selectedTemplateId);
    return t ? t.height === 1350 : false;
}

function reflowLayout(layers, targetFormat) {
    const isPlanta = isTemplate45();
    const targetW = 1080;
    const targetH = targetFormat === 'story' ? 1920 : (isPlanta ? 1350 : 1080);
    
    const baseW = 1080;
    const baseH = 1080; // As coordenadas base são definidas em 1080x1080
    
    const sx = targetW / baseW;
    
    // Configurações de safe zone
    let topSafe = 60;
    let bottomSafe = 60;
    let topPad = 0;
    let bottomPad = 0;
    
    if (targetFormat === 'story') {
        topSafe = 250;
        bottomSafe = 380;
        topPad = 15; // respiro abaixo do topo da safe zone
        bottomPad = 0;
    } else if (isPlanta) {
        // Para 4:5 (1350px), podemos usar safe zone padrão de 60px
        topSafe = 60;
        bottomSafe = 60;
        topPad = 0;
        bottomPad = 0;
    }
    
    // Separa os clusters
    const topLayers = layers.filter(l => l.cluster === 'TOP');
    const bottomLayers = layers.filter(l => l.cluster === 'BOTTOM');
    
    // 1) Escala horizontal e fontes
    layers.forEach(L => {
        if (L.cluster === 'BG') {
            L.top = '0px';
            L.left = '0px';
            L.width = targetW + 'px';
            L.height = targetH + 'px';
            L.cssText = updateCssProp(L.cssText, 'width', targetW + 'px');
            L.cssText = updateCssProp(L.cssText, 'height', targetH + 'px');
            return;
        }
        
        // Se a largura diferir, escala horizontalmente (atualmente sx = 1)
        if (sx !== 1) {
            let leftVal = parseFloat(L.left) || 0;
            L.left = (leftVal * sx) + 'px';
            
            let wVal = parseFloat(L.width) || 0;
            if (wVal) L.width = (wVal * sx) + 'px';
            L.cssText = updateCssProp(L.cssText, 'width', L.width);
            
            // Escala fontSize na cssText
            if (L.cssText) {
                const fsMatch = L.cssText.match(/font-size:\s*(\d+)px/);
                if (fsMatch) {
                    const newFs = Math.round(parseFloat(fsMatch[1]) * sx);
                    L.cssText = L.cssText.replace(/font-size:\s*\d+px/, `font-size:${newFs}px`);
                }
            }
        }
    });
    
    // 2) Âncoras verticais por cluster
    if (topLayers.length > 0) {
        // Encontra o menor Y inicial no TOP
        const clusterTop0 = Math.min(...topLayers.map(L => parseFloat(L.top) || 0));
        const desiredTop = topSafe + topPad;
        const dTop = desiredTop - clusterTop0;
        topLayers.forEach(L => {
            let currentTop = parseFloat(L.top) || 0;
            let newTop = currentTop + dTop;
            L.top = newTop + 'px';
            
            const el = document.getElementById('el-' + L.id);
            if (el) el.style.top = L.top;
        });
    }
    
    if (bottomLayers.length > 0) {
        // Encontra a base máxima no BOTTOM em 1080x1080 base
        // Para calcular a base, usamos o y base + h base
        const clusterBottom0 = Math.max(...bottomLayers.map(L => {
            let yVal = parseFloat(L.top) || 0;
            let hVal = parseFloat(L.height) || 0;
            return yVal + hVal;
        }));
        
        let desiredBottom = targetH - bottomSafe - bottomPad;
        const hasFooter = layers.some(l => l.cluster === 'FOOTER');
        if (hasFooter) {
            desiredBottom = Math.min(desiredBottom, targetH - 140);
        }
        const dBottom = desiredBottom - clusterBottom0;
        bottomLayers.forEach(L => {
            let currentTop = parseFloat(L.top) || 0;
            let newTop = currentTop + dBottom;
            L.top = newTop + 'px';
            
            const el = document.getElementById('el-' + L.id);
            if (el) el.style.top = L.top;
        });
    }

    const footerLayers = layers.filter(l => l.cluster === 'FOOTER');
    if (footerLayers.length > 0) {
        const clusterFooter0 = 1080; // a base máxima do rodapé na resolução base
        const desiredFooter = targetH;
        const dFooter = desiredFooter - clusterFooter0;
        footerLayers.forEach(L => {
            let currentTop = parseFloat(L.top) || 0;
            let newTop = currentTop + dFooter;
            L.top = newTop + 'px';
            
            const el = document.getElementById('el-' + L.id);
            if (el) el.style.top = L.top;
        });
    }
    
    // 3) Garantia de safe zone (clamp / fit)
    // Se a altura do cluster for maior que a disponível, escala verticalmente para caber
    [topLayers, bottomLayers].forEach(cluster => {
        if (cluster.length === 0) return;
        const minY = Math.min(...cluster.map(L => parseFloat(L.top) || 0));
        const maxY = Math.max(...cluster.map(L => (parseFloat(L.top) || 0) + (parseFloat(L.height) || 0)));
        const height = maxY - minY;
        const disponivel = targetH - topSafe - bottomSafe;
        if (height > disponivel) {
            const f = disponivel / height;
            const centro = minY + (height / 2);
            cluster.forEach(L => {
                let currentTop = parseFloat(L.top) || 0;
                let currentHeight = parseFloat(L.height) || 0;
                
                let newTop = centro + (currentTop - centro) * f;
                let newHeight = currentHeight * f;
                
                L.top = newTop + 'px';
                L.height = newHeight + 'px';
                L.cssText = updateCssProp(L.cssText, 'height', L.height);
                
                const el = document.getElementById('el-' + L.id);
                if (el) {
                    el.style.top = L.top;
                    el.style.height = L.height;
                }
            });
        }
    });
    
    return layers;
}
let selectedFormat = 'feed';
let canvasReady = false;
let uploadedProductImage = null;

// Armazenar as imagens geradas pela IA e recortes do frontend
let generatedFeedUrl = null;
let generatedStoryUrl = null;
let croppedImage11 = null;
let croppedImage916 = null;
let lastUserAdjustment = "";
let aiRawImageUrl = null; // Guarda a imagem pura da IA antes da logo

async function applyLogoToImage(imageUrl, logoUrl) {
    if (!logoUrl) return imageUrl;
    
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.crossOrigin = "anonymous";
        
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            const logo = new Image();
            logo.crossOrigin = "anonymous";
            logo.onload = () => {
                const maxLogoWidth = canvas.width * 0.25;
                const maxLogoHeight = canvas.height * 0.15;
                const ratio = Math.min(maxLogoWidth / logo.width, maxLogoHeight / logo.height);
                const drawW = logo.width * ratio;
                const drawH = logo.height * ratio;
                
                const padding = 40;
                const drawX = canvas.width - drawW - padding;
                const drawY = padding;
                
                ctx.drawImage(logo, drawX, drawY, drawW, drawH);
                resolve(canvas.toDataURL('image/jpeg', 0.95));
            };
            logo.onerror = () => resolve(imageUrl);
            logo.src = logoUrl;
        };
        img.onerror = () => resolve(imageUrl);
        img.src = imageUrl;
    });
}

function removeChromaKey(img) {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, c.width, c.height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];
        
        // Detecta tons de magenta (CHROMA KEY)
        if (r > 150 && b > 150 && g < Math.min(r, b) * 0.6) {
            data[i + 3] = 0; // Aplica Alpha 0 (Transparente)
        }
    }
    ctx.putImageData(imageData, 0, 0);
    return c.toDataURL('image/png'); // Importante ser PNG para manter transparência
}

function getCroppedBase64(img, outW, outH) {
    const c = document.createElement('canvas');
    c.width = outW;
    c.height = outH;
    const ctx = c.getContext('2d');
    
    const imgRatio = img.width / img.height;
    const canvasRatio = outW / outH;
    let drawW, drawH, drawX, drawY;
    
    if (imgRatio > canvasRatio) {
        drawH = outH;
        drawW = outH * imgRatio;
        drawX = (outW - drawW) / 2;
        drawY = 0;
    } else {
        drawW = outW;
        drawH = outW / imgRatio;
        drawX = 0;
        drawY = (outH - drawH) / 2;
    }
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    
    // Suporta transparência se a imagem original for PNG
    const isPng = img.src && (img.src.includes('image/png') || img.src.includes('.png') || img.src.startsWith('data:image/png'));
    if (isPng) {
        return c.toDataURL('image/png');
    }
    return c.toDataURL('image/jpeg', 0.9);
}

function setupAIStudio() {
    const navGallery = document.getElementById('studio-nav-gallery');
    const navEditor  = document.getElementById('studio-nav-editor');
    const navSuccess = document.getElementById('studio-nav-success');
    const galleryView = document.getElementById('studio-gallery-view');
    const editorView  = document.getElementById('studio-editor-view');
    const successView = document.getElementById('studio-success-view');
    const backBtn     = document.getElementById('studio-back-to-gallery');
    const backBtnSuccess = document.getElementById('btn-success-back');

    function showGallery() {
        galleryView.classList.add('active');
        editorView.classList.remove('active');
        if(successView) successView.classList.remove('active');
        
        navGallery.classList.add('active');
        navEditor.classList.remove('active');
        if(navSuccess) {
            navSuccess.classList.remove('active');
            navSuccess.style.display = 'none';
        }
    }

    function showEditor() {
        editorView.classList.add('active');
        galleryView.classList.remove('active');
        if(successView) successView.classList.remove('active');

        navEditor.classList.add('active');
        navGallery.classList.remove('active');
        if(navSuccess) {
            navSuccess.classList.remove('active');
            navSuccess.style.display = 'none';
        }
    }

    function showSuccessView() {
        if(successView) successView.classList.add('active');
        editorView.classList.remove('active');
        galleryView.classList.remove('active');

        if(navSuccess) {
            navSuccess.style.display = 'inline-flex';
            navSuccess.classList.add('active');
        }
        navEditor.classList.remove('active');
        navGallery.classList.remove('active');
    }

    if (navGallery) navGallery.addEventListener('click', showGallery);
    if (navEditor) navEditor.addEventListener('click', showEditor);
    if (navSuccess) navSuccess.addEventListener('click', showSuccessView);
    if (backBtn) backBtn.addEventListener('click', showGallery);
    if (backBtnSuccess) backBtnSuccess.addEventListener('click', showEditor);

    // --- Category Filter Tabs ---
    const tabContainer = document.getElementById('template-gallery-tabs');
    if (tabContainer) {
        tabContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.template-tab-btn');
            if (!btn) return;
            tabContainer.querySelectorAll('.template-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderTemplateGallery(btn.getAttribute('data-category'));
        });
    }

    // --- Render gallery ---
    renderTemplateGallery('all');

    // --- Format selector ---
    const formatCards = document.querySelectorAll('#studio-editor-view .format-card');
    formatCards.forEach(card => {
        card.addEventListener('click', () => {
            formatCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            selectedFormat = card.getAttribute('data-format');
            
            // Troca a URL ativa baseada no formato selecionado (se a IA já gerou)
            if (selectedFormat === 'feed' && generatedFeedUrl) {
                selectedUrl = generatedFeedUrl;
            } else if (selectedFormat === 'story' && generatedStoryUrl) {
                selectedUrl = generatedStoryUrl;
            }
            
            if (typeof renderInteractiveOverlay === 'function' && selectedTemplateId) {
                renderInteractiveOverlay();
            }
            if (canvasReady) renderCreativeCanvas();
        });
    });

    // --- Upload: Logo ---
    setupUploadBox('studio-logo-upload-box', 'studio-logo-input', 'studio-logo-preview', false);

    setupUploadBox('studio-product-upload-box', 'studio-product-input', 'studio-product-preview', false, (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                uploadedProductImage = img;
                
                if (typeof renderInteractiveOverlay === 'function') {
                    renderInteractiveOverlay();
                }
                if (typeof renderCreativeCanvas === 'function') {
                    renderCreativeCanvas();
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });

    // --- Brand Kit Logic ---
    const brandToggle = document.getElementById('studio-brand-toggle');
    const simpleColorWrap = document.getElementById('studio-simple-color-wrap');
    const brandKitWrap = document.getElementById('studio-brand-kit-wrap');
    const inputBrandColors = document.getElementById('studio-brand-colors');
    const inputBrandFonts = document.getElementById('studio-brand-fonts');

    // Carregar configurações salvas
    const savedBrandToggle = localStorage.getItem('imob_brand_toggle');
    const savedBrandColors = localStorage.getItem('imob_brand_colors');
    const savedBrandFonts = localStorage.getItem('imob_brand_fonts');

    if (savedBrandToggle === 'true') {
        if (brandToggle) brandToggle.checked = true;
        if (simpleColorWrap) simpleColorWrap.style.display = 'none';
        if (brandKitWrap) brandKitWrap.style.display = 'flex';
    }
    if (savedBrandColors && inputBrandColors) inputBrandColors.value = savedBrandColors;
    if (savedBrandFonts && inputBrandFonts) inputBrandFonts.value = savedBrandFonts;

    if (brandToggle) {
        brandToggle.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            localStorage.setItem('imob_brand_toggle', isChecked);
            if (isChecked) {
                simpleColorWrap.style.display = 'none';
                brandKitWrap.style.display = 'flex';
            } else {
                simpleColorWrap.style.display = 'flex';
                brandKitWrap.style.display = 'none';
            }
        });
    }

    if (inputBrandColors) {
        inputBrandColors.addEventListener('input', (e) => {
            localStorage.setItem('imob_brand_colors', e.target.value);
        });
    }

    if (inputBrandFonts) {
        inputBrandFonts.addEventListener('input', (e) => {
            localStorage.setItem('imob_brand_fonts', e.target.value);
        });
    }

    // --- Color picker ---
    const colorInput = document.getElementById('studio-color-input');
    const colorLabel = document.getElementById('color-hex-label');
    if (colorInput && colorLabel) {
        colorInput.addEventListener('input', (e) => {
            colorLabel.innerText = e.target.value.toUpperCase();
            if (canvasReady) renderCreativeCanvas();
        });
    }

    // --- Real-time Text Preview ---
    const textInputs = ['studio-headline-input', 'studio-text-input', 'studio-desc-input', 'studio-cta-input'];
    textInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                if (canvasReady) renderCreativeCanvas();
            });
        }
    });

    // --- Generate with AI ---
    const aiBtn = document.getElementById('studio-ai-btn');
    if (aiBtn) {
        aiBtn.addEventListener('click', async () => {
            if (!loggedUser || !loggedUser.token) {
                alert("Você precisa estar logado para usar a IA.");
                return;
            }

            // Removemos o prompt nativo do navegador a pedido do usuário.
            // A IA vai gerar baseada apenas na imagem e nos textos fornecidos.
            const promptStr = "";

            const originalHtml = aiBtn.innerHTML;
            aiBtn.classList.add("loading");
            aiBtn.disabled = true;
            aiBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Gerando Formatos (aprox. 20s)...`;

            try {
                // Captura os textos dinâmicos para enviar de contexto para a IA
                const custom_fields = {};
                document.querySelectorAll('.dyn-template-input').forEach(input => {
                    custom_fields[input.getAttribute('data-field-id')] = input.value || '';
                });
                
                // Descobre qual imagem base usar (a do usuário ou a do template)
                const templateObj = TEMPLATE_GALLERY.find(t => t.id === selectedTemplateId);
                const category = templateObj ? templateObj.category : 'alto-padrao';

                let baseImageToCrop = uploadedProductImage;
                let croppedImage11 = null;
                let croppedImage916 = null;
                
                // Se o usuário não subiu foto, carrega a foto do template
                if (!baseImageToCrop && templateObj && templateObj.bgImage) {
                    await new Promise((resolve) => {
                        const img = new Image();
                        img.crossOrigin = "anonymous";
                        img.onload = () => {
                            baseImageToCrop = img;
                            resolve();
                        };
                        img.onerror = () => resolve(); // Se der erro, segue sem imagem
                        img.src = templateObj.bgImage;
                    });
                }

                // Recorta a imagem em 1:1 (ou 4:5 para planta-mcmv) e 9:16 antes de enviar para a IA / editor
                if (baseImageToCrop) {
                    const isPlanta = isTemplate45();
                    const targetH = isPlanta ? 1350 : 1080;
                    croppedImage11 = getCroppedBase64(baseImageToCrop, 1080, targetH);
                    croppedImage916 = getCroppedBase64(baseImageToCrop, 1080, 1920);
                }

                // Define as propriedades de cor/fonte (Brand Identity module)
                const c1 = localStorage.getItem('imob_brand_color_primary') || '';
                const c2 = localStorage.getItem('imob_brand_color_secondary') || '';
                const c3 = localStorage.getItem('imob_brand_color_tertiary') || '';
                
                let brandColorsArr = [];
                if (c1) brandColorsArr.push(`Primária: ${c1}`);
                if (c2) brandColorsArr.push(`Secundária: ${c2}`);
                if (c3) brandColorsArr.push(`Terciária: ${c3}`);
                const brandColors = brandColorsArr.join(', ');

                const brandFonts = localStorage.getItem('imob_brand_fonts') || '';
                const isBrandKitEnabled = !!(brandColors || brandFonts);
                const simpleColor = document.getElementById('studio-color-input')?.value || '#c8da42';

                // ═══════════════════════════════════════════════════════
                // HTML OVERLAY — composição pura, sem chamada de IA
                // Suporta: planta-mcmv, lar-feliz (htmlOverlay: true), e MCMV genérico
                // ═══════════════════════════════════════════════════════
                if (templateObj && templateObj.htmlOverlay) {
                    const isPlanta = isTemplate45();
                    const isStory = selectedFormat === 'story';
                    const targetH = isStory ? 1920 : (isPlanta ? 1350 : 1080);
                    
                    let bgSrc = null;
                    if (typeof uploadedProductImage !== 'undefined' && uploadedProductImage) {
                        try {
                            const _c = document.createElement('canvas');
                            _c.width = 1080; _c.height = targetH;
                            _c.getContext('2d').drawImage(uploadedProductImage, 0, 0, 1080, targetH);
                            bgSrc = _c.toDataURL('image/jpeg', 0.92);
                        } catch(e) { bgSrc = templateObj.bgImage; }
                    } else if (typeof croppedImage11 !== 'undefined' && croppedImage11) {
                        bgSrc = croppedImage11;
                    }
                    bgSrc = bgSrc || templateObj.bgImage;

                    const approvalImg = document.getElementById('success-preview-img');
                    if (approvalImg && bgSrc) {
                        approvalImg.src = typeof bgSrc === 'string' ? bgSrc : '';
                    }
                    window.lastGeneratedBgImage = bgSrc;
                    aiRawImageUrl = bgSrc;

                    const brandC1 = localStorage.getItem('imob_brand_color_primary') || '#0a4635';
                    const brandC2 = localStorage.getItem('imob_brand_color_secondary') || '#c8da42';
                    const brandFont = localStorage.getItem('imob_brand_fonts') || 'Inter, sans-serif';

                    if (selectedTemplateId === 'planta-mcmv') {
                        renderPlantaOverlay(custom_fields, brandC1, brandC2, brandFont);
                    } else {
                        renderInteractiveOverlay();
                    }
                    showEditorProView();

                    aiBtn.innerHTML = originalHtml;
                    aiBtn.disabled = false;
                    aiBtn.classList.remove("loading");
                    return; // Para aqui — não chama fetch abaixo
                }
                // ═══════════════════════════════════════════════════════

                const res = await fetch("/imovel/api/generate-image", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${loggedUser.token}`
                    },
                    body: JSON.stringify({
                        prompt: promptStr,
                        style: selectedTemplateId,
                        category: category,
                        template_prompt: templateObj ? templateObj.aiPrompt : '',
                        format: selectedFormat, // Envia 'feed' ou 'story' normalmente
                        custom_fields: custom_fields,
                        color: simpleColor,
                        use_brand_kit: isBrandKitEnabled,
                        brand_colors: brandColors,
                        brand_fonts: brandFonts,
                        image_data: croppedImage11 || null // Envia a foto do usuário (ou do template) como base para a IA compor os shapes
                    })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Erro desconhecido ao gerar a imagem.");

                if (data.status === 'coming_soon') {
                    alert("Aviso: " + data.error);
                } else if (data.image_urls && data.image_urls.length > 0) {
                    // Atualiza créditos localmente para efeito visual no frontend
                    packageState.artesFeitas++;
                    updateDashboardMetrics();
                    updateSidebarCredits();

                    aiRawImageUrl = data.image_urls[0];

                    const approvalImg = document.getElementById('success-preview-img');
                    
                    if (category === 'mcmv') {
                        const imgForKey = new Image();
                        imgForKey.crossOrigin = "anonymous";
                        imgForKey.onload = () => {
                            try {
                                // Passo 1: Remove o chroma key magenta do overlay da IA
                                const transparentOverlayBase64 = removeChromaKey(imgForKey);
                                
                                // Passo 2: Carrega a foto de fundo do usuário
                                // Prioridade: 1) foto recortada do usuário, 2) foto original do usuário, 3) foto padrão do template
                                const bgSrc = croppedImage11 || (uploadedProductImage ? (() => { const c = document.createElement('canvas'); c.width=1080; c.height=1080; const x=c.getContext('2d'); x.drawImage(uploadedProductImage,0,0,1080,1080); return c.toDataURL('image/jpeg',0.92); })() : null) || templateObj.bgImage;
                                window.lastGeneratedBgImage = bgSrc;
                                
                                const bgImg = new Image();
                                bgImg.onload = () => {
                                    const isPlanta = isTemplate45();
                                    const isStory = selectedFormat === 'story';
                                    const targetH = isStory ? 1920 : (isPlanta ? 1350 : 1080);

                                    // Passo 3: Composita foto + overlay num canvas 1080xH
                                    const canvas = document.createElement('canvas');
                                    canvas.width = 1080;
                                    canvas.height = targetH;
                                    const ctx = canvas.getContext('2d');
                                    
                                    // Desenha foto de fundo (cover)
                                    const imgRatio = bgImg.width / bgImg.height;
                                    const canvasRatio = 1080 / targetH;
                                    let dw = 1080, dh = targetH, dx = 0, dy = 0;
                                    if (imgRatio > canvasRatio) { 
                                        dw = targetH * imgRatio; 
                                        dx = -(dw - 1080) / 2; 
                                    } else { 
                                        dh = 1080 / imgRatio; 
                                        dy = -(dh - targetH) / 2; 
                                    }
                                    ctx.drawImage(bgImg, dx, dy, dw, dh);
                                    
                                    // Desenha o overlay transparente da IA por cima
                                    const overlayImg = new Image();
                                    overlayImg.onload = () => {
                                        ctx.drawImage(overlayImg, 0, 0, 1080, targetH);
                                        
                                        // Passo 4: O resultado é a imagem composta (foto + formas da IA)
                                        const composedBase64 = canvas.toDataURL('image/png');
                                        aiRawImageUrl = composedBase64; // Guarda para download
                                        window.lastGeneratedBgImage = composedBase64; // Usa como fundo do editor
                                        
                                        if (approvalImg) {
                                            approvalImg.src = composedBase64;
                                            if (typeof renderInteractiveOverlay === 'function') {
                                                renderInteractiveOverlay();
                                            }
                                            showEditorProView();
                                        }
                                        
                                        aiBtn.innerHTML = originalHtml;
                                        aiBtn.disabled = false;
                                        aiBtn.classList.remove("loading");
                                    };
                                    overlayImg.onerror = () => {
                                        // Se falhar ao carregar overlay, usa só a foto
                                        window.lastGeneratedBgImage = bgSrc;
                                        if (approvalImg) { approvalImg.src = bgSrc; }
                                        if (typeof renderInteractiveOverlay === 'function') renderInteractiveOverlay();
                                        showEditorProView();
                                        aiBtn.innerHTML = originalHtml;
                                        aiBtn.disabled = false;
                                        aiBtn.classList.remove("loading");
                                    };
                                    overlayImg.src = transparentOverlayBase64;
                                };
                                bgImg.onerror = () => {
                                    // Fallback: usa só o overlay sem fundo
                                    aiRawImageUrl = transparentOverlayBase64;
                                    window.lastGeneratedBgImage = transparentOverlayBase64;
                                    if (approvalImg) { approvalImg.src = transparentOverlayBase64; }
                                    if (typeof renderInteractiveOverlay === 'function') renderInteractiveOverlay();
                                    showEditorProView();
                                    aiBtn.innerHTML = originalHtml;
                                    aiBtn.disabled = false;
                                    aiBtn.classList.remove("loading");
                                };
                                bgImg.crossOrigin = "anonymous";
                                bgImg.src = bgSrc;
                                
                            } catch (e) {
                                console.error("Erro processando imagem IA:", e);
                                alert("Falha ao compor imagem: " + e.message);
                                aiBtn.innerHTML = originalHtml;
                                aiBtn.disabled = false;
                                aiBtn.classList.remove("loading");
                            }
                        };
                        imgForKey.onerror = () => {
                            alert("Falha ao baixar a imagem gerada pela IA.");
                            aiBtn.innerHTML = originalHtml;
                            aiBtn.disabled = false;
                            aiBtn.classList.remove("loading");
                        };
                        // Forçar revalidação de cache no CDN para evitar falha de CORS
                        imgForKey.src = data.image_urls[0] + '?t=' + new Date().getTime();
                    } else {
                        if (approvalImg) {
                            approvalImg.src = aiRawImageUrl;
                            if (typeof renderInteractiveOverlay === 'function') {
                                renderInteractiveOverlay();
                            }
                            showEditorProView();
                        }
                        aiBtn.innerHTML = originalHtml;
                        aiBtn.disabled = false;
                        aiBtn.classList.remove("loading");
                    }
                }

            } catch (err) {
                alert("Ocorreu um erro: " + err.message + "\n\nDebug URL: " + window.location.href);
                console.error(err);
            } finally {
                aiBtn.classList.remove("loading");
                aiBtn.disabled = false;
                aiBtn.innerHTML = originalHtml;
            }
        });
    }

    // --- Download / Aprovar Arte ---
    const downloadBtn = document.getElementById('studio-download-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            downloadCreative();
        });
    }

    // --- Botão DEBUG para não gastar créditos ---
    const btnDebug = document.getElementById('debug-editor-btn');
    if (btnDebug) {
        btnDebug.addEventListener('click', () => {
            const isPlanta = isTemplate45();
            const templateObj = TEMPLATE_GALLERY.find(t => t.id === selectedTemplateId);
            const isHtmlOverlay = templateObj && templateObj.htmlOverlay;
            // Preserva a imagem oficial de exemplo do template se for htmlOverlay (MCMV)
            const userBg = (!isHtmlOverlay && uploadedProductImage)
                ? (() => {
                    const c = document.createElement('canvas');
                    c.width = 1080; c.height = 1080;
                    const x = c.getContext('2d');
                    x.drawImage(uploadedProductImage, 0, 0, 1080, 1080);
                    return c.toDataURL('image/jpeg', 0.92);
                })()
                : null;

            const defaultBg = isPlanta
                ? '/imovel/Assets/planta_preco_example.png'
                : (templateObj && templateObj.bgImage ? templateObj.bgImage : '/imovel/Assets/lar_feliz_dresden.png');

            aiRawImageUrl = userBg || defaultBg;
            window.lastGeneratedBgImage = aiRawImageUrl;
            const approvalImg = document.getElementById('success-preview-img');
            if (approvalImg) {
                approvalImg.crossOrigin = 'anonymous';
                approvalImg.src = aiRawImageUrl;

                const custom_fields = {};
                document.querySelectorAll('.dyn-template-input').forEach(input => {
                    custom_fields[input.getAttribute('data-field-id')] = input.value || '';
                });

                const brandC1 = localStorage.getItem('imob_brand_color_primary') || '#0a4635';
                const brandC2 = localStorage.getItem('imob_brand_color_secondary') || '#c8da42';
                const brandFont = localStorage.getItem('imob_brand_fonts') || 'Inter, sans-serif';

                if (templateObj && templateObj.htmlOverlay) {
                    // Templates com htmlOverlay
                    if (selectedTemplateId === 'planta-mcmv') {
                        renderPlantaOverlay(custom_fields, brandC1, brandC2, brandFont);
                    } else {
                        renderInteractiveOverlay();
                    }
                    showEditorProView();
                } else {
                    // Lar Feliz e outros: usa renderInteractiveOverlay (layers atômicos)
                    approvalImg.onload = () => {
                        if (typeof renderInteractiveOverlay === 'function') {
                            renderInteractiveOverlay();
                        }
                    };
                    // Se a imagem já está cacheada, disparar onload manualmente
                    if (approvalImg.complete) {
                        if (typeof renderInteractiveOverlay === 'function') {
                            renderInteractiveOverlay();
                        }
                    }
                    showEditorProView();
                }
            }
        });
    }

    // --- Ações do Editor Pro ---
    const btnEditorDownload = document.getElementById('editor-btn-download');
    const btnEditorStory    = document.getElementById('editor-btn-story');
    const btnEditorFeed     = document.getElementById('editor-btn-feed');
    const btnEditorAdjust   = document.getElementById('editor-btn-ai-adjust');
    const btnEditorBack     = document.getElementById('editor-btn-back');

    // Sincroniza highlight dos botões Feed / Story
    function syncFormatButtons() {
        const isFeed  = selectedFormat !== 'story';
        if (btnEditorFeed)  btnEditorFeed.classList.toggle('active', isFeed);
        if (btnEditorStory) btnEditorStory.classList.toggle('active', !isFeed);
    }

    // Função auxiliar para forçar o download direto da URL da imagem AI
    const forceDownloadUrl = async (url, filename) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename + '.jpg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        } catch (e) {
            console.error("Erro no download direto", e);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename + '.jpg';
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };

    if (btnEditorDownload) {
        btnEditorDownload.addEventListener('click', async () => {
            // Descelecionar qualquer camada antes de tirar o print
            activeLayerIds = [];
            const prevSafeZone = window.showSafeZoneGuides;
            window.showSafeZoneGuides = false;
            if (typeof renderEditorProLayers === 'function') renderEditorProLayers();

            const originalHtml = btnEditorDownload.innerHTML;
            btnEditorDownload.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Baixando...';
            
            const wrapper = document.getElementById("interactive-overlay-wrapper");
            const restoredTextGradients = [];
            try {
                if (typeof html2canvas !== 'undefined') {
                    // --- WORKAROUND FOR GRADIENT TEXT IN HTML2CANVAS ---
                    // html2canvas does not support -webkit-background-clip: text.
                    // We temporarily replace any text layers using text gradients with high-fidelity canvas PNG images.
                    const textElements = wrapper.querySelectorAll('.editor-element[data-type="text"]');
                    textElements.forEach(el => {
                        const computed = window.getComputedStyle(el);
                        const bg = (computed.backgroundImage && computed.backgroundImage !== 'none') 
                            ? computed.backgroundImage 
                            : (computed.background || '');
                        const bgClip = computed.webkitBackgroundClip || computed.backgroundClip || '';
                        
                        if (bgClip.includes('text') && bg.includes('gradient')) {
                            // Extract colors
                            const colorRegex = /(#[0-9a-fA-F]{3,8}|rgba?\([^\)]+\))/g;
                            const matches = bg.match(colorRegex) || [];
                            const validColors = matches.filter(c => !c.includes('rgba(0, 0, 0, 0)') && c !== 'transparent');
                            const c1 = validColors[0] || '#F6E1A6';
                            const c2 = validColors[validColors.length - 1] || '#DEAE4E';
                            
                            // Dimensions
                            const w = el.offsetWidth || el.clientWidth || 440;
                            const h = el.offsetHeight || el.clientHeight || 200;
                            const fontSize = parseFloat(computed.fontSize) || 190;
                            const fontFamily = computed.fontFamily || 'Cinzel, serif';
                            const fontWeight = computed.fontWeight || '700';
                            const textAlign = computed.textAlign || 'center';
                            const textVal = el.innerText.trim();
                            
                            // Create temporary canvas
                            const canvas = document.createElement('canvas');
                            canvas.width = w;
                            canvas.height = h;
                            const ctx = canvas.getContext('2d');
                            ctx.clearRect(0, 0, w, h);
                            
                            // Font settings
                            ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
                            ctx.textAlign = textAlign;
                            ctx.textBaseline = 'alphabetic';
                            
                            // Create linear gradient
                            let grad;
                            if (bg.includes('to right') || bg.includes('90deg')) {
                                grad = ctx.createLinearGradient(0, 0, w, 0);
                            } else if (bg.includes('to bottom right') || bg.includes('135deg')) {
                                grad = ctx.createLinearGradient(0, 0, w, h);
                            } else {
                                grad = ctx.createLinearGradient(0, 0, 0, h);
                            }
                            grad.addColorStop(0, c1);
                            grad.addColorStop(1, c2);
                            ctx.fillStyle = grad;
                            
                            // Text position
                            let drawX = w / 2;
                            if (textAlign === 'left') drawX = 0;
                            else if (textAlign === 'right') drawX = w;
                            
                            let drawY = (h * 0.5) + (fontSize * 0.28);
                            
                            // Render text on canvas
                            const lines = textVal.split('\n');
                            if (lines.length > 1) {
                                const lineH = fontSize * 1.1;
                                const startY = (h - (lineH * (lines.length - 1))) / 2;
                                lines.forEach((lineText, index) => {
                                    ctx.fillText(lineText, drawX, startY + (index * lineH));
                                });
                            } else {
                                ctx.fillText(textVal, drawX, drawY);
                            }
                            
                            // Save original content and styles
                            restoredTextGradients.push({
                                el: el,
                                innerHTML: el.innerHTML,
                                background: el.style.background,
                                backgroundImage: el.style.backgroundImage,
                                backgroundColor: el.style.backgroundColor,
                                webkitBackgroundClip: el.style.webkitBackgroundClip,
                                backgroundClip: el.style.backgroundClip,
                                color: el.style.color,
                                webkitTextFillColor: el.style.webkitTextFillColor
                            });
                            
                            // Temporarily strip styles for print
                            el.style.background = 'none';
                            el.style.backgroundImage = 'none';
                            el.style.backgroundColor = 'transparent';
                            el.style.webkitBackgroundClip = 'initial';
                            el.style.backgroundClip = 'initial';
                            el.style.color = 'initial';
                            el.style.webkitTextFillColor = 'initial';
                            
                            // Replace with PNG image
                            el.innerHTML = `<img src="${canvas.toDataURL('image/png')}" style="width:100%; height:100%; display:block; object-fit:contain; pointer-events:none; border:none; background:none;">`;
                        }
                    });

                    // Adiciona classe de download para remover safe zones, grades, e sombras temporariamente
                    wrapper.classList.add('is-downloading');

                    // Força scale 1 no wrapper momentaneamente para garantir resolução correta no print
                    const oldTransform = wrapper.style.transform;
                    wrapper.style.transform = "scale(1)";
                    
                    // Determina a cor de fundo real do wrapper para evitar transparências com grade
                    const computedBg = window.getComputedStyle(wrapper).backgroundColor || '#000000';
                    const finalBg = (computedBg === 'transparent' || computedBg === 'rgba(0, 0, 0, 0)') ? '#000000' : computedBg;

                    // Como o artboard já tem 1080x1080 reais, o scale 1 basta
                    const canvas = await html2canvas(wrapper, { 
                        useCORS: true, 
                        backgroundColor: finalBg, 
                        scale: 1 
                    });
                    
                    // Restaura scale e remove classe de download
                    wrapper.style.transform = oldTransform;
                    wrapper.classList.remove('is-downloading');

                    // Restaura os textos originais
                    restoredTextGradients.forEach(item => {
                        item.el.innerHTML = item.innerHTML;
                        item.el.style.background = item.background;
                        item.el.style.backgroundImage = item.backgroundImage || '';
                        item.el.style.backgroundColor = item.backgroundColor || '';
                        item.el.style.webkitBackgroundClip = item.webkitBackgroundClip;
                        item.el.style.backgroundClip = item.backgroundClip;
                        item.el.style.color = item.color;
                        item.el.style.webkitTextFillColor = item.webkitTextFillColor;
                    });
                    
                    const finalImgData = canvas.toDataURL("image/jpeg", 0.9);
                    const a = document.createElement('a');
                    a.href = finalImgData;
                    a.download = 'ImobGrowth_Arte.jpg';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                } else {
                    await forceDownloadUrl(aiRawImageUrl, 'ImobGrowth_Arte_Fallback');
                }
            } catch (e) {
                console.error("Erro no html2canvas", e);
                if (wrapper) wrapper.classList.remove('is-downloading');
                // Restaura os textos originais em caso de erro
                restoredTextGradients.forEach(item => {
                    item.el.innerHTML = item.innerHTML;
                    item.el.style.background = item.background;
                    item.el.style.backgroundImage = item.backgroundImage || '';
                    item.el.style.backgroundColor = item.backgroundColor || '';
                    item.el.style.webkitBackgroundClip = item.webkitBackgroundClip;
                    item.el.style.backgroundClip = item.backgroundClip;
                    item.el.style.color = item.color;
                    item.el.style.webkitTextFillColor = item.webkitTextFillColor;
                });
                await forceDownloadUrl(aiRawImageUrl, 'ImobGrowth_Arte_Fallback');
            }
            
            // Restaura safe zone
            window.showSafeZoneGuides = prevSafeZone;
            if (typeof renderEditorProLayers === 'function') renderEditorProLayers();
            
            btnEditorDownload.innerHTML = originalHtml;
        });
    }

    // --- Bot\u00e3o FEED ---
    if (btnEditorFeed) {
        btnEditorFeed.addEventListener('click', async () => {
            if (selectedFormat === 'feed' || selectedFormat === 'planta') return; // j\u00e1 est\u00e1 em feed
            saveEditorState();
            selectedFormat = 'feed';
            syncFormatButtons();
            if (typeof renderInteractiveOverlay === 'function') {
                renderInteractiveOverlay();
            }
            updateEditorZoom(0);
        });
    }

    // --- Bot\u00e3o STORY ---
    if (btnEditorStory) {
        btnEditorStory.addEventListener('click', async () => {
            if (selectedFormat === 'story') return; // j\u00e1 est\u00e1 em story
            saveEditorState();
            selectedFormat = 'story';
            syncFormatButtons();
            if (typeof renderInteractiveOverlay === 'function') {
                renderInteractiveOverlay();
            }
            updateEditorZoom(0);
        });
    }

    // Sincronizar bot\u00f5es na abertura do editor
    syncFormatButtons();


    // Helper para redimensionar base64 grande
    function resizeBase64ToMax(base64Str, maxSize) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                if (Math.max(img.width, img.height) <= maxSize) {
                    resolve(base64Str);
                    return;
                }
                const canvas = document.createElement('canvas');
                let w = img.width;
                let h = img.height;
                if (w > h) {
                    if (w > maxSize) {
                        h = Math.round(h * (maxSize / w));
                        w = maxSize;
                    }
                } else {
                    if (h > maxSize) {
                        w = Math.round(w * (maxSize / h));
                        h = maxSize;
                    }
                }
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = () => resolve(base64Str);
            img.src = base64Str;
        });
    }

    // Helper para obter a URL de dados da imagem (convertendo imagens locais para base64 com limite de resolução)
    async function getImageDataUrl(url) {
        if (!url) return '';
        if (url.startsWith('data:')) {
            if (url.length > 1024 * 1024) { // Maior que 1MB
                return await resizeBase64ToMax(url, 1080);
            }
            return url;
        }
        if (url.startsWith('http') && !url.includes('localhost') && !url.includes('127.0.0.1') && !url.includes('::1')) {
            return url;
        }
        return new Promise((resolve) => {
            const img = new Image();
            const isAbsolute = url.startsWith('http://') || url.startsWith('https://');
            const isSameOrigin = url.includes(window.location.host) || !isAbsolute;
            if (isAbsolute && !isSameOrigin) {
                img.crossOrigin = "anonymous";
            }
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const isStory = selectedFormat === 'story';
                const maxW = 1080;
                const maxH = isStory ? 1920 : 1080;
                
                let targetW = img.width;
                let targetH = img.height;
                const ratio = img.width / img.height;
                
                if (isStory) {
                    if (targetW > maxW) {
                        targetW = maxW;
                        targetH = Math.round(targetW / ratio);
                    }
                    if (targetH > maxH) {
                        targetH = maxH;
                        targetW = Math.round(targetH * ratio);
                    }
                } else {
                    if (targetW > maxW) {
                        targetW = maxW;
                        targetH = Math.round(targetW / ratio);
                    }
                    if (targetH > maxW) {
                        targetH = maxW;
                        targetW = Math.round(targetH * ratio);
                    }
                }
                
                canvas.width = targetW;
                canvas.height = targetH;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, targetW, targetH);
                try {
                    resolve(canvas.toDataURL('image/jpeg', 0.85));
                } catch (e) {
                    console.error("Erro ao converter imagem local para base64:", e);
                    resolve(url);
                }
            };
            img.onerror = () => resolve(url);
            img.src = url;
        });
    }

    if (btnEditorAdjust) {
        btnEditorAdjust.addEventListener('click', async () => {
            const userAdj = prompt("Digite o que deseja alterar na imagem (Ex: 'Adicione uma piscina', 'Mude a cor do prédio'):");
            if (!userAdj) return;
            
            lastUserAdjustment = userAdj;
            const originalHtml = btnEditorAdjust.innerHTML;
            btnEditorAdjust.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Aplicando...';
            btnEditorAdjust.disabled = true;

            try {
                const approvalImg = document.getElementById('success-preview-img');
                let currentImgSrc = approvalImg ? approvalImg.src : (aiRawImageUrl || '');

                if (currentImgSrc) {
                    currentImgSrc = await getImageDataUrl(currentImgSrc);
                }

                const res = await fetch("/imovel/api/generate-image", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${loggedUser.token}` },
                    body: JSON.stringify({ is_adjustment: true, prompt: userAdj, image_data: currentImgSrc, format: selectedFormat })
                });
                
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Erro desconhecido ao ajustar imagem.");

                if (data.image_urls && data.image_urls.length > 0) {
                    aiRawImageUrl = data.image_urls[0];
                    if (approvalImg) approvalImg.src = aiRawImageUrl;
                }
            } catch (err) {
                if (err.message && err.message.includes('fetch')) {
                    alert("Erro de conexão (Failed to fetch):\n\nO backend local não está respondendo. Certifique-se de que o servidor local está rodando usando 'npx vercel dev' ou 'vercel dev' no seu terminal, e não apenas um servidor estático como Live Server.");
                } else {
                    alert("Erro ao aplicar ajuste: " + err.message);
                }
            } finally {
                btnEditorAdjust.innerHTML = originalHtml;
                btnEditorAdjust.disabled = false;
            }
        });
    }

    if (btnEditorBack) {
        btnEditorBack.addEventListener('click', hideEditorProView);
    }

    // --- Editor Toolbar Actions ---
    const btnText = document.getElementById('toolbar-btn-text');
    if (btnText) {
        btnText.addEventListener('click', () => {
            saveEditorState();
            editorLayers.push({
                id: 'layer-' + layerIdCounter++,
                name: "Novo Texto",
                type: "text",
                content: "Novo Texto",
                cssText: "font-size:2rem; font-weight:700; color:#ffffff; font-family:Inter, sans-serif;",
                top: "50%", left: "50%",
                visible: true, locked: false
            });
            renderEditorProLayers();
        });
    }

    // Zoom control — usa a função global updateEditorZoom (que sincroniza toolbar + header)
    const btnZoomIn  = document.getElementById('toolbar-btn-zoom-in');
    const btnZoomOut = document.getElementById('toolbar-btn-zoom-out');
    const btnZoomInHeader  = document.getElementById('editor-btn-zoom-in-header');
    const btnZoomOutHeader = document.getElementById('editor-btn-zoom-out-header');

    if (btnZoomIn)  btnZoomIn.addEventListener('click',  () => updateEditorZoom(0.05));
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => updateEditorZoom(-0.05));
    if (btnZoomInHeader)  btnZoomInHeader.addEventListener('click',  () => updateEditorZoom(0.05));
    if (btnZoomOutHeader) btnZoomOutHeader.addEventListener('click', () => updateEditorZoom(-0.05));

    // Inicializa a seleção por arraste de mouse
    setupEditorDragSelection();
}

// ── Ferramenta FORMA — função global chamada via onclick no HTML ──
window.openShapePicker = function(btnEl) {
    // Toggle: fecha se já estiver aberto
    const existing = document.getElementById('shape-picker-menu');
    if (existing) { existing.remove(); return; }

    const shapes = [
        { label: '▬  Retângulo',  html: `<div style="width:100%;height:100%;background:rgba(200,218,66,0.85);border-radius:8px;"></div>`,                                             w: 300, h: 120 },
        { label: '⬭  Pílula',    html: `<div style="width:100%;height:100%;background:rgba(200,218,66,0.85);border-radius:999px;"></div>`,                                            w: 300, h: 100 },
        { label: '●  Círculo',    html: `<div style="width:100%;height:100%;background:rgba(200,218,66,0.85);border-radius:50%;"></div>`,                                              w: 150, h: 150 },
        { label: '◆  Losango',   html: `<div style="width:100%;height:100%;background:rgba(200,218,66,0.85);clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%);"></div>`,            w: 160, h: 160 },
        { label: '▲  Triângulo', html: `<div style="width:100%;height:100%;background:rgba(200,218,66,0.85);clip-path:polygon(50% 0%,100% 100%,0% 100%);"></div>`,                   w: 180, h: 156 },
        { label: '—  Linha',     html: `<div style="width:100%;height:100%;background:rgba(200,218,66,0.85);border-radius:3px;"></div>`,                                               w: 400, h:   8 },
        { label: '▰  Barra',     html: `<div style="width:100%;height:100%;background:rgba(200,218,66,0.85);border-radius:4px;"></div>`,                                              w: 400, h:  60 },
    ];

    const menu = document.createElement('div');
    menu.id = 'shape-picker-menu';
    menu.style.cssText = [
        'position:fixed', 'z-index:99999',
        'background:#1e1e2a', 'border:1px solid rgba(255,255,255,0.15)',
        'border-radius:12px', 'padding:8px',
        'display:flex', 'flex-direction:column', 'gap:4px',
        'box-shadow:0 8px 32px rgba(0,0,0,0.6)', 'min-width:170px',
    ].join(';');

    shapes.forEach(s => {
        const item = document.createElement('button');
        item.textContent = s.label;
        item.style.cssText = [
            'background:rgba(255,255,255,0.06)', 'border:none', 'border-radius:8px',
            'color:#e8e8e8', "font-family:'Inter',sans-serif", 'font-size:13px', 'font-weight:500',
            'padding:9px 14px', 'text-align:left', 'cursor:pointer', 'transition:background 0.15s',
        ].join(';');
        item.onmouseenter = () => item.style.background = 'rgba(200,218,66,0.2)';
        item.onmouseleave = () => item.style.background = 'rgba(255,255,255,0.06)';
        item.addEventListener('click', () => {
            if (typeof saveEditorState === 'function') saveEditorState();
            editorLayers.push({
                id:      'layer-' + layerIdCounter++,
                name:    s.label.replace(/^[^\s]+\s+/, '').trim(),
                type:    'html',
                content: s.html,
                cssText: `position:absolute; width:${s.w}px; height:${s.h}px;`,
                top: '50%', left: '50%',
                visible: true, locked: false,
            });
            if (typeof renderEditorProLayers === 'function') renderEditorProLayers();
            menu.remove();
        });
        menu.appendChild(item);
    });

    // Âncora ao botão usando posição fixa
    const rect = btnEl.getBoundingClientRect();
    menu.style.top  = (rect.bottom + 8) + 'px';
    menu.style.left = rect.left + 'px';
    document.body.appendChild(menu);

    // Fecha ao clicar fora
    setTimeout(() => {
        document.addEventListener('click', function closeShapeMenu(e) {
            if (!menu.contains(e.target) && e.target !== btnEl) {
                menu.remove();
                document.removeEventListener('click', closeShapeMenu);
            }
        });
    }, 10);
};


// EDITOR PRO: GERENCIAMENTO DE ESTADO E CAMADAS
// ==========================================================================
let editorLayers = [];
let activeLayerIds = [];
let dragGroup = [];
let layerIdCounter = 1;
let editorZoom = 0.45; // Fator de escala atual do artboard

function updateEditorZoom(delta) {
    editorZoom = Math.min(2.0, Math.max(0.1, editorZoom + delta));
    const artboard = document.getElementById('interactive-overlay-wrapper');
    const scaler = document.getElementById('artboard-scaler');
    if (artboard && scaler) {
        artboard.style.transform = `scale(${editorZoom})`;
        
        const isStory = selectedFormat === 'story';
        const isPlanta = isTemplate45();
        const W = 1080;
        const H = isStory ? 1920 : (isPlanta ? 1350 : 1080);
        
        scaler.style.width = (W * editorZoom) + "px";
        scaler.style.height = (H * editorZoom) + "px";
        
        const lbl = document.getElementById('editor-zoom-level');
        const lblH = document.getElementById('editor-zoom-level-header');
        const pct = Math.round(editorZoom * 100) + "%";
        if (lbl) lbl.textContent = pct;
        if (lblH) lblH.textContent = pct;
    }
}

window.resetEditorZoom = function() {
    editorZoom = 0.45;
    updateEditorZoom(0);
};

// --- SISTEMA DE UNDO (CTRL+Z) ---
let editorHistory = [];

function saveEditorState() {
    const currentStateStr = JSON.stringify(editorLayers);
    if (editorHistory.length > 0) {
        const lastStateStr = JSON.stringify(editorHistory[editorHistory.length - 1]);
        if (currentStateStr === lastStateStr) return;
    }
    editorHistory.push(JSON.parse(currentStateStr));
    if (editorHistory.length > 30) editorHistory.shift();
}

function undoEditorState() {
    if (editorHistory.length > 0) {
        editorLayers = editorHistory.pop();
        activeLayerIds = [];
        renderEditorProLayers();
    }
}

let editorClipboard = [];

document.addEventListener('keydown', (e) => {
    const proView = document.getElementById('editor-pro-view');
    if (proView && proView.classList.contains('active')) {
        // Ignora se estiver digitando em campos de texto
        const activeEl = document.activeElement;
        const isTyping = activeEl && (
            activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            activeEl.isContentEditable ||
            activeEl.closest('[contenteditable="true"]')
        );
        const isUndoKey = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z';
        if (isTyping && !isUndoKey) return;

        // CTRL+Z (Desfazer)
        if (isUndoKey) {
            e.preventDefault();
            undoEditorState();
        }

        // CTRL+A (Selecionar Tudo)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
            e.preventDefault();
            const selectableIds = editorLayers
                .filter(l => l.visible && !l.locked)
                .map(l => l.id);
            selectLayers(selectableIds);
            console.log('[EDITOR] Selected all visible & unlocked layers:', selectableIds.length);
        }

        // CTRL+C (Copiar)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
            if (activeLayerIds.length > 0) {
                e.preventDefault();
                editorClipboard = activeLayerIds.map(id => {
                    const l = editorLayers.find(ly => ly.id === id);
                    return l ? JSON.parse(JSON.stringify(l)) : null;
                }).filter(Boolean);
                console.log('[EDITOR] Copied layers to clipboard:', editorClipboard.length);
            }
        }

        // CTRL+V (Colar)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
            if (editorClipboard.length > 0) {
                e.preventDefault();
                saveEditorState();
                
                const newActiveIds = [];
                editorClipboard.forEach(layerClone => {
                    const newId = 'layer-' + layerIdCounter++;
                    const newLayer = JSON.parse(JSON.stringify(layerClone));
                    newLayer.id = newId;
                    
                    if (!newLayer.name.endsWith(' (Cópia)')) {
                        newLayer.name = newLayer.name + " (Cópia)";
                    }
                    
                    // Deslocamento de posição
                    let topVal = parseFloat(newLayer.top) || 0;
                    let leftVal = parseFloat(newLayer.left) || 0;
                    const topUnit = (newLayer.top && newLayer.top.includes('%')) ? '%' : 'px';
                    const leftUnit = (newLayer.left && newLayer.left.includes('%')) ? '%' : 'px';
                    
                    if (topUnit === 'px') topVal += 20;
                    else topVal += 2;
                    
                    if (leftUnit === 'px') leftVal += 20;
                    else leftVal += 2;
                    
                    newLayer.top = topVal + topUnit;
                    newLayer.left = leftVal + leftUnit;
                    
                    editorLayers.push(newLayer);
                    newActiveIds.push(newId);
                });
                
                activeLayerIds = newActiveIds;
                renderEditorProLayers();
                console.log('[EDITOR] Pasted and duplicated layers:', newActiveIds);
            }
        }
    }
});

function showEditorProView() {
    const galleryView = document.getElementById('studio-gallery-view');
    const editorView  = document.getElementById('studio-editor-view');
    const proView = document.getElementById('editor-pro-view');
    
    if (galleryView) galleryView.classList.remove('active');
    if (editorView) editorView.classList.remove('active');
    if (proView) proView.classList.add('active');
    
    // Inicia o formato de acordo com o que já estava selecionado (ou feed por padrão)
    if (!selectedFormat) selectedFormat = 'feed';
    const isStoryOnStart = selectedFormat === 'story';
    const isPlantaOnStart = isTemplate45();
    const btnEditorFeedOnStart  = document.getElementById('editor-btn-feed');
    const btnEditorStoryOnStart = document.getElementById('editor-btn-story');
    if (btnEditorFeedOnStart)  btnEditorFeedOnStart.classList.toggle('active', !isStoryOnStart);
    if (btnEditorStoryOnStart) btnEditorStoryOnStart.classList.toggle('active', isStoryOnStart);


    // Inicia a escala do Artboard centralizada (45%)
    const artboard = document.getElementById('interactive-overlay-wrapper');
    const scaler = document.getElementById('artboard-scaler');
    if (artboard && scaler) {
        const initialH = isStoryOnStart ? 1920 : (isPlantaOnStart ? 1350 : 1080);
        artboard.style.height = initialH + 'px';
        artboard.style.minHeight = initialH + 'px';
        artboard.style.transform = "scale(0.45)";
        scaler.style.width = (1080 * 0.45) + "px";
        scaler.style.height = (initialH * 0.45) + "px";
        const lbl = document.getElementById('editor-zoom-level');
        const lblH = document.getElementById('editor-zoom-level-header');
        if (lbl) lbl.textContent = "45%";
        if (lblH) lblH.textContent = "45%";
    }

    // Carrega logo da marca no chip do header
    if (typeof loadBrandLogoInEditor === 'function') loadBrandLogoInEditor();

    // Captura snapshot de referência após um pequeno delay (para o template ter renderizado)
    setTimeout(() => captureReferenceSnapshot(), 400);
}

// ==========================================================================
function captureReferenceSnapshot() {
    const refPanel = document.getElementById('editor-reference-panel');
    const refImg   = document.getElementById('editor-reference-img');
    const refLabel = document.getElementById('editor-reference-label');
    if (!refImg) {
        console.warn('[EDITOR] captureReferenceSnapshot: refImg element not found in DOM.');
        return;
    }

    const templateObj = TEMPLATE_GALLERY.find(t => t.id === selectedTemplateId);
    if (templateObj) {
        // Exibe diretamente a imagem original/exemplo do template
        refImg.src = templateObj.bgImage;
        refImg.style.display = 'block';
        if (refLabel) {
            refLabel.textContent = templateObj.name;
        }
        if (refPanel) {
            refPanel.classList.add('has-snapshot');
        }
        console.log('[EDITOR] Loaded original static template preview successfully:', templateObj.bgImage);
    } else {
        console.warn('[EDITOR] captureReferenceSnapshot: templateObj not found for id', selectedTemplateId);
    }
}

function hideEditorProView() {
    const proView = document.getElementById('editor-pro-view');
    const editorView  = document.getElementById('studio-editor-view');
    if (proView) proView.classList.remove('active');
    if (editorView) editorView.classList.add('active');
}

// ==========================================================================
// MCMV HTML-NATIVE OVERLAY RENDERER
// Constrói todo o overlay do template MCMV como camadas HTML/CSS nativas.
// Nenhuma chamada de IA — instantâneo e 100% editável.
// ==========================================================================
function renderMCMVOverlay(fields, c1, c2, font) {
    // Cores com fallback
    c1 = c1 || '#0a4635';
    c2 = c2 || '#c8da42';
    font = font || 'Inter, sans-serif';
    
    // Versão mais escura do c1 para gradientes
    const c1Dark = c1;
    const c1Rgba20 = hexToRgba(c1, 0.85);
    const c1Rgba10 = hexToRgba(c1, 0.15);
    const c2Rgba  = hexToRgba(c2, 1);
    
    // Campos do usuário com fallbacks
    const nome1      = (fields.nome1 || 'SAINT').toUpperCase();
    const nome2      = (fields.nome2 || 'GUILHERME').toUpperCase();
    const construtora= fields.construtora || 'MRV';
    const impacto1   = (fields.impacto1 || 'O SEU NOVO LAR').toUpperCase();
    const impacto2   = fields.impacto2 || 'começa aqui!';
    const loc        = (fields.localizacao || 'BAIRRO • UF').toUpperCase();
    const tagline    = fields.tagline || 'O equilíbrio perfeito entre conforto, lazer e localização.';
    const entrada    = fields.entrada || '250';
    const dorms      = fields.dormitorios || '2';
    const vagas      = fields.vagas || '1';
    const andares    = fields.andares || '15';
    const lazer      = (fields.destaque_lazer || 'LAZER COMPLETO').toUpperCase();
    const slogan     = fields.slogan || '';
    const amenStr    = fields.amenidades || 'Salão de festas, Churrasqueira, Playground, Pet place, Bicicletário, E muito mais';
    const amenidades = amenStr.split(',').map(s => s.trim()).slice(0, 6);
    const amenIcons  = ['fa-champagne-glasses', 'fa-fire-burner', 'fa-person-skiing', 'fa-paw', 'fa-bicycle', 'fa-plus'];

    // Feature icons e labels
    const features = [
        { icon: 'fa-bed',             label: `${dorms} DORMITÓRIO${dorms != '1' ? 'S' : ''}` },
        { icon: 'fa-car',             label: `${vagas} VAGA${vagas != '1' ? 'S' : ''} DE GARAGEM` },
        { icon: 'fa-building',        label: `${andares} ANDARES` },
        { icon: 'fa-umbrella-beach',  label: lazer },
    ];

    editorLayers = [];
    activeLayerIds = [];
    layerIdCounter = 1;

    function px(n) { return n + 'px'; }

    function addLayer(name, type, content, cssObj, topPx, leftPx, wPx, hPx) {
        const cssText = Object.entries(cssObj).map(([k,v]) => `${k}:${v}`).join(';');
        editorLayers.push({
            id: 'layer-' + layerIdCounter++,
            name, type, content, cssText,
            top: topPx + 'px', left: leftPx + 'px',
            width: wPx, height: hPx,
            visible: true, locked: false
        });
    }

    // ── SHAPE: Bloco Nome (topo-esquerda) ──────────────────────────────
    addLayer('■ Bloco Nome', 'html',
        `<div style="width:100%;height:100%;"></div>`,
        { 'width': '420px', 'height': '230px',
          'background': `linear-gradient(135deg, ${c1} 0%, ${c1Dark} 100%)`,
          'border-radius': '0 0 24px 0', 'box-shadow': '4px 4px 20px rgba(0,0,0,0.35)',
          'position': 'absolute' },
        50, 0, 420, 230);

    // Acento decorativo (traço horizontal)
    addLayer('— Acento Topo', 'html',
        `<div style="width:100%;height:100%;"></div>`,
        { 'width': '60px', 'height': '5px',
          'background': c2, 'border-radius': '4px', 'position': 'absolute' },
        62, 30, 60, 5);

    // ── TEXTOS do bloco nome ────────────────────────────────────────────
    addLayer('Texto Nome 1', 'text', nome1,
        { 'font-size': '58px', 'font-weight': '900', 'color': c2,
          'font-family': font, 'letter-spacing': '-2px', 'line-height': '1',
          'text-shadow': '0 2px 8px rgba(0,0,0,0.3)', 'position': 'absolute' },
        78, 30, 380, 70);

    addLayer('Texto Nome 2', 'text', nome2,
        { 'font-size': '40px', 'font-weight': '700', 'color': '#ffffff',
          'font-family': font, 'letter-spacing': '-1px', 'line-height': '1',
          'position': 'absolute' },
        138, 30, 380, 50);

    if (construtora) {
        addLayer('Texto Construtora', 'text', `by <b style="color:${c2}">${construtora}</b>`,
            { 'font-size': '18px', 'color': 'rgba(255,255,255,0.8)',
              'font-family': font, 'position': 'absolute' },
            195, 30, 300, 30);
    }

    // ── SHAPE: Área Headline (topo-direita) ────────────────────────────
    addLayer('■ Headline BG', 'html',
        `<div style="width:100%;height:100%;"></div>`,
        { 'width': '500px', 'height': '150px',
          'background': c1Rgba10,
          'border-radius': '12px',
          'border-left': `4px solid ${c2}`,
          'position': 'absolute' },
        50, 550, 500, 150);

    addLayer('Texto Headline 1', 'text', impacto1,
        { 'font-size': '36px', 'font-weight': '800', 'color': '#ffffff',
          'font-family': font, 'letter-spacing': '-1px', 'line-height': '1.1',
          'text-align': 'right', 'max-width': '460px', 'position': 'absolute' },
        62, 558, 480, 60);

    addLayer('Texto Headline 2', 'text', impacto2,
        { 'font-size': '42px', 'font-family': "'Brush Script MT', cursive",
          'color': c2, 'text-align': 'right', 'position': 'absolute' },
        112, 568, 470, 55);

    // ── SHAPE: Pill Localização ────────────────────────────────────────
    addLayer('■ Pill Localização', 'html',
        `<div style="display:flex;align-items:center;gap:8px;padding:0 18px;height:100%;"><i class="fa-solid fa-location-dot" style="color:white;font-size:16px;flex-shrink:0;"></i></div>`,
        { 'width': '400px', 'height': '44px',
          'background': c1, 'border-radius': '50px',
          'display': 'flex', 'align-items': 'center',
          'box-shadow': '0 4px 12px rgba(0,0,0,0.25)', 'position': 'absolute' },
        218, 550, 400, 44);

    addLayer('Texto Localização', 'text', loc,
        { 'font-size': '14px', 'font-weight': '700', 'color': '#ffffff',
          'font-family': font, 'letter-spacing': '0.05em', 'position': 'absolute' },
        228, 600, 340, 24);

    // ── SHAPE: Linha decorativa tagline ───────────────────────────────
    addLayer('— Linha Tagline', 'html',
        `<div style="width:100%;height:100%;"></div>`,
        { 'width': '4px', 'height': '70px',
          'background': `linear-gradient(to bottom, ${c2}, transparent)`,
          'border-radius': '4px', 'position': 'absolute' },
        310, 30, 4, 70);

    addLayer('Texto Tagline', 'text', tagline,
        { 'font-size': '18px', 'color': 'rgba(255,255,255,0.9)',
          'font-family': font, 'line-height': '1.4',
          'max-width': '380px', 'position': 'absolute' },
        312, 46, 380, 80);

    // ── SHAPE: Caixa Entrada ───────────────────────────────────────────
    addLayer('■ Caixa Entrada', 'html',
        `<div style="width:100%;height:100%;"></div>`,
        { 'width': '360px', 'height': '170px',
          'background': `linear-gradient(135deg, ${c1} 0%, ${c1Dark}dd 100%)`,
          'border-radius': '20px',
          'border': `2px solid ${c2}40`,
          'box-shadow': '0 8px 32px rgba(0,0,0,0.4)', 'position': 'absolute' },
        415, 30, 360, 170, 'BOTTOM');

    addLayer('Texto Entrada Label', 'text', 'ENTRADA A PARTIR DE',
        { 'font-size': '13px', 'font-weight': '600', 'color': 'rgba(255,255,255,0.7)',
          'font-family': font, 'letter-spacing': '0.1em', 'position': 'absolute' },
        432, 50, 300, 20, 'BOTTOM');

    addLayer('Texto Entrada Valor', 'text', `<span style="font-size:22px;color:rgba(255,255,255,0.7)">R$</span> ${entrada}`,
        { 'font-size': '88px', 'font-weight': '900', 'color': c2,
          'font-family': font, 'letter-spacing': '-4px', 'line-height': '1',
          'position': 'absolute' },
        452, 44, 340, 100, 'BOTTOM');

    addLayer('Texto Entrada Sufixo', 'text', 'mil',
        { 'font-size': '24px', 'font-weight': '600', 'color': 'rgba(255,255,255,0.6)',
          'font-family': font, 'position': 'absolute' },
        538, 54, 100, 32, 'BOTTOM');

    // ── SHAPES: Linhas de Features ─────────────────────────────────────
    features.forEach((feat, i) => {
        const topY = 620 + (i * 70);

        // Círculo do ícone
        addLayer(`■ Feature Círculo ${i+1}`, 'html',
            `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><i class="fa-solid ${feat.icon}" style="color:white;font-size:22px;"></i></div>`,
            { 'width': '54px', 'height': '54px',
              'background': `linear-gradient(135deg, ${c1} 0%, ${c1Dark}cc 100%)`,
              'border-radius': '50%',
              'border': `2px solid ${c2}60`,
              'box-shadow': '0 4px 12px rgba(0,0,0,0.3)', 'position': 'absolute' },
            topY, 30, 54, 54, 'BOTTOM');

        // Linha separadora sutil
        addLayer(`— Linha Feature ${i+1}`, 'html',
            `<div style="width:100%;height:100%;"></div>`,
            { 'width': '400px', 'height': '1px',
              'background': `linear-gradient(to right, ${c2}40, transparent)`,
              'position': 'absolute' },
            topY - 5, 30, 400, 1, 'BOTTOM');

        // Texto da feature
        addLayer(`Texto Feature ${i+1}`, 'text', feat.label,
            { 'font-size': '18px', 'font-weight': '700', 'color': '#ffffff',
              'font-family': font, 'letter-spacing': '0.05em', 'position': 'absolute' },
            topY + 16, 96, 360, 28, 'BOTTOM');
    });

    // ── SHAPE: Barra de Amenidades (full-width) ────────────────────────
    addLayer('■ Barra Amenidades', 'html',
        `<div style="width:100%;height:100%;"></div>`,
        { 'width': '1080px', 'height': '150px',
          'background': `linear-gradient(135deg, ${c1} 0%, ${c1Dark}f0 100%)`,
          'position': 'absolute' },
        930, 0, 1080, 150, 'BOTTOM');

    // Divisores verticais da barra
    for (let i = 1; i < 6; i++) {
        addLayer(`| Divisor ${i}`, 'html',
            `<div style="width:100%;height:100%;"></div>`,
            { 'width': '1px', 'height': '100px',
              'background': `${c2}30`, 'position': 'absolute' },
            945, (i * 145), 1, 100, 'BOTTOM');
    }

    // Compartimentos de amenidades
    amenidades.forEach((am, i) => {
        const xPos = 12 + (i * 145);
        const iconClass = amenIcons[i] || 'fa-star';

        addLayer(`■ Amenidade Ícone ${i+1}`, 'html',
            `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><i class="fa-solid ${iconClass}" style="color:white;font-size:28px;"></i></div>`,
            { 'width': '134px', 'height': '60px', 'position': 'absolute' },
            942, xPos, 134, 60, 'BOTTOM');

        addLayer(`Texto Amenidade ${i+1}`, 'text', am.toUpperCase(),
            { 'font-size': '11px', 'font-weight': '700', 'color': 'rgba(255,255,255,0.85)',
              'font-family': font, 'text-align': 'center', 'letter-spacing': '0.05em',
              'max-width': '130px', 'position': 'absolute' },
            1000, xPos, 134, 30, 'BOTTOM');
    });

    // ── SHAPE: Área Logo (canto direito da barra) ──────────────────────
    addLayer('■ Área Logo', 'html',
        `<div style="width:100%;height:100%;background:white;clip-path:polygon(20% 0%, 100% 0%, 100% 100%, 0% 100%);"></div>`,
        { 'width': '220px', 'height': '150px', 'position': 'absolute' },
        930, 860, 220, 150, 'BOTTOM');

    const brandLogo = localStorage.getItem('imob_brand_logo') || null;

    // Placeholder text layer for logo
    addLayer('Texto Logo Placeholder', 'text', brandLogo ? '' : 'LOGO',
        { 'font-size': '11px', 'font-weight': '600', 'color': '#aaaaaa',
          'font-family': 'sans-serif', 'text-align': 'center', 'position': 'absolute' },
        995, 940, 100, 20, 'BOTTOM');

    if (slogan) {
        addLayer('Texto Slogan', 'text', slogan,
            { 'font-size': '13px', 'color': `${c1}cc`, 'font-family': "'Brush Script MT', cursive",
              'text-align': 'center', 'position': 'absolute' },
            1058, 870, 200, 20, 'BOTTOM');
    }

    // Logo da marca (se disponível)
    if (brandLogo) {
        addLayer('Logo da Marca', 'image', brandLogo,
            { 'max-width': '180px', 'max-height': '100px', 'object-fit': 'contain',
              'position': 'absolute' },
            940, 880, 180, 100, 'BOTTOM');
    }

    reflowLayout(editorLayers, selectedFormat);
    renderEditorProLayers();
}

function renderPlantaOverlay(fields, c1, c2, font) {
    // Cores com fallback
    c1 = c1 || '#0c5c5c'; // petrol
    c2 = c2 || '#ff6f61'; // coral
    font = font || 'Inter, sans-serif';

    // Campos do usuário com fallbacks
    const tag_lancamento = (fields.tag_lancamento || 'LANÇAMENTO').toUpperCase();
    const nome           = fields.nome || 'João Dias';
    const subtitulo      = fields.subtitulo || 'a 4 min. a pé da Estação Giovanni Gronchi';
    const feature_varanda = fields.feature_varanda || 'VARANDA';
    const feature_vaga    = fields.feature_vaga || 'VAGA';
    
    const col1_label     = fields.col1_label || 'Entrada';
    const col1_sub       = fields.col1_sub || 'a partir de';
    const col1_val       = fields.col1_val || 'R$ 500,00';
    
    const col2_label     = fields.col2_label || 'Mensais';
    const col2_sub       = fields.col2_sub || 'a partir de';
    const col2_val       = fields.col2_val || 'R$ 599,00';
    
    const col3_label     = fields.col3_label || 'Renda';
    const col3_sub       = fields.col3_sub || 'a partir de';
    const col3_val       = fields.col3_val || 'R$ 3.500,00';
    
    const col4_label     = fields.col4_label || 'Unidades';
    const col4_sub       = fields.col4_sub || 'a partir de';
    const col4_val       = fields.col4_val || 'R$ 216 mil';

    editorLayers = [];
    activeLayerIds = [];
    layerIdCounter = 1;

    function addLayer(name, type, content, cssObj, topPx, leftPx, wPx, hPx, cluster = 'TOP') {
        const cssText = Object.entries(cssObj).map(([k,v]) => `${k}:${v}`).join(';');
        editorLayers.push({
            id: 'layer-' + layerIdCounter++,
            name, type, content, cssText,
            top: topPx + 'px', left: leftPx + 'px',
            width: wPx + 'px', height: hPx + 'px',
            cluster: cluster,
            visible: true, locked: false
        });
    }

    // ── SHAPE: Pill Tag Lançamento ──────────────────────────────────────
    addLayer('■ Tag Lançamento BG', 'html',
        `<div style="width:100%;height:100%;background:${c2};border-radius:50px;"></div>`,
        { 'width': '200px', 'height': '36px', 'position': 'absolute' },
        50, 440, 200, 36, 'TOP');

    addLayer('Texto Tag Lançamento', 'text', tag_lancamento,
        { 'font-size': '14px', 'font-weight': '800', 'color': '#ffffff',
          'font-family': font, 'text-align': 'center', 'letter-spacing': '0.1em',
          'position': 'absolute', 'line-height': '36px', 'width': '200px', 'height': '36px' },
        50, 440, 200, 36, 'TOP');

    // ── TEXTO: Nome do Empreendimento ──────────────────────────────────
    addLayer('Texto Nome do Empreendimento', 'text', nome,
        { 'font-size': '52px', 'font-weight': '700', 'color': c1,
          'font-family': 'Georgia, serif', 'text-align': 'center', 'position': 'absolute', 'width': '800px', 'height': '70px' },
        110, 140, 800, 70, 'TOP');

    // ── SHAPES/TEXTO: Subtítulo e Linhas Laterais ──────────────────────
    addLayer('— Linha Subtítulo Esquerda', 'html',
        `<div style="width:100%;height:100%;background:#e0e0e0;"></div>`,
        { 'width': '80px', 'height': '1px', 'position': 'absolute' },
        205, 80, 80, 1, 'TOP');

    addLayer('— Linha Subtítulo Direita', 'html',
        `<div style="width:100%;height:100%;background:#e0e0e0;"></div>`,
        { 'width': '80px', 'height': '1px', 'position': 'absolute' },
        205, 920, 80, 1, 'TOP');

    addLayer('Texto Subtítulo', 'text', subtitulo,
        { 'font-size': '18px', 'font-family': font, 'color': '#666666',
          'text-align': 'center', 'position': 'absolute', 'width': '720px', 'height': '30px' },
        195, 180, 720, 30, 'TOP');

    // ── TEXTOS E BALÕES: Features ──
    addLayer('Texto Feature Prefixo', 'text', 'Apartamento de 2 Dormitórios com',
        { 'font-size': '16px', 'font-weight': 'normal', 'color': '#555555',
          'font-family': font, 'text-align': 'right', 'line-height': '36px',
          'position': 'absolute', 'width': '385px', 'height': '36px' },
        242, 100, 385, 36, 'TOP');

    // Varanda
    addLayer('■ Balão Varanda', 'html',
        `<div style="width:100%;height:100%;background:inherit;border-radius:inherit;"></div>`,
        { 'width': '130px', 'height': '36px', 'position': 'absolute', 'background': c2, 'border-radius': '20px' },
        242, 495, 130, 36, 'TOP');

    addLayer('Texto Feature Varanda', 'text', feature_varanda.toUpperCase(),
        { 'font-size': '16px', 'font-weight': 'bold', 'color': '#ffffff',
          'font-family': font, 'text-align': 'center', 'line-height': '36px',
          'position': 'absolute', 'width': '130px', 'height': '36px' },
        242, 495, 130, 36, 'TOP');

    // Conector
    addLayer('Texto Feature Conector', 'text', 'e opção de',
        { 'font-size': '16px', 'font-weight': 'normal', 'color': '#555555',
          'font-family': font, 'text-align': 'center', 'line-height': '36px',
          'position': 'absolute', 'width': '185px', 'height': '36px' },
        242, 635, 185, 36, 'TOP');

    // Vaga
    addLayer('■ Balão Vaga', 'html',
        `<div style="width:100%;height:100%;background:inherit;border-radius:inherit;"></div>`,
        { 'width': '100px', 'height': '36px', 'position': 'absolute', 'background': c2, 'border-radius': '20px' },
        242, 830, 100, 36, 'TOP');

    addLayer('Texto Feature Vaga', 'text', feature_vaga.toUpperCase(),
        { 'font-size': '16px', 'font-weight': 'bold', 'color': '#ffffff',
          'font-family': font, 'text-align': 'center', 'line-height': '36px',
          'position': 'absolute', 'width': '100px', 'height': '36px' },
        242, 830, 100, 36, 'TOP');

    // ── SHAPE: Grid de Preços (Bordas e divisores) ──
    addLayer('■ Grid de Preços Bordas', 'html',
        `<div style="width:100%;height:100%;border:2px solid #e0e0e0;border-radius:8px;box-sizing:border-box;position:relative;background:#ffffff;">
            <div style="position:absolute;left:238px;top:0;width:2px;height:100%;background:#e0e0e0;"></div>
            <div style="position:absolute;left:478px;top:0;width:2px;height:100%;background:#e0e0e0;"></div>
            <div style="position:absolute;left:718px;top:0;width:2px;height:100%;background:#e0e0e0;"></div>
          </div>`,
        { 'width': '960px', 'height': '180px', 'position': 'absolute' },
        690, 60, 960, 180, 'BOTTOM');

    // ── TEXTOS: Colunas do Grid ──
    const cols = [
        { label: col1_label, sub: col1_sub, val: col1_val },
        { label: col2_label, sub: col2_sub, val: col2_val },
        { label: col3_label, sub: col3_sub, val: col3_val },
        { label: col4_label, sub: col4_sub, val: col4_val }
    ];

    cols.forEach((col, i) => {
        const colLeft = 60 + (i * 240);

        addLayer(`Texto Grid Col ${i+1} Label`, 'text', col.label.toUpperCase(),
            { 'font-size': '15px', 'font-weight': '700', 'color': '#666666',
              'font-family': font, 'text-align': 'center', 'letter-spacing': '0.05em', 'position': 'absolute',
              'width': '240px', 'height': '24px' },
            710, colLeft, 240, 24, 'BOTTOM');

        addLayer(`Texto Grid Col ${i+1} Sub`, 'text', col.sub,
            { 'font-size': '12px', 'color': '#999999',
              'font-family': font, 'text-align': 'center', 'position': 'absolute',
              'width': '240px', 'height': '20px' },
            745, colLeft, 240, 20, 'BOTTOM');

        addLayer(`Texto Grid Col ${i+1} Valor`, 'text', col.val,
            { 'font-size': '24px', 'font-weight': '800', 'color': c1,
              'font-family': font, 'text-align': 'center', 'position': 'absolute',
              'width': '240px', 'height': '36px' },
            775, colLeft, 240, 36, 'BOTTOM');
    });

    // ── SHAPE: Logo / Rodapé da Marca ──
    const brandLogo = localStorage.getItem('imob_brand_logo') || null;

    if (brandLogo) {
        addLayer('Logo da Marca', 'image', brandLogo,
            { 'max-width': '200px', 'max-height': '80px', 'object-fit': 'contain',
              'position': 'absolute' },
            920, 440, 200, 80, 'BOTTOM');
    } else {
        addLayer('Texto Logo Placeholder', 'text', 'LOGO',
            { 'font-size': '12px', 'font-weight': '600', 'color': '#aaaaaa',
              'font-family': 'sans-serif', 'text-align': 'center', 'position': 'absolute' },
            950, 490, 100, 20, 'BOTTOM');
    }

    reflowLayout(editorLayers, selectedFormat);

    renderEditorProLayers();
}

// Helper: converte HEX em rgba string
function hexToRgba(hex, alpha) {
    try {
        const h = hex.replace('#', '');
        const r = parseInt(h.substring(0,2), 16);
        const g = parseInt(h.substring(2,4), 16);
        const b = parseInt(h.substring(4,6), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    } catch(e) {
        return `rgba(10,70,53,${alpha})`;
    }
}

// Helper global para reconstruir o overlay correto do template ativo
window.rebuildCurrentTemplateOverlay = function() {
    const custom_fields = {};
    document.querySelectorAll('.dyn-template-input').forEach(input => {
        custom_fields[input.getAttribute('data-field-id')] = input.value || '';
    });
    const brandC1 = localStorage.getItem('imob_brand_color_primary') || '#0a4635';
    const brandC2 = localStorage.getItem('imob_brand_color_secondary') || '#c8da42';
    const brandFont = localStorage.getItem('imob_brand_fonts') || 'Inter, sans-serif';

    const templateObj = TEMPLATE_GALLERY.find(t => t.id === selectedTemplateId);

    if (selectedTemplateId === 'planta-mcmv') {
        renderPlantaOverlay(custom_fields, brandC1, brandC2, brandFont);
    } else {
        renderInteractiveOverlay();
    }
};

// Configura o Editor Pro inicialmente, convertendo inputs em Layers HTML
function renderInteractiveOverlay() {
    // Coleta inputs do usuário
    const custom_fields = {};
    document.querySelectorAll('.dyn-template-input').forEach(input => {
        custom_fields[input.getAttribute('data-field-id')] = input.value || '';
    });
    
    const isPlanta = isTemplate45();
    const isLarFeliz = selectedTemplateId === 'lar-feliz';
    const isSonhoRealizado = selectedTemplateId === 'sonho-realizado';
    // Fallbacks por template: Lar Feliz usa verde+dourado; mcmv/sonho-realizado usa verde escuro+dourado; planta usa petróleo+coral; outros usam brand genérico
    const c1FallBack = isPlanta ? '#0c5c5c' : ((isLarFeliz || isSonhoRealizado) ? '#123524' : '#c8da42');
    const c2FallBack = isPlanta ? '#ff6f61' : ((isLarFeliz || isSonhoRealizado) ? '#E4B84A' : '#ffffff');
    const c1 = localStorage.getItem('imob_brand_color_primary')  || c1FallBack;
    const c2 = localStorage.getItem('imob_brand_color_secondary') || c2FallBack;
    const font = localStorage.getItem('imob_brand_fonts') || 'Inter, sans-serif';

    const templateObj = TEMPLATE_GALLERY.find(t => t.id === selectedTemplateId);
    const category = templateObj ? templateObj.category : 'alto-padrao';
    
    console.log('[EDITOR] renderInteractiveOverlay chamado. selectedTemplateId:', selectedTemplateId, 'category:', category);
    
    // Garante que a altura do artboard e o estado do botão Story no topo estejam sincronizados com selectedFormat
    const artboardEl = document.getElementById('interactive-overlay-wrapper');
    const isStoryFmt = selectedFormat === 'story';
    const targetH = isStoryFmt ? 1920 : (isPlanta ? 1350 : 1080);
    if (artboardEl) {
        artboardEl.style.height = targetH + 'px';
        artboardEl.style.minHeight = targetH + 'px';
    }
    const btnFeedEl  = document.getElementById('editor-btn-feed');
    const btnStoryEl = document.getElementById('editor-btn-story');
    if (btnFeedEl)  btnFeedEl.classList.toggle('active', !isStoryFmt);
    if (btnStoryEl) btnStoryEl.classList.toggle('active', isStoryFmt);


    editorLayers = []; // Reseta as camadas
    activeLayerIds = [];
    layerIdCounter = 1;

    function addLayer(name, type, content, css, top, left, cluster = 'TOP', wPx = '', hPx = '') {
        editorLayers.push({
            id: 'layer-' + layerIdCounter++,
            name: name,
            type: type,
            content: content,
            cssText: css,
            top: top,
            left: left,
            cluster: cluster,
            width: wPx,
            height: hPx,
            visible: true,
            locked: false
        });
    }

    if (category === 'mcmv') {
        // A imagem de fundo JÁ É a composição (foto + arte da IA) feita no canvas
        // Não precisamos de camadas de imagem aqui — só camadas de texto por cima.
        
        if (selectedTemplateId === 'planta-mcmv') {
            const tag_lancamento = custom_fields.tag_lancamento || 'LANÇAMENTO';
            const nome = custom_fields.nome || 'João Dias';
            const subtitulo = custom_fields.subtitulo || 'a 4 min. a pé da Estação Giovanni Gronchi';
            const feature_varanda = custom_fields.feature_varanda || 'VARANDA';
            const feature_vaga = custom_fields.feature_vaga || 'VAGA';
            const col1_label = custom_fields.col1_label || 'Entrada';
            const col1_sub = custom_fields.col1_sub || 'a partir de';
            const col1_val = custom_fields.col1_val || 'R$ 500,00';
            const col2_label = custom_fields.col2_label || 'Mensais';
            const col2_sub = custom_fields.col2_sub || 'a partir de';
            const col2_val = custom_fields.col2_val || 'R$ 599,00';
            const col3_label = custom_fields.col3_label || 'Renda';
            const col3_sub = custom_fields.col3_sub || 'a partir de';
            const col3_val = custom_fields.col3_val || 'R$ 3.500,00';
            const col4_label = custom_fields.col4_label || 'Unidades';
            const col4_sub = custom_fields.col4_sub || 'a partir de';
            const col4_val = custom_fields.col4_val || 'R$ 216 mil';

            // 1) Tag lançamento (y=0.06) -> 6% top, x=0.5
            addLayer("Tag Lançamento", "text", tag_lancamento.toUpperCase(), `font-size:16px; font-weight:700; color:#FFFFFF; text-align:center; width:300px; font-family:${font}; text-transform:uppercase; letter-spacing:0.1em;`, '81px', '390px');

            // 2) Nome (y=0.13) -> 13% top, x=0.5
            addLayer("Nome do Empreendimento", "text", nome, `font-size:48px; font-family:Georgia, serif; font-weight:700; color:${c1}; text-align:center; width:600px;`, '175px', '240px');

            // 3) Subtítulo (y=0.19) -> 19% top, x=0.5
            addLayer("Subtítulo", "text", subtitulo, `font-size:18px; font-style:italic; color:#555555; text-align:center; width:600px; font-family:${font};`, '256px', '240px');

            // 4) Feature (linha) (y=0.25) -> 25% top, x=0.5
            addLayer("Feature Prefixo", "text", "Apartamento de 2 Dormitórios com", `font-size:16px; font-weight:400; color:#555555; text-align:right; width:385px; font-family:${font}; line-height:36px;`, '337px', '100px');
            
            // Varanda
            addLayer("■ Balão Varanda", "html", `<div style="width:100%;height:100%;background:inherit;border-radius:inherit;"></div>`, `width:130px; height:36px; background:${c2}; border-radius:20px;`, '337px', '495px');
            addLayer("Feature Varanda", "text", feature_varanda.toUpperCase(), `font-size:16px; font-weight:700; color:#FFFFFF; text-align:center; width:130px; line-height:36px; font-family:${font};`, '337px', '495px');
            
            addLayer("Feature Conector", "text", "e opção de", `font-size:16px; font-weight:400; color:#555555; text-align:center; width:185px; font-family:${font}; line-height:36px;`, '337px', '635px');
            
           } else if (selectedTemplateId === 'lar-feliz') {
            // ══════════════════════════════════════════════════════════════════════
            // LAR FELIZ v6 — Composição pura, 1 cor = 1 layer, brand tokens, reflow
            // ══════════════════════════════════════════════════════════════════════
            const residencial   = (custom_fields.residencial  || 'DRESDEN').toUpperCase();
            const construtora   = (custom_fields.construtora  || 'CONSTRUTORA ROGGA').toUpperCase();
            const bairro        = (custom_fields.bairro       || 'BAIRRO GLÓRIA').toUpperCase();
            const cidade        = (custom_fields.cidade       || 'JOINVILLE').toUpperCase();
            const preco         = custom_fields.preco         || '390';
            const entrada       = custom_fields.entrada       || '28';
            const parcelas      = custom_fields.parcelas      || '37';
            const valor_parcela = custom_fields.valor_parcela || '1.500';

            const taglineStr    = custom_fields.tagline       || 'Excelente localização!';
            const words         = taglineStr.trim().split(/\s+/);
            const taglineP1     = words[0] || 'Excelente';
            const taglineP2     = words.slice(1).join(' ') || 'localização!';

            // Brand tokens com defaults do template Dresden (v6) - fixados para corresponder exatamente à imagem de exemplo
            let bp  = '#0E2015'; // brand-primary (verde escuro)
            let ba  = '#C89A4C'; // brand-accent  (dourado)
            let tl  = '#EBE6D5'; // brand-text-light (creme)

            // Carrega a identidade de marca proporcional
            const brandPrimary = localStorage.getItem('imob_brand_color_primary');
            const brandSecondary = localStorage.getItem('imob_brand_color_secondary');
            const brandTertiary = localStorage.getItem('imob_brand_color_tertiary');

            const activeColors = [];
            if (brandPrimary) activeColors.push({ hex: brandPrimary, lum: getLuminance(brandPrimary) });
            if (brandSecondary) activeColors.push({ hex: brandSecondary, lum: getLuminance(brandSecondary) });
            if (brandTertiary) activeColors.push({ hex: brandTertiary, lum: getLuminance(brandTertiary) });

            if (activeColors.length === 1) {
                const col = activeColors[0];
                if (col.lum < 120) {
                    bp = col.hex; // Substitui o verde escuro por ser uma cor escura
                } else {
                    ba = col.hex; // Substitui o dourado por ser uma cor clara/acento
                }
            } else if (activeColors.length === 2) {
                // Ordena por brilho: [mais escuro, mais claro]
                activeColors.sort((a, b) => a.lum - b.lum);
                bp = activeColors[0].hex;
                ba = activeColors[1].hex;
                if (activeColors[1].lum > 180) {
                    tl = activeColors[1].hex;
                }
            } else if (activeColors.length >= 3) {
                // Ordena por brilho: [mais escuro, intermediário, mais claro]
                activeColors.sort((a, b) => a.lum - b.lum);
                bp = activeColors[0].hex; // Substitui o verde escuro
                ba = activeColors[1].hex; // Substitui o dourado (acento)
                tl = activeColors[2].hex; // Substitui o creme (claro)
            }

            // ── TOP CLUSTER ──
            // L01: Título Marca ("DRESDEN")
            addLayer('Título Marca', 'text', residencial,
                `font-size:96px; font-family:'Cinzel',serif; font-weight:700; color:${bp}; letter-spacing:0.02em; text-align:center; width:800px; line-height:1.1;`,
                '45px', '140px', 'TOP', '800px', '110px');

            // L02: Subtítulo ("CONSTRUTORA ROGGA")
            addLayer('Subtítulo Construtora', 'text', construtora,
                `font-size:26px; font-family:Montserrat,sans-serif; font-weight:500; color:${ba}; letter-spacing:0.18em; text-align:center; width:400px;`,
                '156px', '340px', 'TOP', '400px', '28px');

            // L03: Traço decorativo esquerdo - posicionado a x=220 com w=90 para não sobrepor o texto
            addLayer('Traço Esq.', 'html',
                `<div style="width:100%;height:100%;background:${ba};border-radius:2px;"></div>`,
                'width:90px; height:3px;',
                '169px', '220px', 'TOP', '90px', '3px');

            // L04: Traço decorativo direito - posicionado a x=770 com w=90 para não sobrepor o texto
            addLayer('Traço Dir.', 'html',
                `<div style="width:100%;height:100%;background:${ba};border-radius:2px;"></div>`,
                'width:90px; height:3px;',
                '169px', '770px', 'TOP', '90px', '3px');

            // L05: ■ BG Localização
            addLayer('■ BG Localização', 'html',
                `<div style="width:100%;height:100%;background:${bp};border-radius:44px;box-shadow:0 6px 20px rgba(0,0,0,0.25);border:1px solid ${ba}4d;"></div>`,
                'width:440px; height:88px;',
                '212px', '320px', 'TOP', '440px', '88px');

            // L06: 📍 Ícone Localização
            addLayer('📍 Ícone Localização', 'html',
                `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-location-dot" style="color:${ba};font-size:24px;"></i></div>`,
                'width:48px; height:48px;',
                '232px', '348px', 'TOP', '48px', '48px');

            // L07: Bairro
            addLayer('Bairro', 'text', bairro,
                `font-size:30px; font-family:Montserrat,sans-serif; font-weight:700; color:${tl}; text-align:left; width:320px; line-height:1.1;`,
                '226px', '410px', 'TOP', '320px', '34px');

            // L08: Cidade
            addLayer('Cidade', 'text', cidade,
                `font-size:24px; font-family:Montserrat,sans-serif; font-weight:600; color:${ba}; text-align:left; width:320px;`,
                '262px', '410px', 'TOP', '320px', '28px');

            // L09: Tagline Parte 1
            addLayer('Tagline Parte 1', 'text', taglineP1,
                `font-size:30px; font-family:'Kaushan Script',cursive; font-weight:400; color:${tl}; text-align:right; width:170px; font-style:italic;`,
                '330px', '372px', 'TOP', '170px', '36px');

            // L10: Tagline Parte 2
            addLayer('Tagline Parte 2', 'text', taglineP2,
                `font-size:30px; font-family:'Kaushan Script',cursive; font-weight:400; color:${ba}; text-align:left; width:160px; font-style:italic;`,
                '330px', '542px', 'TOP', '160px', '36px');

            // L11: Swash Tagline
            addLayer('Swash Tagline', 'html',
                `<div style="width:100%;height:100%;background:${ba};border-radius:2px;"></div>`,
                'width:150px; height:3px;',
                '368px', '548px', 'TOP', '150px', '3px');

            // ── BOTTOM CLUSTER ──
            // L12: ■ BG Preço
            addLayer('■ BG Preço', 'html',
                `<div style="width:100%;height:100%;background:${bp};border-radius:44px;border:1px solid ${ba}4d;box-shadow:0 10px 36px rgba(0,0,0,0.32);"></div>`,
                'width:880px; height:230px;',
                '600px', '100px', 'BOTTOM', '880px', '230px');

            // L14: Texto Badge
            addLayer('Texto Badge', 'text', 'UNIDADES A PARTIR DE',
                `font-size:22px; font-family:Montserrat,sans-serif; font-weight:700; color:${ba}; text-align:center; width:360px; letter-spacing:0.15em;`,
                '601px', '360px', 'BOTTOM', '360px', '24px');

            // L15: R$ (preço)
            addLayer('R$ (preço)', 'text', 'R$',
                `font-size:54px; font-family:Montserrat,sans-serif; font-weight:700; color:${ba}; text-align:left; width:90px;`,
                '690px', '150px', 'BOTTOM', '90px', '70px');

            // L16: Valor Preço ("390")
            addLayer('Valor Preço', 'text', preco,
                `font-size:190px; font-family:'Cinzel',serif; font-weight:700; text-align:center; width:440px; line-height:0.85; background:linear-gradient(180deg,#F6E1A6 0%,#DEAE4E 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;`,
                '628px', '250px', 'BOTTOM', '440px', '200px');

            // L17: "mil" (preço)
            addLayer('"mil" (preço)', 'text', 'mil',
                `font-size:90px; font-family:'Kaushan Script',cursive; font-weight:400; color:${ba}; text-align:left; width:170px; font-style:italic;`,
                '690px', '740px', 'BOTTOM', '170px', '100px');

            // L18: Swash Preço
            addLayer('Swash Preço', 'html',
                `<div style="width:100%;height:100%;background:${ba};border-radius:2px;opacity:0.85;"></div>`,
                'width:560px; height:4px;',
                '800px', '300px', 'BOTTOM', '560px', '4px');

            // L19: ■ BG Entrada
            addLayer('■ BG Entrada', 'html',
                `<div style="width:100%;height:100%;background:${bp};border-radius:40px;border:1px solid ${ba}4d;box-shadow:0 8px 28px rgba(0,0,0,0.28);"></div>`,
                'width:370px; height:140px;',
                '852px', '100px', 'BOTTOM', '370px', '140px');

            // L20: ● Círculo Entrada
            addLayer('● Círculo Entrada', 'html',
                `<div style="width:100%;height:100%;border-radius:50%;border:2px solid ${ba};background:${bp};"></div>`,
                'width:88px; height:88px;',
                '876px', '126px', 'BOTTOM', '88px', '88px');

            // L21: 🏠 Ícone Entrada
            addLayer('🏠 Ícone Entrada', 'html',
                `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-house-chimney" style="color:${ba};font-size:26px;"></i></div>`,
                'width:48px; height:48px;',
                '896px', '146px', 'BOTTOM', '48px', '48px');

            // L22: Label Entrada
            addLayer('Label Entrada', 'text', 'ENTRADA',
                `font-size:22px; font-family:Montserrat,sans-serif; font-weight:700; color:${tl}; text-align:center; width:230px; letter-spacing:0.08em;`,
                '876px', '214px', 'BOTTOM', '230px', '24px');

            // L23: R$ Entrada ("R$ 28")
            addLayer('R$ Entrada', 'text', `R$ ${entrada}`,
                `font-size:40px; font-family:Montserrat,sans-serif; font-weight:700; color:${tl}; text-align:left; width:150px;`,
                '915px', '228px', 'BOTTOM', '150px', '44px');

            // L24: "mil" Entrada
            addLayer('"mil" Entrada', 'text', 'mil',
                `font-size:28px; font-family:'Kaushan Script',cursive; font-weight:400; color:${ba}; text-align:left; width:70px; font-style:italic;`,
                '922px', '384px', 'BOTTOM', '70px', '32px');

            // L25: ● Círculo Separador
            addLayer('● Separador', 'html',
                `<div style="width:100%;height:100%;border-radius:50%;background:${ba};box-shadow:0 2px 8px rgba(0,0,0,0.25);"></div>`,
                'width:76px; height:76px;',
                '882px', '502px', 'BOTTOM', '76px', '76px');

            // L26: "+" Separador
            addLayer('+ Separador', 'text', '+',
                `font-size:48px; font-weight:700; color:${bp}; font-family:Montserrat,sans-serif; line-height:48px; width:76px; text-align:center;`,
                '896px', '502px', 'BOTTOM', '76px', '48px');

            // L27: ■ BG Parcelas
            addLayer('■ BG Parcelas', 'html',
                `<div style="width:100%;height:100%;background:${bp};border-radius:40px;border:1px solid ${ba}4d;box-shadow:0 8px 28px rgba(0,0,0,0.28);"></div>`,
                'width:370px; height:140px;',
                '852px', '610px', 'BOTTOM', '370px', '140px');

            // L28: ● Círculo Parcelas
            addLayer('● Círculo Parcelas', 'html',
                `<div style="width:100%;height:100%;border-radius:50%;border:2px solid ${ba};background:${bp};"></div>`,
                'width:88px; height:88px;',
                '876px', '636px', 'BOTTOM', '88px', '88px');

            // L29: 📅 Ícone Parcelas
            addLayer('📅 Ícone Parcelas', 'html',
                `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-calendar-days" style="color:${ba};font-size:26px;"></i></div>`,
                'width:48px; height:48px;',
                '896px', '656px', 'BOTTOM', '48px', '48px');

            // L30: Label Parcelas
            addLayer('Label Parcelas', 'text', `${parcelas} PARCELAS DE`,
                `font-size:20px; font-family:Montserrat,sans-serif; font-weight:700; color:${tl}; text-align:center; width:240px; letter-spacing:0.06em;`,
                '876px', '724px', 'BOTTOM', '240px', '24px');

            // L31: R$ Parcela
            addLayer('R$ Parcela', 'text', `R$ ${valor_parcela}`,
                `font-size:40px; font-family:Montserrat,sans-serif; font-weight:700; color:${tl}; text-align:center; width:240px;`,
                '915px', '724px', 'BOTTOM', '240px', '44px');

            // ── SHAPE: Logo / Rodapé da Marca ──
            const brandLogo = localStorage.getItem('imob_brand_logo') || null;
            if (brandLogo) {
                const isStory = selectedFormat === 'story';
                const logoY = isStory ? 1550 : 1000;
                addLayer('Logo da Marca', 'image', brandLogo,
                    `max-width:200px; max-height:60px; object-fit:contain;`,
                    logoY + 'px', '440px', 'BOTTOM', '200px', '60px');
            }
        } else if (selectedTemplateId === 'sonho-realizado') {
            // ══════════════════════════════════════════════════════════════════════
            // SONHO REALIZADO (Minha Casa MCMV) — Composição pura, layers atômicos
            // ══════════════════════════════════════════════════════════════════════
            const nome1       = (custom_fields.nome1       || 'SAINT').toUpperCase();
            const nome2       = (custom_fields.nome2       || 'GUILHERME').toUpperCase();
            const construtora = custom_fields.construtora || 'MRV';
            const impacto1    = (custom_fields.impacto1    || 'O SEU NOVO LAR').toUpperCase();
            const impacto2    = custom_fields.impacto2    || 'começa aqui!';
            const loc         = (custom_fields.localizacao || 'VILA GUILHERME · SP').toUpperCase();
            const taglineStr  = custom_fields.tagline       || 'O equilíbrio perfeito entre conforto, lazer e localização.';
            const entrada     = custom_fields.entrada     || '250';
            const dorms       = custom_fields.dormitorios   || '2';
            const vagas       = custom_fields.vagas       || '1';
            const andares     = custom_fields.andares     || '15';
            const lazer       = (custom_fields.destaque_lazer || 'LAZER COMPLETO').toUpperCase();
            const slogan      = custom_fields.slogan      || 'É pra vida toda.';
            const amenStr     = custom_fields.amenidades  || 'Salão de festas, Churrasqueira, Playground, Pet place, Bicicletário, E muito mais';
            const amenidades  = amenStr.split(',').map(s => s.trim()).slice(0, 6);

            let tagP1 = 'O equilíbrio perfeito entre';
            let tagP2 = 'conforto, lazer e localização.';
            if (taglineStr) {
                const mid = Math.floor(taglineStr.length / 2);
                const before = taglineStr.lastIndexOf(' ', mid);
                const after = taglineStr.indexOf(' ', mid + 1);
                let splitIdx = before;
                if (before === -1 || (after !== -1 && (mid - before > after - mid))) {
                    splitIdx = after;
                }
                if (splitIdx !== -1) {
                    tagP1 = taglineStr.substring(0, splitIdx).trim();
                    tagP2 = taglineStr.substring(splitIdx).trim();
                } else {
                    tagP1 = taglineStr;
                    tagP2 = '';
                }
            }

            let bp = '#123524'; // brand-primary (verde escuro)
            let ba = '#E4B84A'; // brand-accent (dourado)
            let tl = '#FFFFFF'; // brand-text-light (branco)

            const brandPrimary = localStorage.getItem('imob_brand_color_primary');
            const brandSecondary = localStorage.getItem('imob_brand_color_secondary');
            const brandTertiary = localStorage.getItem('imob_brand_color_tertiary');

            const activeColors = [];
            if (brandPrimary) activeColors.push({ hex: brandPrimary, lum: getLuminance(brandPrimary) });
            if (brandSecondary) activeColors.push({ hex: brandSecondary, lum: getLuminance(brandSecondary) });
            if (brandTertiary) activeColors.push({ hex: brandTertiary, lum: getLuminance(brandTertiary) });

            if (activeColors.length === 1) {
                const col = activeColors[0];
                if (col.lum < 120) { bp = col.hex; } else { ba = col.hex; }
            } else if (activeColors.length === 2) {
                activeColors.sort((a, b) => a.lum - b.lum);
                bp = activeColors[0].hex;
                ba = activeColors[1].hex;
                if (activeColors[1].lum > 180) { tl = activeColors[1].hex; }
            } else if (activeColors.length >= 3) {
                activeColors.sort((a, b) => a.lum - b.lum);
                bp = activeColors[0].hex;
                ba = activeColors[1].hex;
                tl = activeColors[2].hex;
            }

            // L00: Acento decorativo acima do título
            addLayer('Traço Divisor Superior', 'html',
                `<div style="width:100%;height:100%;background:${bp};border-radius:2px;"></div>`,
                'width:40px; height:4px;',
                '45px', '45px', 'TOP', '40px', '4px');

            // Títulos e Textos do Topo
            addLayer('Título Marca', 'text', `${nome1}\n${nome2}`,
                `font-size:64px; font-family:Montserrat,sans-serif; font-weight:800; color:${bp}; letter-spacing:0.01em; text-align:left; width:420px; line-height:1.05;`,
                '65px', '45px', 'TOP', '420px', '150px');

            addLayer('Subtítulo Construtora', 'text', `by ${construtora}`,
                `font-size:26px; font-family:Montserrat,sans-serif; font-weight:600; color:${bp}; letter-spacing:0.04em; text-align:left; width:200px;`,
                '215px', '220px', 'TOP', '200px', '30px');

            addLayer('Tagline Linha 1', 'text', impacto1,
                `font-size:30px; font-family:Montserrat,sans-serif; font-weight:800; color:${tl}; letter-spacing:0.02em; text-align:right; width:440px; text-shadow:0 2px 6px rgba(0,0,0,0.35);`,
                '45px', '600px', 'TOP', '440px', '38px');

            addLayer('Tagline Linha 2', 'text', impacto2,
                `font-size:48px; font-family:'Kaushan Script',cursive; font-weight:400; color:${ba}; text-align:right; width:440px; font-style:italic; text-shadow:0 2px 6px rgba(0,0,0,0.35);`,
                '85px', '600px', 'TOP', '440px', '60px');

            addLayer('■ BG Localização', 'html',
                `<div style="width:100%;height:100%;background:${bp}cc;border-radius:40px;box-shadow:0 6px 16px rgba(0,0,0,0.25);"></div>`,
                'width:350px; height:56px;',
                '175px', '670px', 'TOP', '350px', '56px');

            addLayer('📍 Ícone Localização', 'html',
                `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-location-dot" style="color:${ba};font-size:20px;"></i></div>`,
                'width:32px; height:32px;',
                '187px', '695px', 'TOP', '32px', '32px');

            const safeLoc = loc.replace('·', '-').replace('•', '-');
            addLayer('Localização Texto', 'text', safeLoc,
                `font-size:20px; font-family:Montserrat,sans-serif; font-weight:700; color:${tl}; text-align:left; width:260px; letter-spacing:0.04em;`,
                '185px', '735px', 'TOP', '260px', '28px');

            addLayer('Traço Divisor', 'html',
                `<div style="width:100%;height:100%;background:${bp};border-radius:2px;"></div>`,
                'width:180px; height:3px;',
                '265px', '48px', 'TOP', '180px', '3px');

            addLayer('Descrição Linha 1', 'text', tagP1,
                `font-size:24px; font-family:Montserrat,sans-serif; font-weight:400; color:${bp}; text-align:left; width:400px; line-height:1.3;`,
                '290px', '48px', 'TOP', '400px', '32px');

            addLayer('Descrição Linha 2', 'text', tagP2,
                `font-size:24px; font-family:Montserrat,sans-serif; font-weight:800; color:${bp}; text-align:left; width:400px; line-height:1.3;`,
                '323px', '48px', 'TOP', '400px', '32px');

            // Caixa de Preço (TOP) - posicionada logo abaixo da descrição
            addLayer('■ BG Preço', 'html',
                `<div style="width:100%;height:100%;background:${bp};border-radius:24px;box-shadow:0 8px 24px rgba(0,0,0,0.28);"></div>`,
                'width:320px; height:110px;',
                '390px', '40px', 'TOP', '320px', '110px');

            addLayer('Label Entrada', 'text', 'ENTRADA\nA PARTIR DE',
                `font-size:16px; font-family:Montserrat,sans-serif; font-weight:700; color:${tl}; line-height:1.2; text-align:left; width:130px;`,
                '410px', '60px', 'TOP', '130px', '50px');

            addLayer('R$ (preço)', 'text', 'R$',
                `font-size:26px; font-family:Montserrat,sans-serif; font-weight:700; color:${ba}; text-align:left; width:45px;`,
                '450px', '195px', 'TOP', '45px', '35px');

            addLayer('Valor Preço', 'text', entrada,
                `font-size:76px; font-family:Montserrat,sans-serif; font-weight:800; color:${ba}; text-align:left; width:180px; line-height:0.9;`,
                '395px', '235px', 'TOP', '180px', '75px');

            const features = [
                { icon: 'fa-bed', label: `${dorms} DORMITÓRIOS` },
                { icon: 'fa-square-parking', label: `${vagas} VAGA DE GARAGEM` },
                { icon: 'fa-building', label: `${andares} ANDARES` },
                { icon: 'fa-tree', label: lazer },
            ];
            features.forEach((f, i) => {
                const rowOffset = 520 + i * 50;
                addLayer(`● Ícone ${f.label}`, 'html',
                    `<div style="width:100%;height:100%;border-radius:50%;background:${bp};display:flex;align-items:center;justify-content:center;"><i class="fa-solid ${f.icon}" style="color:${tl};font-size:20px;"></i></div>`,
                    'width:40px; height:40px;',
                    `${rowOffset}px`, '48px', 'TOP', '40px', '40px');
                addLayer(`Texto ${f.label}`, 'text', f.label,
                    `font-size:24px; font-family:Montserrat,sans-serif; font-weight:700; color:${bp}; text-align:left; width:320px; line-height:1.1;`,
                    `${rowOffset + 4}px`, '102px', 'TOP', '320px', '30px');
            });

            // Faixas do rodapé e logos
            addLayer('■ BG Rodapé', 'html',
                `<div style="width:100%;height:100%;background:${bp};"></div>`,
                'width:1080px; height:130px;',
                '950px', '0px', 'FOOTER', '1080px', '130px');

            addLayer('■ BG Painel Logo', 'html',
                `<div style="width:100%;height:100%;background:${tl};clip-path:polygon(15% 0, 100% 0, 100% 100%, 0 100%);"></div>`,
                'width:280px; height:130px;',
                '950px', '800px', 'FOOTER', '280px', '130px');

            addLayer('Logo MRV', 'html',
                `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;font-family:Montserrat,sans-serif;">
                  <div style="display:flex;align-items:center;gap:6px;">
                    <svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <polygon points="10,10 55,50 10,90" fill="#009A53"/>
                      <polygon points="55,50 100,10 100,90" fill="#EAAA00"/>
                      <polygon points="10,90 55,50 100,90" fill="#005A36"/>
                    </svg>
                    <span style="font-size:28px;font-weight:900;color:${bp};letter-spacing:-0.05em;line-height:1;">MRV</span>
                  </div>
                  <div style="font-size:12px;font-weight:700;color:${bp};margin-top:4px;letter-spacing:0.02em;text-align:center;">É pra vida toda.</div>
                </div>`,
                'width:200px; height:80px;',
                '975px', '850px', 'FOOTER', '200px', '80px');

            // Ícones de amenidades no rodapé
            const footerIcons = [
                { icon: 'fa-champagne-glasses', label: 'SALÃO DE\nFESTAS' },
                { icon: 'fa-fire-burner', label: 'CHURRASQUEIRA' },
                { icon: 'fa-child-reaching', label: 'PLAYGROUND' },
                { icon: 'fa-paw', label: 'PET PLACE' },
                { icon: 'fa-bicycle', label: 'BICICLETÁRIO' },
                { icon: 'fa-plus', label: 'E MUITO\nMAIS!' },
            ];
            
            if (amenidades && amenidades.length > 0) {
                const defaultIcons = ['fa-champagne-glasses', 'fa-fire-burner', 'fa-child-reaching', 'fa-paw', 'fa-bicycle', 'fa-plus'];
                for (let i = 0; i < Math.min(6, amenidades.length); i++) {
                    footerIcons[i] = {
                        icon: defaultIcons[i] || 'fa-plus',
                        label: amenidades[i].toUpperCase().replace(/\s+/g, '\n')
                    };
                }
            }

            footerIcons.forEach((f, i) => {
                const colWidth = 800 / 6;
                const colLeftEdge = i * colWidth;
                const leftIcon = Math.round(colLeftEdge + (colWidth - 36) / 2);
                const leftText = Math.round(colLeftEdge + (colWidth - 110) / 2);
                
                // Icon (Top of the footer)
                addLayer(`Ícone Rodapé ${f.label}`, 'html',
                    `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><i class="fa-solid ${f.icon}" style="color:${tl};font-size:24px;"></i></div>`,
                    'width:36px; height:36px;',
                    '977px', `${leftIcon}px`, 'FOOTER', '36px', '36px');
                    
                // Text (Bottom of the footer)
                addLayer(`Texto Rodapé ${f.label}`, 'text', f.label,
                    `font-size:13px; font-family:Montserrat,sans-serif; font-weight:600; color:${tl}; text-align:center; width:110px; line-height:1.2;`,
                    '1023px', `${leftText}px`, 'FOOTER', '110px', '30px');

                // Vertical divisor line (between columns, only for the first 5 columns)
                if (i < 5) {
                    const leftDivisor = Math.round((i + 1) * colWidth);
                    addLayer(`Divisor Rodapé ${i}`, 'html',
                        `<div style="width:100%;height:100%;background:rgba(255,255,255,0.15);"></div>`,
                        'width:1px; height:80px;',
                        '975px', `${leftDivisor}px`, 'FOOTER', '1px', '80px');
                }
            });
        } else if (selectedTemplateId === 'alto-eliseos') {
            // ══════════════════════════════════════════════════════════════════════
            // ALTO ELÍSEOS — Lançamento (imobiliário / MCMV)
            // ══════════════════════════════════════════════════════════════════════
            const titulo          = custom_fields.titulo || 'ALTO\nELÍSEOS';
            const tagline         = custom_fields.tagline || 'VIVA A POUCOS\nMINUTOS DO CENTRO';
            const box1            = custom_fields.box1 || '2 QUARTOS\nCOM VARANDA';
            const box2            = custom_fields.box2 || 'VAGA DE\nGARAGEM';
            const box3            = custom_fields.box3 || 'ACESSOS\nINTELIGENTES\nE EXCLUSIVOS';
            const box4            = custom_fields.box4 || 'ÁREA DE\nLAZER\nCOMPLETA';
            const localizacao     = custom_fields.localizacao || 'CAMPOS ELÍSEOS\nFÁCIL ACESSO\nA SANTO DUMONT';
            const condicoesTitulo = custom_fields.condicoes_titulo || 'CONDIÇÕES QUE CABEM NO SEU PLANO';
            const rendaValor      = custom_fields.renda_valor || 'R$ 3.500';
            const entradaValor    = custom_fields.entrada_valor || 'R$ 500';
            const pagarValor      = custom_fields.pagar_valor || '60X';
            const subsidioValor   = custom_fields.subsidio_valor || 'ATÉ 55MIL';
            const ctaL1           = custom_fields.cta_l1 || 'CADASTRE-SE AGORA';
            const ctaL2           = custom_fields.cta_l2 || 'E RECEBA AS CONDIÇÕES DE';
            const ctaL3           = custom_fields.cta_l3 || 'LANÇAMENTO ANTES!';

            // Cores base (estimativas do print)
            let bp  = '#5C0B0F'; // brand-primary: bordô escuro
            let ba  = '#E2A84F'; // brand-accent: dourado
            let tl  = '#F7EFDF'; // brand-text-light: creme claro
            let sec = '#FFF9EF'; // token extra: branco-creme

            // Brand color personalization
            const brandPrimary = localStorage.getItem('imob_brand_color_primary');
            const brandSecondary = localStorage.getItem('imob_brand_color_secondary');
            const brandTertiary = localStorage.getItem('imob_brand_color_tertiary');

            const activeColors = [];
            if (brandPrimary) activeColors.push({ hex: brandPrimary, lum: getLuminance(brandPrimary) });
            if (brandSecondary) activeColors.push({ hex: brandSecondary, lum: getLuminance(brandSecondary) });
            if (brandTertiary) activeColors.push({ hex: brandTertiary, lum: getLuminance(brandTertiary) });

            if (activeColors.length === 1) {
                const col = activeColors[0];
                if (col.lum < 120) { bp = col.hex; } else { ba = col.hex; }
            } else if (activeColors.length === 2) {
                activeColors.sort((a, b) => a.lum - b.lum);
                bp = activeColors[0].hex;
                ba = activeColors[1].hex;
            } else if (activeColors.length >= 3) {
                activeColors.sort((a, b) => a.lum - b.lum);
                bp = activeColors[0].hex;
                ba = activeColors[1].hex;
                tl = activeColors[2].hex;
            }

            // Helper to adjust color luminance for gradients
            function adjustColor(hex, percent) {
                try {
                    let num = parseInt(hex.replace("#",""), 16),
                    amt = Math.round(2.55 * percent),
                    R = (num >> 16) + amt,
                    G = (num >> 8 & 0x00FF) + amt,
                    B = (num & 0x0000FF) + amt;
                    return "#" + (0x1000000 + (R<255?R<0?0:R:255)*0x10000 + (G<255?G<0?0:G:255)*0x100 - (B<255?B<0?0:B:255)).toString(16).slice(1);
                } catch(e) {
                    return hex;
                }
            }

            const gradBP = bp.toLowerCase() === '#5c0b0f' 
                ? `linear-gradient(135deg, #7E1418 0%, #5C0B0F 55%, #3F0608 100%)`
                : `linear-gradient(135deg, ${adjustColor(bp, 20)} 0%, ${bp} 55%, ${adjustColor(bp, -20)} 100%)`;
            const gradBA = ba.toLowerCase() === '#e2a84f'
                ? `linear-gradient(135deg, #F6CE85 0%, #E2A84F 50%, #B67B22 100%)`
                : `linear-gradient(135deg, ${adjustColor(ba, 15)} 0%, ${ba} 50%, ${adjustColor(ba, -15)} 100%)`;

            const isStory = selectedFormat === 'story';
            const layoutPos = isStory ? {
                L00_height: 1920,
                L01_top: 256,
                L01_text_top: 258,
                L02_top: 250,
                L02_text_top: 306,
                L03_top: 322,
                L04_top: 516,
                L05_top: 542,
                L06_top: 638,
                L06_text_top: 691,
                L07_top: 1484,
                L07_icon_top: 1484,
                L07_title_top: 1522,
                L07_sub_top: 1490,
                L08_top: 1524,
                L09_top: 1571,
                L09_text_l1_normal: 1627,
                L09_text_l2_normal: 1603,
                L09_text_l1_inv: 1619,
                L09_text_l2_inv: 1605,
                L10_icon_top: 1570,
                L10_text_top: 1630,
                L11_top: 1826,
                L12_top: 1838,
                L13_l1_top: 1832,
                L13_l2_top: 1872,
                L13_l3_top: 1892,
            } : {
                L00_height: 1080,
                L01_top: 66,
                L01_text_top: 68,
                L02_top: 60,
                L02_text_top: 116,
                L03_top: 132,
                L04_top: 326,
                L05_top: 352,
                L06_top: 448,
                L06_text_top: 501,
                L07_top: 769,
                L07_icon_top: 769,
                L07_title_top: 807,
                L07_sub_top: 775,
                L08_top: 809,
                L09_top: 856,
                L09_text_l1_normal: 912,
                L09_text_l2_normal: 888,
                L09_text_l1_inv: 904,
                L09_text_l2_inv: 890,
                L10_icon_top: 855,
                L10_text_top: 915,
                L11_top: 986,
                L12_top: 998,
                L13_l1_top: 992,
                L13_l2_top: 1032,
                L13_l3_top: 1052,
            };

            function addMCMVLayer(name, type, content, style, topVal, left, cluster, width, height) {
                let cssText = '';
                const styleObj = {
                    ...style,
                    position: 'absolute',
                    width: `${width}px`,
                    height: `${height}px`,
                };
                for (const [k, v] of Object.entries(styleObj)) {
                    const kebabKey = k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
                    cssText += `${kebabKey}:${v}; `;
                }
                addLayer(name, type, content, cssText, `${topVal}px`, `${left}px`, cluster, `${width}px`, `${height}px`);
            }

            // L00 — Degradê Lateral Vermelho (no máximo até a metade da imagem)
            addMCMVLayer('L00 Degradê Lateral', 'html', `
                <div style="width:100%; height:100%; background:linear-gradient(to right, ${bp} 0%, ${hexToRgba(bp, 0.95)} 30%, ${hexToRgba(bp, 0.6)} 70%, rgba(0,0,0,0) 100%);"></div>`,
                { zIndex: 2 }, 0, 0, 'NONE', 540, layoutPos.L00_height);

            // L01 Pill Lançamento - Ícone e Fundo
            addMCMVLayer('L01 Pill Lançamento - Ícone', 'html', `
                <div style="display:flex;align-items:center;height:100%;width:100%;position:relative;">
                    <i class="fa-solid fa-rocket" style="font-size:34px;color:${bp};transform:rotate(-20deg);position:absolute;left:0;top:9px;"></i>
                    <div style="background:${gradBA};width:230px;height:48px;border-radius:999px;box-shadow:0 4px 10px rgba(0,0,0,.35);position:absolute;left:60px;top:2px;"></div>
                </div>`,
                { zIndex: 10 }, layoutPos.L01_top, 18, 'NONE', 300, 52);

            // L01 Pill Lançamento - Texto
            addMCMVLayer('L01 Pill Lançamento - Texto', 'text', 'LANÇAMENTO', {
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 800,
                fontSize: '24px',
                letterSpacing: '4px',
                color: bp,
                textAlign: 'center',
                lineHeight: '48px',
                zIndex: 11
            }, layoutPos.L01_text_top, 78, 'NONE', 230, 48);

            // L02 Selo MCMV - Fundo e Ícone
            addMCMVLayer('L02 Selo MCMV - Fundo', 'html', `
                <div style="width:100%;height:100%;border-radius:50%;background:${sec};
                            display:flex;flex-direction:column;align-items:center;padding-top:14px;
                            box-shadow:0 4px 12px rgba(0,0,0,.35);box-sizing:border-box;position:relative;">
                    <i class="fa-solid fa-house-chimney" style="font-size:34px;color:#1B7A3D;"></i>
                </div>`,
                { zIndex: 10 }, layoutPos.L02_top, 930, 'NONE', 126, 112);

            // L02 Selo MCMV - Texto
            addMCMVLayer('L02 Selo MCMV - Texto', 'text', "Minha Casa\nMinha Vida", {
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: '13px',
                color: '#0A4DA1',
                lineHeight: 1.15,
                textAlign: 'center',
                zIndex: 11
            }, layoutPos.L02_text_top, 930, 'NONE', 126, 40);

            // L03 — Título do Empreendimento
            addMCMVLayer('L03 Título Empreendimento', 'text', titulo, {
                fontFamily: "'Cinzel', serif",
                fontWeight: 700,
                fontSize: '84px',
                lineHeight: 1.02,
                letterSpacing: '2px',
                color: ba,
                background: gradBA,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textAlign: 'left',
                textShadow: '0 3px 12px rgba(0,0,0,.45)',
                zIndex: 10
            }, layoutPos.L03_top, 25, 'NONE', 420, 180);

            // L04 — Ornamento Losango
            addMCMVLayer('L04 Ornamento Losango', 'html', `
                <div style="display:flex;align-items:center;gap:12px;width:100%;">
                    <div style="flex:1;height:2px;background:${ba};opacity:.9;"></div>
                    <div style="width:12px;height:12px;background:${ba};transform:rotate(45deg);"></div>
                    <div style="flex:1;height:2px;background:${ba};opacity:.9;"></div>
                </div>`,
                { zIndex: 10 }, layoutPos.L04_top, 25, 'NONE', 380, 14);

            // L05 — Tagline com cor dinâmica
            const taglineLines = tagline.split('\n');
            const taglineHtml = taglineLines.length >= 2 
                ? `${taglineLines[0]}<br><span style="color:${ba};">${taglineLines[1].split(' ')[0]}</span> ${taglineLines[1].split(' ').slice(1).join(' ')}`
                : tagline;

            addMCMVLayer('L05 Tagline', 'html', `
                <div style="font-family:'Cinzel',serif;font-weight:600;font-size:30px;
                            letter-spacing:5px;color:${tl};line-height:1.35;
                            text-shadow:0 2px 8px rgba(0,0,0,.55);text-align:left;">
                    ${taglineHtml}
                </div>`,
                { zIndex: 10 }, layoutPos.L05_top, 25, 'NONE', 460, 90);

            // L06 — Boxes de características (Fundo, Ícone e Texto separados)
            const boxes = [
                { id: 1, icone: 'fa-bed',            txt: box1,  left: 25,  destaque: false },
                { id: 2, icone: 'fa-car',            txt: box2,  left: 170, destaque: false },
                { id: 3, icone: 'fa-key',            txt: box3,  left: 315, destaque: false },
                { id: 4, icone: 'fa-umbrella-beach', txt: box4,  left: 460, destaque: true  },
            ];
            boxes.forEach((b) => {
                const bg  = b.destaque ? gradBA : gradBP;
                const cor = b.destaque ? bp : tl;
                const corIcone = b.destaque ? bp : ba;

                // 1. Box Fundo (html)
                addMCMVLayer(`L06.${b.id} Box Fundo`, 'html', `
                    <div style="width:100%;height:100%;background:${bg};border:2px solid ${ba};
                                border-radius:14px;box-shadow:0 4px 12px rgba(0,0,0,.4);box-sizing:border-box;"></div>`,
                    { zIndex: 10 }, layoutPos.L06_top, b.left, 'NONE', 132, 118);

                // 2. Box Ícone (html)
                addMCMVLayer(`L06.${b.id} Box Ícone`, 'html', `
                    <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
                        <i class="fa-solid ${b.icone}" style="font-size:30px;color:${corIcone};"></i>
                    </div>`,
                    { zIndex: 11 }, layoutPos.L06_top, b.left, 'NONE', 132, 50);

                // 3. Box Texto (text)
                addMCMVLayer(`L06.${b.id} Box Texto`, 'text', b.txt, {
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: b.destaque ? 800 : 600,
                    fontSize: '15px',
                    color: cor,
                    textAlign: 'center',
                    lineHeight: 1.25,
                    zIndex: 11
                }, layoutPos.L06_text_top, b.left, 'NONE', 132, 55);
            });

            // L07 Badge Localização - Fundo e Ícone
            const locLines = localizacao.split('\n');
            const locLine1 = locLines[0] || 'CAMPOS ELÍSEOS';
            const locLine2 = locLines[1] || 'FÁCIL ACESSO';
            const locLine3 = locLines[2] || 'A SANTO DUMONT';

            addMCMVLayer('L07 Badge Localização - Fundo', 'html', `
                <div style="width:100%;height:100%;background:${gradBP};border:2px solid ${ba};
                            border-radius:999px;box-shadow:0 4px 12px rgba(0,0,0,.4);box-sizing:border-box;"></div>`,
                { zIndex: 10 }, layoutPos.L07_top, 713, 'NONE', 330, 68);

            addMCMVLayer('L07 Badge Localização - Ícone', 'html', `
                <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
                    <i class="fa-solid fa-location-dot" style="font-size:30px;color:${ba};"></i>
                </div>`,
                { zIndex: 11 }, layoutPos.L07_icon_top, 725, 'NONE', 30, 68);

            // L07 Badge Localização - Linha 1 (Título)
            addMCMVLayer('L07 Badge Localização - Título', 'text', locLine1, {
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 800,
                fontSize: '18px',
                color: tl,
                textAlign: 'left',
                zIndex: 11
            }, layoutPos.L07_title_top, 770, 'NONE', 250, 22);

            // L07 Badge Localização - Linhas 2-3 (Subtítulo)
            addMCMVLayer('L07 Badge Localização - Subtítulo', 'text', `${locLine2}\n${locLine3}`, {
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 600,
                fontSize: '12px',
                color: ba,
                textAlign: 'left',
                lineHeight: 1.2,
                zIndex: 11
            }, layoutPos.L07_sub_top, 770, 'NONE', 250, 30);

            // L08 — Label Condições
            addMCMVLayer('L08 Label Condições', 'html', `
                <div style="display:flex;align-items:center;gap:16px;width:100%;height:100%;">
                    <div style="flex:1;height:1.5px;background:${ba};opacity:.85;"></div>
                    <span style="font-family:'Montserrat',sans-serif;font-weight:700;font-size:19px;
                                 letter-spacing:2px;color:${tl};white-space:nowrap;
                                 text-shadow:0 2px 6px rgba(0,0,0,.6);">${condicoesTitulo}</span>
                    <div style="flex:1;height:1.5px;background:${ba};opacity:.85;"></div>
                </div>`,
                { zIndex: 10 }, layoutPos.L08_top, 29, 'NONE', 610, 26);

            // L09 — Pills brancos de condições (Fundo, Ícone e Textos separados)
            const pills = [
                { id: 1, icone: 'fa-users',         l1: 'RENDA DE',    l2: rendaValor, left: 25,  w: 158 },
                { id: 2, icone: 'fa-coins',         l1: 'ENTRADA DE:', l2: entradaValor,   left: 190, w: 158 },
                { id: 3, icone: 'fa-calendar-days', l1: pagarValor,         l2: 'PARA PAGAR', left: 355, w: 130, invertido: true },
                { id: 4, icone: 'fa-house',         l1: 'SUBSÍDIO DE', l2: subsidioValor, left: 492, w: 158 },
            ];
            pills.forEach((p) => {
                // 1. Pill Fundo
                addMCMVLayer(`L09.${p.id} Pill Fundo`, 'html', `
                    <div style="width:100%;height:100%;background:${sec};border-radius:16px;
                                box-shadow:0 4px 10px rgba(0,0,0,.35);box-sizing:border-box;"></div>`,
                    { zIndex: 10 }, layoutPos.L09_top, p.left, 'NONE', p.w, 80);

                // 2. Pill Ícone
                addMCMVLayer(`L09.${p.id} Pill Ícone`, 'html', `
                    <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
                        <i class="fa-solid ${p.icone}" style="font-size:20px;color:${bp};
                           border:2px solid ${ba};border-radius:50%;padding:6px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;"></i>
                    </div>`,
                    { zIndex: 11 }, layoutPos.L09_top, p.left + 8, 'NONE', 36, 80);

                // 3. Pill Textos
                const textLeft = p.left + 46;
                const textWidth = p.w - 52;
                if (p.invertido) {
                    addMCMVLayer(`L09.${p.id} Pill Texto L1`, 'text', p.l1, {
                        fontFamily: "'Montserrat', sans-serif",
                        fontWeight: 800,
                        fontSize: '22px',
                        color: bp,
                        textAlign: 'left',
                        zIndex: 11
                    }, layoutPos.L09_text_l1_inv, textLeft, 'NONE', textWidth, 24);

                    addMCMVLayer(`L09.${p.id} Pill Texto L2`, 'text', p.l2, {
                        fontFamily: "'Montserrat', sans-serif",
                        fontWeight: 600,
                        fontSize: '11px',
                        color: bp,
                        letterSpacing: '.5px',
                        textAlign: 'left',
                        zIndex: 11
                    }, layoutPos.L09_text_l2_inv, textLeft, 'NONE', textWidth, 14);
                } else {
                    addMCMVLayer(`L09.${p.id} Pill Texto L1`, 'text', p.l1, {
                        fontFamily: "'Montserrat', sans-serif",
                        fontWeight: 600,
                        fontSize: '11px',
                        color: bp,
                        letterSpacing: '.5px',
                        textAlign: 'left',
                        zIndex: 11
                    }, layoutPos.L09_text_l1_normal, textLeft, 'NONE', textWidth, 14);

                    addMCMVLayer(`L09.${p.id} Pill Texto L2`, 'text', p.l2, {
                        fontFamily: "'Montserrat', sans-serif",
                        fontWeight: 800,
                        fontSize: '20px',
                        color: bp,
                        textAlign: 'left',
                        zIndex: 11
                    }, layoutPos.L09_text_l2_normal, textLeft, 'NONE', textWidth, 24);
                }
            });

            // L10 — Ícones circulares com legenda (Fundo e Legenda separados)
            const circulos = [
                { id: 1, icone: 'fa-shield-halved', txt: 'SEGURANÇA\nE CONFORTO',       left: 656 },
                { id: 2, icone: 'fa-leaf',          txt: 'SUSTENTABILIDADE\nE ECONOMIA', left: 759 },
                { id: 3, icone: 'fa-dumbbell',      txt: 'LAZER\nCOMPLETO',             left: 863 },
                { id: 4, icone: 'fa-location-dot',  txt: 'LOCALIZAÇÃO\nESTRATÉGICA',    left: 964 },
            ];
            circulos.forEach((c) => {
                // 1. Círculo Ícone Fundo
                addMCMVLayer(`L10.${c.id} Ícone Fundo`, 'html', `
                    <div style="width:60px;height:60px;border-radius:50%;background:${sec};
                                display:flex;align-items:center;justify-content:center;
                                box-shadow:0 3px 8px rgba(0,0,0,.4);margin:0 auto;">
                        <i class="fa-solid ${c.icone}" style="font-size:26px;color:${bp};"></i>
                    </div>`,
                    { zIndex: 10 }, layoutPos.L10_icon_top, c.left, 'NONE', 110, 60);

                // 2. Círculo Legenda (text)
                addMCMVLayer(`L10.${c.id} Legenda`, 'text', c.txt, {
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 700,
                    fontSize: '11px',
                    color: tl,
                    textAlign: 'center',
                    lineHeight: 1.25,
                    letterSpacing: '.5px',
                    textShadow: '0 2px 5px rgba(0,0,0,.7)',
                    zIndex: 11
                }, layoutPos.L10_text_top, c.left, 'NONE', 110, 30);
            });

            // L11 — Barra de rodapé full-width
            addMCMVLayer('L11 Barra Rodapé', 'html', `
                <div style="width:100%;height:100%;background:${gradBP};
                            border-top:3px solid ${ba};box-shadow:0 -6px 18px rgba(0,0,0,.45);box-sizing:border-box;"></div>`,
                { zIndex: 10 }, layoutPos.L11_top, 0, 'NONE', 1080, 94);

            // L12 — Quadrado dourado com calendário
            addMCMVLayer('L12 Ícone Calendário Rodapé', 'html', `
                <div style="width:100%;height:100%;background:${gradBA};border-radius:14px;
                            display:flex;align-items:center;justify-content:center;
                            box-shadow:0 3px 8px rgba(0,0,0,.4);box-sizing:border-box;">
                    <i class="fa-solid fa-calendar-check" style="font-size:36px;color:${bp};"></i>
                </div>`,
                { zIndex: 11 }, layoutPos.L12_top, 144, 'NONE', 70, 70);

            // L13 — CTA Linhas 1, 2, 3 (textos separados)
            addMCMVLayer('L13 CTA Linha 1', 'text', ctaL1, {
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 800,
                fontSize: '38px',
                color: tl,
                letterSpacing: '1px',
                zIndex: 11
            }, layoutPos.L13_l1_top, 234, 'NONE', 620, 38);

            addMCMVLayer('L13 CTA Linha 2', 'text', ctaL2, {
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 600,
                fontSize: '17px',
                color: ba,
                letterSpacing: '3px',
                zIndex: 11
            }, layoutPos.L13_l2_top, 234, 'NONE', 620, 20);

            addMCMVLayer('L13 CTA Linha 3', 'text', ctaL3, {
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 800,
                fontSize: '19px',
                color: ba,
                letterSpacing: '2px',
                textDecoration: 'underline',
                zIndex: 11
            }, layoutPos.L13_l3_top, 234, 'NONE', 620, 22);
        } else if (selectedTemplateId === 'recreio-shopping') {
            // ══════════════════════════════════════════════════════════════════════
            // RECREIO SHOPPING (Américas 19) — MCMV (Engenharia Reversa)
            // ══════════════════════════════════════════════════════════════════════
            const titulo          = custom_fields.titulo || 'Em frente ao Recreio Shopping\ne a 5 minutos da praia';
            const badgeQuartosL1  = custom_fields.badge_quartos_l1 || 'APARTAMENTOS DE';
            const badgeQuartosL2  = custom_fields.badge_quartos_l2 || '3 QUARTOS';
            const metragem        = custom_fields.metragem || '64 m²';
            const valorImoveis    = custom_fields.valor_imoveis || 'R$ 539.000,00';
            const valorEntrada    = custom_fields.valor_entrada || 'R$ 40 mil';
            const valorParcelas   = custom_fields.valor_parcelas || 'R$ 2.500';
            const entrega         = custom_fields.entrega || 'MARÇO/2027';
            const assinaturaL1    = custom_fields.assinatura_l1 || 'AMÉRICAS 19';
            const assinaturaL2    = custom_fields.assinatura_l2 || 'RECREIO';

            // Cores base (estimativas do print/regras do usuário)
            let bp = '#1B3A50'; // brand-primary (azul-marinho)
            let ba = '#BE9C50'; // brand-accent (dourado)
            let tl = '#F4EFE6'; // brand-text-light (creme)

            // Formatos & Safe Zone
            const format = selectedFormat === 'story' ? '9:16' : '1:1';
            const F_width = 1080;
            const F_height = format === '9:16' ? 1920 : 1080;
            const F_safeTop = format === '9:16' ? 250 : 60;
            const F_safeBottom = format === '9:16' ? 260 : 60;

            function resolvePositionLocal(cluster, edgeOffset, heightVal, ignoreSafe = false) {
                if (cluster === 'TOP') {
                    const off = ignoreSafe ? edgeOffset : Math.max(edgeOffset, F_safeTop);
                    return off;
                }
                const off = ignoreSafe ? edgeOffset : Math.max(edgeOffset, F_safeBottom);
                return F_height - off - heightVal;
            }

            function addMCMVLayer(name, type, content, style, edgeTop, left, cluster, width, height, ignoreSafe = false) {
                const top = resolvePositionLocal(cluster, edgeTop, height, ignoreSafe);
                let cssText = '';
                const styleObj = {
                    ...style,
                    position: 'absolute',
                    width: `${width}px`,
                    height: `${height}px`,
                };
                for (const [k, v] of Object.entries(styleObj)) {
                    const kebabKey = k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
                    cssText += `${kebabKey}:${v}; `;
                }
                addLayer(name, type, content, cssText, `${top}px`, `${left}px`, 'NONE', `${width}px`, `${height}px`);
            }

            // Deslocamento uniforme de cluster
            const MIN_TOP_OFFSET    = 72;
            const MIN_BOTTOM_OFFSET = 24;
            const shiftTop    = Math.max(0, F_safeTop - MIN_TOP_OFFSET);
            const shiftBottom = Math.max(0, F_safeBottom - MIN_BOTTOM_OFFSET);

            // ════════ DEGRADÊS BRANCOS SUAVES DE LEITURA ════════
            // L00 — Degradê Superior quase transparente para destacar textos superiores
            addMCMVLayer('L00_degrade_superior', 'html',
                `<div style="width:100%;height:100%;background:linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.65) 60%, rgba(255,255,255,0) 100%);pointer-events:none;"></div>`,
                {},
                0, 0, 'TOP', F_width, format === '9:16' ? 560 : 480, /* ignoreSafe */ true
            );

            // L00 — Degradê Inferior quase transparente para destacar textos do rodapé
            addMCMVLayer('L00_degrade_inferior', 'html',
                `<div style="width:100%;height:100%;background:linear-gradient(0deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.65) 60%, rgba(255,255,255,0) 100%);pointer-events:none;"></div>`,
                {},
                0, 0, 'BOTTOM', F_width, format === '9:16' ? 340 : 280, /* ignoreSafe */ true
            );

            // ════════ CLUSTER SUPERIOR (TOP) ════════

            // L01 — Moldura decorativa dourada
            addMCMVLayer('L01_moldura', 'html',
                `<div style="width:100%;height:100%;border:3px solid ${ba};opacity:.9;box-sizing:border-box;"></div>`,
                {},
                25, 25, 'TOP', 1030, F_height - 50, /* ignoreSafe */ true
            );

            // L02 — Título principal (Text layer editável)
            addMCMVLayer('L02_titulo', 'text', titulo,
                {
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 700,
                    fontSize: '54px',
                    lineHeight: 1.28,
                    color: bp,
                    textAlign: 'center',
                    whiteSpace: 'pre-line',
                },
                72 + shiftTop, 40, 'TOP', 1000, 150
            );

            // L03 — Fundo Balão "APARTAMENTOS DE / 3 QUARTOS" (HTML Layer - Fundo separado)
            addMCMVLayer('L03_badge_quartos_fundo', 'html',
                `<div style="width:100%;height:100%;background:${bp};border:2px solid rgba(255,255,255,.75);
                    border-radius:10px;box-shadow:0 4px 14px rgba(0,0,0,.25);"></div>`,
                {},
                235 + shiftTop, 100, 'TOP', 330, 120
            );

            // L03 — Texto Linha 1 "APARTAMENTOS DE" (Text Layer Editável)
            addMCMVLayer('L03_badge_quartos_l1', 'text', badgeQuartosL1,
                {
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 600,
                    fontSize: '21px',
                    lineHeight: 1.2,
                    letterSpacing: '2px',
                    color: tl,
                    textAlign: 'center',
                },
                248 + shiftTop, 105, 'TOP', 320, 30
            );

            // L03 — Texto Linha 2 "3 QUARTOS" (Text Layer Editável)
            addMCMVLayer('L03_badge_quartos_l2', 'text', badgeQuartosL2,
                {
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 800,
                    fontSize: '42px',
                    lineHeight: 1.2,
                    letterSpacing: '1px',
                    color: tl,
                    textAlign: 'center',
                },
                282 + shiftTop, 105, 'TOP', 320, 55
            );

            // L04 — Fundo Balão "64 m²" (HTML Layer - Fundo separado)
            addMCMVLayer('L04_badge_metragem_fundo', 'html',
                `<div style="width:100%;height:100%;background:${bp};border-radius:8px;
                    box-shadow:0 4px 12px rgba(0,0,0,.25);"></div>`,
                {},
                368 + shiftTop, 170, 'TOP', 190, 60
            );

            // L04 — Texto Metragem "64 m²" (Text Layer Editável)
            addMCMVLayer('L04_badge_metragem', 'text', metragem,
                {
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 600,
                    fontSize: '34px',
                    lineHeight: 1.2,
                    color: tl,
                    textAlign: 'center',
                },
                376 + shiftTop, 170, 'TOP', 190, 50
            );

            // L05–L08 — Bloco de valores à direita (Text Layers Editáveis)
            addMCMVLayer('L05_valor_imoveis', 'text', `Imóveis a partir de ${valorImoveis}`,
                {
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 500,
                    fontSize: '30px',
                    color: bp,
                    textAlign: 'right',
                },
                240 + shiftTop, 430, 'TOP', 570, 44
            );

            addMCMVLayer('L06_valor_entrada', 'text', `Entrada de ${valorEntrada}`,
                {
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 500,
                    fontSize: '30px',
                    color: bp,
                    textAlign: 'right',
                },
                296 + shiftTop, 430, 'TOP', 570, 44
            );

            addMCMVLayer('L07_valor_parcelas', 'text', `Parcelas de ${valorParcelas}`,
                {
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 500,
                    fontSize: '30px',
                    color: bp,
                    textAlign: 'right',
                },
                348 + shiftTop, 430, 'TOP', 570, 44
            );

            addMCMVLayer('L08_entrega', 'text', `Entrega prevista: ${entrega}`,
                {
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 700,
                    fontSize: '27px',
                    color: bp,
                    textAlign: 'right',
                },
                400 + shiftTop, 430, 'TOP', 570, 44
            );

            // ════════ CLUSTER INFERIOR (BOTTOM) ════════

            // L09 — Preço principal (Text Layer Editável)
            addMCMVLayer('L09_preco_principal', 'text', `R$ ${valorImoveis.replace(/R\$\s*/i, '').trim()}`,
                {
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 800,
                    fontSize: '58px',
                    color: bp,
                    textAlign: 'left',
                },
                145 + shiftBottom, 100, 'BOTTOM', 440, 58
            );

            // L10 — Divisor vertical entre preço e entrada (traço fino navy)
            addMCMVLayer('L10_divisor_vertical', 'html',
                `<div style="width:100%;height:100%;background:${bp};opacity:.85;"></div>`,
                {},
                134 + shiftBottom, 566, 'BOTTOM', 3, 72
            );

            // L11 — Entrada rodapé (Text Layer Editável)
            addMCMVLayer('L11_entrada_rodape', 'text', `Entrada de ${valorEntrada}`,
                {
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 500,
                    fontSize: '37px',
                    color: bp,
                    textAlign: 'left',
                },
                150 + shiftBottom, 600, 'BOTTOM', 400, 46
            );

            // L12 — Parcelas rodapé (Text Layer Editável)
            addMCMVLayer('L12_parcelas_rodape', 'text', `Parcelas de ${valorParcelas}`,
                {
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 500,
                    fontSize: '40px',
                    color: bp,
                    textAlign: 'center',
                },
                74 + shiftBottom, 240, 'BOTTOM', 600, 48
            );

            // L13 — Assinatura "AMÉRICAS 19 ─── RECREIO" (Text Layers Editáveis + Linha Separadora)
            addMCMVLayer('L13_assinatura_l1', 'text', assinaturaL1,
                {
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 600,
                    fontSize: '21px',
                    letterSpacing: '5px',
                    color: bp,
                    textAlign: 'right',
                },
                24 + shiftBottom, 190, 'BOTTOM', 230, 30
            );

            addMCMVLayer('L13_assinatura_linha', 'html',
                `<div style="width:100%;height:2px;background:${bp};"></div>`,
                {},
                38 + shiftBottom, 445, 'BOTTOM', 190, 2
            );

            addMCMVLayer('L13_assinatura_l2', 'text', assinaturaL2,
                {
                    fontFamily: "'Playfair Display', serif",
                    fontWeight: 600,
                    fontSize: '21px',
                    letterSpacing: '5px',
                    color: bp,
                    textAlign: 'left',
                },
                24 + shiftBottom, 660, 'BOTTOM', 230, 30
            );
        } else if (selectedTemplateId === 'lazer-clube') {
            // ══════════════════════════════════════════════════════════════════════
            // LAZER CLUBE (Caminhos do Jaçanã) — MCMV (Engenharia Reversa)
            // ══════════════════════════════════════════════════════════════════════
            const badgeTag          = custom_fields.badge_tag || 'LANÇAMENTO';
            const badgePrograma     = custom_fields.badge_programa || 'Minha Casa Minha Vida';
            const nomeL1            = custom_fields.nome_l1 || 'CAMINHOS DO';
            const nomeL2            = custom_fields.nome_l2 || 'JAÇANÃ';
            const subtituloL1       = custom_fields.subtitulo_l1 || 'lazer de clube:';
            const subtituloL2       = custom_fields.subtitulo_l2 || 'cinema, sportbar e mais';
            const kicker            = custom_fields.kicker || 'UM CONDOMÍNIO COM CARA DE CLUBE';
            const headlineL1        = custom_fields.headline_l1 || 'Lazer de clube todo dia, no';
            const headlineL2        = custom_fields.headline_l2 || 'Jaçanã';
            const descricao         = custom_fields.descricao || 'piscina, cinema, sportbar, quadra e praça do fogo';
            const labelEntrada      = custom_fields.label_entrada || 'ENTRADA A PARTIR DE';
            const valorEntrada      = custom_fields.valor_entrada || 'R$ 500';
            const notaFgts          = custom_fields.nota_fgts || '*use o seu FGTS';
            const beneficioSubsidio = custom_fields.beneficio_subsidio || 'R$ 55 mil';
            const beneficioRenda    = custom_fields.beneficio_renda || 'com até 2 pessoas';
            const beneficioDorm     = custom_fields.beneficio_dormitorios || '2 e 3 dormitórios';
            const botaoTexto        = custom_fields.botao_texto || 'Faça seu cadastro';
            const rodapeInst        = custom_fields.rodape_institucional || 'Minha Casa Minha Vida  ·  Programa Prefeitura de SP  ·  Plano&Plano';

            // Cores base (estimativas da peça)
            let bp = '#0B1B2E'; // brand-primary (azul-marinho quase preto)
            let ba = '#F5C518'; // brand-accent (dourado/amarelo)
            let tl = '#FFFFFF'; // brand-text-light (branco)

            const brandPrimary = localStorage.getItem('imob_brand_color_primary');
            const brandSecondary = localStorage.getItem('imob_brand_color_secondary');
            if (brandPrimary) bp = brandPrimary;
            if (brandSecondary) ba = brandSecondary;

            // Formatos & Safe Zone
            const format = selectedFormat === 'story' ? '9:16' : '1:1';
            const F_width = 1080;
            const F_height = format === '9:16' ? 1920 : 1080;
            const F_safeTop = format === '9:16' ? 250 : 60;
            const F_safeBottom = format === '9:16' ? 260 : 60;

            function resolvePositionLocal(cluster, edgeOffset, heightVal, ignoreSafe = false) {
                if (cluster === 'TOP') {
                    const off = ignoreSafe ? edgeOffset : Math.max(edgeOffset, F_safeTop);
                    return off;
                }
                const off = ignoreSafe ? edgeOffset : Math.max(edgeOffset, F_safeBottom);
                return F_height - off - heightVal;
            }

            function addMCMVLayer(name, type, content, style, edgeTop, left, cluster, width, height, ignoreSafe = false) {
                const top = resolvePositionLocal(cluster, edgeTop, height, ignoreSafe);
                let cssText = '';
                const styleObj = {
                    ...style,
                    position: 'absolute',
                    width: `${width}px`,
                    height: `${height}px`,
                };
                for (const [k, v] of Object.entries(styleObj)) {
                    const kebabKey = k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
                    cssText += `${kebabKey}:${v}; `;
                }
                addLayer(name, type, content, cssText, `${top}px`, `${left}px`, 'NONE', `${width}px`, `${height}px`);
            }

            // Deslocamento uniforme de cluster
            const MIN_TOP_OFFSET    = 40;
            const MIN_BOTTOM_OFFSET = 29;
            const shiftTop    = Math.max(0, F_safeTop - MIN_TOP_OFFSET);
            const shiftBottom = Math.max(0, F_safeBottom - MIN_BOTTOM_OFFSET);

            // ════════ CLUSTER SUPERIOR (TOP) ════════

            // L01 — Fundo Badge "LANÇAMENTO" (Pill Dourada + Ícone)
            addMCMVLayer('L01_badge_lancamento_fundo', 'html',
                `<div style="width:100%;height:100%;display:flex;align-items:center;padding-left:18px;background:${ba};border-radius:30px;box-sizing:border-box;">
                   <i class="fa-solid fa-bolt" style="color:${bp};font-size:16px;"></i>
                 </div>`,
                {}, 40 + shiftTop, 45, 'TOP', 268, 63, true
            );

            // L01 — Texto Badge "LANÇAMENTO" (Text Layer Editável)
            addMCMVLayer('L01_badge_lancamento_texto', 'text', badgeTag,
                {
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 800,
                    fontSize: '15px',
                    letterSpacing: '0.5px',
                    color: bp,
                    textAlign: 'left',
                    lineHeight: '63px'
                },
                40 + shiftTop, 90, 'TOP', 215, 63, true
            );

            // L02 — Fundo Badge "Minha Casa Minha Vida" (Pill Branca + Ícone)
            addMCMVLayer('L02_badge_mcmv_fundo', 'html',
                `<div style="width:100%;height:100%;display:flex;align-items:center;padding-left:16px;background:${tl};border-radius:30px;box-shadow:0 2px 6px rgba(0,0,0,0.25);box-sizing:border-box;">
                   <i class="fa-solid fa-house" style="color:${bp};font-size:15px;"></i>
                 </div>`,
                {}, 40 + shiftTop, 730, 'TOP', 305, 63, true
            );

            // L02 — Texto Badge "Minha Casa Minha Vida" (Text Layer Editável)
            addMCMVLayer('L02_badge_mcmv_texto', 'text', badgePrograma,
                {
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 700,
                    fontSize: '14px',
                    color: bp,
                    textAlign: 'left',
                    lineHeight: '63px'
                },
                40 + shiftTop, 770, 'TOP', 255, 63, true
            );

            // L03 — Título Empreendimento Linha 1 (CAMINHOS DO) (Text Layer Editável)
            addMCMVLayer('L03_nome_l1', 'text', nomeL1,
                {
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 800,
                    fontSize: '30px',
                    letterSpacing: '0.5px',
                    color: tl,
                    textAlign: 'left',
                    lineHeight: '54px'
                },
                393 + shiftTop, 45, 'TOP', 260, 54, true
            );

            // L03 — Título Empreendimento Linha 2 (JAÇANÃ) (Text Layer Editável)
            addMCMVLayer('L03_nome_l2', 'text', nomeL2,
                {
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 800,
                    fontSize: '30px',
                    letterSpacing: '0.5px',
                    color: ba,
                    textAlign: 'left',
                    lineHeight: '54px'
                },
                393 + shiftTop, 305, 'TOP', 260, 54, true
            );

            // L04 — Subtítulo Linha 1 (lazer de clube:) (Text Layer Editável)
            addMCMVLayer('L04_subtitulo_l1', 'text', subtituloL1,
                {
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 600,
                    fontSize: '15px',
                    color: tl,
                    textAlign: 'left',
                    lineHeight: '45px'
                },
                445 + shiftTop, 45, 'TOP', 180, 45, true
            );

            // L04 — Subtítulo Linha 2 (cinema, sportbar e mais) (Text Layer Editável)
            addMCMVLayer('L04_subtitulo_l2', 'text', subtituloL2,
                {
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: 700,
                    fontSize: '15px',
                    color: ba,
                    textDecoration: 'underline',
                    textAlign: 'left',
                    lineHeight: '45px'
                },
                445 + shiftTop, 220, 'TOP', 350, 45, true
            );

            // ════════ CLUSTER INFERIOR (BOTTOM) ════════

            // L04B — Degradê Escuro de Legibilidade (55% da altura)
            const alturaOverlay = Math.round(F_height * 0.55);
            addMCMVLayer('L04B_overlay_gradiente_escurecimento', 'html',
                `<div style="width:100%;height:100%;background:linear-gradient(to top, ${bp} 0%, ${bp} 45%, transparent 100%);pointer-events:none;"></div>`,
                {}, 0, 0, 'BOTTOM', F_width, alturaOverlay, true
            );

            // L05 — Kicker "UM CONDOMÍNIO COM CARA DE CLUBE" (Text Layer Editável)
            addMCMVLayer('L05_kicker_condominio', 'text', kicker,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '14px', letterSpacing: '1px', color: ba, textAlign: 'left' },
                566 + shiftBottom, 45, 'BOTTOM', 500, 27, true
            );

            // L06 — Headline Linha 1 (Text Layer Editável)
            addMCMVLayer('L06_headline_linha1', 'text', headlineL1,
                { fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: '34px', lineHeight: 1.1, color: tl, textAlign: 'left' },
                503 + shiftBottom, 45, 'BOTTOM', 783, 63, true
            );

            // L07 — Headline Linha 2 (Text Layer Editável)
            addMCMVLayer('L07_headline_linha2', 'text', headlineL2,
                { fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: '36px', lineHeight: 1.1, color: ba, textAlign: 'left' },
                436 + shiftBottom, 45, 'BOTTOM', 403, 67, true
            );

            // L08 — Descrição de Apoio (Text Layer Editável)
            addMCMVLayer('L08_descricao_apoio', 'text', descricao,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: '15px', color: tl, textAlign: 'left' },
                394 + shiftBottom, 45, 'BOTTOM', 962, 34, true
            );

            // L09 — Bloco de Preço Fundo (Retângulo Amarelo/Dourado) (HTML Layer Separada)
            addMCMVLayer('L09_bg_bloco_preco', 'html',
                `<div style="width:100%;height:100%;background:${ba};border-radius:14px;box-shadow:0 4px 12px rgba(0,0,0,0.3);"></div>`,
                {}, 181 + shiftBottom, 45, 'BOTTOM', 380, 165, true
            );

            // L10 — Label Entrada (Text Layer Editável)
            addMCMVLayer('L10_label_entrada', 'text', labelEntrada,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '12px', letterSpacing: '0.5px', color: bp, textAlign: 'left' },
                308 + shiftBottom, 68, 'BOTTOM', 330, 20, true
            );

            // L11 — Valor Entrada (Text Layer Editável)
            addMCMVLayer('L11_valor_entrada', 'text', valorEntrada,
                { fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: '40px', color: bp, textAlign: 'left' },
                238 + shiftBottom, 68, 'BOTTOM', 330, 65, true
            );

            // L12 — Nota FGTS (Text Layer Editável)
            addMCMVLayer('L12_nota_fgts', 'text', notaFgts,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '12px', color: bp, opacity: 0.85, fontStyle: 'italic', textAlign: 'left' },
                205 + shiftBottom, 68, 'BOTTOM', 250, 18, true
            );

            // L13 — Benefício Subsídio (Ícone HTML + Texto Editável)
            addMCMVLayer('L13_beneficio_subsidio_icone', 'html',
                `<div style="width:26px;height:26px;border-radius:50%;border:2px solid ${ba};display:flex;align-items:center;justify-content:center;">
                   <i class="fa-solid fa-sack-dollar" style="color:${ba};font-size:12px;"></i>
                 </div>`,
                {}, 309 + shiftBottom, 450, 'BOTTOM', 30, 30, true
            );

            addMCMVLayer('L13_beneficio_subsidio_texto', 'text', `Subsídio de até ${beneficioSubsidio}`,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '14px', color: tl, textAlign: 'left', lineHeight: '30px' },
                309 + shiftBottom, 490, 'BOTTOM', 410, 30, true
            );

            // L14 — Benefício Renda (Ícone HTML + Texto Editável)
            addMCMVLayer('L14_beneficio_renda_icone', 'html',
                `<div style="width:26px;height:26px;border-radius:50%;border:2px solid ${ba};display:flex;align-items:center;justify-content:center;">
                   <i class="fa-solid fa-people-group" style="color:${ba};font-size:12px;"></i>
                 </div>`,
                {}, 253 + shiftBottom, 450, 'BOTTOM', 30, 30, true
            );

            addMCMVLayer('L14_beneficio_renda_texto', 'text', `Some sua renda ${beneficioRenda}`,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '14px', color: tl, textAlign: 'left', lineHeight: '30px' },
                253 + shiftBottom, 490, 'BOTTOM', 410, 30, true
            );

            // L15 — Benefício Dormitórios (Ícone HTML + Texto Editável)
            addMCMVLayer('L15_beneficio_dormitorios_icone', 'html',
                `<div style="width:26px;height:26px;border-radius:50%;border:2px solid ${ba};display:flex;align-items:center;justify-content:center;">
                   <i class="fa-solid fa-bed" style="color:${ba};font-size:12px;"></i>
                 </div>`,
                {}, 205 + shiftBottom, 450, 'BOTTOM', 30, 30, true
            );

            addMCMVLayer('L15_beneficio_dormitorios_texto', 'text', beneficioDorm,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '14px', color: ba, textAlign: 'left', lineHeight: '30px' },
                205 + shiftBottom, 490, 'BOTTOM', 410, 30, true
            );

            // L16 — Fundo Botão "Faça seu cadastro" (HTML Layer + Ícones)
            addMCMVLayer('L16_botao_cadastro_fundo', 'html',
                `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:space-between;padding:0 24px;background:${tl};border-radius:40px;box-shadow:0 4px 12px rgba(0,0,0,0.25);box-sizing:border-box;">
                   <i class="fa-solid fa-file-signature" style="color:${bp};font-size:16px;"></i>
                   <i class="fa-solid fa-arrow-right" style="color:${bp};font-size:15px;"></i>
                 </div>`,
                {}, 103 + shiftBottom, 45, 'BOTTOM', 447, 65, true
            );

            // L16 — Texto Botão "Faça seu cadastro" (Text Layer Editável)
            addMCMVLayer('L16_botao_cadastro_texto', 'text', botaoTexto,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '17px', color: bp, textAlign: 'center', lineHeight: '65px' },
                103 + shiftBottom, 90, 'BOTTOM', 357, 65, true
            );

            // L17 — Rodapé Institucional
            addMCMVLayer('L17_rodape_institucional', 'text', rodapeInst,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: '12px', color: tl, opacity: 0.75, textAlign: 'left' },
                29 + shiftBottom, 45, 'BOTTOM', 939, 24, true
            );
        } else if (selectedTemplateId === 'apartamento-equipado') {
            // ══════════════════════════════════════════════════════════════════════
            // APARTAMENTO EQUIPADO & PLANEJADO (Tuiuti - SP) — Engenharia Reversa
            // ══════════════════════════════════════════════════════════════════════
            const badgeImovel = custom_fields.badge_imovel || 'IMÓVEL À VENDA';
            const titulo      = custom_fields.titulo || 'Apartamento';
            const subtitulo   = custom_fields.subtitulo || 'EQUIPADO & PLANEJADO';
            const descricao   = custom_fields.descricao || 'Cozinha · Sala · 2 Quartos reformados';
            const pill1       = custom_fields.pill_1 || '2 Quartos';
            const pill2       = custom_fields.pill_2 || 'Area Serviço';
            const pill3       = custom_fields.pill_3 || 'Tuiuti - SP';
            const pill4       = custom_fields.pill_4 || 'Reformado';
            const valorRotulo = custom_fields.valor_rotulo || 'VALOR';
            const valorPreco  = custom_fields.valor_preco || 'R$ 225.000';
            const telefone    = custom_fields.telefone || '(14) 99657-1979';

            let bp = '#0d0d0d'; // brand-primary (preto quase puro)
            let ba = '#d4af37'; // brand-accent (dourado)
            let tl = '#ffffff'; // brand-text-light (branco)

            const brandPrimary = localStorage.getItem('imob_brand_color_primary');
            const brandSecondary = localStorage.getItem('imob_brand_color_secondary');
            if (brandPrimary) bp = brandPrimary;
            if (brandSecondary) ba = brandSecondary;

            const format = selectedFormat === 'story' ? '9:16' : '1:1';
            const F_width = 1080;
            const F_height = format === '9:16' ? 1920 : 1080;
            const F_safeTop = format === '9:16' ? 250 : 60;
            const F_safeBottom = format === '9:16' ? 260 : 60;

            function resolvePositionLocal(cluster, edgeOffset, heightVal, ignoreSafe = false) {
                if (cluster === 'TOP') {
                    const off = ignoreSafe ? edgeOffset : Math.max(edgeOffset, F_safeTop);
                    return off;
                }
                const off = ignoreSafe ? edgeOffset : Math.max(edgeOffset, F_safeBottom);
                return F_height - off - heightVal;
            }

            function addMCMVLayer(name, type, content, style, edgeTop, left, cluster, width, height, ignoreSafe = false) {
                const top = resolvePositionLocal(cluster, edgeTop, height, ignoreSafe);
                let cssText = '';
                const styleObj = {
                    ...style,
                    position: 'absolute',
                    width: `${width}px`,
                    height: `${height}px`,
                };
                for (const [k, v] of Object.entries(styleObj)) {
                    const kebabKey = k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
                    cssText += `${kebabKey}:${v}; `;
                }
                addLayer(name, type, content, cssText, `${top}px`, `${left}px`, 'NONE', `${width}px`, `${height}px`);
            }

            // ════════ CLUSTER SUPERIOR (TOP) ════════

            // L01 — Moldura Dourada
            addMCMVLayer('L01_moldura_dourada', 'html',
                `<div style="width:100%;height:100%;border:2px solid ${ba};box-sizing:border-box;"></div>`,
                { padding: '22px', boxSizing: 'border-box' },
                0, 0, 'TOP', F_width, F_height, true
            );

            // L02 — Badge "IMÓVEL À VENDA"
            addMCMVLayer('L02_badge_imovel', 'html',
                `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;
                   background:${tl};border-radius:8px;
                   font-family:Montserrat,sans-serif;font-weight:700;font-size:28px;
                   letter-spacing:1.5px;color:${bp};">${badgeImovel}</div>`,
                {},
                45, 45, 'TOP', 340, 70, false
            );

            // ════════ CLUSTER INFERIOR (BOTTOM) ════════

            // L03 — Gradiente Painel Inferior
            addMCMVLayer('L03_gradiente_painel', 'html',
                `<div style="width:100%;height:100%;
                   background:linear-gradient(180deg, rgba(13,13,13,0) 0%, ${bp} 32%, ${bp} 100%);"></div>`,
                {},
                0, 0, 'BOTTOM', 1080, 950, true
            );

            // L04 — Título "Apartamento"
            addMCMVLayer('L04_titulo', 'text', titulo,
                { fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: '88px',
                  color: tl, textAlign: 'center', lineHeight: 1.1 },
                715, 50, 'BOTTOM', 980, 110, false
            );

            // L05 — Subtítulo "EQUIPADO & PLANEJADO"
            addMCMVLayer('L05_subtitulo', 'text', subtitulo,
                { fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: '46px',
                  color: ba, textAlign: 'center', letterSpacing: '4px', lineHeight: 1.2 },
                630, 50, 'BOTTOM', 980, 70, false
            );

            // L06 — Descrição
            addMCMVLayer('L06_descricao', 'text', descricao,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: '28px',
                  color: tl, textAlign: 'center', letterSpacing: '0.5px' },
                558, 50, 'BOTTOM', 980, 42, false
            );

            // L07–L10 — Pills de características
            const pills = [
                { txt: pill1, left: 55,  width: 205 },
                { txt: pill2, left: 282, width: 255 },
                { txt: pill3, left: 559, width: 215 },
                { txt: pill4, left: 796, width: 225 },
            ];
            pills.forEach((p, i) => {
                addMCMVLayer(`L${String(7 + i).padStart(2, '0')}_pill_${i + 1}`, 'html',
                    `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;
                       background:${bp};border:1.5px solid ${ba};border-radius:26px;
                       font-family:Montserrat,sans-serif;font-weight:600;font-size:24px;
                       color:${ba};">${p.txt}</div>`,
                    {},
                    485, p.left, 'BOTTOM', p.width, 52, false
                );
            });

            // L11 — Label "VALOR"
            addMCMVLayer('L11_label_valor', 'html',
                `<div style="display:flex;align-items:center;justify-content:center;gap:18px;width:100%;height:100%;">
                   <span style="display:inline-block;width:26px;height:2px;background:${ba};"></span>
                   <span style="font-family:Montserrat,sans-serif;font-weight:700;font-size:24px;
                     letter-spacing:6px;color:${tl};">${valorRotulo}</span>
                   <span style="display:inline-block;width:26px;height:2px;background:${ba};"></span>
                 </div>`,
                {},
                400, 50, 'BOTTOM', 980, 36, false
            );

            // L12 — Preço "R$ 225.000"
            addMCMVLayer('L12_preco', 'text', valorPreco,
                { fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: '92px',
                  color: tl, textAlign: 'center', letterSpacing: '2px' },
                282, 50, 'BOTTOM', 980, 105, false
            );

            // L13 — Pill Telefone
            addMCMVLayer('L13_pill_telefone', 'html',
                `<div style="display:flex;align-items:center;justify-content:center;gap:14px;width:100%;height:100%;
                   background:${bp};border:1.5px solid ${ba};border-radius:34px;
                   font-family:Montserrat,sans-serif;font-weight:600;font-size:30px;color:${ba};">
                   <i class="fa-solid fa-phone" style="font-size:26px;"></i>${telefone}</div>`,
                {},
                160, 300, 'BOTTOM', 480, 68, false
            );
        } else if (selectedTemplateId === 'nova-iraja-residencial') {
            // ══════════════════════════════════════════════════════════════════════
            // NOVA IRAJÁ RESIDENCIAL (Vivaz / Seller) — MCMV (Engenharia Reversa High-Fidelity)
            // ══════════════════════════════════════════════════════════════════════
            const taglineBarra    = custom_fields.tagline_barra    || 'NA MEDIDA CERTA PARA SEUS SONHOS.';
            const apartamentosTxt = custom_fields.apartamentos_txt || 'apartamentos';
            const dormsDestaque   = custom_fields.dorms_destaque   || '2 quartos';
            const varandaGarden   = custom_fields.varanda_garden   || 'com varanda\nou garden.';
            const labelEntrada    = custom_fields.label_entrada    || 'Entrada';
            const labelApartir    = custom_fields.label_apartir    || 'a partir de:';
            const valorEntrada    = custom_fields.valor_entrada    || '800,00';

            // ── CONFIGURAÇÃO DE CORES & BRAND TOKENS ──
            let bp  = '#13284A'; // brand-primary    — navy escuro
            let ba  = '#C3D82C'; // brand-accent     — verde-limão
            let tl  = '#FFFFFF'; // brand-text-light — branco
            let sec = '#8FD6B0'; // secundária       — verde-menta
            let ter = '#33422A'; // terciária        — verde-oliva escuro

            const brandPrimary = localStorage.getItem('imob_brand_color_primary');
            const brandSecondary = localStorage.getItem('imob_brand_color_secondary');
            if (brandPrimary) bp = brandPrimary;
            if (brandSecondary) ba = brandSecondary;

            // ── TOKENS DE GRADIENTE (DEGRADÊS) ──
            const gTop   = 'linear-gradient(180deg, #16294D 0%, #0E1B33 100%)';
            const gPrice = 'linear-gradient(160deg, #1B3660 0%, #0D1B33 100%)';
            const gLeaf  = 'linear-gradient(135deg, #A9E6C4 0%, #4C9B6C 100%)';

            const format = selectedFormat === 'story' ? '9:16' : '1:1';
            const F_height = format === '9:16' ? 1920 : 1080;
            const F_safeTop = format === '9:16' ? 250 : 60;
            const F_safeBottom = format === '9:16' ? 260 : 60;

            function resolvePositionLocal(cluster, edgeOffset, heightVal, ignoreSafe = false) {
                if (cluster === 'TOP') {
                    const off = ignoreSafe ? edgeOffset : Math.max(edgeOffset, F_safeTop);
                    return off;
                }
                const off = ignoreSafe ? edgeOffset : Math.max(edgeOffset, F_safeBottom);
                return F_height - off - heightVal;
            }

            function addMCMVLayer(name, type, content, style, edgeTop, left, cluster, width, height, ignoreSafe = false) {
                const top = resolvePositionLocal(cluster, edgeTop, height, ignoreSafe);
                let cssText = '';
                const styleObj = {
                    ...style,
                    position: 'absolute',
                    width: `${width}px`,
                    height: `${height}px`,
                };
                for (const [k, v] of Object.entries(styleObj)) {
                    const kebabKey = k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
                    cssText += `${kebabKey}:${v}; `;
                }
                addLayer(name, type, content, cssText, `${top}px`, `${left}px`, 'NONE', `${width}px`, `${height}px`);
            }

            // ════════ CLUSTER SUPERIOR (TOP) ════════

            // L01 — Decoração de folhas (canto sup. esquerdo) — GRADIENTE (gLeaf) — bleed
            addMCMVLayer('L01_DecoracaoFolhas', 'html',
                '<i class="fa-solid fa-leaf" style="font-size:60px; transform:rotate(-15deg);"></i>',
                { background: gLeaf, color: tl, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '0 0 48px 0' },
                0, 0, 'TOP', 210, 170, true);

            // L02 — Painel superior navy (fundo, cantos inferiores arredondados) — GRADIENTE (gTop) — bleed
            addMCMVLayer('L02_PainelSuperiorBG', 'html', '',
                { background: gTop, borderRadius: '0 0 64px 64px', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' },
                0, 0, 'TOP', 1080, 240, true);

            // L03 — Logo "NOVA IRAJÁ"
            addMCMVLayer('L03_LogoMarca', 'text', 'NOVA\nIRAJÁ',
                { fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: '46px', color: tl, lineHeight: 1.0, letterSpacing: '1px', textAlign: 'left' },
                55, 48, 'TOP', 220, 110, false);

            // L04 — Subtítulo "RESIDENCIAL" (do logo)
            addMCMVLayer('L04_LogoSubtitulo', 'text', 'RESIDENCIAL',
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: '13px', color: tl, letterSpacing: '3px', textAlign: 'left' },
                160, 52, 'TOP', 200, 20, false);

            // L05 — Tagline cursiva "apartamentos"
            addMCMVLayer('L05_TaglineCursiva', 'text', apartamentosTxt,
                { fontFamily: "'Kaushan Script', cursive", fontWeight: 400, fontSize: '48px', color: sec, textAlign: 'left' },
                68, 330, 'TOP', 380, 70, false);

            // L06 — Complemento da tagline (peso misto: regular + bold)
            const taglineFormatted = taglineBarra.includes('PARA SEUS SONHOS.')
                ? taglineBarra.replace('PARA SEUS SONHOS.', '<b style="color:#FFFFFF;">PARA SEUS SONHOS.</b>')
                : taglineBarra;
            addMCMVLayer('L06_TaglineComplemento', 'html', taglineFormatted,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: '21px', color: tl, lineHeight: 1.3, textAlign: 'left' },
                145, 330, 'TOP', 400, 70, false);

            // L07 — Selo "Minha Casa Minha Vida" — círculo branco (BG)
            addMCMVLayer('L07_SeloCirculoBG', 'html', '',
                { background: tl, borderRadius: '50%', boxShadow: '0 6px 18px rgba(0,0,0,0.30)' },
                205, 755, 'TOP', 230, 230, false);

            // L08 — Selo ícone
            addMCMVLayer('L08_SeloIcone', 'html',
                '<i class="fa-solid fa-house-chimney-window" style="font-size:46px; color:#2E6E9E;"></i>',
                { display: 'flex', alignItems: 'center', justifyContent: 'center' },
                235, 825, 'TOP', 90, 70, false);

            // L09 — Selo texto "Minha Casa Minha Vida"
            addMCMVLayer('L09_SeloTexto', 'text', 'Minha Casa\nMinha Vida',
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '18px', color: '#111111', lineHeight: 1.15, textAlign: 'center' },
                320, 790, 'TOP', 180, 60, false);

            // L10 — Chamada cursiva "2 quartos"
            addMCMVLayer('L10_Chamada2Quartos', 'text', dormsDestaque,
                { fontFamily: "'Kaushan Script', cursive", fontWeight: 400, fontSize: '52px', color: tl, textShadow: '0 2px 8px rgba(0,0,0,0.40)', textAlign: 'left' },
                430, 50, 'TOP', 280, 70, false);

            // L11 — Complemento "com varanda ou garden."
            addMCMVLayer('L11_ChamadaComplemento', 'text', varandaGarden,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: '24px', color: tl, textShadow: '0 2px 6px rgba(0,0,0,0.35)', lineHeight: 1.3, textAlign: 'left' },
                505, 52, 'TOP', 260, 70, false);

            // ════════ CLUSTER INFERIOR (BOTTOM) ════════

            // L12 — Painel de preço, formato "blob" arredondado — GRADIENTE (gPrice)
            addMCMVLayer('L12_PainelPrecoBG', 'html', '',
                { background: gPrice, borderRadius: '0 130px 130px 0', boxShadow: '0 10px 30px rgba(0,0,0,0.35)' },
                190, 0, 'BOTTOM', 560, 430, false);

            // L13 — Label "Entrada"
            addMCMVLayer('L13_LabelEntrada', 'text', labelEntrada,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '28px', color: tl, textAlign: 'left' },
                555, 48, 'BOTTOM', 200, 42, false);

            // L14 — Label "a partir de:"
            addMCMVLayer('L14_LabelAPartirDe', 'text', labelApartir,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: '18px', color: tl, textAlign: 'left' },
                505, 48, 'BOTTOM', 220, 28, false);

            // L15 — Prefixo "R$"
            addMCMVLayer('L15_PrecoPrefixo', 'text', 'R$',
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '26px', color: ba, textAlign: 'left' },
                430, 48, 'BOTTOM', 50, 38, false);

            // L16 — Valor Entrada
            const partesValor = valorEntrada.split(',');
            const inteiroVal = partesValor[0] || '800';
            const decimalVal = partesValor[1] !== undefined ? `,${partesValor[1]}` : ',00';

            addMCMVLayer('L16_PrecoValor', 'text', inteiroVal,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '86px', color: ba, lineHeight: 1, textAlign: 'left' },
                330, 100, 'BOTTOM', 230, 100, false);

            // L17 — Sufixo ",00"
            addMCMVLayer('L17_PrecoSufixo', 'text', decimalVal,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '32px', color: ba, textAlign: 'left' },
                395, 340, 'BOTTOM', 90, 45, false);

            // L18 — Barra de rodapé (fundo claro, full-width) — bleed
            addMCMVLayer('L18_RodapeBarraBG', 'html', '',
                { background: '#F4F3EF' },
                58, 0, 'BOTTOM', 1080, 140, true);

            // L19 — Ícone "vivaz" — bleed
            addMCMVLayer('L19_VivazIcone', 'html',
                `<i class="fa-solid fa-gem" style="font-size:30px; color:${ba};"></i>`,
                { display: 'flex', alignItems: 'center', justifyContent: 'center' },
                95, 95, 'BOTTOM', 50, 50, true);

            // L20 — Texto "vivaz" + subtítulo "RESIDENCIAL" — bleed
            addMCMVLayer('L20_VivazTexto', 'html',
                `vivaz<br><span style="font-size:9px;letter-spacing:2px;font-weight:500;">RESIDENCIAL</span>`,
                { fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: '24px', color: bp, lineHeight: 1.2, textAlign: 'left' },
                98, 155, 'BOTTOM', 180, 45, true);

            // L21 — Linha divisória vertical — bleed
            addMCMVLayer('L21_LinhaDivisoria', 'html', '',
                { background: '#C9C9C9' },
                100, 430, 'BOTTOM', 2, 40, true);

            // L22 — Parceiro "SELLER" — bleed
            addMCMVLayer('L22_ParceiroSeller', 'text', 'SELLER',
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '20px', color: '#6B6B6B', letterSpacing: '1px', textAlign: 'left' },
                98, 460, 'BOTTOM', 140, 40, true);

            // L23 — Faixa decorativa inferior (padrão estampado) — bleed
            addMCMVLayer('L23_FaixaDecorativa', 'html', '',
                { background: ter, opacity: 0.92 },
                0, 0, 'BOTTOM', 1080, 58, true);
        } else if (selectedTemplateId === 'mitz-de-luca') {
            // ══════════════════════════════════════════════════════════════════════
            // MITZ DE LUCA (Manasa Construtora) — MCMV (Engenharia Reversa)
            // ══════════════════════════════════════════════════════════════════════
            const titulo          = custom_fields.titulo          || 'MITZ';
            const subtitulo       = custom_fields.subtitulo       || 'DE LUCA';
            const tagline1        = custom_fields.tagline_1        || 'Seu novo apê';
            const tagline2        = custom_fields.tagline_2        || 'no Jabaquara';
            const dormitoriosTxt  = custom_fields.dormitorios_txt  || '2 DORMITÓRIOS';
            const labelApartir    = custom_fields.label_apartir    || 'A PARTIR DE';
            const precoValor      = custom_fields.preco_valor      || '245';
            const labelFluxo      = custom_fields.label_fluxo      || 'FLUXO DE PAGAMENTO';

            const pgto1Val        = custom_fields.pgto1_val        || '10 MIL';
            const pgto1Nota       = custom_fields.pgto1_nota       || 'Podendo ser\nseu FGTS';
            const pgto2Val        = custom_fields.pgto2_val        || '4 MIL';
            const pgto2Nota       = custom_fields.pgto2_nota       || '1ª em 2026\n2ª em 2027';
            const pgto3Val        = custom_fields.pgto3_val        || '790';
            const pgto3Nota       = custom_fields.pgto3_nota       || 'Durante\na obra';
            const pgto4Val        = custom_fields.pgto4_val        || '5.300';
            const pgto4Nota       = custom_fields.pgto4_nota       || 'Podendo ser\ncomposta por até\n3 pessoas';

            const plantaoLabel    = custom_fields.plantao_label    || 'PLANTÃO DE VENDAS';
            const endereco1       = custom_fields.endereco1       || 'Av. Ver. João de Luca, 1963';
            const endereco2       = custom_fields.endereco2       || 'Jabaquara - São Paulo/SP';
            const logoMarca       = custom_fields.logo_marca       || 'MANASA';

            // ── CONFIGURAÇÃO DE CORES & BRAND TOKENS ──
            let bp = '#12122A'; // brand-primary — azul-marinho quase preto
            let ba = '#F0125E'; // brand-accent  — rosa/magenta
            let tl = '#FFFFFF'; // brand-text-light — branco

            const brandPrimary = localStorage.getItem('imob_brand_color_primary');
            const brandSecondary = localStorage.getItem('imob_brand_color_secondary');
            if (brandPrimary) bp = brandPrimary;
            if (brandSecondary) ba = brandSecondary;

            const format = selectedFormat === 'story' ? '9:16' : '1:1';
            const F_height = format === '9:16' ? 1920 : 1080;
            const F_safeTop = format === '9:16' ? 250 : 60;
            const F_safeBottom = format === '9:16' ? 260 : 60;

            function resolvePositionLocal(cluster, edgeOffset, heightVal, ignoreSafe = false) {
                if (cluster === 'TOP') {
                    const off = ignoreSafe ? edgeOffset : Math.max(edgeOffset, F_safeTop);
                    return off;
                }
                const off = ignoreSafe ? edgeOffset : Math.max(edgeOffset, F_safeBottom);
                return F_height - off - heightVal;
            }

            function addMCMVLayer(name, type, content, style, edgeTop, left, cluster, width, height, ignoreSafe = false) {
                const top = resolvePositionLocal(cluster, edgeTop, height, ignoreSafe);
                let cssText = '';
                const styleObj = {
                    ...style,
                    position: 'absolute',
                    width: `${width}px`,
                    height: `${height}px`,
                };
                for (const [k, v] of Object.entries(styleObj)) {
                    const kebabKey = k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
                    cssText += `${kebabKey}:${v}; `;
                }
                addLayer(name, type, content, cssText, `${top}px`, `${left}px`, 'NONE', `${width}px`, `${height}px`);
            }

            const shadow = '0px 2px 6px rgba(0,0,0,0.35)';

            // ════════ CLUSTER SUPERIOR (TOP) ════════

            // L01 — Título do empreendimento
            addMCMVLayer('L01 Título Mitz', 'text', titulo,
                { fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: '86px', color: tl, letterSpacing: 0, lineHeight: 1, textShadow: shadow },
                55, 45, 'TOP', 320, 90, false);

            // L02 — Subtítulo da construtora ("DE LUCA")
            addMCMVLayer('L02 Subtítulo De Luca', 'text', subtitulo,
                { fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '26px', color: tl, letterSpacing: '3px', lineHeight: 1, textShadow: shadow },
                148, 48, 'TOP', 160, 30, false);

            // L03 — Marca gráfica ao lado de "DE LUCA"
            addMCMVLayer('L03 Marca Ícone', 'html', '<i class="fa-solid fa-chevron-up"></i>',
                { fontSize: '18px', color: tl },
                150, 195, 'TOP', 24, 24, false);

            // L04 — Selo "Minha Casa Minha Vida"
            addMCMVLayer('L04 Selo MCMV', 'html',
                '<div style="text-align:center;line-height:1.15"><i class="fa-solid fa-people-roof" style="font-size:26px;display:block;margin-bottom:4px;"></i><span style="font-size:11px;font-weight:700;">Minha Casa</span><br/><span style="font-size:11px;font-weight:700;">Minha Vida</span></div>',
                { width: '140px', height: '140px', borderRadius: '50%', background: '#FFFFFF', color: '#0B2A6B', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.25)' },
                50, 875, 'TOP', 140, 140, false);

            // L05 — Tagline linha 1
            addMCMVLayer('L05 Tagline Linha 1', 'text', tagline1,
                { fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: '46px', color: tl, lineHeight: 1.1, textShadow: shadow },
                255, 45, 'TOP', 600, 55, false);

            // L06 — Tagline linha 2 (cor de destaque)
            addMCMVLayer('L06 Tagline Linha 2', 'text', tagline2,
                { fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: '46px', color: ba, lineHeight: 1.1, textShadow: shadow },
                315, 45, 'TOP', 600, 55, false);

            // L07 — Ícone cama
            addMCMVLayer('L07 Ícone Cama', 'html', '<i class="fa-solid fa-bed"></i>',
                { fontSize: '32px', color: ba },
                399, 45, 'TOP', 34, 34, false);

            // L08 — "2 DORMITÓRIOS"
            addMCMVLayer('L08 Texto Dormitórios', 'text', dormitoriosTxt,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '23px', color: tl, letterSpacing: '0.5px', lineHeight: 1.1, textShadow: shadow },
                395, 95, 'TOP', 280, 30, false);

            // L09 — "A PARTIR DE"
            addMCMVLayer('L09 Texto A Partir De', 'text', labelApartir,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: '15px', color: tl, opacity: 0.85, letterSpacing: '1px', lineHeight: 1.1, textShadow: shadow },
                430, 95, 'TOP', 220, 22, false);

            // L10 — Preço, prefixo "R$"
            addMCMVLayer('L10 Preço Prefixo', 'text', 'R$',
                { fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: '30px', color: ba, lineHeight: 1, textShadow: shadow },
                478, 45, 'TOP', 42, 34, false);

            // L11 — Preço, valor
            addMCMVLayer('L11 Preço Valor', 'text', precoValor,
                { fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: '74px', color: ba, lineHeight: 1, textShadow: shadow },
                470, 88, 'TOP', 190, 80, false);

            // L12 — Preço, sufixo "MIL"
            addMCMVLayer('L12 Preço Sufixo', 'text', "MIL'",
                { fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: '34px', color: ba, lineHeight: 1, textShadow: shadow },
                495, 290, 'TOP', 100, 40, false);

            // L13 — Linha divisória decorativa
            addMCMVLayer('L13 Linha Divisória', 'html', '',
                { background: tl, opacity: 0.3 },
                590, 45, 'TOP', 990, 1, false);

            // L14 — Label "FLUXO DE PAGAMENTO"
            addMCMVLayer('L14 Label Fluxo Pagamento', 'text', labelFluxo,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '15px', color: tl, opacity: 0.85, letterSpacing: '1.5px', lineHeight: 1, textShadow: shadow },
                605, 45, 'TOP', 320, 20, false);

            // L15+ — Linhas do fluxo de pagamento
            const paymentRows = [
                { icon: 'fa-sack-dollar',    label: 'ATO DE',                     value: `R$ ${pgto1Val}`, note: pgto1Nota, top: 635, height: 75 },
                { icon: 'fa-calendar-days',  label: '2 ANUAIS DE',                value: `R$ ${pgto2Val}`, note: pgto2Nota, top: 720, height: 75 },
                { icon: 'fa-calendar-check', label: 'MENSAIS DE',                 value: `R$ ${pgto3Val}`, note: pgto3Nota, top: 805, height: 75 },
                { icon: 'fa-people-group',   label: 'FLUXO FEITO PARA\nRENDA DE', value: `R$ ${pgto4Val}`, note: pgto4Nota, top: 890, height: 100 },
            ];

            paymentRows.forEach((row, i) => {
                const n = String(i + 1).padStart(2, '0');
                const isDoubleLine = row.label.includes('\n');

                addMCMVLayer(`L_pgto${n}_icone`, 'html', `<i class="fa-solid ${row.icon}"></i>`,
                    { fontSize: '26px', color: ba },
                    row.top + 4, 45, 'TOP', 34, 34, false);

                addMCMVLayer(`L_pgto${n}_label`, 'text', row.label,
                    { fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '15px', color: tl, lineHeight: 1.25, textShadow: shadow },
                    row.top, 95, 'TOP', 230, isDoubleLine ? 50 : 20, false);

                addMCMVLayer(`L_pgto${n}_valor`, 'text', row.value,
                    { fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: '27px', color: ba, lineHeight: 1.1, textShadow: shadow },
                    row.top + (isDoubleLine ? 54 : 34), 95, 'TOP', 230, 34, false);

                addMCMVLayer(`L_pgto${n}_nota`, 'text', row.note,
                    { fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: '13px', color: tl, opacity: 0.75, lineHeight: 1.4, textShadow: shadow },
                    row.top + 6, 640, 'TOP', 380, row.height - 10, false);

                if (i < paymentRows.length - 1) {
                    addMCMVLayer(`L_pgto${n}_divisor`, 'html', '',
                        { background: tl, opacity: 0.15 },
                        row.top + row.height, 45, 'TOP', 990, 1, false);
                }
            });

            // ════════ CLUSTER INFERIOR (BOTTOM) ════════

            // L_rodape_barra — Barra de rodapé
            addMCMVLayer('L Rodapé Barra', 'html', '',
                { background: bp },
                0, 0, 'BOTTOM', 1080, 125, true);

            // L_rodape_manasa — Logotipo da marca
            addMCMVLayer('L Rodapé Marca', 'text', logoMarca,
                { fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: '30px', color: tl, letterSpacing: '1px', lineHeight: 1 },
                48, 45, 'BOTTOM', 240, 38, true);

            // L_rodape_construtora — Subtítulo
            addMCMVLayer('L Rodapé Construtora', 'text', 'CONSTRUTORA',
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: '12px', color: tl, opacity: 0.85, letterSpacing: '3px', lineHeight: 1 },
                28, 48, 'BOTTOM', 240, 14, true);

            // L_local_icone_pin — Ícone de localização
            addMCMVLayer('L Local Ícone Pin', 'html', '<i class="fa-solid fa-location-dot"></i>',
                { fontSize: '20px', color: ba },
                198, 45, 'BOTTOM', 24, 24, false);

            // L_local_label_plantao — Label Plantão
            addMCMVLayer('L Local Label Plantão', 'text', plantaoLabel,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '15px', color: ba, letterSpacing: '0.5px', lineHeight: 1, textShadow: shadow },
                200, 82, 'BOTTOM', 300, 20, false);

            // L_local_endereco1 — Endereço linha 1
            addMCMVLayer('L Local Endereço 1', 'text', endereco1,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: '15px', color: tl, lineHeight: 1.3, textShadow: shadow },
                176, 82, 'BOTTOM', 420, 20, false);

            // L_local_endereco2 — Endereço linha 2
            addMCMVLayer('L Local Endereço 2', 'text', endereco2,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: '15px', color: tl, lineHeight: 1.3, textShadow: shadow },
                152, 82, 'BOTTOM', 420, 20, false);
        } else if (selectedTemplateId === 'jacana-zn-imovel') {
            // ══════════════════════════════════════════════════════════════════════
            // JAÇANÃ (ZN Imóvel) — MCMV (Engenharia Reversa)
            // ══════════════════════════════════════════════════════════════════════
            const labelBairro       = custom_fields.label_bairro       || 'Apartamentos à venda no bairro:';
            const tituloBairro      = custom_fields.titulo_bairro      || 'Jaçanã';
            const areaM2            = custom_fields.area_m2            || '24 a 38m²';
            const dormsNumeros      = custom_fields.dorms_numeros      || '1 e 2';
            const dormsLabel        = custom_fields.dorms_label        || 'quartos';
            const pillTerraco       = custom_fields.pill_terraco       || 'Com Terraço';
            const localizacaoTexto  = custom_fields.localizacao_texto  || '10 minutos do\nMetrô Tucuruvi';

            // ── CONFIGURAÇÃO DE CORES & BRAND TOKENS ──
            let bp  = '#0D0D0D'; // brand-primary: preto dominado
            let ba  = '#EA3E65'; // brand-accent: coral/rosa
            let tl  = '#FFFFFF'; // brand-text-light: branco
            let sec = '#CCA34F'; // secondary: dourado

            const brandPrimary = localStorage.getItem('imob_brand_color_primary');
            const brandSecondary = localStorage.getItem('imob_brand_color_secondary');
            if (brandPrimary) bp = brandPrimary;
            if (brandSecondary) ba = brandSecondary;

            const format = selectedFormat === 'story' ? '9:16' : '1:1';
            const F_height = format === '9:16' ? 1920 : 1080;
            const F_safeTop = format === '9:16' ? 250 : 60;
            const F_safeBottom = format === '9:16' ? 260 : 60;

            function resolvePositionLocal(cluster, edgeOffset, heightVal, ignoreSafe = false) {
                if (cluster === 'TOP') {
                    const off = ignoreSafe ? edgeOffset : Math.max(edgeOffset, F_safeTop);
                    return off;
                }
                const off = ignoreSafe ? edgeOffset : Math.max(edgeOffset, F_safeBottom);
                return F_height - off - heightVal;
            }

            function addMCMVLayer(name, type, content, style, edgeTop, left, cluster, width, height, ignoreSafe = false) {
                const top = resolvePositionLocal(cluster, edgeTop, height, ignoreSafe);
                let cssText = '';
                const styleObj = {
                    ...style,
                    position: 'absolute',
                    width: `${width}px`,
                    height: `${height}px`,
                };
                for (const [k, v] of Object.entries(styleObj)) {
                    const kebabKey = k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
                    cssText += `${kebabKey}:${v}; `;
                }
                addLayer(name, type, content, cssText, `${top}px`, `${left}px`, 'NONE', `${width}px`, `${height}px`);
            }

            const fontDisplay = "'Baloo 2', sans-serif";

            // ════════ CLUSTER SUPERIOR (TOP) ════════

            // L01 — Logo "ZN imóvel"
            addMCMVLayer('L01_logo_zn_imovel', 'html',
                `<div style="width:100%;height:100%;background:#FFFFFF;border-radius:50px;box-shadow:0 4px 10px rgba(0,0,0,0.25);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Poppins',sans-serif;">
                   <div style="line-height:1;">
                     <span style="color:#1C2569;font-weight:800;font-size:40px;">Z</span><span style="color:#2B8FBF;font-weight:800;font-size:40px;">N</span><span style="color:#000000;font-weight:500;font-size:36px;">imóvel</span>
                   </div>
                   <div style="font-size:10px;color:#1C2569;letter-spacing:1px;margin-top:2px;">www.znimovel.com.br</div>
                 </div>`,
                {}, 237, 15, 'TOP', 247, 107, false);

            // L02 — Label "Apartamentos à venda no bairro:"
            addMCMVLayer('L02_label_bairro', 'text', labelBairro,
                { fontFamily: fontDisplay, fontWeight: 600, fontSize: '27px', color: bp, textAlign: 'center', letterSpacing: '0px', lineHeight: 1.1 },
                277, 609, 'TOP', 440, 32, false);

            // L03 — Título "Jaçanã"
            addMCMVLayer('L03_titulo_bairro', 'text', tituloBairro,
                { fontFamily: fontDisplay, fontWeight: 800, fontSize: '88px', color: bp, textAlign: 'center', letterSpacing: '-1px', lineHeight: 0.95 },
                309, 663, 'TOP', 326, 91, false);

            // L04 — Ícone de área + "24 a 38m²"
            addMCMVLayer('L04_area_m2', 'html',
                `<div style="display:flex;align-items:center;justify-content:flex-start;width:100%;height:100%;">
                   <i class="fa-solid fa-up-right-and-down-left-from-center" style="font-size:34px;color:${bp};margin-right:10px;"></i>
                   <span style="font-family:${fontDisplay};font-weight:700;font-size:32px;color:${bp};">${areaM2}</span>
                 </div>`,
                {}, 407, 693, 'TOP', 279, 56, false);

            // L05 — "1 e 2"
            const numPartes = dormsNumeros.split(' ');
            const num1 = numPartes[0] || '1';
            const conector = numPartes[1] || 'e';
            const num2 = numPartes[2] || '2';

            addMCMVLayer('L05_numeros_1_e_2', 'html',
                `<div style="display:flex;align-items:baseline;justify-content:center;width:100%;height:100%;font-family:${fontDisplay};font-weight:800;background:linear-gradient(135deg,#F2545F,#FF6478);-webkit-background-clip:text;background-clip:text;color:transparent;">
                   <span style="font-size:140px;">${num1}</span>
                   <span style="font-size:54px;font-weight:700;margin:0 12px;">${conector}</span>
                   <span style="font-size:140px;">${num2}</span>
                 </div>`,
                {}, 521, 701, 'TOP', 275, 167, false);

            // L06 — "quartos"
            addMCMVLayer('L06_texto_quartos', 'text', dormsLabel,
                { fontFamily: fontDisplay, fontWeight: 800, fontSize: '68px', color: bp, textAlign: 'center', letterSpacing: '-1px', lineHeight: 1 },
                719, 687, 'TOP', 312, 70, false);

            // L07 — Pill "Com Terraço"
            addMCMVLayer('L07_pill_com_terraco', 'html',
                `<div style="width:100%;height:100%;background:linear-gradient(135deg,#F2545F,#FF6478);border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 8px rgba(234,62,101,0.35);">
                   <span style="font-family:${fontDisplay};font-weight:700;font-size:30px;color:${tl};">${pillTerraco}</span>
                 </div>`,
                {}, 810, 671, 'TOP', 342, 70, false);

            // L08 — Cartão vazio
            addMCMVLayer('L08_cartao_vazio_placeholder', 'html',
                `<div style="width:100%;height:100%;border-radius:16px;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.08);background:transparent;"></div>`,
                {}, 726, 608, 'TOP', 59, 139, false);

            // L09 — Pill preto "10 minutos do Metrô Tucuruvi"
            const locFormatted = localizacaoTexto.replace('\n', '<br>');
            addMCMVLayer('L09_badge_localizacao', 'html',
                `<div style="width:100%;height:100%;background:${bp};border:1px solid ${sec};border-radius:30px;display:flex;align-items:center;padding:0 22px;box-shadow:0 4px 10px rgba(0,0,0,0.3);box-sizing:border-box;">
                   <i class="fa-solid fa-location-dot" style="font-size:34px;color:${sec};margin-right:14px;flex-shrink:0;"></i>
                   <div style="font-family:${fontDisplay};color:${tl};line-height:1.15;">
                     ${locFormatted}
                   </div>
                 </div>`,
                {}, 929, 287, 'TOP', 397, 107, false);

            // L10 — Card "Minha Casa Minha Vida"
            addMCMVLayer('L10_selo_minha_casa_minha_vida', 'html',
                `<div style="width:100%;height:100%;background:#FFFFFF;border-radius:20px;box-shadow:0 4px 10px rgba(0,0,0,0.15);display:flex;align-items:center;padding:0 18px;box-sizing:border-box;">
                   <i class="fa-solid fa-house-chimney-user" style="font-size:56px;color:#2E86AB;margin-right:14px;flex-shrink:0;"></i>
                   <div style="font-family:${fontDisplay};font-weight:800;font-size:24px;color:${bp};line-height:1.2;">
                     <div>Minha Casa</div>
                     <div>Minha Vida</div>
                   </div>
                 </div>`,
                {}, 901, 693, 'TOP', 357, 143, false);
        } else if (selectedTemplateId === 'jr-prime-vila-re') {
            // ══════════════════════════════════════════════════════════════════════
            // JR PRIME VILA RÉ — MCMV (Engenharia Reversa)
            // ══════════════════════════════════════════════════════════════════════
            const titulo          = custom_fields.titulo          || 'JR PRIME';
            const subtitulo       = custom_fields.subtitulo       || 'VILA RÉ';
            const labelUnidades   = custom_fields.label_unidades   || 'Unidades de';
            const metragens       = custom_fields.metragens       || '29 m2\n45 m2';
            const dorms           = custom_fields.dorms           || '2 DORMS';
            const pillParcelas    = custom_fields.pill_parcelas    || 'PARCELAS';
            const labelPreco      = custom_fields.label_preco      || 'A partir de R$';
            const valorPreco      = custom_fields.valor_preco      || '799,00';

            // ── CONFIGURAÇÃO DE CORES & BRAND TOKENS ──
            let bp = '#1A1A1A'; // brand-primary — dark
            let ba = '#F5B41A'; // brand-accent  — dourado/amarelo
            let tl = '#FFFFFF'; // brand-text-light — branco

            const brandPrimary = localStorage.getItem('imob_brand_color_primary');
            const brandSecondary = localStorage.getItem('imob_brand_color_secondary');
            if (brandPrimary) bp = brandPrimary;
            if (brandSecondary) ba = brandSecondary;

            const format = selectedFormat === 'story' ? '9:16' : '1:1';
            const F_height = format === '9:16' ? 1920 : 1080;
            const F_safeTop = format === '9:16' ? 250 : 60;
            const F_safeBottom = format === '9:16' ? 260 : 60;

            function resolvePositionLocal(cluster, edgeOffset, heightVal, ignoreSafe = false) {
                if (cluster === 'TOP') {
                    const off = ignoreSafe ? edgeOffset : Math.max(edgeOffset, F_safeTop);
                    return off;
                }
                const off = ignoreSafe ? edgeOffset : Math.max(edgeOffset, F_safeBottom);
                return F_height - off - heightVal;
            }

            function addMCMVLayer(name, type, content, style, edgeTop, left, cluster, width, height, ignoreSafe = false) {
                const top = resolvePositionLocal(cluster, edgeTop, height, ignoreSafe);
                let cssText = '';
                const styleObj = {
                    ...style,
                    position: 'absolute',
                    width: `${width}px`,
                    height: `${height}px`,
                };
                for (const [k, v] of Object.entries(styleObj)) {
                    const kebabKey = k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
                    cssText += `${kebabKey}:${v}; `;
                }
                addLayer(name, type, content, cssText, `${top}px`, `${left}px`, 'NONE', `${width}px`, `${height}px`);
            }

            // ===== CLUSTER SUPERIOR (TOP) =====

            // L01 — Selo/certificação
            addMCMVLayer('L01 Selo', 'html',
                `<div style="width:100%;height:100%;border-radius:50%;background:${bp};display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-award" style="color:${tl};font-size:26px;"></i></div>`,
                {}, 30, 955, 'TOP', 68, 68, false);

            // L02 — Título "JR PRIME"
            addMCMVLayer('L02 Título', 'text', titulo,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '46px', color: tl, textAlign: 'right', letterSpacing: '1px', textTransform: 'uppercase', textShadow: '0 2px 6px rgba(0,0,0,0.35)' },
                115, 470, 'TOP', 565, 55, false);

            // L03 — Subtítulo "VILA RÉ"
            addMCMVLayer('L03 Subtítulo', 'text', subtitulo,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '32px', color: ba, textAlign: 'right', letterSpacing: '2px', textTransform: 'uppercase', textShadow: '0 2px 6px rgba(0,0,0,0.35)' },
                168, 470, 'TOP', 565, 40, false);

            // L04 — Label "Unidades de"
            addMCMVLayer('L04 Label Unidades', 'text', labelUnidades,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '22px', color: tl, textAlign: 'right', textShadow: '0 1px 4px rgba(0,0,0,0.3)' },
                222, 470, 'TOP', 565, 28, false);

            // L05 — Metragens "29 m2 / 45 m2"
            addMCMVLayer('L05 Metragens', 'text', metragens,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '34px', color: tl, textAlign: 'right', lineHeight: 1.15, textShadow: '0 2px 6px rgba(0,0,0,0.35)' },
                255, 470, 'TOP', 565, 80, false);

            // L06 — Dormitórios "2 DORMS"
            addMCMVLayer('L06 Dorms', 'text', dorms,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '24px', color: tl, textAlign: 'right', letterSpacing: '2px', textTransform: 'uppercase', textShadow: '0 2px 6px rgba(0,0,0,0.35)' },
                335, 470, 'TOP', 565, 30, false);

            // ===== CLUSTER INFERIOR (BOTTOM) =====

            // L07 — Painel diagonal amarelo — bleed
            addMCMVLayer('L07 Painel Diagonal', 'html',
                `<div style="width:100%;height:100%;background:${ba};clip-path:polygon(55% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 80%);"></div>`,
                {}, 0, 0, 'BOTTOM', 1080, 490, true);

            // L08 — Barra de rodapé — bleed
            addMCMVLayer('L08 Barra Rodapé', 'html',
                `<div style="width:100%;height:100%;background:#FAFAFA;"></div>`,
                {}, 0, 0, 'BOTTOM', 1080, 92, true);

            // L09 — Bloco branco do preço
            addMCMVLayer('L09 Box Preço', 'html',
                `<div style="width:100%;height:100%;background:#FFFFFF;border-radius:18px;box-shadow:0 8px 20px rgba(0,0,0,0.25);"></div>`,
                {}, 92, 500, 'BOTTOM', 535, 270, false);

            // L10 — Pill "PARCELAS"
            addMCMVLayer('L10 Pill Parcelas', 'html',
                `<div style="width:100%;height:100%;background:${bp};border-radius:20px;display:flex;align-items:center;justify-content:center;"><span style="color:${tl};font-family:'Montserrat',sans-serif;font-weight:700;font-size:15px;letter-spacing:1px;">${pillParcelas}</span></div>`,
                {}, 342, 500, 'BOTTOM', 170, 40, false);

            // L11 — Label "A partir de R$"
            addMCMVLayer('L11 Label Preço', 'text', labelPreco,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '20px', color: bp, textAlign: 'left' },
                279, 535, 'BOTTOM', 460, 28, false);

            // L12 — Valor "799,00"
            addMCMVLayer('L12 Valor Preço', 'text', valorPreco,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '62px', color: bp, textAlign: 'left', lineHeight: 1 },
                197, 535, 'BOTTOM', 460, 70, false);

            // L13 — Logo "Minha Casa Minha Vida" — bleed
            addMCMVLayer('L13 Logo MCMV', 'html',
                `<div style="width:100%;height:100%;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-house-chimney-window" style="color:#F4A31C;font-size:22px;"></i><span style="color:#1B3B6F;font-family:'Montserrat',sans-serif;font-weight:700;font-size:13px;line-height:1.1;">Minha Casa<br/>Minha Vida</span></div>`,
                {}, 29, 60, 'BOTTOM', 230, 34, true);

            // L14 — Logo "CAIXA" — bleed
            addMCMVLayer('L14 Logo Caixa', 'html',
                `<div style="width:100%;height:100%;display:flex;align-items:center;gap:8px;"><i class="fa-solid fa-university" style="color:#0033A0;font-size:20px;"></i><span style="color:#0033A0;font-family:'Montserrat',sans-serif;font-weight:800;font-size:24px;letter-spacing:1px;">CAIXA</span></div>`,
                {}, 29, 760, 'BOTTOM', 220, 34, true);
        } else if (selectedTemplateId === 'jurubatuba-evoque') {
            // ══════════════════════════════════════════════════════════════════════
            // JURUBATUBA (Corretor Evoque) — MCMV (Engenharia Reversa)
            // ══════════════════════════════════════════════════════════════════════
            const tituloChamada        = custom_fields.titulo_chamada        || 'MORE A POUCOS MINUTOS\nA PÉ DA ESTAÇÃO';
            const tituloEmpreendimento = custom_fields.titulo_empreendimento || 'JURUBATUBA';
            const entradaValor         = custom_fields.entrada_valor         || '500';
            const antecipeTexto        = custom_fields.antecipe_texto        || 'SE ANTECIPE\nAO\nLANÇAMENTO';
            const chameTexto           = custom_fields.chame_texto           || 'ME CHAME\nAGORA\nE GARANTA ESSA OPORTUNIDADE!';
            const dormsNumeros         = custom_fields.dorms_numeros         || '1 ou 2';
            const dormsLabel           = custom_fields.dorms_label           || 'quartos';
            const labelVagaCarro       = custom_fields.label_vaga_carro       || 'VAGA DE CARRO';
            const labelVagaMoto        = custom_fields.label_vaga_moto        || 'VAGA DE MOTO';
            const labelVaranda         = custom_fields.label_varanda         || 'VARANDA';
            const corretorNome         = custom_fields.corretor_nome         || 'EVOQUE';
            const telefoneWhatsapp     = custom_fields.telefone_whatsapp     || '11 97244-1917';
            const textoCtaFinal        = custom_fields.texto_cta_final        || 'ME CHAME AGORA E GARANTA ESSA OPORTUNIDADE!';

            // ── CONFIGURAÇÃO DE CORES & BRAND TOKENS ──
            let bp  = '#1E1642'; // brand-primary: fundo rodapé / dark
            let ba  = '#B01B72'; // brand-accent: rosa/magenta
            let tl  = '#FFFFFF'; // brand-text-light: branco
            let sec = '#0FA3A0'; // secondary: teal
            let ter = '#E3A536'; // terciária: dourado entrada
            let wa  = '#25D366'; // whatsapp: verde oficial

            const brandPrimary = localStorage.getItem('imob_brand_color_primary');
            const brandSecondary = localStorage.getItem('imob_brand_color_secondary');
            if (brandPrimary) bp = brandPrimary;
            if (brandSecondary) ba = brandSecondary;

            const format = selectedFormat === 'story' ? '9:16' : '1:1';
            const F_height = format === '9:16' ? 1920 : 1080;
            const F_safeTop = format === '9:16' ? 250 : 60;
            const F_safeBottom = format === '9:16' ? 260 : 60;

            function resolvePositionLocal(cluster, edgeOffset, heightVal, ignoreSafe = false) {
                if (cluster === 'TOP') {
                    const off = ignoreSafe ? edgeOffset : Math.max(edgeOffset, F_safeTop);
                    return off;
                }
                const off = ignoreSafe ? edgeOffset : Math.max(edgeOffset, F_safeBottom);
                return F_height - off - heightVal;
            }

            function addMCMVLayer(name, type, content, style, edgeTop, left, cluster, width, height, ignoreSafe = false) {
                const top = resolvePositionLocal(cluster, edgeTop, height, ignoreSafe);
                let cssText = '';
                const styleObj = {
                    ...style,
                    position: 'absolute',
                    width: `${width}px`,
                    height: `${height}px`,
                };
                for (const [k, v] of Object.entries(styleObj)) {
                    const kebabKey = k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
                    cssText += `${kebabKey}:${v}; `;
                }
                addLayer(name, type, content, cssText, `${top}px`, `${left}px`, 'NONE', `${width}px`, `${height}px`);
            }

            // ═══ CLUSTER SUPERIOR (TOP) ═══

            // L01 — Fundo topo teal — bleed
            addMCMVLayer('L01 Fundo Topo Teal', 'html',
                `<div style="width:100%;height:100%;background:${sec};"></div>`,
                {}, 0, 0, 'TOP', 1080, 290, true);

            // L02 — Chamada Topo
            addMCMVLayer('L02 Título Chamada', 'text', tituloChamada,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '40px', color: tl, lineHeight: 1.15, textAlign: 'left' },
                34, 50, 'TOP', 640, 100, false);

            // L03 — Título Empreendimento "JURUBATUBA"
            addMCMVLayer('L03 Título Empreendimento', 'text', tituloEmpreendimento,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: '108px', color: tl, lineHeight: 1, textAlign: 'left' },
                128, 44, 'TOP', 1000, 150, false);

            // L04 — Forma diagonal decorativa — bleed
            addMCMVLayer('L04 Forma Diagonal', 'html',
                `<div style="width:100%;height:100%;background:${ba};opacity:.94;clip-path:polygon(0 0, 70% 0, 25% 100%, 0 100%);"></div>`,
                {}, 240, 0, 'TOP', 560, 400, true);

            // L05 — Pill Entrada
            addMCMVLayer('L05 Pill Entrada', 'html',
                `<div style="width:300px;height:150px;background:${tl};border-radius:26px;box-shadow:0 6px 14px rgba(0,0,0,.18);display:flex;align-items:center;gap:14px;padding:0 18px;box-sizing:border-box;">
                   <div style="width:64px;height:64px;min-width:64px;border-radius:50%;background:${ter};display:flex;align-items:center;justify-content:center;">
                     <i class="fa-solid fa-hand-holding-dollar" style="color:${tl};font-size:28px;"></i>
                   </div>
                   <div style="font-family:'Montserrat',sans-serif;color:${bp};line-height:1.15;">
                     <div style="font-size:20px;font-weight:700;">ENTRADA</div>
                     <div style="font-size:16px;font-weight:400;">DE</div>
                     <div style="font-size:30px;font-weight:800;color:${ter};">R$${entradaValor}</div>
                   </div>
                 </div>`,
                {}, 330, 40, 'TOP', 300, 150, false);

            // L06 — Pill Antecipe
            const antePartes = antecipeTexto.split('\n');
            const ante1 = antePartes[0] || 'SE ANTECIPE';
            const ante2 = antePartes[1] || 'AO';
            const ante3 = antePartes[2] || 'LANÇAMENTO';

            addMCMVLayer('L06 Pill Antecipe', 'html',
                `<div style="width:300px;height:150px;background:${tl};border-radius:26px;box-shadow:0 6px 14px rgba(0,0,0,.18);display:flex;align-items:center;gap:14px;padding:0 18px;box-sizing:border-box;">
                   <div style="width:64px;height:64px;min-width:64px;border-radius:50%;background:${ba};display:flex;align-items:center;justify-content:center;">
                     <i class="fa-solid fa-calendar-days" style="color:${tl};font-size:28px;"></i>
                   </div>
                   <div style="font-family:'Montserrat',sans-serif;color:${bp};line-height:1.2;">
                     <div style="font-size:19px;font-weight:700;">${ante1}</div>
                     <div style="font-size:15px;font-weight:400;">${ante2}</div>
                     <div style="font-size:19px;font-weight:800;">${ante3}</div>
                   </div>
                 </div>`,
                {}, 330, 380, 'TOP', 300, 150, false);

            // L07 — Pill Me Chame
            const chamePartes = chameTexto.split('\n');
            const chame1 = chamePartes[0] || 'ME CHAME';
            const chame2 = chamePartes[1] || 'AGORA';
            const chame3 = chamePartes[2] || 'E GARANTA ESSA OPORTUNIDADE!';

            addMCMVLayer('L07 Pill Chame', 'html',
                `<div style="width:320px;height:150px;background:${tl};border-radius:26px;box-shadow:0 6px 14px rgba(0,0,0,.18);display:flex;align-items:center;gap:14px;padding:0 18px;box-sizing:border-box;">
                   <div style="width:64px;height:64px;min-width:64px;border-radius:50%;background:${wa};display:flex;align-items:center;justify-content:center;">
                     <i class="fa-brands fa-whatsapp" style="color:${tl};font-size:32px;"></i>
                   </div>
                   <div style="font-family:'Montserrat',sans-serif;color:${bp};line-height:1.2;">
                     <div style="font-size:19px;font-weight:700;">${chame1}</div>
                     <div style="font-size:22px;font-weight:800;">${chame2}</div>
                     <div style="font-size:13px;font-weight:400;">${chame3}</div>
                   </div>
                 </div>`,
                {}, 330, 720, 'TOP', 320, 150, false);

            // L08 — Bloco Quartos
            addMCMVLayer('L08 Bloco Quartos', 'html',
                `<div style="width:100%;height:100%;text-align:right;font-family:'Montserrat',sans-serif;color:${tl};">
                   <div style="font-size:72px;font-weight:800;line-height:1;">${dormsNumeros}</div>
                   <div style="font-size:60px;font-weight:800;line-height:1.05;">${dormsLabel}</div>
                   <div style="font-size:30px;font-weight:400;line-height:1.3;margin-top:10px;">
                     com opção de <span style="font-weight:800;color:${ba};">vaga</span><br>
                     e <span style="font-weight:800;color:${ba};">varanda</span>
                   </div>
                 </div>`,
                {}, 560, 470, 'TOP', 570, 270, false);

            // 📸 Fotos / Uploads de Imagens do Template
            const imgPredio    = (window._templateUploadedImages && window._templateUploadedImages['foto_predio']) || null;
            const imgVagaCarro = (window._templateUploadedImages && window._templateUploadedImages['foto_vaga_carro']) || '/imovel/Assets/real_estate_1.png';
            const imgVagaMoto  = (window._templateUploadedImages && window._templateUploadedImages['foto_vaga_moto'])  || '/imovel/Assets/real_estate_2.png';
            const imgVaranda   = (window._templateUploadedImages && window._templateUploadedImages['foto_varanda'])   || '/imovel/Assets/real_estate_3.png';

            if (imgPredio) {
                const approvalImg = document.getElementById('success-preview-img');
                if (approvalImg) approvalImg.src = imgPredio;
            }

            // 📸 L08b — Foto Vaga de Carro
            addMCMVLayer('Foto Vaga de Carro', 'html',
                `<div style="width:100%;height:100%;border-radius:14px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.3);"><img src="${imgVagaCarro}" style="width:100%;height:100%;object-fit:cover;" /></div>`,
                {}, 470, 680, 'TOP', 350, 200, false);

            // L09 — Label Vaga Carro
            addMCMVLayer('L09 Label Vaga Carro', 'html',
                `<div style="width:100%;height:100%;background:${bp};border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 8px rgba(0,0,0,0.3);">
                   <span style="font-family:'Montserrat',sans-serif;font-weight:700;font-size:20px;color:${tl};letter-spacing:.5px;">${labelVagaCarro}</span>
                 </div>`,
                {}, 645, 690, 'TOP', 330, 46, false);

            // 📸 L09b — Foto Vaga de Moto
            addMCMVLayer('Foto Vaga de Moto', 'html',
                `<div style="width:100%;height:100%;border-radius:14px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.3);"><img src="${imgVagaMoto}" style="width:100%;height:100%;object-fit:cover;" /></div>`,
                {}, 687, 680, 'TOP', 350, 200, false);

            // L10 — Label Vaga Moto
            addMCMVLayer('L10 Label Vaga Moto', 'html',
                `<div style="width:100%;height:100%;background:${bp};border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 8px rgba(0,0,0,0.3);">
                   <span style="font-family:'Montserrat',sans-serif;font-weight:700;font-size:20px;color:${tl};letter-spacing:.5px;">${labelVagaMoto}</span>
                 </div>`,
                {}, 862, 690, 'TOP', 330, 46, false);

            // 📸 L10b — Foto Varanda
            addMCMVLayer('Foto Varanda', 'html',
                `<div style="width:100%;height:100%;border-radius:14px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.3);"><img src="${imgVaranda}" style="width:100%;height:100%;object-fit:cover;" /></div>`,
                {}, 569, 680, 'BOTTOM', 350, 200, false);

            // L11 — Label Varanda
            addMCMVLayer('L11 Label Varanda', 'html',
                `<div style="width:100%;height:100%;background:${bp};border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 8px rgba(0,0,0,0.3);">
                   <span style="font-family:'Montserrat',sans-serif;font-weight:700;font-size:20px;color:${tl};letter-spacing:.5px;">${labelVaranda}</span>
                 </div>`,
                {}, 744, 690, 'BOTTOM', 330, 46, false);

            // L12 — Selo Minha Casa Minha Vida
            addMCMVLayer('L12 Selo MCMV', 'html',
                `<div style="width:100%;height:100%;background:${tl};border-radius:10px;box-shadow:0 4px 10px rgba(0,0,0,.2);display:flex;align-items:center;gap:8px;padding:0 12px;box-sizing:border-box;">
                   <i class="fa-solid fa-award" style="color:${bp};font-size:26px;"></i>
                   <span style="font-family:'Montserrat',sans-serif;font-weight:700;font-size:13px;color:${bp};line-height:1.1;">Minha Casa<br>Minha Vida</span>
                 </div>`,
                {}, 470, 700, 'BOTTOM', 300, 100, false);

            // L13 — Fundo Rodapé Navy — bleed
            addMCMVLayer('L13 Fundo Rodapé', 'html',
                `<div style="width:100%;height:100%;background:${bp};"></div>`,
                {}, 0, 0, 'BOTTOM', 1080, 230, true);

            // L14 — Logo Corretor Evoque — bleed
            addMCMVLayer('L14 Logo Corretor Evoque', 'html',
                `<div style="width:100%;height:100%;display:flex;align-items:center;gap:12px;">
                   <div style="width:56px;height:56px;min-width:56px;border-radius:50%;background:${tl};display:flex;align-items:center;justify-content:center;">
                     <i class="fa-solid fa-building" style="color:${bp};font-size:26px;"></i>
                   </div>
                   <div style="font-family:'Montserrat',sans-serif;color:${tl};line-height:1.1;">
                     <div style="font-size:16px;font-weight:400;">CORRETOR</div>
                     <div style="font-size:26px;font-weight:800;">${corretorNome}</div>
                   </div>
                 </div>`,
                {}, 60, 40, 'BOTTOM', 280, 130, true);

            // L15 — Telefone WhatsApp — bleed
            addMCMVLayer('L15 Telefone WhatsApp', 'html',
                `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:flex-end;gap:12px;">
                   <i class="fa-brands fa-whatsapp" style="color:${wa};font-size:36px;"></i>
                   <span style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:34px;color:${tl};">${telefoneWhatsapp}</span>
                 </div>`,
                {}, 90, 600, 'BOTTOM', 440, 90, true);

            // L16 — Faixa CTA BG — bleed
            addMCMVLayer('L16 Faixa CTA BG', 'html',
                `<div style="width:100%;height:100%;background:${ba};"></div>`,
                {}, 0, 0, 'BOTTOM', 1080, 55, true);

            // L17 — Texto CTA Final — bleed
            addMCMVLayer('L17 Texto CTA Final', 'text', textoCtaFinal,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '20px', color: tl, textAlign: 'center' },
                8, 0, 'BOTTOM', 1080, 40, true);
        } else if (selectedTemplateId === 'castello-di-lorenzo') {
            // ══════════════════════════════════════════════════════════════════════
            // CASTELLO DI LORENZO (Rita Vieira) — MCMV (Engenharia Reversa)
            // ══════════════════════════════════════════════════════════════════════
            const moreNo        = custom_fields.more_no || 'MORE NO';
            const ritaVieira    = custom_fields.rita_vieira || 'RITA VIEIRA';
            const jaNo          = custom_fields.ja_no || 'JÁ NO';
            const anoQueVem     = custom_fields.ano_que_vem || 'ANO QUE VEM.';
            const castelloName  = custom_fields.castello_di_lorenzo || 'CASTELLO\nDI LORENZO';

            const sinalLabel    = custom_fields.sinal_label || 'SINAL';
            const sinalValor    = custom_fields.sinal_valor || 'R$ 40.000,00';
            const sinalSub      = custom_fields.sinal_sub || 'PARCELADO EM ATÉ 3X';

            const parcelasLabel = custom_fields.parcelas_label || '16x DE';
            const parcelasValor = custom_fields.parcelas_valor || 'R$ 1.500,00';

            const balaoLabel    = custom_fields.balao_label || '1 BALÃO EM';
            const balaoLabel2   = custom_fields.balao_label2 || 'JUNHO DE 2027';
            const balaoValor    = custom_fields.balao_valor || 'R$ 16.000,00';

            const financLabel   = custom_fields.financiamento_label || 'FINANCIAMENTO';
            const financSub     = custom_fields.financiamento_sub || 'SOMENTE NA ENTREGA';
            const financValor   = custom_fields.financiamento_valor || 'R$ 320 MIL';

            const amenidade1    = custom_fields.amenidade1 || '2 QUARTOS\nCOM SUÍTE';
            const amenidade2    = custom_fields.amenidade2 || 'SACADA COM\nCHURRASQUEIRA';
            const localizacao   = custom_fields.localizacao || 'RITA VIEIRA';
            const logoEmpresa   = custom_fields.logo_empresa || 'FLORES IMÓVEIS';
            const registroCreui = custom_fields.registro_creui || 'CREUI 10834-J';

            // Cores base & brand tokens
            let bp = '#0B1E3D'; // brand-primary (azul-marinho escuro)
            let ba = '#C9A227'; // brand-accent (dourado)
            let tl = '#FFFFFF'; // brand-text-light (branco)

            const brandPrimary = localStorage.getItem('imob_brand_color_primary');
            const brandSecondary = localStorage.getItem('imob_brand_color_secondary');
            const brandTertiary = localStorage.getItem('imob_brand_color_tertiary');

            const activeColors = [];
            if (brandPrimary) activeColors.push({ hex: brandPrimary, lum: getLuminance(brandPrimary) });
            if (brandSecondary) activeColors.push({ hex: brandSecondary, lum: getLuminance(brandSecondary) });
            if (brandTertiary) activeColors.push({ hex: brandTertiary, lum: getLuminance(brandTertiary) });

            if (activeColors.length === 1) {
                const col = activeColors[0];
                if (col.lum < 120) { bp = col.hex; } else { ba = col.hex; }
            } else if (activeColors.length === 2) {
                activeColors.sort((a, b) => a.lum - b.lum);
                bp = activeColors[0].hex;
                ba = activeColors[1].hex;
                if (activeColors[1].lum > 180) { tl = activeColors[1].hex; }
            } else if (activeColors.length >= 3) {
                activeColors.sort((a, b) => a.lum - b.lum);
                bp = activeColors[0].hex;
                ba = activeColors[1].hex;
                tl = activeColors[2].hex;
            }

            const format = selectedFormat === 'story' ? '9:16' : '1:1';
            const F_height = format === '9:16' ? 1920 : 1080;
            const safeTop = format === '9:16' ? 250 : 60;
            const safeBottom = format === '9:16' ? 260 : 60;

            const shiftTop = Math.max(0, safeTop - 35);
            const shiftBottom = format === '9:16' ? 200 : 0;

            function resolvePositionLocal(cluster, edgeOffset, heightVal) {
                if (cluster === 'TOP') {
                    let top = edgeOffset + shiftTop;
                    if (top < safeTop) top = safeTop;
                    return top;
                } else if (cluster === 'BOTTOM_UNCLAMPED') {
                    return F_height - edgeOffset - heightVal;
                } else {
                    let top = F_height - (edgeOffset + shiftBottom) - heightVal;
                    if (top + heightVal > F_height - safeBottom) {
                        top = F_height - safeBottom - heightVal;
                    }
                    return top;
                }
            }

            function addMCMVLayer(name, type, content, style, edgeTop, left, cluster, width, height) {
                const top = resolvePositionLocal(cluster, edgeTop, height);
                let cssText = '';
                const styleObj = {
                    ...style,
                    position: 'absolute',
                    width: `${width}px`,
                    height: `${height}px`,
                };
                for (const [k, v] of Object.entries(styleObj)) {
                    const kebabKey = k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
                    cssText += `${kebabKey}:${v}; `;
                }
                addLayer(name, type, content, cssText, `${top}px`, `${left}px`, cluster, `${width}px`, `${height}px`);
            }

            // ══════════════════════════════════════════════════════════
            // DEGRADÊS DE LEITURA (LADO ESQUERDO E RODAPÉ)
            // ══════════════════════════════════════════════════════════

            // L00 — Degradê Lateral Esquerdo (da borda esquerda até o fim da área de texto)
            const gradEsquerdo = `linear-gradient(90deg, ${hexToRgba(bp, 0.95)} 0%, ${hexToRgba(bp, 0.75)} 60%, ${hexToRgba(bp, 0)} 100%)`;
            addMCMVLayer('L00_degrade_esquerdo', 'html',
                `<div style="width:100%;height:100%;background:${gradEsquerdo};pointer-events:none;"></div>`,
                {}, 0, 0, 'TOP', 640, F_height);

            // ══════════════════════════════════════════════════════════
            // CLUSTER SUPERIOR (TOP) — L01 a L22
            // ══════════════════════════════════════════════════════════

            // L01 — "MORE NO"
            addMCMVLayer('L01_more_no', 'text', moreNo, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: '20px', color: tl,
                textAlign: 'left', letterSpacing: '1px', lineHeight: 1.1,
            }, 35, 45, 'TOP', 200, 28);

            // L02 — "RITA VIEIRA" (título principal)
            addMCMVLayer('L02_rita_vieira', 'text', ritaVieira, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '58px', color: tl,
                textAlign: 'left', letterSpacing: '0px', lineHeight: 1.0,
            }, 65, 45, 'TOP', 520, 90);

            // L03 — "JÁ NO"
            addMCMVLayer('L03_ja_no', 'text', jaNo, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: '20px', color: tl,
                textAlign: 'left', letterSpacing: '1px', lineHeight: 1.1,
            }, 170, 45, 'TOP', 150, 28);

            // L04 — "ANO QUE VEM."
            addMCMVLayer('L04_ano_que_vem', 'text', anoQueVem, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '48px', color: ba,
                textAlign: 'left', letterSpacing: '0px', lineHeight: 1.0,
            }, 205, 45, 'TOP', 560, 65);

            // L05 — Ícone decorativo acima de "CASTELLO DI LORENZO"
            addMCMVLayer('L05_icone_castello', 'html',
                `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-chess-rook" style="color:${tl};font-size:22px;"></i></div>`,
                {}, 300, 165, 'TOP', 30, 30);

            // L06 — "CASTELLO DI LORENZO"
            addMCMVLayer('L06_castello_di_lorenzo', 'text', castelloName, {
                fontFamily: "'Cinzel', serif", fontWeight: 500, fontSize: '22px', color: tl,
                textAlign: 'left', letterSpacing: '4px', lineHeight: 1.25,
            }, 305, 45, 'TOP', 300, 68);

            // L07 — Linha divisória
            addMCMVLayer('L07_divisor', 'html',
                `<div style="width:100%;height:1px;background:${tl};opacity:0.5;"></div>`,
                {}, 410, 45, 'TOP', 230, 2);

            // Pricing Rows (L08_01 to L08_04)
            const pricingRows = [
                {
                    icon: 'fa-hand-holding-dollar', iconTop: 450,
                    fields: [
                        { key: 'label', text: sinalLabel, top: 455, size: 15, weight: 700, color: tl, h: 20 },
                        { key: 'valor', text: sinalValor, top: 472, size: 32, weight: 800, color: ba, h: 42 },
                        { key: 'sub',   text: sinalSub,   top: 507, size: 13, weight: 400, color: tl, h: 17 },
                    ],
                },
                {
                    icon: 'fa-calendar-days', iconTop: 550,
                    fields: [
                        { key: 'label', text: parcelasLabel, top: 552, size: 15, weight: 700, color: tl, h: 20 },
                        { key: 'valor', text: parcelasValor, top: 570, size: 32, weight: 800, color: ba, h: 42 },
                    ],
                },
                {
                    icon: 'fa-calendar-days', iconTop: 620,
                    fields: [
                        { key: 'label',  text: balaoLabel,  top: 622, size: 15, weight: 700, color: tl, h: 20 },
                        { key: 'label2', text: balaoLabel2, top: 642, size: 15, weight: 700, color: tl, h: 20 },
                        { key: 'valor',  text: balaoValor,  top: 663, size: 30, weight: 800, color: ba, h: 39 },
                    ],
                },
                {
                    icon: 'fa-sack-dollar', iconTop: 712,
                    fields: [
                        { key: 'label', text: financLabel, top: 714, size: 15, weight: 700, color: tl, h: 20 },
                        { key: 'sub',   text: financSub,   top: 734, size: 13, weight: 600, color: tl, h: 17 },
                        { key: 'valor', text: financValor, top: 756, size: 30, weight: 800, color: ba, h: 39 },
                    ],
                },
            ];

            pricingRows.forEach((row, i) => {
                const n = String(i + 1).padStart(2, '0');
                addMCMVLayer(`L08_${n}_icone_valor`, 'html',
                    `<div style="width:44px;height:44px;border-radius:50%;border:1px solid ${tl};display:flex;align-items:center;justify-content:center;"><i class="fa-solid ${row.icon}" style="color:${tl};font-size:22px;"></i></div>`,
                    {}, row.iconTop, 45, 'TOP', 44, 44);

                row.fields.forEach((f) => {
                    addMCMVLayer(`L08_${n}_${f.key}`, 'text', f.text, {
                        fontFamily: "'Montserrat', sans-serif", fontWeight: f.weight, fontSize: `${f.size}px`, color: f.color,
                        textAlign: 'left', letterSpacing: '0.5px', lineHeight: 1.15,
                    }, f.top, 110, 'TOP', 280, f.h);
                });
            });

            // ══════════════════════════════════════════════════════════
            // CLUSTER INFERIOR (BOTTOM) — L23 a L33
            // ══════════════════════════════════════════════════════════

            // L23 — Degradê no Rodapé (de baixo para cima) cobrindo apenas a área dos textos do rodapé
            const hRodapeDegrade = format === '9:16' ? 260 : 185;
            const gradRodape = `linear-gradient(0deg, ${hexToRgba(bp, 0.96)} 0%, ${hexToRgba(bp, 0.78)} 65%, ${hexToRgba(bp, 0)} 100%)`;
            addMCMVLayer('L23_barra_rodape', 'html',
                `<div style="width:100%;height:100%;background:${gradRodape};pointer-events:none;"></div>`,
                {}, 0, 0, 'BOTTOM_UNCLAMPED', 1080, hRodapeDegrade);

            // L24 — Amenidades (Quartos e Churrasqueira)
            const amenidadesList = [
                { icon: 'fa-bed',         iconLeft: 55,  textLeft: 95,  text: amenidade1 },
                { icon: 'fa-fire-burner', iconLeft: 350, textLeft: 390, text: amenidade2 },
            ];

            amenidadesList.forEach((a, i) => {
                const n = String(i + 1).padStart(2, '0');
                addMCMVLayer(`L24_${n}_icone_amenidade`, 'html',
                    `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><i class="fa-solid ${a.icon}" style="color:${tl};font-size:18px;"></i></div>`,
                    {}, 100, a.iconLeft, 'BOTTOM', 30, 30);

                addMCMVLayer(`L24_${n}_texto_amenidade`, 'text', a.text, {
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '15px', color: tl,
                    textAlign: 'left', letterSpacing: '0.3px', lineHeight: 1.2,
                }, 100, a.textLeft, 'BOTTOM', 220, 40);
            });

            // L26 — Divisor "|" 1
            addMCMVLayer('L26_divisor_1', 'text', '|', {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: '20px', color: tl, textAlign: 'center',
            }, 105, 315, 'BOTTOM', 10, 35);

            // L29 — Divisor "|" 2
            addMCMVLayer('L29_divisor_2', 'text', '|', {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: '20px', color: tl, textAlign: 'center',
            }, 105, 625, 'BOTTOM', 10, 35);

            // L30 — Ícone Pin
            addMCMVLayer('L30_icone_pin', 'html',
                `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-location-dot" style="color:${ba};font-size:16px;"></i></div>`,
                {}, 103, 655, 'BOTTOM', 25, 25);

            // L31 — Texto Localização
            addMCMVLayer('L31_texto_localizacao', 'text', localizacao, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '16px', color: ba,
                textAlign: 'left', letterSpacing: '0.5px', lineHeight: 1.2,
            }, 103, 685, 'BOTTOM', 180, 25);

            // L32 — Logo Institucional
            addMCMVLayer('L32_logo_flores_imoveis', 'text', logoEmpresa, {
                fontFamily: "'Cinzel', serif", fontWeight: 500, fontSize: '24px', color: tl,
                textAlign: 'center', letterSpacing: '5px', lineHeight: 1.1,
            }, 32, 340, 'BOTTOM', 400, 30);

            // L33 — CREUI
            addMCMVLayer('L33_creui', 'text', registroCreui, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: '11px', color: tl,
                textAlign: 'center', letterSpacing: '2px', lineHeight: 1.1, opacity: 0.8,
            }, 6, 420, 'BOTTOM', 240, 15);
        } else if (selectedTemplateId === 'adolfo-pinheiro') {
            // ══════════════════════════════════════════════════════════════════════
            // ADOLFO PINHEIRO — Fachada Perspectiva Ilustrada, MCMV (Engenharia Reversa)
            // ══════════════════════════════════════════════════════════════════════
            const logoTexto      = custom_fields.logo_texto || 'Minha Casa\nMinha Vida';
            const taglineLinha1  = custom_fields.tagline_linha1 || 'More a 2 min.';
            const taglineLinha2  = custom_fields.tagline_linha2 || 'da Estação';
            const titulo         = custom_fields.titulo || 'ADOLFO\nPINHEIRO';
            const textoApoio     = custom_fields.texto_apoio || 'Opções de\n2 quartos,\ncom varanda';
            const labelEntrada   = custom_fields.label_entrada || 'Entrada a partir de';
            const valorEntrada   = custom_fields.valor_entrada || 'R$ 500,00';
            const labelRenda     = custom_fields.label_renda || 'Renda a partir de';
            const valorRenda     = custom_fields.valor_renda || 'R$ 4.000,00';
            const totemTexto     = custom_fields.totem_texto || 'Adolfo Pinheiro';

            let bp  = '#5B2A8C';
            let ba  = '#E91C82';
            let tl  = '#FFFFFF';
            let sec = '#1B0F26';
            let ter = '#FBF9FD';

            const brandPrimary = localStorage.getItem('imob_brand_color_primary');
            const brandSecondary = localStorage.getItem('imob_brand_color_secondary');
            const brandTertiary = localStorage.getItem('imob_brand_color_tertiary');

            const activeColors = [];
            if (brandPrimary) activeColors.push({ hex: brandPrimary, lum: getLuminance(brandPrimary) });
            if (brandSecondary) activeColors.push({ hex: brandSecondary, lum: getLuminance(brandSecondary) });
            if (brandTertiary) activeColors.push({ hex: brandTertiary, lum: getLuminance(brandTertiary) });

            if (activeColors.length === 1) {
                const col = activeColors[0];
                if (col.lum < 120) { bp = col.hex; } else { ba = col.hex; }
            } else if (activeColors.length === 2) {
                activeColors.sort((a, b) => a.lum - b.lum);
                bp = activeColors[0].hex;
                ba = activeColors[1].hex;
            } else if (activeColors.length >= 3) {
                activeColors.sort((a, b) => a.lum - b.lum);
                bp = activeColors[0].hex;
                ba = activeColors[1].hex;
                tl = activeColors[2].hex;
            }

            const format = selectedFormat === 'story' ? '9:16' : '1:1';
            const FORMATS = {
                '1:1':  { width: 1080, height: 1080, safeTop: 60,  safeBottom: 60  },
                '9:16': { width: 1080, height: 1920, safeTop: 250, safeBottom: 260 },
            };

            function resolvePosition(cluster, edgeOffset, height) {
                const cfg = FORMATS[format];
                if (cluster === 'TOP') {
                    return Math.max(edgeOffset, cfg.safeTop);
                }
                if (edgeOffset === 0) {
                    return cfg.height - edgeOffset - height;
                }
                const rawTop = cfg.height - edgeOffset - height;
                const maxTop = cfg.height - cfg.safeBottom - height;
                return Math.min(rawTop, maxTop);
            }

            function addMCMVLayer(name, type, content, style, edgeTop, left, cluster, width, height) {
                const top = resolvePosition(cluster, edgeTop, height);
                let cssText = '';
                const styleObj = {
                    ...style,
                    position: 'absolute',
                    width: `${width}px`,
                    height: `${height}px`,
                };
                for (const [k, v] of Object.entries(styleObj)) {
                    const kebabKey = k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
                    cssText += `${kebabKey}:${v}; `;
                }
                addLayer(name, type, content, cssText, `${top}px`, `${left}px`, cluster, `${width}px`, `${height}px`);
            }

            // L01 — Ícone do logo "Minha Casa Minha Vida"
            addMCMVLayer(
                'L01_logo_icone', 'html',
                `<div style="width:100%;height:100%;border-radius:50%;background:${tl};display:flex;align-items:center;justify-content:center;">
                   <i class="fa-solid fa-house" style="color:${bp};font-size:34px;"></i>
                 </div>`,
                {}, 40, 43, 'TOP', 70, 70
            );

            // L02 — Texto do logo "Minha Casa Minha Vida"
            addMCMVLayer(
                'L02_logo_texto', 'text', logoTexto,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '22px', lineHeight: '24px', color: tl, textAlign: 'left', letterSpacing: '0.2px' },
                45, 125, 'TOP', 220, 55
            );

            // L03 — Fundo do pill/badge "More a 2 min. / da Estação"
            addMCMVLayer(
                'L03_pill_fundo', 'html',
                `<div style="width:100%;height:100%;background:${bp};border-radius:32px;"></div>`,
                {}, 190, 43, 'TOP', 480, 150
            );

            // L04 — Tagline linha 1 "More a 2 min."
            addMCMVLayer(
                'L04_tagline_linha1', 'text', taglineLinha1,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: '32px', lineHeight: '36px', color: tl, textAlign: 'left' },
                218, 75, 'TOP', 420, 40
            );

            // L05 — Tagline linha 2 "da Estação"
            addMCMVLayer(
                'L05_tagline_linha2', 'text', taglineLinha2,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '58px', lineHeight: '60px', color: tl, textAlign: 'left' },
                262, 75, 'TOP', 420, 65
            );

            // L06 — Título do empreendimento "ADOLFO PINHEIRO"
            addMCMVLayer(
                'L06_titulo', 'text', titulo,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '92px', lineHeight: '96px', color: tl, textAlign: 'left', letterSpacing: '0px' },
                format === '9:16' ? 420 : 360, 43, 'TOP', 700, 200
            );

            // L07 — Ícone de quarto/cama
            addMCMVLayer(
                'L07_icone_quarto', 'html',
                `<i class="fa-solid fa-bed" style="color:${tl};font-size:48px;"></i>`,
                {}, format === '9:16' ? 760 : 610, 43, 'TOP', 60, 60
            );

            // L08 — Texto de apoio "Opções de 2 quartos, com varanda"
            addMCMVLayer(
                'L08_texto_apoio', 'text', textoApoio,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '30px', lineHeight: '34px', color: tl, textAlign: 'left' },
                format === '9:16' ? 755 : 605, 115, 'TOP', 400, 110
            );

            // L09 — Losango decorativo com ícone de estação/metrô
            addMCMVLayer(
                'L09_losango_decorativo', 'html',
                `<div style="width:100%;height:100%;background:${bp};transform:rotate(45deg);display:flex;align-items:center;justify-content:center;">
                   <i class="fa-solid fa-train-subway" style="color:${tl};font-size:44px;transform:rotate(-45deg);"></i>
                 </div>`,
                {}, format === '9:16' ? 740 : 590, 850, 'TOP', 130, 130
            );

            // L10 — Fundo do box "Entrada a partir de"
            addMCMVLayer(
                'L10_box_entrada_fundo', 'html',
                `<div style="width:100%;height:100%;background:${ter};border-radius:24px;"></div>`,
                {}, 40, 43, 'BOTTOM', 460, 190
            );

            // L11 — Label "Entrada a partir de"
            addMCMVLayer(
                'L11_label_entrada', 'text', labelEntrada,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '24px', lineHeight: '28px', color: bp, textAlign: 'left' },
                170, 75, 'BOTTOM', 400, 30
            );

            // L12 — Valor "R$ 500,00"
            addMCMVLayer(
                'L12_valor_entrada', 'text', valorEntrada,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '66px', lineHeight: '68px', color: ba, textAlign: 'left' },
                90, 75, 'BOTTOM', 400, 75
            );

            // L13 — Fundo do box "Renda a partir de"
            addMCMVLayer(
                'L13_box_renda_fundo', 'html',
                `<div style="width:100%;height:100%;background:${bp};border-radius:24px;"></div>`,
                {}, 40, 577, 'BOTTOM', 460, 190
            );

            // L14 — Label "Renda a partir de"
            addMCMVLayer(
                'L14_label_renda', 'text', labelRenda,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '24px', lineHeight: '28px', color: tl, textAlign: 'left' },
                170, 610, 'BOTTOM', 400, 30
            );

            // L15 — Valor "R$ 4.000,00"
            addMCMVLayer(
                'L15_valor_renda', 'text', valorRenda,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '52px', lineHeight: '54px', color: tl, textAlign: 'left' },
                105, 610, 'BOTTOM', 400, 60
            );

            // L16 — Fundo da barra/totem vertical
            addMCMVLayer(
                'L16_totem_fundo', 'html',
                `<div style="width:100%;height:100%;background:${sec};"></div>`,
                {}, 0, 880, 'BOTTOM_UNCLAMPED', 150, format === '9:16' ? 1920 : 1080
            );

            // L17 — Ícone de trem/metrô no topo do totem
            addMCMVLayer(
                'L17_totem_icone', 'html',
                `<i class="fa-solid fa-train-subway" style="color:${tl};font-size:36px;"></i>`,
                {}, format === '9:16' ? 1440 : 600, 930, 'BOTTOM_UNCLAMPED', 50, 50
            );

            // L18 — Texto rotacionado "Adolfo Pinheiro" dentro do totem
            addMCMVLayer(
                'L18_totem_texto', 'text', totemTexto,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '36px', color: tl, textAlign: 'center', letterSpacing: '1px', transform: 'rotate(-90deg)', transformOrigin: 'center' },
                format === '9:16' ? 880 : 40, 905, 'BOTTOM_UNCLAMPED', 45, 300
            );
        } else if (selectedTemplateId === 'adolfo-pinheiro-original') {
            // ══════════════════════════════════════════════════════════════════════
            // ADOLFO PINHEIRO ORIGINAL — Layout com 4 fotos customizadas pelo usuário
            // ══════════════════════════════════════════════════════════════════════
            const taglineLinha1  = custom_fields.tagline_linha1 || 'More a 2 min.';
            const taglineLinha2  = custom_fields.tagline_linha2 || 'da Estação';
            const titulo         = custom_fields.titulo || 'ADOLFO\nPINHEIRO';
            const textoApoio     = custom_fields.texto_apoio || 'Opções de\n2 QUARTOS,\ncom varanda';
            const labelEntrada   = custom_fields.label_entrada || 'Entrada a partir de';
            const valorEntrada   = custom_fields.valor_entrada || '500';
            const labelRenda     = custom_fields.label_renda || 'Renda a partir de';
            const valorRenda     = custom_fields.valor_renda || '4.000';
            const totemTexto     = custom_fields.totem_texto || 'Adolfo Pinheiro';

            let bp  = '#8A1DF2'; // dominant purple
            let ba  = '#35D4DA'; // brand accent (cyan)
            let tl  = '#FFFFFF'; // white
            let sec = '#000000'; // black (totem)

            const brandPrimary = localStorage.getItem('imob_brand_color_primary');
            const brandSecondary = localStorage.getItem('imob_brand_color_secondary');
            const brandTertiary = localStorage.getItem('imob_brand_color_tertiary');

            const activeColors = [];
            if (brandPrimary) activeColors.push({ hex: brandPrimary, lum: getLuminance(brandPrimary) });
            if (brandSecondary) activeColors.push({ hex: brandSecondary, lum: getLuminance(brandSecondary) });
            if (brandTertiary) activeColors.push({ hex: brandTertiary, lum: getLuminance(brandTertiary) });

            if (activeColors.length === 1) {
                const col = activeColors[0];
                if (col.lum < 120) { bp = col.hex; } else { ba = col.hex; }
            } else if (activeColors.length === 2) {
                activeColors.sort((a, b) => a.lum - b.lum);
                bp = activeColors[0].hex;
                ba = activeColors[1].hex;
            } else if (activeColors.length >= 3) {
                activeColors.sort((a, b) => a.lum - b.lum);
                bp = activeColors[0].hex;
                ba = activeColors[1].hex;
                tl = activeColors[2].hex;
            }

            const format = selectedFormat === 'story' ? '9:16' : '1:1';
            const FORMATS = {
                '1:1':  { width: 1080, height: 1080, safeTop: 60,  safeBottom: 60  },
                '9:16': { width: 1080, height: 1920, safeTop: 250, safeBottom: 260 },
            };

            function resolvePosition(cluster, edgeOffset, height) {
                const cfg = FORMATS[format];
                if (cluster === 'TOP') {
                    return Math.max(edgeOffset, cfg.safeTop);
                }
                if (cluster === 'BOTTOM_UNCLAMPED') {
                    return cfg.height - edgeOffset - height;
                }
                if (edgeOffset === 0) {
                    return cfg.height - edgeOffset - height;
                }
                const rawTop = cfg.height - edgeOffset - height;
                const maxTop = cfg.height - cfg.safeBottom - height;
                return Math.min(rawTop, maxTop);
            }

            function addMCMVLayer(name, type, content, style, edgeTop, left, cluster, width, height) {
                const top = resolvePosition(cluster, edgeTop, height);
                let cssText = '';
                const styleObj = {
                    ...style,
                    position: 'absolute',
                    width: `${width}px`,
                    height: `${height}px`,
                };
                for (const [k, v] of Object.entries(styleObj)) {
                    const kebabKey = k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
                    cssText += `${kebabKey}:${v}; `;
                }
                addLayer(name, type, content, cssText, `${top}px`, `${left}px`, cluster, `${width}px`, `${height}px`);
            }

            // Compositor do fundo (4 Imagens + Roxo Overlay)
            const img1 = (window._templateUploadedImages && window._templateUploadedImages['imagem1']) || '/imovel/Assets/real_estate_1.png';
            const img2 = (window._templateUploadedImages && window._templateUploadedImages['imagem2']) || '/imovel/Assets/real_estate_2.png';
            const img3 = (window._templateUploadedImages && window._templateUploadedImages['imagem3']) || '/imovel/Assets/real_estate_3.png';
            const img4 = (window._templateUploadedImages && window._templateUploadedImages['imagem4']) || '/imovel/Assets/real_estate_4.png';

            const hasImg1 = !!(window._templateUploadedImages && window._templateUploadedImages['imagem1']);
            const img1Html = hasImg1
                ? `<img src="${img1}" style="position:absolute; top:0; left:500px; width:580px; height:${format === '9:16' ? 600 : 260}px; object-fit:cover;" />`
                : `<div style="position:absolute; top:0; left:500px; width:580px; height:${format === '9:16' ? 600 : 260}px; background:#8A1DF2;"></div>`;

            const bgHtml = `
                <div style="width:1080px; height:${format === '9:16' ? 1920 : 1080}px; position:relative; overflow:hidden; background:${sec};">
                  <!-- Imagem 1: Prédio (ou fundo lilás se não enviada) -->
                  ${img1Html}
                  
                  <!-- Imagem 2: Lounge -->
                  ${format === '9:16' ? `<img src="${img2}" style="position:absolute; top:600px; left:460px; width:620px; height:500px; object-fit:cover;" />` : ''}
                  
                  <!-- Imagem 3: Fachada -->
                  <img src="${img3}" style="position:absolute; top:${format === '9:16' ? 1100 : 260}px; left:0; width:520px; height:820px; object-fit:cover; border-right: 6px solid ${bp}; border-top: ${format === '1:1' ? `6px solid ${bp}` : 'none'};" />
                  
                  <!-- Imagem 4: Piscina -->
                  <img src="${img4}" style="position:absolute; top:${format === '9:16' ? 1100 : 260}px; left:520px; width:560px; height:820px; object-fit:cover; border-top: ${format === '1:1' ? `6px solid ${bp}` : 'none'};" />

                  <!-- Purple Overlay on the Left -->
                  <div style="position:absolute; top:0; left:0; width:1080px; height:${format === '9:16' ? 1100 : 260}px; background:${bp}; clip-path: polygon(0 0, 780px 0, 480px 100%, 0 100%);"></div>
                </div>
            `;
            // Adiciona a composição como camada 0 (fundo)
            addLayer('Composição de Fundo (4 fotos)', 'html', bgHtml, 'width:1080px; height:100%; z-index: 1;', '0px', '0px', 'TOP', '1080px', (format === '9:16' ? '1920px' : '1080px'));

            // L01 Selo Minha Casa Minha Vida - Fundo
            const isStory = selectedFormat === 'story';
            const layoutPos = isStory ? {
                L01_top: 250,
                L02_top: 253,
                L03_top: 333,
                L04_top: 440,
                L05_top: 731,
                L06_top: 923,
                L07_top: 936,
            } : {
                L01_top: 90,
                L02_top: 253,
                L03_top: 333,
                L04_top: 440,
                L05_top: 731,
                L06_top: 923,
                L07_top: 936,
            };

            // L01 Selo Minha Casa Minha Vida - Fundo
            addMCMVLayer(
                'L01 Selo MCMV - Fundo', 'html',
                `<div style="width:100%;height:100%;background:${tl};border-radius:45px;box-sizing:border-box;"></div>`,
                { zIndex: 10 }, layoutPos.L01_top, 78, 'TOP', 255, 90
            );

            // L01 Selo Minha Casa Minha Vida - Ícone
            addMCMVLayer(
                'L01 Selo MCMV - Ícone', 'html',
                `<i class="fa-solid fa-house-chimney" style="font-size:40px;color:#0A7DD0;display:flex;align-items:center;justify-content:center;width:100%;height:100%;"></i>`,
                { zIndex: 11 }, layoutPos.L01_top + 25, 78 + 22, 'TOP', 40, 40
            );

            // L01 Selo Minha Casa Minha Vida - Texto
            addMCMVLayer(
                'L01 Selo MCMV - Texto', 'text', "Minha Casa\nMinha Vida",
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '21px', lineHeight: 1.08, color: '#B3122E', zIndex: 11, display: 'flex', alignItems: 'center' },
                layoutPos.L01_top + 22, 78 + 22 + 40 + 12, 'TOP', 160, 50
            );

            // L02 Pill - Fundo
            addMCMVLayer(
                'L02 Pill - Fundo', 'html',
                `<div style="width:100%;height:100%;background:${ba};border-radius:14px;"></div>`,
                { zIndex: 10 }, layoutPos.L02_top, 51, 'TOP', 308, 70
            );

            // L02 Pill - Texto
            addMCMVLayer(
                'L02 Pill - Texto', 'text', taglineLinha1,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '38px', color: tl, textAlign: 'center', lineHeight: '70px', zIndex: 11 },
                layoutPos.L02_top, 51, 'TOP', 308, 70
            );

            // L03 Texto da Estação
            addMCMVLayer(
                'L03 Texto da Estação', 'text', taglineLinha2,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: '52px',
                  color: tl, lineHeight: 1.1, textAlign: 'left', zIndex: 10 },
                layoutPos.L03_top, 55, 'TOP', 340, 62
            );

            // L04 Título Empreendimento
            addMCMVLayer(
                'L04 Título Empreendimento', 'text', titulo,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: '92px',
                  color: ba, lineHeight: 0.98, letterSpacing: '1px', textAlign: 'left',
                  textShadow: '0 2px 8px rgba(0,0,0,.18)', zIndex: 10 },
                layoutPos.L04_top, 42, 'TOP', 575, 190
            );

            // L05 Badge Características - Moldura
            addMCMVLayer(
                'L05 Badge Características - Moldura', 'html',
                `<div style="width:100%;height:100%;border:3px solid ${tl};border-radius:26px;box-sizing:border-box;"></div>`,
                { zIndex: 10 }, layoutPos.L05_top, 64, 'TOP', 620, 141
            );

            // L05 Badge Características - Ícone Cama
            addMCMVLayer(
                'L05 Badge Características - Ícone Cama', 'html',
                `<i class="fa-solid fa-bed" style="font-size:56px;color:${tl};display:flex;align-items:center;justify-content:center;width:100%;height:100%;"></i>`,
                { zIndex: 11 }, layoutPos.L05_top + 42, 64 + 32, 'TOP', 56, 56
            );

            // L05 Badge Características - Ícone Prédio
            addMCMVLayer(
                'L05 Badge Características - Ícone Prédio', 'html',
                `<i class="fa-solid fa-building" style="font-size:56px;color:${tl};display:flex;align-items:center;justify-content:center;width:100%;height:100%;"></i>`,
                { zIndex: 11 }, layoutPos.L05_top + 42, 64 + 620 - 32 - 56, 'TOP', 56, 56
            );

            // L05 Badge Características - Textos dinâmicos baseados nas linhas de textoApoio
            const apoios = (textoApoio || '').split('\n');
            if (apoios.length >= 3) {
                addMCMVLayer(
                    'L05 Badge - Texto Linha 1', 'text', apoios[0],
                    { fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: '34px', color: tl, textAlign: 'center', zIndex: 11 },
                    layoutPos.L05_top + 16, 64 + 88, 'TOP', 440, 38
                );
                addMCMVLayer(
                    'L05 Badge - Texto Linha 2', 'text', apoios[1],
                    { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '42px', color: tl, textAlign: 'center', zIndex: 11 },
                    layoutPos.L05_top + 52, 64 + 88, 'TOP', 440, 46
                );
                addMCMVLayer(
                    'L05 Badge - Texto Linha 3', 'text', apoios[2],
                    { fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: '34px', color: tl, textAlign: 'center', zIndex: 11 },
                    layoutPos.L05_top + 96, 64 + 88, 'TOP', 440, 38
                );
            } else if (apoios.length === 2) {
                addMCMVLayer(
                    'L05 Badge - Texto Linha 1', 'text', apoios[0],
                    { fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: '34px', color: tl, textAlign: 'center', zIndex: 11 },
                    layoutPos.L05_top + 32, 64 + 88, 'TOP', 440, 38
                );
                addMCMVLayer(
                    'L05 Badge - Texto Linha 2', 'text', apoios[1],
                    { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '42px', color: tl, textAlign: 'center', zIndex: 11 },
                    layoutPos.L05_top + 72, 64 + 88, 'TOP', 440, 46
                );
            } else {
                addMCMVLayer(
                    'L05 Badge - Texto', 'text', textoApoio,
                    { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '38px', color: tl, textAlign: 'center', zIndex: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' },
                    layoutPos.L05_top + 46, 64 + 88, 'TOP', 440, 50
                );
            }

            // L06 Bloco Entrada - Fundo
            addMCMVLayer(
                'L06 Bloco Entrada - Fundo', 'html',
                `<div style="width:100%;height:100%;background:${tl};border-radius:18px;"></div>`,
                { zIndex: 10 }, layoutPos.L06_top, 55, 'TOP', 413, 154
            );

            // L06 Bloco Entrada - Label
            addMCMVLayer(
                'L06 Bloco Entrada - Label', 'text', labelEntrada,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '28px', color: bp, textAlign: 'center', zIndex: 11 },
                layoutPos.L06_top + 18, 55, 'TOP', 413, 34
            );

            // L06 Bloco Entrada - R$
            let valEntradaClean = valorEntrada.replace('R$', '').replace(',00', '').trim();
            if (valEntradaClean.includes(',')) valEntradaClean = valEntradaClean.split(',')[0];
            if (valEntradaClean.includes('.')) valEntradaClean = valEntradaClean.split('.')[0];
            const valorEntradaInteiro = valEntradaClean.replace(/\D/g, '') || '500';

            addMCMVLayer(
                'L06 Bloco Entrada - R$', 'text', 'R$',
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '44px', color: bp, zIndex: 11, textAlign: 'right' },
                layoutPos.L06_top + 90, 55 + 56, 'TOP', 60, 44
            );

            // L06 Bloco Entrada - Valor
            addMCMVLayer(
                'L06 Bloco Entrada - Valor', 'text', valorEntradaInteiro,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: '100px', color: bp, lineHeight: '90px', zIndex: 11, textAlign: 'center' },
                layoutPos.L06_top + 48, 55 + 56 + 60, 'TOP', 170, 100
            );

            // L06 Bloco Entrada - Sufixo
            addMCMVLayer(
                'L06 Bloco Entrada - Sufixo', 'text', ',00',
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '40px', color: bp, zIndex: 11 },
                layoutPos.L06_top + 94, 55 + 56 + 60 + 170, 'TOP', 70, 40
            );

            // L07 Bloco Renda - Fundo
            addMCMVLayer(
                'L07 Bloco Renda - Fundo', 'html',
                `<div style="width:100%;height:100%;background:rgba(255,255,255,.28);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border-radius:16px;"></div>`,
                { zIndex: 10 }, layoutPos.L07_top, 497, 'TOP', 308, 135
            );

            // L07 Bloco Renda - Label
            addMCMVLayer(
                'L07 Bloco Renda - Label', 'text', labelRenda,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: '27px', color: tl, textAlign: 'center', zIndex: 11 },
                layoutPos.L07_top + 14, 497, 'TOP', 308, 32
            );

            // L07 Bloco Renda - R$
            let valRendaClean = valorRenda.replace('R$', '').replace(',00', '').trim();
            if (valRendaClean.includes(',')) valRendaClean = valRendaClean.split(',')[0];
            const valorRendaNum = parseInt(valRendaClean.replace(/\D/g, '')) || 4000;
            const valorRendaFormatado = valorRendaNum.toLocaleString('pt-BR');

            addMCMVLayer(
                'L07 Bloco Renda - R$', 'text', 'R$',
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '34px', color: tl, zIndex: 11, textAlign: 'right' },
                layoutPos.L07_top + 82, 497 + 24, 'TOP', 50, 38
            );

            // L07 Bloco Renda - Valor
            addMCMVLayer(
                'L07 Bloco Renda - Valor', 'text', valorRendaFormatado,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '68px', color: tl, lineHeight: '62px', zIndex: 11, textAlign: 'center' },
                layoutPos.L07_top + 54, 497 + 24 + 50, 'TOP', 160, 70
            );

            // L07 Bloco Renda - Sufixo
            addMCMVLayer(
                'L07 Bloco Renda - Sufixo', 'text', ',00',
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '30px', color: tl, zIndex: 11 },
                layoutPos.L07_top + 84, 497 + 24 + 50 + 160, 'TOP', 50, 34
            );

            // L08 Totem Estação Adolfo Pinheiro - Fundo
            addMCMVLayer(
                'L08 Totem Estação - Fundo', 'html',
                `<div style="width:100%;height:100%;background:${sec};border-radius:18px 18px 0 0;box-shadow:-4px 0 14px rgba(0,0,0,.35);"></div>`,
                { zIndex: 10 }, 0, 962, 'BOTTOM', 112, 820
            );

            // L08 Totem Estação Adolfo Pinheiro - Ícone (sem container branco, cor tl)
            addMCMVLayer(
                'L08 Totem Estação - Ícone', 'html',
                `<i class="fa-solid fa-train-subway" style="font-size:44px;color:${tl};display:flex;align-items:center;justify-content:center;width:100%;height:100%;"></i>`,
                { zIndex: 11 }, 738, 962 + 20, 'BOTTOM_UNCLAMPED', 72, 72
            );

            // L08 Totem Estação Adolfo Pinheiro - Faixa Lilás (editável)
            addMCMVLayer(
                'L08 Totem Estação - Faixa Lilás', 'html',
                `<div style="width:100%;height:100%;background:${bp};"></div>`,
                { zIndex: 11 }, 676, 962, 'BOTTOM_UNCLAMPED', 112, 34
            );

            // L08 Totem Estação Adolfo Pinheiro - Texto
            addMCMVLayer(
                'L08 Totem Estação - Texto', 'text', totemTexto,
                { writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '46px', color: tl, letterSpacing: '1px', zIndex: 11, textAlign: 'center' },
                72, 962, 'BOTTOM_UNCLAMPED', 112, 580
            );
        } else if (selectedTemplateId === 'lancamento-centro-niteroi') {
            // ══════════════════════════════════════════════════════════════════════
            // LANÇAMENTO CENTRO NITERÓI — MCMV (Engenharia Reversa)
            // ══════════════════════════════════════════════════════════════════════
            const badgeLancamento    = custom_fields.badge_lancamento || 'LANÇAMENTO';
            const tituloL1           = custom_fields.titulo_l1 || 'CENTRO';
            const tituloL2           = custom_fields.titulo_l2 || 'NITERÓI';
            const taglineL1          = custom_fields.tagline_l1 || 'VIVA O MELHOR DA CIDADE';
            const taglineL2          = custom_fields.tagline_l2 || 'COM VISTA.';
            const boxQuartosDestaque = custom_fields.box_quartos_destaque || custom_fields.box_quartos?.split('\n')[0] || '2 QUARTOS';
            const boxQuartosSub      = custom_fields.box_quartos_sub || custom_fields.box_quartos?.split('\n').slice(1).join('\n') || 'COM SUÍTE\nE VARANDA';
            const atoLabel           = custom_fields.ato_label || 'ATO DE';
            const atoValor           = custom_fields.ato_valor || 'R$500';
            const parcelasLabel      = custom_fields.parcelas_label || 'PARCELAS A PARTIR DE';
            const parcelasValor      = custom_fields.parcelas_valor || 'R$1.500';
            const praiaTempo         = custom_fields.praia_tempo || custom_fields.praia_texto?.split('\n')[0] || '10 MINUTOS';
            const praiaLocal         = custom_fields.praia_local || custom_fields.praia_texto?.split('\n').slice(1).join('\n') || 'DA PRAIA DE ICARAÍ';
            const barcasTexto        = custom_fields.barcas_texto || 'PRÓXIMO\nÀS BARCAS';
            const seloTexto          = custom_fields.selo_texto || 'CENTRO\nDE TUDO,\nPERTO DE VOCÊ.';
            const rodapeItem1        = custom_fields.rodape_item1 || 'NO CORAÇÃO\nDE NITERÓI';
            const rodapeItem2        = custom_fields.rodape_item2 || 'PERTO DE TUDO:\nCOMÉRCIO, SERVIÇOS\nE MOBILIDADE';
            const rodapeItem3        = custom_fields.rodape_item3 || 'SEGURANÇA, CONFORTO\nE LAZER COMPLETO';

            let bp = '#132A47'; // brand-primary — azul-marinho
            let ba = '#C9A227'; // brand-accent  — dourado
            let tl = '#FFFFFF'; // brand-text-light — branco

            const brandPrimary = localStorage.getItem('imob_brand_color_primary');
            const brandSecondary = localStorage.getItem('imob_brand_color_secondary');
            const brandTertiary = localStorage.getItem('imob_brand_color_tertiary');

            const activeColors = [];
            if (brandPrimary) activeColors.push({ hex: brandPrimary, lum: getLuminance(brandPrimary) });
            if (brandSecondary) activeColors.push({ hex: brandSecondary, lum: getLuminance(brandSecondary) });
            if (brandTertiary) activeColors.push({ hex: brandTertiary, lum: getLuminance(brandTertiary) });

            if (activeColors.length === 1) {
                const col = activeColors[0];
                if (col.lum < 120) { bp = col.hex; } else { ba = col.hex; }
            } else if (activeColors.length === 2) {
                activeColors.sort((a, b) => a.lum - b.lum);
                bp = activeColors[0].hex;
                ba = activeColors[1].hex;
                if (activeColors[1].lum > 180) { tl = activeColors[1].hex; }
            } else if (activeColors.length >= 3) {
                activeColors.sort((a, b) => a.lum - b.lum);
                bp = activeColors[0].hex;
                ba = activeColors[1].hex;
                tl = activeColors[2].hex;
            }

            const isStory = selectedFormat === 'story';
            const F_width = 1080;
            const F_height = isStory ? 1920 : 1080;

            function addNiteroiLayer(name, type, content, style, topPx, leftPx, widthPx, heightPx) {
                let cssText = '';
                const styleObj = {
                    ...style,
                    position: 'absolute',
                    width: `${widthPx}px`,
                    height: `${heightPx}px`,
                };
                for (const [k, v] of Object.entries(styleObj)) {
                    const kebabKey = k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
                    cssText += `${kebabKey}:${v}; `;
                }
                addLayer(name, type, content, cssText, `${topPx}px`, `${leftPx}px`, 'NONE', `${widthPx}px`, `${heightPx}px`);
            }

            // ════════ CLUSTER SUPERIOR (TOP) ════════

            // L01 — Fundo do pill "LANÇAMENTO"
            addNiteroiLayer('L01_pill_lancamento_bg', 'html',
                `<div style="width:100%;height:100%;background:${ba};border-radius:10px;"></div>`,
                {}, isStory ? 90 : 55, 36, 210, 48
            );

            // L02 — Texto "LANÇAMENTO"
            addNiteroiLayer('L02_texto_lancamento', 'text', badgeLancamento,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '22px', color: bp, letterSpacing: '1.5px', textAlign: 'left' },
                isStory ? 103 : 68, 58, 180, 26
            );

            // L03 — Título "CENTRO" (branco)
            addNiteroiLayer('L03_titulo_centro', 'text', tituloL1,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '92px', color: tl, lineHeight: 1, textAlign: 'left' },
                isStory ? 150 : 110, 36, 460, 92
            );

            // L04 — Título "NITERÓI" (dourado)
            addNiteroiLayer('L04_titulo_niteroi', 'text', tituloL2,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '92px', color: ba, lineHeight: 1, textAlign: 'left' },
                isStory ? 240 : 200, 36, 500, 92
            );

            // L05 — Tagline linha 1 "VIVA O MELHOR DA CIDADE"
            addNiteroiLayer('L05_tagline_linha1', 'text', taglineL1,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '27px', color: tl, textAlign: 'left' },
                isStory ? 385 : 345, 36, 420, 32
            );

            // L06 — Tagline linha 2 "COM VISTA."
            addNiteroiLayer('L06_tagline_linha2', 'text', taglineL2,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '27px', color: ba, textAlign: 'left' },
                isStory ? 420 : 380, 36, 260, 32
            );

            // L07 — Fundo do box "2 QUARTOS COM SUÍTE E VARANDA"
            addNiteroiLayer('L07_box_quartos_bg', 'html',
                `<div style="width:100%;height:100%;background:${bp};border-radius:16px;opacity:0.95;"></div>`,
                {}, isStory ? 480 : 440, 32, 420, 132
            );

            // L08a — Camada separada para "2 QUARTOS" (Destaque)
            addNiteroiLayer('L08a_texto_quartos_destaque', 'text', boxQuartosDestaque,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '26px', color: tl, letterSpacing: '0.5px', textAlign: 'left' },
                isStory ? 498 : 458, 52, 280, 30
            );

            // L08b — Camada separada para "COM SUÍTE E VARANDA"
            addNiteroiLayer('L08b_texto_quartos_sub', 'text', boxQuartosSub,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '20px', color: tl, lineHeight: 1.25, textAlign: 'left' },
                isStory ? 532 : 492, 52, 280, 55
            );

            // L09 — Ícone varanda
            addNiteroiLayer('L09_icone_varanda', 'html',
                `<i class="fa-solid fa-building" style="font-size:64px;color:${tl};"></i>`,
                {}, isStory ? 500 : 460, 345, 95, 95
            );

            // ════════ CLUSTER INFERIOR (BOTTOM) ════════

            // L10 — Fundo pill "ATO DE / R$500"
            addNiteroiLayer('L10_pill_ato_de_bg', 'html',
                `<div style="width:100%;height:100%;background:${bp};border-radius:50px;"></div>`,
                {}, isStory ? 1390 : 575, 32, 420, 100
            );

            // L11 — Ícone caneta/documento
            addNiteroiLayer('L11_icone_ato_de', 'html',
                `<i class="fa-solid fa-pen-to-square" style="font-size:32px;color:${tl};"></i>`,
                {}, isStory ? 1413 : 598, 52, 54, 54
            );

            // L12 — Label "ATO DE"
            addNiteroiLayer('L12_texto_ato_de_label', 'text', atoLabel,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '18px', color: tl, textAlign: 'left' },
                isStory ? 1403 : 588, 122, 200, 24
            );

            // L13 — Valor "R$500"
            addNiteroiLayer('L13_texto_ato_de_valor', 'text', atoValor,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '36px', color: ba, textAlign: 'left' },
                isStory ? 1437 : 622, 122, 220, 42
            );

            // L14 — Fundo pill "PARCELAS A PARTIR DE / R$1.500"
            addNiteroiLayer('L14_pill_parcelas_bg', 'html',
                `<div style="width:100%;height:100%;background:${bp};border-radius:50px;"></div>`,
                {}, isStory ? 1515 : 685, 32, 420, 100
            );

            // L15 — Ícone relógio
            addNiteroiLayer('L15_icone_parcelas', 'html',
                `<i class="fa-solid fa-clock" style="font-size:32px;color:${tl};"></i>`,
                {}, isStory ? 1538 : 708, 52, 54, 54
            );

            // L16 — Label "PARCELAS A PARTIR DE"
            addNiteroiLayer('L16_texto_parcelas_label', 'text', parcelasLabel,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '16px', color: tl, textAlign: 'left' },
                isStory ? 1528 : 698, 122, 260, 22
            );

            // L17 — Valor "R$1.500"
            addNiteroiLayer('L17_texto_parcelas_valor', 'text', parcelasValor,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '36px', color: ba, textAlign: 'left' },
                isStory ? 1562 : 732, 122, 260, 42
            );

            // L18 — Fundo da barra "10 MINUTOS.../PRÓXIMO ÀS BARCAS"
            addNiteroiLayer('L18_barra_localizacao_bg', 'html',
                `<div style="width:100%;height:100%;background:${bp};border-radius:16px;"></div>`,
                {}, isStory ? 1640 : 800, 32, 900, 100
            );

            // L19 — Ícone carro
            addNiteroiLayer('L19_icone_carro', 'html',
                `<i class="fa-solid fa-car" style="font-size:30px;color:${tl};"></i>`,
                {}, isStory ? 1665 : 825, 52, 50, 50
            );

            // L20a — Camada separada para "10 MINUTOS" (Tempo)
            addNiteroiLayer('L20a_texto_praia_tempo', 'text', praiaTempo,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '19px', color: tl, textAlign: 'left' },
                isStory ? 1656 : 816, 115, 300, 24
            );

            // L20b — Camada separada para "DA PRAIA DE ICARAÍ" (Local)
            addNiteroiLayer('L20b_texto_praia_local', 'text', praiaLocal,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '16px', color: tl, lineHeight: 1.2, textAlign: 'left' },
                isStory ? 1682 : 842, 115, 300, 40
            );

            // L20_divisor — Barra separadora vertical entre o Carro e o Navio
            addNiteroiLayer('L20_divisor_carro_navio', 'html',
                `<div style="width:2px;height:54px;background:${tl};opacity:0.4;border-radius:1px;"></div>`,
                {}, isStory ? 1663 : 823, 432, 2, 54
            );

            // L21 — Ícone barco
            addNiteroiLayer('L21_icone_barco', 'html',
                `<i class="fa-solid fa-ship" style="font-size:30px;color:${tl};"></i>`,
                {}, isStory ? 1665 : 825, 450, 50, 50
            );

            // L22 — Texto "PRÓXIMO ÀS BARCAS"
            addNiteroiLayer('L22_texto_barcas', 'text', barcasTexto,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '18px', color: ba, lineHeight: 1.25, textAlign: 'left' },
                isStory ? 1668 : 828, 515, 220, 44
            );

            // L23 — Selo circular (fundo + borda)
            addNiteroiLayer('L23_selo_circular_bg', 'html',
                `<div style="width:100%;height:100%;background:${bp};border-radius:50%;border:4px solid ${tl};"></div>`,
                {}, isStory ? 1630 : 790, 915, 130, 130
            );

            // L24 — Ícone dentro do selo
            addNiteroiLayer('L24_selo_icone', 'html',
                `<i class="fa-solid fa-city" style="font-size:26px;color:${tl};"></i>`,
                {}, isStory ? 1640 : 800, 955, 50, 50
            );

            // L25 — Texto do selo "CENTRO DE TUDO, PERTO DE VOCÊ."
            addNiteroiLayer('L25_selo_texto', 'text', seloTexto,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '13px', color: tl, lineHeight: 1.25, textAlign: 'center' },
                isStory ? 1680 : 840, 925, 110, 70
            );

            // L26 — Barra de rodapé full-width (Dourado com degradê branco)
            addNiteroiLayer('L26_rodape_bg', 'html',
                `<div style="width:100%;height:100%;background:linear-gradient(90deg, ${ba} 0%, #F5E5C0 25%, #FFFFFF 50%, #F5E5C0 75%, ${ba} 100%);"></div>`,
                {}, isStory ? 1802 : 962, 0, 1080, 118
            );

            // L27 — 3 Diferenciais de Rodapé (Ícones e textos em azul-marinho para contraste sobre o fundo dourado/branco)
            const itensRodape = [
                { icone: 'fa-solid fa-location-dot', texto: rodapeItem1, left: 45, textoLeft: 105, textoWidth: 210, linhas: 2 },
                { icone: 'fa-solid fa-bag-shopping', texto: rodapeItem2, left: 395, textoLeft: 455, textoWidth: 260, linhas: 3 },
                { icone: 'fa-solid fa-shield-halved', texto: rodapeItem3, left: 745, textoLeft: 805, textoWidth: 260, linhas: 2 },
            ];

            // Divisores verticais entre os itens do rodapé
            addNiteroiLayer('L27_divisor_1', 'html',
                `<div style="width:2px;height:54px;background:${bp};opacity:0.35;"></div>`,
                {}, isStory ? 1834 : 994, 360, 2, 54
            );
            addNiteroiLayer('L27_divisor_2', 'html',
                `<div style="width:2px;height:54px;background:${bp};opacity:0.35;"></div>`,
                {}, isStory ? 1834 : 994, 710, 2, 54
            );

            itensRodape.forEach((item, i) => {
                addNiteroiLayer(
                    `L27_${i}_rodape_icone`, 'html',
                    `<i class="${item.icone}" style="font-size:26px;color:${bp};"></i>`,
                    {}, isStory ? 1837 : 997, item.left, 54, 54
                );
                addNiteroiLayer(
                    `L27_${i}_rodape_texto`, 'text', item.texto,
                    { fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: item.linhas === 2 ? '17px' : '15px', color: bp, lineHeight: 1.3, textAlign: 'left' },
                    isStory ? 1834 : 994, item.textoLeft, item.textoWidth, item.linhas * 22
                );
            });
        } else if (selectedTemplateId === 'ver-klabin') {
            // ══════════════════════════════════════════════════════════════════════
            // VER KLABIN — MCMV (Engenharia Reversa 27 Layers - 1:1 + 9:16 com Safe Zone)
            // ══════════════════════════════════════════════════════════════════════
            const tagTopoL1     = custom_fields.tag_topo_l1 || 'BREVE LANÇAMENTO >>>>';
            const tagTopoL2     = custom_fields.tag_topo_l2 || 'A 600M DA ESTAÇÃO SANTOS-IMIGRANTES';
            const headlineL1    = custom_fields.headline_l1 || 'A CHÁCARA\nKLABIN AGORA';
            const headlineL2    = custom_fields.headline_l2 || 'É PARA VOCÊ.';
            const watermark     = custom_fields.watermark || 'IMAGEM ILUSTRATIVA DA FACHADA';
            const taglineText   = custom_fields.tagline || 'VISTA • EXCLUSIVIDADE • RITMO';
            const dormsNum1     = custom_fields.dorms_num_1 || '1';
            const dormsNum2     = custom_fields.dorms_num_2 || '2';
            const dormsLabel    = custom_fields.dorms_label || 'DORMS.';
            const opcaoTerraco  = custom_fields.opcao_terraco || 'COM OPÇÃO DE TERRAÇO';
            const lazerCompleto = custom_fields.lazer_completo || 'LAZER COMPLETO';
            const ctaTexto      = custom_fields.cta_texto || 'CLIQUE E SAIBA MAIS';
            const enderecoTexto = custom_fields.endereco_texto || 'RUA SANTA CRUZ, 1248  •  CHÁCARA KLABIN';
            const logoLd        = custom_fields.logo_ld || 'LD inc.';
            const logoSae       = custom_fields.logo_sae || 'SAE';
            const logoDrive     = custom_fields.logo_drive || 'Drive';
            const textoHis      = custom_fields.texto_his || 'EMPREENDIMENTO COM UNIDADES DE\nHABITAÇÃO DE INTERESSE SOCIAL';

            let bp = '#181818'; // brand-primary
            let ba = '#D6E24B'; // brand-accent
            let tl = '#FFFFFF'; // brand-text-light

            const brandPrimary = localStorage.getItem('imob_brand_color_primary');
            const brandSecondary = localStorage.getItem('imob_brand_color_secondary');
            if (brandPrimary) bp = brandPrimary;
            if (brandSecondary) ba = brandSecondary;

            const format = selectedFormat === 'story' ? '9:16' : '1:1';
            const FORMATS = {
              '1:1':  { width: 1080, height: 1080, safeTop: 60,  safeBottom: 60  },
              '9:16': { width: 1080, height: 1920, safeTop: 250, safeBottom: 260 },
            };

            function resolvePositionLocal(cluster, edgeOffset, heightVal, ignoreSafeZone = false) {
              const fmt = FORMATS[format];
              let top;
              if (cluster === 'TOP') {
                top = edgeOffset;
                if (!ignoreSafeZone && top < fmt.safeTop) {
                  top = fmt.safeTop;
                }
              } else {
                top = fmt.height - edgeOffset - heightVal;
                const limit = fmt.height - fmt.safeBottom - heightVal;
                if (!ignoreSafeZone && top > limit) {
                  top = limit;
                }
              }
              return top;
            }

            function addVerKlabinLayer(name, type, content, style, edgeTop, left, cluster, width, height, ignoreSafeZone = false) {
                const top = resolvePositionLocal(cluster, edgeTop, height, ignoreSafeZone);
                let cssText = '';
                const styleObj = {
                    ...style,
                    position: 'absolute',
                    width: `${width}px`,
                    height: `${height}px`,
                };
                for (const [k, v] of Object.entries(styleObj)) {
                    const kebabKey = k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
                    cssText += `${kebabKey}:${v}; `;
                }
                addLayer(name, type, content, cssText, `${top}px`, `${left}px`, cluster, `${width}px`, `${height}px`);
            }

            // ══════════════ CLUSTER SUPERIOR (TOP) ══════════════

            // L01/L02 — barra "BREVE LANÇAMENTO >>>>" (fundo + texto)
            addVerKlabinLayer('L01_BG_BreveLancamento', 'html', '',
                { background: ba },
                0, 0, 'TOP', 300, 48, true);
            addVerKlabinLayer('L02_Texto_BreveLancamento', 'text', tagTopoL1,
                { display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '19px', color: bp, letterSpacing: '0.5px' },
                0, 0, 'TOP', 300, 48, true);

            // L03/L04 — barra "A 600M DA ESTAÇÃO SANTOS-IMIGRANTES" (fundo + texto)
            addVerKlabinLayer('L03_BG_Estacao', 'html', '',
                { background: bp },
                0, 300, 'TOP', 780, 48, true);
            addVerKlabinLayer('L04_Texto_Estacao', 'text', tagTopoL2,
                { display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '17px', color: tl, letterSpacing: '0.3px' },
                0, 300, 'TOP', 780, 48, true);

            // L05 — logo "Minha Casa Minha Vida"
            addVerKlabinLayer('L05_Logo_MinhaCasaMinhaVida', 'html',
                `<div style="display:flex;flex-direction:column;align-items:flex-start;gap:2px;">
                   <i class="fa-solid fa-house-chimney-window" style="font-size:26px;color:${ba};"></i>
                   <span style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:13px;color:${bp};line-height:1.15;">Minha Casa<br/>Minha Vida</span>
                 </div>`,
                {}, 300, 860, 'TOP', 190, 90);

            // L06/L07 — badge circular "HIS" (fundo + texto)
            addVerKlabinLayer('L06_BG_BadgeHIS', 'html', '',
                { background: ba, borderRadius: '50%', border: `2px solid ${bp}` },
                420, 860, 'TOP', 70, 70);
            addVerKlabinLayer('L07_Texto_BadgeHIS', 'text', 'HIS',
                { display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '16px', color: bp },
                420, 860, 'TOP', 70, 70);
            // L08/L09 — badge circular "R2V" (fundo + texto)
            addVerKlabinLayer('L08_BG_BadgeR2V', 'html', '',
                { background: ba, borderRadius: '50%', border: `2px solid ${bp}` },
                420, 950, 'TOP', 70, 70);
            addVerKlabinLayer('L09_Texto_BadgeR2V', 'text', 'R2V',
                { display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '16px', color: bp },
                420, 950, 'TOP', 70, 70);

            // L10 — painel diagonal escuro atrás do headline
            addVerKlabinLayer('L10_BG_PainelDiagonal', 'html', '',
                { background: bp, opacity: 0.92, clipPath: 'polygon(18% 0%, 100% 0%, 100% 100%, 0% 100%)' },
                380, 480, 'TOP', 600, 420, true);

            // L11 — headline linhas 1-2
            addVerKlabinLayer('L11_Texto_HeadlineBranco', 'text', headlineL1,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '50px', lineHeight: '1.05', color: tl, textAlign: 'left', whiteSpace: 'pre-line' },
                560, 560, 'TOP', 470, 140);

            // L12 — headline linha 3 "É PARA VOCÊ."
            addVerKlabinLayer('L12_Texto_HeadlineAccent', 'text', headlineL2,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '50px', lineHeight: '1.05', color: ba, textAlign: 'left' },
                700, 560, 'TOP', 470, 60);

            // L13 — selo/legenda vertical "IMAGEM ILUSTRATIVA DA FACHADA"
            addVerKlabinLayer('L13_Texto_Watermark', 'text', watermark,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: '9px', color: tl, opacity: 0.5, letterSpacing: '0.5px', transform: 'rotate(-90deg)', transformOrigin: 'left top', whiteSpace: 'nowrap' },
                400, 6, 'TOP', 300, 14);

            // ══════════════ CLUSTER INFERIOR (BOTTOM) ══════════════

            // L14 — logotipo "VER KLABIN"
            addVerKlabinLayer('L14_Logo_VerKlabin', 'html',
                `<div style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:32px;line-height:0.95;letter-spacing:1px;color:${tl};">
                   VER<br/>KLABIN
                 </div>`,
                {}, 300, 700, 'BOTTOM', 280, 70);

            // L15 — tagline "VISTA • EXCLUSIVIDADE • RITMO"
            addVerKlabinLayer('L15_Texto_Tagline', 'text', taglineText,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: '10px', color: tl, letterSpacing: '2px' },
                280, 700, 'BOTTOM', 280, 18);

            // L16 — "1 e 2"
            addVerKlabinLayer('L16_Texto_1e2', 'html',
                `<span style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:84px;color:${ba};">${escapeHTML(dormsNum1)}</span>
                 <span style="font-family:'Montserrat',sans-serif;font-weight:600;font-size:32px;color:${tl};margin:0 4px;"> e </span>
                 <span style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:84px;color:${ba};">${escapeHTML(dormsNum2)}</span>`,
                { display: 'flex', alignItems: 'center', lineHeight: '1' },
                265, 30, 'BOTTOM', 210, 90);

            // L17 — "DORMS."
            addVerKlabinLayer('L17_Texto_Dorms', 'text', dormsLabel,
                { display: 'flex', alignItems: 'center', fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '52px', color: tl },
                265, 250, 'BOTTOM', 220, 70);

            // L18 — "COM OPÇÃO DE TERRAÇO"
            addVerKlabinLayer('L18_Texto_ComOpcaoTerraco', 'text', opcaoTerraco,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '20px', color: tl },
                235, 30, 'BOTTOM', 340, 24);

            // L19 — "LAZER COMPLETO"
            addVerKlabinLayer('L19_Texto_LazerCompleto', 'text', lazerCompleto,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '22px', color: ba },
                205, 30, 'BOTTOM', 260, 26);

            // L20 — CTA "CLIQUE E SAIBA MAIS"
            addVerKlabinLayer('L20_Texto_CTA', 'text', ctaTexto,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '24px', color: ba, letterSpacing: '0.5px' },
                210, 690, 'BOTTOM', 300, 36);

            // L21/L22 — barra de endereço full-width
            addVerKlabinLayer('L21_BG_BarraEndereco', 'html', '',
                { background: ba },
                140, 0, 'BOTTOM', 1080, 60, true);
            addVerKlabinLayer('L22_Texto_Endereco', 'text', enderecoTexto,
                { display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '22px', color: bp },
                150, 40, 'BOTTOM', 1000, 30, true);

            // L23 — barra de rodapé preta full-width
            addVerKlabinLayer('L23_BG_RodapePreto', 'html', '',
                { background: bp },
                0, 0, 'BOTTOM', 1080, 140, true);

            // L24 — Incorporação LD inc.
            addVerKlabinLayer('L24_Logo_Incorporacao_LD', 'html',
                `<div style="display:flex;flex-direction:column;gap:4px;">
                   <span style="font-family:'Montserrat',sans-serif;font-weight:500;font-size:9px;color:${tl};opacity:0.8;">INCORPORAÇÃO</span>
                   <span style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:18px;color:${tl};">${escapeHTML(logoLd)}</span>
                 </div>`,
                {}, 40, 40, 'BOTTOM', 160, 70, true);

            // L25 — Incorp + Constr SAE
            addVerKlabinLayer('L25_Logo_IncorpConstrucao_SAE', 'html',
                `<div style="display:flex;flex-direction:column;gap:4px;">
                   <span style="font-family:'Montserrat',sans-serif;font-weight:500;font-size:9px;color:${tl};opacity:0.8;">INCORPORAÇÃO E CONSTRUÇÃO</span>
                   <span style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:18px;color:${tl};">${escapeHTML(logoSae)}</span>
                 </div>`,
                {}, 40, 230, 'BOTTOM', 200, 70, true);

            // L26 — Vendas Drive
            addVerKlabinLayer('L26_Logo_Vendas_Drive', 'html',
                `<div style="display:flex;flex-direction:column;gap:4px;">
                   <span style="font-family:'Montserrat',sans-serif;font-weight:500;font-size:9px;color:${tl};opacity:0.8;">VENDAS</span>
                   <span style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:18px;color:${tl};">${escapeHTML(logoDrive)}</span>
                 </div>`,
                {}, 40, 460, 'BOTTOM', 160, 70, true);

            // L27 — Selo HIS + Prefeitura SP
            addVerKlabinLayer('L27_Selo_HIS_PrefeituraSP', 'html',
                `<div style="display:flex;align-items:center;gap:8px;">
                   <i class="fa-solid fa-landmark" style="font-size:22px;color:${tl};"></i>
                   <span style="font-family:'Montserrat',sans-serif;font-weight:600;font-size:10px;color:${tl};line-height:1.3;">${escapeHTML(textoHis).replace(/\n/g, '<br/>')}</span>
                 </div>`,
                {}, 35, 680, 'BOTTOM', 360, 80, true);
        } else if (selectedTemplateId === 'chacara-santo-antonio') {
            // ══════════════════════════════════════════════════════════════════════
            // APARTAMENTOS CHÁCARA SANTO ANTÔNIO — MCMV (Engenharia Reversa 23 Layers)
            // ══════════════════════════════════════════════════════════════════════
            const tituloL1      = custom_fields.titulo_l1 || 'APARTAMENTOS NA';
            const tituloL2      = custom_fields.titulo_l2 || 'CHÁCARA SANTO';
            const tituloL3      = custom_fields.titulo_l3 || 'ANTÔNIO - SP';
            const seloL1        = custom_fields.selo_l1 || 'Minha Casa';
            const seloL2        = custom_fields.selo_l2 || 'Minha Vida';
            const painelTitulo  = custom_fields.painel_titulo || 'FLUXO DE PAGAMENTO';
            const valorEntrada  = custom_fields.valor_entrada || 'R$799,00';
            const valorMensais  = custom_fields.valor_mensais || 'R$899,00';
            const valorAnuais   = custom_fields.valor_anuais || 'R$1.999,00';
            const valorChaves   = custom_fields.valor_chaves || 'R$2.500,00';
            const botaoTexto    = custom_fields.botao_texto || 'Saiba mais';

            let bp = '#132a5e'; // brand-primary (azul-marinho)
            let ba = '#d4a017'; // brand-accent (dourado/mostarda)
            let tl = '#ffffff'; // brand-text-light (branco)

            const brandPrimary = localStorage.getItem('imob_brand_color_primary');
            const brandSecondary = localStorage.getItem('imob_brand_color_secondary');
            if (brandPrimary) bp = brandPrimary;
            if (brandSecondary) ba = brandSecondary;

            const isStory = selectedFormat === 'story';

            function addChacaraLayer(name, type, content, style, top, left, width, height) {
                let cssText = '';
                const styleObj = {
                    ...style,
                    position: 'absolute',
                    width: `${width}px`,
                    height: `${height}px`,
                };
                for (const [k, v] of Object.entries(styleObj)) {
                    const kebabKey = k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
                    cssText += `${kebabKey}:${v}; `;
                }
                addLayer(name, type, content, cssText, `${top}px`, `${left}px`, 'NONE', `${width}px`, `${height}px`);
            }

            // ══════════════ CLUSTER SUPERIOR (TOP) ══════════════
            const topBannerTop = isStory ? 250 : 40;

            // L01 — Fundo da faixa superior (pill azul-marinho com ponta ou cantos arredondados)
            addChacaraLayer(
                'L01_bannerBg', 'html',
                `<div style="width:100%;height:100%;background:${bp};border-radius:24px 0 24px 24px;border:2px solid ${ba};box-shadow:0 6px 18px rgba(0,0,0,0.25);box-sizing:border-box;"></div>`,
                { borderRadius: '24px 0 24px 24px', background: bp },
                topBannerTop, 40, 1000, 200
            );

            // L02 — Caixa do ícone de prédio (dentro da faixa)
            addChacaraLayer(
                'L02_bannerIconBox', 'html',
                `<div style="width:100%;height:100%;background:rgba(255,255,255,0.12);border-radius:50%;border:2px solid ${tl};display:flex;align-items:center;justify-content:center;box-sizing:border-box;"><i class="fa-solid fa-building" style="font-size:44px;color:${tl};"></i></div>`,
                { borderRadius: '50%', iconColor: tl },
                topBannerTop + 35, 65, 130, 130
            );

            // L03 — Título do empreendimento (3 linhas)
            const fullTitle = `${tituloL1}\n${tituloL2}\n${tituloL3}`;
            addChacaraLayer(
                'L03_bannerTitle', 'text', fullTitle,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '38px', color: tl, textAlign: 'left', lineHeight: '1.15', letterSpacing: '0px' },
                topBannerTop + 25, 220, 800, 150
            );

            // ══════════════ CLUSTER INFERIOR (BOTTOM) ══════════════
            const seloTop = isStory ? 960 : 450;
            const painelTop = isStory ? 1050 : 540;
            const painelTitleTop = isStory ? 1020 : 515;
            const dividerTop = isStory ? 1095 : 585;
            const rowBaseTop = isStory ? 1115 : 605;
            const rowStep = isStory ? 80 : 65;
            const btnTop = isStory ? 1580 : 940;

            // L04 — Fundo do selo "Minha Casa Minha Vida" (retângulo branco arredondado)
            addChacaraLayer(
                'L04_logoCircleBg', 'html',
                `<div style="width:100%;height:100%;background:${tl};border-radius:18px;border:2px solid ${ba};box-shadow:0 6px 18px rgba(0,0,0,0.18);box-sizing:border-box;"></div>`,
                { borderRadius: '18px', background: tl },
                seloTop, 290, 500, 110
            );

            // L05 — Conteúdo do selo (ícone casa + textos "Minha Casa" e "Minha Vida")
            addChacaraLayer(
                'L05_logoContent', 'html',
                `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:14px;">
                    <i class="fa-solid fa-house-chimney" style="font-size:42px;color:#2f6fb3;"></i>
                    <div style="display:flex;flex-direction:column;line-height:1.15;">
                        <span style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:26px;color:${bp};">${escapeHTML(seloL1)}</span>
                        <span style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:26px;color:${bp};">${escapeHTML(seloL2)}</span>
                    </div>
                </div>`,
                {},
                seloTop, 290, 500, 110
            );

            // L06 — Fundo do painel branco "Fluxo de pagamento"
            const painelHeight = isStory ? 440 : 370;
            addChacaraLayer(
                'L06_panelBg', 'html',
                `<div style="width:100%;height:100%;background:${tl};border-radius:28px;border:2px solid ${ba};box-shadow:0 6px 20px rgba(0,0,0,0.12);box-sizing:border-box;"></div>`,
                { borderRadius: '28px', background: tl },
                painelTop, 60, 960, painelHeight
            );

            // L07 — Título "FLUXO DE PAGAMENTO" (header pill azul)
            addChacaraLayer(
                'L07_panelTitle', 'html',
                `<div style="width:100%;height:100%;background:${bp};border-radius:30px;display:flex;align-items:center;justify-content:center;"><span style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:32px;color:${tl};letter-spacing:1px;text-transform:uppercase;">${escapeHTML(painelTitulo)}</span></div>`,
                {},
                painelTitleTop, 140, 800, 60
            );

            // L08 — Linha divisória fina abaixo do título
            addChacaraLayer(
                'L08_divider', 'html',
                `<div style="width:100%;height:2px;background:#d9d9d9;"></div>`,
                { background: '#d9d9d9' },
                dividerTop, 90, 900, 2
            );

            // L09–L20 — Lista de 4 itens (ícone circular + label + valor)
            const features = [
                { icon: 'fa-solid fa-wallet',        label: 'ENTRADA:', value: valorEntrada },
                { icon: 'fa-solid fa-calendar-days', label: 'MENSAIS:', value: valorMensais },
                { icon: 'fa-solid fa-star',          label: 'ANUAIS:',  value: valorAnuais },
                { icon: 'fa-solid fa-key',           label: 'CHAVES:',  value: valorChaves },
            ];

            features.forEach((item, i) => {
                const idx = String(i + 1).padStart(2, '0');
                const rowTop = rowBaseTop + (i * rowStep);

                // Ícone circular (fundo azul-marinho, ícone branco)
                addChacaraLayer(
                    `L09_${idx}_rowIcon`, 'html',
                    `<div style="width:100%;height:100%;background:${bp};border-radius:50%;display:flex;align-items:center;justify-content:center;"><i class="${item.icon}" style="font-size:26px;color:${tl};"></i></div>`,
                    { borderRadius: '50%', background: bp },
                    rowTop, 100, 50, 50
                );

                // Label (texto literal, alinhado à esquerda)
                addChacaraLayer(
                    `L09_${idx}_rowLabel`, 'text', item.label,
                    { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '26px', color: bp, textAlign: 'left' },
                    rowTop + 8, 170, 250, 36
                );

                // Valor (texto literal, alinhado à direita)
                addChacaraLayer(
                    `L09_${idx}_rowValue`, 'text', item.value,
                    { fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '26px', color: bp, textAlign: 'right' },
                    rowTop + 8, 560, 420, 36
                );

                // Linha divisória entre itens (exceto no último)
                if (i < 3) {
                    addChacaraLayer(
                        `L09_${idx}_rowDivider`, 'html',
                        `<div style="width:100%;height:1px;background:#e5e5e5;"></div>`,
                        {},
                        rowTop + rowStep - 8, 170, 810, 1
                    );
                }
            });

            // L21 — Fundo do botão "Saiba mais" (pílula branca com borda azul)
            addChacaraLayer(
                'L21_btnBg', 'html',
                `<div style="width:100%;height:100%;background:${tl};border:3px solid ${bp};border-radius:45px;box-shadow:0 4px 12px rgba(0,0,0,0.1);box-sizing:border-box;"></div>`,
                { borderRadius: '45px', background: tl, border: `3px solid ${bp}` },
                btnTop, 100, 880, 80
            );

            // L22 — Ícone de seta do botão
            addChacaraLayer(
                'L22_btnIcon', 'html',
                `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;border:2px solid ${bp};border-radius:50%;"><i class="fa-solid fa-arrow-right" style="font-size:24px;color:${bp};"></i></div>`,
                { iconColor: bp },
                btnTop + 12, 130, 56, 56
            );

            // L23 — Texto "Saiba mais"
            addChacaraLayer(
                'L23_btnText', 'text', botaoTexto,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '32px', color: bp, textAlign: 'center' },
                btnTop + 16, 200, 680, 48
            );
        } else if (selectedTemplateId === 'conceito-california') {
            // ══════════════════════════════════════════════════════════════════════
            // CONCEITO CALIFÓRNIA — MCMV (Engenharia Reversa com Efeito Neon)
            // ══════════════════════════════════════════════════════════════════════
            const logoMarca      = custom_fields.logo_marca || 'CONCEITO';
            const logoNome       = custom_fields.logo_nome || 'Califórnia';
            const entregaL1      = custom_fields.entrega_l1 || 'ENTREGA';
            const entregaL2      = custom_fields.entrega_l2 || 'INÍCIO DE';
            const entregaAno     = custom_fields.entrega_ano || '2027';
            const compreL1       = custom_fields.compre_l1 || 'COMPRE SEU';
            const compreL2       = custom_fields.compre_l2 || 'APARTAMENTO COM';
            const descontoLabel  = custom_fields.desconto_label || 'DESCONTO DE';
            const descontoValor  = custom_fields.desconto_valor || '70';
            const descontoSufixo = custom_fields.desconto_sufixo || 'MIL';
            const col1Label      = custom_fields.col1_label || 'ENTRADA\nPARCELADA\nEM ATÉ';
            const col1Valor      = custom_fields.col1_valor || '60x';
            const col2Label1     = custom_fields.col2_label1 || 'RENDA A PARTIR DE';
            const col2Valor      = custom_fields.col2_valor || 'R$ 5.500';
            const col2Label2     = custom_fields.col2_label2 || 'PODEM UNIR ATÉ\nTRÊS RENDAS';
            const col3Label      = custom_fields.col3_label || 'USE O SEU';
            const col3Valor      = custom_fields.col3_valor || 'FGTS';

            let bp  = '#3B0F54'; // brand-primary (roxo)
            let ba  = '#FFC61A'; // brand-accent (dourado/amarelo neon)
            let tl  = '#FFFFFF'; // brand-text-light (branco)
            let sec = '#8E1C6B'; // secundária (magenta/vinho)

            const brandPrimary = localStorage.getItem('imob_brand_color_primary');
            const brandSecondary = localStorage.getItem('imob_brand_color_secondary');
            if (brandPrimary) bp = brandPrimary;
            if (brandSecondary) ba = brandSecondary;

            const isStory = selectedFormat === 'story';

            function addCaliforniaLayer(name, type, content, style, top, left, width, height) {
                let cssText = '';
                const styleObj = {
                    ...style,
                    position: 'absolute',
                    width: `${width}px`,
                    height: `${height}px`,
                };
                for (const [k, v] of Object.entries(styleObj)) {
                    const kebabKey = k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
                    cssText += `${kebabKey}:${v}; `;
                }
                addLayer(name, type, content, cssText, `${top}px`, `${left}px`, 'NONE', `${width}px`, `${height}px`);
            }

            // ══════════════ CLUSTER SUPERIOR (TOP) ══════════════
            const topOffset = isStory ? 250 : 40;

            // L01 — Logo textual "CONCEITO"
            addCaliforniaLayer('L01_logo_conceito', 'text', logoMarca, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '22px', color: bp,
                letterSpacing: '2px', textAlign: 'left',
            }, topOffset, 80, 260, 28);

            // L02 — "Califórnia" (assinatura cursiva)
            addCaliforniaLayer('L02_logo_california', 'text', logoNome, {
                fontFamily: "'Kaushan Script', 'Dancing Script', 'Great Vibes', cursive", fontWeight: 400, fontSize: '52px', color: sec, textAlign: 'left',
            }, topOffset + 25, 78, 320, 70);

            // L03 — Badge circular do calendário (com glow neon)
            const badgeTop = isStory ? 380 : 170;
            addCaliforniaLayer('L03_badge_calendario', 'html',
                `<div style="width:100%;height:100%;background:${bp};border-radius:50%;border:2px solid ${ba};display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px 2px ${ba}, 0 0 24px 6px rgba(255,198,26,0.4);"><i class="fa-solid fa-calendar-days" style="color:${tl};font-size:36px;"></i></div>`,
                {}, badgeTop, 85, 90, 90);

            // L04/L05 — "ENTREGA INÍCIO DE"
            const entregaTop = isStory ? 485 : 275;
            const entregaTexto = `${entregaL1}\n${entregaL2}`;
            addCaliforniaLayer('L04_texto_entrega', 'text', entregaTexto, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '24px', color: tl, textAlign: 'left', lineHeight: '1.2', letterSpacing: '0.5px',
            }, entregaTop, 85, 220, 60);

            // L06 — "2027" (com glow neon)
            const anoTop = isStory ? 545 : 335;
            addCaliforniaLayer('L06_texto_2027', 'text', entregaAno, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: '78px', color: ba, textAlign: 'left',
                textShadow: `0 0 12px ${ba}, 0 0 28px rgba(255,198,26,0.6)`,
            }, anoTop, 80, 260, 90);

            // L07/L08 — "COMPRE SEU APARTAMENTO COM"
            const compreTop = isStory ? 980 : 440;
            const compreTexto = `${compreL1}\n${compreL2}`;
            addCaliforniaLayer('L07_texto_compre_seu', 'text', compreTexto, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '26px', color: tl, textAlign: 'right', lineHeight: '1.2',
            }, compreTop, 640, 400, 70);

            // L09 — Pill "DESCONTO DE"
            const pillTop = isStory ? 1055 : 515;
            addCaliforniaLayer('L09_pill_desconto_de', 'html',
                `<div style="width:100%;height:100%;background:${ba};border-radius:23px;display:flex;align-items:center;justify-content:center;"><span style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:22px;color:${bp};">${escapeHTML(descontoLabel)}</span></div>`,
                {}, pillTop, 730, 290, 48);

            // L10 — "70" (número gigante, com glow neon)
            const valorTop = isStory ? 1090 : 550;
            addCaliforniaLayer('L10_texto_70', 'text', descontoValor, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: '200px', color: ba, textAlign: 'right', letterSpacing: '-4px', lineHeight: '0.9',
                textShadow: `0 0 16px ${ba}, 0 0 40px rgba(255,198,26,0.7)`,
            }, valorTop, 640, 400, 200);

            // L11 — "MIL" (com glow neon)
            const milTop = isStory ? 1290 : 750;
            addCaliforniaLayer('L11_texto_mil', 'text', descontoSufixo, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: '110px', color: ba, textAlign: 'right', letterSpacing: '-2px', lineHeight: '0.9',
                textShadow: `0 0 16px ${ba}, 0 0 40px rgba(255,198,26,0.7)`,
            }, milTop, 640, 400, 110);

            // ══════════════ CLUSTER INFERIOR (BOTTOM) ══════════════

            // L12 — Barra full-width do rodapé
            const rodapeTop = isStory ? 1680 : 890;
            const rodapeHeight = isStory ? 240 : 190;
            addCaliforniaLayer('L12_barra_rodape', 'html', '', {
                background: `linear-gradient(90deg, ${bp} 0%, ${sec} 100%)`,
            }, rodapeTop, 0, 1080, rodapeHeight);

            // L13/L14 — Linhas divisórias verticais entre as 3 colunas
            const dividerTopCol = rodapeTop + 30;
            [360, 720].forEach((leftPos, i) => {
                addCaliforniaLayer(`L1${3 + i}_divisor_vertical`, 'html', '', {
                    background: `${tl}`, opacity: 0.35,
                }, dividerTopCol, leftPos, 2, 130);
            });

            // Coluna 1 (ENTRADA PARCELADA EM ATÉ 60x)
            const c1Top = rodapeTop + 25;
            addCaliforniaLayer('Footer_Col1_Icone', 'html',
                `<div style="width:100%;height:100%;background:${bp};border-radius:50%;border:2px solid ${ba};display:flex;align-items:center;justify-content:center;box-shadow:0 0 10px 2px ${ba}, 0 0 20px 5px rgba(255,198,26,0.4);"><i class="fa-solid fa-hand-holding-dollar" style="color:${tl};font-size:28px;"></i></div>`,
                {}, c1Top, 40, 70, 70);
            addCaliforniaLayer('Footer_Col1_Label', 'text', col1Label, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '18px', color: tl, textAlign: 'left', lineHeight: '1.2',
            }, c1Top, 125, 220, 60);
            addCaliforniaLayer('Footer_Col1_Valor', 'text', col1Valor, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '42px', color: ba, textAlign: 'left',
            }, c1Top + 65, 125, 220, 48);

            // Coluna 2 (RENDA A PARTIR DE R$ 5.500 PODEM UNIR ATÉ TRÊS RENDAS)
            const c2Top = rodapeTop + 25;
            addCaliforniaLayer('Footer_Col2_Icone', 'html',
                `<div style="width:100%;height:100%;background:${bp};border-radius:50%;border:2px solid ${ba};display:flex;align-items:center;justify-content:center;box-shadow:0 0 10px 2px ${ba}, 0 0 20px 5px rgba(255,198,26,0.4);"><i class="fa-solid fa-people-group" style="color:${tl};font-size:28px;"></i></div>`,
                {}, c2Top, 390, 70, 70);
            addCaliforniaLayer('Footer_Col2_Label1', 'text', col2Label1, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '16px', color: tl, textAlign: 'left',
            }, c2Top, 475, 230, 22);
            addCaliforniaLayer('Footer_Col2_Valor', 'text', col2Valor, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '34px', color: ba, textAlign: 'left',
            }, c2Top + 24, 475, 230, 40);
            addCaliforniaLayer('Footer_Col2_Label2', 'text', col2Label2, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: '14px', color: tl, textAlign: 'left', lineHeight: '1.2',
            }, c2Top + 68, 475, 230, 36);

            // Coluna 3 (USE O SEU FGTS)
            const c3Top = rodapeTop + 25;
            addCaliforniaLayer('Footer_Col3_Icone', 'html',
                `<div style="width:100%;height:100%;background:${bp};border-radius:50%;border:2px solid ${ba};display:flex;align-items:center;justify-content:center;box-shadow:0 0 10px 2px ${ba}, 0 0 20px 5px rgba(255,198,26,0.4);"><i class="fa-solid fa-house-chimney" style="color:${tl};font-size:28px;"></i></div>`,
                {}, c3Top, 750, 70, 70);
            addCaliforniaLayer('Footer_Col3_Label', 'text', col3Label, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '18px', color: tl, textAlign: 'left',
            }, c3Top + 10, 835, 220, 24);
            addCaliforniaLayer('Footer_Col3_Valor', 'text', col3Valor, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '40px', color: ba, textAlign: 'left',
            }, c3Top + 36, 835, 220, 44);
        } else if (selectedTemplateId === 'conexao-anhembi') {
            // ══════════════════════════════════════════════════════════════════════
            // CONEXÃO ANHEMBI — MCMV (Engenharia Reversa — Layers Atômicos)
            // Tokens de cor extraídos visualmente do template original
            // ══════════════════════════════════════════════════════════════════════
            const badgeLancamento = custom_fields.badge_lancamento || 'ANTECIPE-SE AO LANÇAMENTO';
            const logoCon         = custom_fields.logo_con         || 'CON';
            const logoXao         = custom_fields.logo_xao         || 'ÃO';
            const logoSub         = custom_fields.logo_sub         || 'ANHEMBI';
            const taglineL1       = custom_fields.tagline_l1       || 'A SUA CHANCE DE';
            const taglineL2       = custom_fields.tagline_l2       || 'MORAR AO LADO';
            const taglineL3       = custom_fields.tagline_l3       || 'DA ESTAÇÃO';
            const taglineBoldL1   = custom_fields.tagline_bold_l1  || 'PORTUGUESA -';
            const taglineBoldL2   = custom_fields.tagline_bold_l2  || 'TIETÊ CHEGOU';
            const dormsNum1       = custom_fields.dorms_num1       || '1';
            const dormsNum2       = custom_fields.dorms_num2       || '2';
            const pillVaranda     = custom_fields.pill_varanda     || 'VARANDA';
            const lazerDestaque   = custom_fields.lazer_destaque   || 'LAZER NO';
            const lazerLocal      = custom_fields.lazer_local      || 'ROOFTOP';
            const rodapeL1        = custom_fields.rodape_l1        || 'CAIXA';
            const rodapeL2        = custom_fields.rodape_l2        || 'MINHA CASA\nMINHA VIDA';
            const rodapeL3        = custom_fields.rodape_l3        || 'integra';

            // ── Tokens de cor ──
            let bp_ca  = '#0E1F3C'; // azul-marinho escuro
            let ba_ca  = '#F5A623'; // dourado/laranja
            let tl_ca  = '#FFFFFF'; // branco
            let sec_ca = '#7A2020'; // vermelho-vinho
            let ter_ca = '#1C6DD0'; // azul médio

            const brandPrimary   = localStorage.getItem('imob_brand_color_primary');
            const brandSecondary = localStorage.getItem('imob_brand_color_secondary');
            if (brandPrimary)   bp_ca = brandPrimary;
            if (brandSecondary) ba_ca = brandSecondary;

            const isStory_ca = selectedFormat === 'story';
            const topSafe_ca    = isStory_ca ? 250 : 60;
            const canvasH_ca    = isStory_ca ? 1920 : 1080;
            const bottomSafe_ca = isStory_ca ? 260  : 60;

            // Resolve posição com âncora TOP/BOTTOM + safe zone
            function resolvePos_ca(cluster, edgeOffset, height) {
                let top;
                if (cluster === 'TOP') {
                    top = edgeOffset;
                    if (top < topSafe_ca) top = topSafe_ca;
                } else {
                    top = canvasH_ca - edgeOffset - height;
                    if (edgeOffset !== 0) {
                        const maxTop = canvasH_ca - bottomSafe_ca - height;
                        if (top > maxTop) top = maxTop;
                    }
                }
                return top;
            }

            // Helper addLayer para esse template (coordenadas fixas de 1080px)
            function addAnhembiLayer(name, type, content, style, edgeOffset, left, cluster, width, height) {
                const top = resolvePos_ca(cluster, edgeOffset, height);
                let cssText = '';
                const styleObj = {
                    ...style,
                    position: 'absolute',
                    width: `${width}px`,
                    height: `${height}px`,
                };
                for (const [k, v] of Object.entries(styleObj)) {
                    const kebabKey = k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
                    cssText += `${kebabKey}:${v}; `;
                }
                addLayer(name, type, content, cssText, `${top}px`, `${left}px`, 'NONE', `${width}px`, `${height}px`);
            }

            // ═══════════════ CLUSTER SUPERIOR (TOP) ═══════════════

            // L01 — Badge "ANTECIPE-SE AO LANÇAMENTO"
            addAnhembiLayer('L01_BadgeLancamento', 'html',
                `<div style="background:${sec_ca};color:${tl_ca};padding:8px 16px;border-radius:20px;font-weight:700;font-size:20px;letter-spacing:0.5px;font-family:'Montserrat',sans-serif;white-space:nowrap;">${escapeHTML(badgeLancamento)}</div>`,
                {}, 55, 40, 'TOP', 420, 50);

            // L02 — Selo circular "COM UNIDADES R2V"
            addAnhembiLayer('L02_SeloR2V', 'html',
                `<div style="width:100%;height:100%;border-radius:50%;background:${ter_ca};color:${tl_ca};display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-weight:700;font-size:12px;text-align:center;line-height:1.2;">COM UNIDADES<br/><span style="font-size:26px;font-weight:900;">R2V</span></div>`,
                {}, 35, 800, 'TOP', 100, 100);

            // L03 — Logo MCMV pequeno
            addAnhembiLayer('L03_LogoMCMVpequeno', 'html',
                `<div style="width:100%;height:100%;background:${tl_ca};border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-weight:700;font-size:9px;color:${bp_ca};text-align:center;line-height:1.3;">CAIXA<br/>MINHA CASA<br/>MINHA VIDA</div>`,
                {}, 55, 920, 'TOP', 100, 70);

            // L04 — Logo "CONEXÃO ANHEMBI"
            addAnhembiLayer('L04_LogoConexaoAnhembi', 'html',
                `<div style="font-family:'Montserrat',sans-serif;font-weight:900;font-size:64px;line-height:1;color:${bp_ca};">${escapeHTML(logoCon)}<span style="color:${ba_ca};font-size:90px;">X</span>${escapeHTML(logoXao)}</div><div style="font-family:'Montserrat',sans-serif;font-weight:700;font-size:26px;letter-spacing:6px;color:${ter_ca};margin-top:4px;">${escapeHTML(logoSub)}</div>`,
                {}, 300, 45, 'TOP', 600, 130);

            // L05 — Tagline regular
            addAnhembiLayer('L05_TaglineRegular', 'text',
                `${taglineL1}\n${taglineL2}\n${taglineL3}`,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: '500', fontSize: '32px', lineHeight: '1.3', color: bp_ca, textTransform: 'uppercase', whiteSpace: 'pre-line' },
                460, 45, 'TOP', 520, 130);

            // L06 — Tagline bold
            addAnhembiLayer('L06_TaglineBold', 'text',
                `${taglineBoldL1}\n${taglineBoldL2}`,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: '800', fontSize: '36px', lineHeight: '1.2', color: bp_ca, textTransform: 'uppercase', whiteSpace: 'pre-line' },
                600, 45, 'TOP', 520, 100);

            // L07 — Numeral 1 (dourado)
            addAnhembiLayer('L07_Numeral1', 'text', dormsNum1,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: '900', fontSize: '130px', color: ba_ca, lineHeight: '1' },
                470, 620, 'TOP', 90, 120);

            // L08 — Conector "e" (branco)
            addAnhembiLayer('L08_Conector_e', 'text', 'e',
                { fontFamily: "'Montserrat', sans-serif", fontWeight: '700', fontSize: '60px', color: tl_ca, lineHeight: '1' },
                520, 720, 'TOP', 40, 70);

            // L09 — Numeral 2 (branco)
            addAnhembiLayer('L09_Numeral2', 'text', dormsNum2,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: '900', fontSize: '130px', color: tl_ca, lineHeight: '1' },
                470, 775, 'TOP', 110, 120);

            // L10 — "DORMS."
            addAnhembiLayer('L10_Dorms', 'text', 'DORMS.',
                { fontFamily: "'Montserrat', sans-serif", fontWeight: '800', fontSize: '46px', color: tl_ca, textTransform: 'uppercase' },
                650, 620, 'TOP', 300, 55);

            // L11 — "+OFFICE"
            addAnhembiLayer('L11_MaisOffice', 'text', '+OFFICE',
                { fontFamily: "'Montserrat', sans-serif", fontWeight: '500', fontSize: '34px', color: tl_ca, textTransform: 'uppercase' },
                715, 620, 'TOP', 220, 45);

            // L12 — Pill "VARANDA"
            addAnhembiLayer('L12_PillVaranda', 'html',
                `<div style="border:2px solid ${tl_ca};border-radius:20px;color:${tl_ca};font-family:'Montserrat',sans-serif;font-weight:600;font-size:22px;padding:6px 16px;display:inline-block;text-transform:uppercase;">${escapeHTML(pillVaranda)}</div>`,
                {}, 780, 620, 'TOP', 170, 46);

            // L13 — "LAZER NO" (dourado)
            addAnhembiLayer('L13_LazerNo', 'text', lazerDestaque,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: '700', fontSize: '32px', color: ba_ca, textTransform: 'uppercase' },
                855, 620, 'TOP', 220, 45);

            // L14 — "ROOFTOP" (dourado, bold, maior)
            addAnhembiLayer('L14_Rooftop', 'text', lazerLocal,
                { fontFamily: "'Montserrat', sans-serif", fontWeight: '900', fontSize: '46px', color: ba_ca, textTransform: 'uppercase' },
                905, 620, 'TOP', 260, 55);

            // ═══════════════ CLUSTER INFERIOR (BOTTOM) ═══════════════

            // L15 — Barra diagonal laranja
            addAnhembiLayer('L15_BarraDiagonalLaranja', 'html',
                `<div style="width:100%;height:100%;background:${ba_ca};clip-path:polygon(0 40%, 100% 0, 100% 100%, 0 100%);"></div>`,
                {}, 200, 0, 'BOTTOM', 1080, 150);

            // L16 — Barra branca do rodapé (full-bleed, offset 0 → toca a borda)
            addAnhembiLayer('L16_BarraRodapeBG', 'html',
                `<div style="width:100%;height:100%;background:${tl_ca};"></div>`,
                {}, 0, 0, 'BOTTOM', 1080, 190);

            // L17 — Logo CAIXA (rodapé)
            addAnhembiLayer('L17_LogoCaixa', 'html',
                `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-weight:700;font-size:20px;color:${bp_ca};text-align:center;">${escapeHTML(rodapeL1).replace(/\n/g, '<br/>')}</div>`,
                {}, 75, 90, 'BOTTOM', 150, 40);

            // L18 — Logo MCMV rodapé
            addAnhembiLayer('L18_LogoMCMVBar', 'html',
                `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-weight:700;font-size:18px;color:${bp_ca};text-align:center;line-height:1.3;">${escapeHTML(rodapeL2).replace(/\n/g, '<br/>')}</div>`,
                {}, 75, 430, 'BOTTOM', 220, 40);

            // L19 — Logo integra (rodapé)
            addAnhembiLayer('L19_LogoIntegra', 'html',
                `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-weight:700;font-size:22px;color:${bp_ca};text-align:center;font-style:italic;">${escapeHTML(rodapeL3)}</div>`,
                {}, 75, 830, 'BOTTOM', 150, 40);

        } else if (selectedTemplateId === 'bonsucesso') {
            // ══════════════════════════════════════════════════════════════════════
            // ELEVATO BONSUCESSO (BY TENDA) — MCMV (Composition of Atomic Layers)
            // ══════════════════════════════════════════════════════════════════════
            const logoTitle     = custom_fields.logo_title     || 'ELEVATO';
            const logoSub       = custom_fields.logo_sub       || 'Bonsucesso';
            const badgeTop      = custom_fields.badge_top      || 'NÃO PERCA\nESSA OPORTUNIDADE\nNA ZONA NORTE!';
            const tituloClaro   = custom_fields.titulo_claro   || 'O FUTURO\nJÁ ESTÁ';
            const tituloDestaque= custom_fields.titulo_destaque|| 'ACONTECENDO!';
            const textoApoio    = custom_fields.texto_apoio    || 'Projeto Elevato Bonsucesso, mais pestadas de rua incuro, e um gecitos-as criesas nm utenidores.';
            const endereco      = custom_fields.endereco       || 'RUA ITAÓCA, BONSUCESSO';

            const f1Label       = custom_fields.feat1_label    || 'ATO MÍNIMO';
            const f1Val         = custom_fields.feat1_val      || 'R$ 500,00';
            const f2Label       = custom_fields.feat2_label    || 'PARCELAMENTO';
            const f2Val         = custom_fields.feat2_val      || 'FACILITADO';
            const f3Label       = custom_fields.feat3_label    || 'DOCUMENTAÇÃO';
            const f3Val         = custom_fields.feat3_val      || 'GRÁTIS';
            const f4Label       = custom_fields.feat4_label    || 'PRODUTO APTO';
            const f4Val         = custom_fields.feat4_val      || 'PARA REPASSE';

            const painelTitulo  = custom_fields.painel_titulo  || 'OBRAS AVANÇADAS!';
            const painelTexto   = custom_fields.painel_texto   || 'MAIS VALORIZAÇÃO,\nMAIS VENDAS,\nMAIS RESULTADOS!';
            const rodapeText    = custom_fields.rodape_text    || 'Acione o seu viabilizador!';

            let bp_bs = '#0B1E38'; // brand-primary — azul marinho escuro oficial
            let ba_bs = '#D32F2F'; // brand-accent — vermelho Tenda oficial
            let go_bs = '#FFD700'; // gold — amarelo vibrante oficial
            let tl_bs = '#FFFFFF'; // brand-text-light — branco puro

            const brandPrimary   = localStorage.getItem('imob_brand_color_primary');
            const brandSecondary = localStorage.getItem('imob_brand_color_secondary');
            if (brandPrimary)   bp_bs = brandPrimary;
            if (brandSecondary) ba_bs = brandSecondary;

            const isStory_bs    = selectedFormat === 'story';
            const canvasH_bs    = isStory_bs ? 1920 : 1080;
            const safeTop_bs    = isStory_bs ? 250 : 60;
            const safeBottom_bs = isStory_bs ? 260 : 60;

            function resolvePos_bs(cluster, edgeOffset, height, ignoreSafeZone = false) {
                let top;
                if (cluster === 'TOP') {
                    top = edgeOffset;
                    if (!ignoreSafeZone && top < safeTop_bs) top = safeTop_bs;
                } else {
                    top = canvasH_bs - edgeOffset - height;
                    if (!ignoreSafeZone && (top + height) > (canvasH_bs - safeBottom_bs)) {
                        top = canvasH_bs - safeBottom_bs - height;
                    }
                }
                return top;
            }

            function addBonsucessoLayer(name, type, content, style, edgeTop, left, cluster, width, height, ignoreSafeZone = false) {
                const top = resolvePos_bs(cluster, edgeTop, height, ignoreSafeZone);
                let cssText = '';
                const styleObj = {
                    ...style,
                    position: 'absolute',
                    width: `${width}px`,
                    height: `${height}px`,
                };
                for (const [k, v] of Object.entries(styleObj)) {
                    const kebabKey = k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
                    cssText += `${kebabKey}:${v}; `;
                }
                addLayer(name, type, content, cssText, `${top}px`, `${left}px`, 'NONE', `${width}px`, `${height}px`);
            }

            // ═══════════════ CLUSTER SUPERIOR (TOP) ═══════════════

            // L01 — Logo ELEVATO (Texto)
            addBonsucessoLayer('L01_logo_elevato', 'text', logoTitle, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: '36px',
                color: tl_bs, letterSpacing: '3px', textTransform: 'uppercase',
                textShadow: '0 2px 6px rgba(0,0,0,0.6)',
            }, 40, 45, 'TOP', 280, 44);

            // L02 — Logo Subtítulo Bonsucesso (Texto)
            addBonsucessoLayer('L02_logo_subtitulo', 'text', logoSub, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: '18px',
                color: tl_bs, letterSpacing: '1.5px', textTransform: 'none',
                textShadow: '0 1px 4px rgba(0,0,0,0.5)',
            }, 84, 45, 'TOP', 200, 24);

            // L03 — Linha decorativa esquerda (Grafismo)
            addBonsucessoLayer('L03_linha_dec_esq', 'html',
                `<div style="width:100%;height:1px;background:${tl_bs};opacity:.4"></div>`,
                {}, 88, 45, 'TOP', 20, 1);

            // L04 — Linha decorativa direita (Grafismo)
            addBonsucessoLayer('L04_linha_dec_dir', 'html',
                `<div style="width:100%;height:1px;background:${tl_bs};opacity:.4"></div>`,
                {}, 88, 175, 'TOP', 20, 1);

            // L05 — Badge Fundo Vermelho Tilted (Grafismo/Fundo)
            addBonsucessoLayer('L05_badge_fundo', 'html',
                `<div style="width:100%;height:100%;background:${ba_bs};border:3px solid #FFFFFF;border-radius:12px;box-shadow:0 6px 14px rgba(0,0,0,0.4);transform:rotate(-4deg);box-sizing:border-box;"></div>`,
                {}, 30, 620, 'TOP', 410, 125);

            // Parse lines of badge top
            const badgeFormatted = escapeHTML(badgeTop).split('\n');
            const bL1 = badgeFormatted[0] || 'NÃO PERCA';
            const bL2 = badgeFormatted[1] || 'ESSA OPORTUNIDADE';
            const bL3 = badgeFormatted[2] || 'NA ZONA NORTE!';

            // L06 — Badge Texto Linha 1 (Texto)
            addBonsucessoLayer('L06_badge_texto_l1', 'text', bL1, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: '19px',
                color: tl_bs, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px',
                transform: 'rotate(-4deg)',
            }, 42, 620, 'TOP', 410, 26);

            // L07 — Badge Texto Linha 2 (Texto)
            addBonsucessoLayer('L07_badge_texto_l2', 'text', bL2, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: '17px',
                color: tl_bs, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px',
                transform: 'rotate(-4deg)',
            }, 68, 620, 'TOP', 410, 24);

            // L08 — Badge Texto Linha 3 (HTML para highlight amarelo)
            addBonsucessoLayer('L08_badge_texto_l3', 'html',
                `<div style="font-family:'Montserrat',sans-serif;font-weight:900;font-size:21px;color:${tl_bs};text-align:center;text-transform:uppercase;letter-spacing:0.5px;transform:rotate(-4deg);line-height:1;">` +
                    (bL3.includes('ZONA NORTE')
                        ? bL3.replace('ZONA NORTE', `<span style="color:${go_bs}">ZONA NORTE</span>`)
                        : `<span style="color:${go_bs}">${bL3}</span>`) +
                `</div>`,
                {}, 92, 620, 'TOP', 410, 30);

            // L09 — Título principal "O FUTURO JÁ ESTÁ" (Texto)
            addBonsucessoLayer('L09_titulo_principal', 'text', tituloClaro, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: '56px',
                color: tl_bs, lineHeight: '1.05', textTransform: 'uppercase',
                textShadow: '0 3px 8px rgba(0,0,0,0.65)', whiteSpace: 'pre-line',
            }, 150, 45, 'TOP', 560, 135);

            // L10 — Chamada destaque "ACONTECENDO!" (Texto)
            addBonsucessoLayer('L10_chamada_destaque', 'text', tituloDestaque, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: '60px',
                color: go_bs, textTransform: 'uppercase', letterSpacing: '-0.5px',
                textShadow: '0 3px 8px rgba(0,0,0,0.5)',
            }, 290, 45, 'TOP', 560, 68);

            // L11 — Sublinhado duplo da chamada (Grafismo)
            addBonsucessoLayer('L11_chamada_sublinhado', 'html',
                `<div style="width:100%;height:5px;background:${go_bs};border-radius:2px;box-shadow:0 2px 4px rgba(0,0,0,0.4);"></div>` +
                `<div style="width:100%;height:3px;background:${go_bs};margin-top:3px;border-radius:2px;box-shadow:0 2px 4px rgba(0,0,0,0.4);"></div>`,
                {}, 362, 45, 'TOP', 480, 14);

            // L12 — Texto de apoio (Texto)
            addBonsucessoLayer('L12_texto_apoio', 'text', textoApoio, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: '17px',
                color: tl_bs, lineHeight: '1.35', whiteSpace: 'pre-line',
                textShadow: '0 2px 4px rgba(0,0,0,0.6)',
            }, 400, 45, 'TOP', 480, 85);

            // L13 — Ícone Pin Localização (Ícone/Grafismo)
            addBonsucessoLayer('L13_localizacao_icone', 'html',
                `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;">` +
                    `<i class="fa-solid fa-location-dot" style="color:${ba_bs};font-size:36px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.6));"></i>` +
                `</div>`,
                {}, 505, 45, 'TOP', 40, 40);

            // L14 — Texto Endereço Localização (Texto)
            addBonsucessoLayer('L14_localizacao_texto', 'text', endereco, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: '18px',
                color: tl_bs, textTransform: 'uppercase', lineHeight: '1.2',
                textShadow: '0 2px 6px rgba(0,0,0,0.7)', whiteSpace: 'pre-line',
            }, 505, 95, 'TOP', 400, 48);

            // ═══════════════ CARACTERÍSTICAS / FEATS (L15 a L30) ═══════════════
            const features = [
                { icon: 'fa-hand-holding-dollar', label: f1Label, value: f1Val },
                { icon: 'fa-credit-card',         label: f2Label, value: f2Val },
                { icon: 'fa-file-lines',          label: f3Label, value: f3Val },
                { icon: 'fa-house-chimney',       label: f4Label, value: f4Val },
            ];

            features.forEach((f, i) => {
                const topVal = 195 + i * 95;
                const baseIdx = 15 + i * 4;

                // Círculo Ícone
                addBonsucessoLayer(`L${baseIdx}_feat${i+1}_icone`, 'html',
                    `<div style="width:100%;height:100%;border-radius:50%;background:#FFFFFF;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,0.4);">` +
                        `<i class="fa-solid ${f.icon}" style="color:${bp_bs};font-size:24px"></i>` +
                    `</div>`,
                    {}, topVal, 600, 'TOP', 52, 52);

                // Cápsula Fundo Vermelho
                addBonsucessoLayer(`L${baseIdx + 1}_feat${i+1}_fundo`, 'html',
                    `<div style="width:100%;height:100%;background:${ba_bs};border-radius:24px;box-shadow:0 4px 12px rgba(0,0,0,0.35);"></div>`,
                    {}, topVal, 664, 'TOP', 365, 52);

                // Rótulo da Feature (Texto separado)
                addBonsucessoLayer(`L${baseIdx + 2}_feat${i+1}_rotulo`, 'text', f.label, {
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: '13px',
                    color: tl_bs, textTransform: 'uppercase', letterSpacing: '0.3px',
                }, topVal + 8, 684, 'TOP', 330, 18);

                // Valor da Feature (Texto separado)
                addBonsucessoLayer(`L${baseIdx + 3}_feat${i+1}_valor`, 'text', f.value, {
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: '16px',
                    color: tl_bs, textTransform: 'uppercase', letterSpacing: '0.3px',
                }, topVal + 26, 684, 'TOP', 330, 20);
            });

            // ═══════════════ CLUSTER INFERIOR (BOTTOM) ═══════════════

            // L31 — Painel Obras Avançadas (Fundo Pincelada SVG)
            addBonsucessoLayer('L31_painel_obras_fundo', 'html',
                `<div style="width:100%;height:100%;position:relative;transform:rotate(-3deg);">` +
                    `<svg viewBox="0 0 480 200" preserveAspectRatio="none" style="position:absolute;top:0;left:0;width:100%;height:100%;filter:drop-shadow(0 6px 14px rgba(0,0,0,0.6));">` +
                        `<path d="M 35 16 ` +
                        `C 55 12, 100 15, 150 11 ` +
                        `C 200 14, 260 10, 320 13 ` +
                        `C 370 11, 420 15, 450 20 ` +
                        `C 458 24, 465 22, 455 30 ` +
                        `C 468 35, 475 32, 458 42 ` +
                        `C 472 48, 478 45, 462 55 ` +
                        `C 475 60, 480 58, 464 68 ` +
                        `C 478 74, 482 72, 465 82 ` +
                        `C 476 88, 480 86, 462 95 ` +
                        `C 475 102, 478 100, 460 110 ` +
                        `C 472 116, 475 115, 458 124 ` +
                        `C 468 130, 470 132, 454 140 ` +
                        `C 464 146, 460 152, 445 158 ` +
                        `C 430 164, 410 166, 380 170 ` +
                        `C 330 174, 270 171, 210 175 ` +
                        `C 150 172, 90 176, 50 170 ` +
                        `C 35 166, 28 162, 22 152 ` +
                        `C 12 146, 16 140, 24 132 ` +
                        `C 10 126, 14 120, 22 112 ` +
                        `C 8 105, 12 98, 20 90 ` +
                        `C 6 82, 10 75, 22 68 ` +
                        `C 10 60, 15 54, 24 46 ` +
                        `C 12 38, 18 32, 28 26 ` +
                        `C 20 20, 26 18, 35 16 Z" fill="${bp_bs}" />` +
                    `</svg>` +
                `</div>`,
                {}, 125, 40, 'BOTTOM', 490, 210);

            // Parse painelTexto lines
            const pLines = escapeHTML(painelTexto).split('\n').map(s => s.trim()).filter(Boolean);
            const pL1 = pLines[0] || 'MAIS VALORIZAÇÃO,';
            const pL2 = pLines[1] || 'MAIS VENDAS,';
            const pL3 = pLines.slice(2).join(' ') || 'MAIS RESULTADOS!';

            // L32 — Painel Obras Título "OBRAS AVANÇADAS!" (Texto separado)
            addBonsucessoLayer('L32_painel_obras_titulo', 'text', painelTitulo, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: '25px',
                color: go_bs, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px',
                textShadow: '0 2px 4px rgba(0,0,0,0.6)', transform: 'rotate(-3deg)',
            }, 145, 45, 'BOTTOM', 480, 32);

            // L33 — Painel Obras Linha 1 "MAIS VALORIZAÇÃO," (Texto separado - Branco)
            addBonsucessoLayer('L33_painel_obras_texto1', 'text', pL1, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: '18px',
                color: tl_bs, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.4px',
                textShadow: '0 2px 4px rgba(0,0,0,0.6)', transform: 'rotate(-3deg)',
            }, 178, 45, 'BOTTOM', 480, 24);

            // L34 — Painel Obras Linha 2 "MAIS VENDAS," (Texto separado - Branco)
            addBonsucessoLayer('L34_painel_obras_texto2', 'text', pL2, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: '18px',
                color: tl_bs, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.4px',
                textShadow: '0 2px 4px rgba(0,0,0,0.6)', transform: 'rotate(-3deg)',
            }, 202, 45, 'BOTTOM', 480, 24);

            // L35 — Painel Obras Linha 3 "MAIS RESULTADOS!" (Texto separado - Amarelo)
            addBonsucessoLayer('L35_painel_obras_texto3', 'text', pL3, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: '18px',
                color: go_bs, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.4px',
                textShadow: '0 2px 4px rgba(0,0,0,0.6)', transform: 'rotate(-3deg)',
            }, 226, 45, 'BOTTOM', 480, 26);

            // L36 — Rodapé Barra Vermelha Tenda (Fundo)
            addBonsucessoLayer('L36_rodape_fundo', 'html',
                `<div style="width:100%;height:100%;background:${ba_bs};box-shadow:0 -4px 12px rgba(0,0,0,0.3);"></div>`,
                {}, 0, 0, 'BOTTOM', 1080, 90, true);

            // L37 — Rodapé Logo Tenda (Logo/Grafismo)
            addBonsucessoLayer('L37_rodape_logo_tenda', 'html',
                `<div style="display:flex;align-items:center;gap:12px;height:100%;">` +
                    `<svg width="40" height="30" viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">` +
                        `<path d="M10 70 L50 10 L90 70 H65 L50 35 L35 70 Z" fill="#FFFFFF"/>` +
                    `</svg>` +
                    `<span style="font-family:'Montserrat','Poppins',sans-serif;font-weight:900;font-size:36px;color:#FFFFFF;letter-spacing:-1px;">Tenda</span>` +
                `</div>`,
                {}, 25, 200, 'BOTTOM', 220, 45, true);

            // L38 — Rodapé Tagline "Acione o seu viabilizador!" (Texto separado)
            addBonsucessoLayer('L38_rodape_tagline', 'text', rodapeText, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '24px',
                color: tl_bs, textAlign: 'left',
            }, 28, 440, 'BOTTOM', 450, 35, true);

        } else if (selectedTemplateId === 'casa-fortaleza') {
            // ══════════════════════════════════════════════════════════════════════
            // CASA FORTALEZA — MCMV (Composition of Atomic Layers)
            // ══════════════════════════════════════════════════════════════════════
            const pillTop       = custom_fields.pill_top       || 'LANÇAMENTO';
            const titulo        = custom_fields.titulo         || 'Apê próximo a Expoema';
            const logoTitle     = custom_fields.logo_title     || 'FORTALEZA';
            const logoSub       = custom_fields.logo_sub       || 'Empreendimentos';
            const programaLabel = custom_fields.programa_label || 'PROGRAMA\nCASA VERDE\nE AMARELA';
            const rendaVal      = custom_fields.renda_val      || 'R$2.500';
            const desc1Val      = custom_fields.desc1_val      || 'R$ 10mil';
            const desc2Val      = custom_fields.desc2_val      || 'R$ 47mil';
            const ctaText       = custom_fields.cta_text       || 'CLIQUE EM SAIBA MAIS';

            let bp_cf  = '#1A3FA0'; // brand-primary — azul dominante
            let ba_cf  = '#E5231B'; // brand-accent — vermelho
            let tl_cf  = '#FFFFFF'; // brand-text-light — branco
            let sec_cf = '#3BAA35'; // brand-secondary — verde CTA

            const brandPrimary   = localStorage.getItem('imob_brand_color_primary');
            const brandSecondary = localStorage.getItem('imob_brand_color_secondary');
            if (brandPrimary)   bp_cf = brandPrimary;
            if (brandSecondary) ba_cf = brandSecondary;

            const isStory_cf    = selectedFormat === 'story';
            const canvasH_cf    = isStory_cf ? 1920 : 1080;
            const safeTop_cf    = isStory_cf ? 250 : 60;
            const safeBottom_cf = isStory_cf ? 260 : 60;

            function resolvePos_cf(cluster, edgeOffset, height, ignoreSafeZone = false) {
                let top;
                if (cluster === 'TOP') {
                    top = edgeOffset;
                    if (!ignoreSafeZone && top < safeTop_cf) top = safeTop_cf;
                } else {
                    top = canvasH_cf - edgeOffset - height;
                    if (!ignoreSafeZone && (top + height) > (canvasH_cf - safeBottom_cf)) {
                        top = canvasH_cf - safeBottom_cf - height;
                    }
                }
                return top;
            }

            function addFortalezaLayer(name, type, content, style, edgeTop, left, cluster, width, height, ignoreSafeZone = false) {
                const top = resolvePos_cf(cluster, edgeTop, height, ignoreSafeZone);
                let cssText = '';
                const styleObj = {
                    ...style,
                    position: 'absolute',
                    width: `${width}px`,
                    height: `${height}px`,
                };
                for (const [k, v] of Object.entries(styleObj)) {
                    const kebabKey = k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
                    cssText += `${kebabKey}:${v}; `;
                }
                addLayer(name, type, content, cssText, `${top}px`, `${left}px`, 'NONE', `${width}px`, `${height}px`);
            }

            // ── CLUSTER SUPERIOR (TOP) ──

            // L00 — Camada de fundo azul do topo (Header com onda/curva)
            const headerHeight_cf = isStory_cf ? 420 : 200;
            addFortalezaLayer('L00_bg_topo_azul', 'html',
                `<svg width="1080" height="${headerHeight_cf}" viewBox="0 0 1080 200" preserveAspectRatio="none" style="display:block;width:100%;height:100%;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.35));">` +
                    `<path d="M 0,0 L 1080,0 L 1080,150 Q 540,215 0,175 Z" fill="${bp_cf}"/>` +
                `</svg>`,
                {}, 0, 0, 'TOP', 1080, headerHeight_cf, true);

            // L01 — Pill vermelho "LANÇAMENTO" (Fundo)
            addFortalezaLayer('L01_pill_lancamento_bg', 'html',
                `<div style="width:100%;height:100%;background:${ba_cf};border-radius:8px;box-shadow:0 3px 8px rgba(0,0,0,0.3);"></div>`,
                {}, 24, 27, 'TOP', 210, 58);

            // L02 — Pill Texto "LANÇAMENTO" (Texto separado)
            addFortalezaLayer('L02_pill_lancamento_text', 'text', pillTop, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '26px',
                color: tl_cf, letterSpacing: '0.5px', textAlign: 'center', lineHeight: '58px',
            }, 24, 27, 'TOP', 210, 58);

            // L03 — Badge circular com ícone de pin (localização)
            addFortalezaLayer('L03_icone_pin', 'html',
                `<div style="width:100%;height:100%;border:2px solid ${tl_cf};border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);">` +
                    `<i class="fa-solid fa-location-dot" style="color:${tl_cf};font-size:24px;"></i>` +
                `</div>`,
                {}, 24, 250, 'TOP', 56, 56);

            // L04 — Título "Apê próximo a Expoema" (Texto separado)
            addFortalezaLayer('L04_titulo', 'text', titulo, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '44px',
                color: tl_cf, lineHeight: '1.1', textAlign: 'left', textShadow: '0 2px 6px rgba(0,0,0,0.5)',
            }, 95, 27, 'TOP', 520, 60);

            // L05 — Ícone do logo Fortaleza (barras ascendentes)
            addFortalezaLayer('L05_icone_fortaleza', 'html',
                `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;">` +
                    `<i class="fa-solid fa-chart-simple" style="color:${ba_cf};font-size:38px;"></i>` +
                `</div>`,
                {}, 22, 845, 'TOP', 48, 42);

            // L06 — Texto do logo Construtora Fortaleza (Texto separado)
            addFortalezaLayer('L06_texto_fortaleza', 'text', `${logoTitle}\n${logoSub}`, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '20px',
                color: tl_cf, textAlign: 'left', lineHeight: '1.2', whiteSpace: 'pre-line',
            }, 24, 900, 'TOP', 180, 50);

            // L07 — Ícone Casa Verde e Amarela
            addFortalezaLayer('L07_icone_casaverde', 'html',
                `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;">` +
                    `<i class="fa-solid fa-house-chimney" style="color:#4A90D9;font-size:36px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));"></i>` +
                `</div>`,
                {}, 132, 790, 'TOP', 40, 40);

            // L08 — Texto "PROGRAMA CASA VERDE E AMARELA" (Texto separado)
            addFortalezaLayer('L08_texto_casaverde', 'text', programaLabel, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '16px',
                color: tl_cf, textAlign: 'left', lineHeight: '1.15', whiteSpace: 'pre-line',
            }, 132, 838, 'TOP', 232, 60);

            // ── CLUSTER INFERIOR (BOTTOM) ──

            // L09 — Fundo branco arredondado do bloco "Renda familiar"
            addFortalezaLayer('L09_bg_renda', 'html',
                `<div style="width:100%;height:100%;background:${tl_cf};border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.3);"></div>`,
                {}, 100, 325, 'BOTTOM', 235, 175);

            // L10 — Label "Renda familiar a partir de" (Texto separado)
            addFortalezaLayer('L10_label_renda', 'text', 'Renda familiar\na partir de', {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '19px',
                color: bp_cf, textAlign: 'center', lineHeight: '1.2', whiteSpace: 'pre-line',
            }, 125, 325, 'BOTTOM', 235, 45);

            // L11 — Valor Renda ("R$2.500") (Texto separado)
            addFortalezaLayer('L11_valor_renda', 'text', rendaVal, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '46px',
                color: bp_cf, textAlign: 'center',
            }, 175, 325, 'BOTTOM', 235, 55);

            // L12 — Fundo azul do bloco "Desconto até R$10mil"
            addFortalezaLayer('L12_bg_desconto1', 'html',
                `<div style="width:100%;height:100%;background:${bp_cf};border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.3);"></div>`,
                {}, 100, 570, 'BOTTOM', 235, 175);

            // L13 — Label "DESCONTO DE ATÉ" (1) (Texto separado)
            addFortalezaLayer('L13_label_desconto1', 'text', 'DESCONTO\nDE ATÉ', {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '17px',
                color: tl_cf, textAlign: 'center', lineHeight: '1.2', whiteSpace: 'pre-line',
            }, 125, 570, 'BOTTOM', 235, 42);

            // L14 — Valor Desconto 1 ("R$ 10mil") (Texto separado)
            addFortalezaLayer('L14_valor_desconto1', 'text', desc1Val, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '34px',
                color: ba_cf, textAlign: 'center',
            }, 175, 570, 'BOTTOM', 235, 45);

            // L15 — Fundo azul do bloco "Desconto até R$47mil (subsídio)"
            addFortalezaLayer('L15_bg_desconto2', 'html',
                `<div style="width:100%;height:100%;background:${bp_cf};border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.3);"></div>`,
                {}, 100, 815, 'BOTTOM', 235, 175);

            // L16 — Label "DESCONTO DE ATÉ" (2) (Texto separado)
            addFortalezaLayer('L16_label_desconto2', 'text', 'DESCONTO\nDE ATÉ', {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '17px',
                color: tl_cf, textAlign: 'center', lineHeight: '1.2', whiteSpace: 'pre-line',
            }, 125, 815, 'BOTTOM', 235, 42);

            // L17 — Valor Desconto 2 ("R$ 47mil") (Texto separado)
            addFortalezaLayer('L17_valor_desconto2', 'text', desc2Val, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '30px',
                color: ba_cf, textAlign: 'center',
            }, 170, 815, 'BOTTOM', 235, 40);

            // L18 — Caption "(SUBSÍDIO)" (Texto separado)
            addFortalezaLayer('L18_caption_desconto2', 'text', '(SUBSÍDIO)', {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '13px',
                color: tl_cf, textAlign: 'center',
            }, 205, 815, 'BOTTOM', 235, 18);

            // L19 — Botão CTA verde (Fundo pill)
            addFortalezaLayer('L19_bg_cta', 'html',
                `<div style="width:100%;height:100%;background:${sec_cf};border-radius:34px;box-shadow:0 4px 14px rgba(0,0,0,0.35);"></div>`,
                {}, 20, 27, 'BOTTOM', 1026, 68);

            // L20 — Texto do CTA "CLIQUE EM SAIBA MAIS" (Texto separado)
            addFortalezaLayer('L20_texto_cta', 'text', ctaText, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '26px',
                color: tl_cf, textAlign: 'center', lineHeight: '68px',
            }, 20, 27, 'BOTTOM', 1026, 68);

        } else if (selectedTemplateId === 'guaianases') {
            // ══════════════════════════════════════════════════════════════════════
            // GUAIANASES — MCMV (Composition of Atomic Layers)
            // ══════════════════════════════════════════════════════════════════════
            const seloTop              = custom_fields.selo_top              || 'CHEGOU A SUA VEZ!';
            const titulo               = custom_fields.titulo               || 'GUAIANASES';
            const seloFinanciamentoT1  = custom_fields.selo_financiamento_t1  || 'FINANCIAMENTO';
            const seloFinanciamentoT2  = custom_fields.selo_financiamento_t2  || 'Minha Casa\nMinha Vida';
            const seloFinanciamentoT3  = custom_fields.selo_financiamento_t3  || 'FACILITADO';
            const tagline1             = custom_fields.tagline1             || 'O APTO QUE CABE';
            const tagline2             = custom_fields.tagline2             || 'NO SEU BOLSO!';
            const labelRenda           = custom_fields.label_renda           || 'RENDA FAMILIAR\nA PARTIR DE';
            const rendaVal             = custom_fields.renda_val             || 'R$ 2.500';
            const labelEntrada         = custom_fields.label_entrada         || 'ENTRADA\nA PARTIR DE';
            const entradaVal           = custom_fields.entrada_val           || 'R$ 500';
            const labelParcelas        = custom_fields.label_parcelas        || '36 PARCELAS DE';
            const parcelasVal          = custom_fields.parcelas_val          || 'R$ 485';
            const labelAnuais          = custom_fields.label_anuais          || '2 ANUAIS DE';
            const anuaisVal            = custom_fields.anuais_val            || 'R$ 2 MIL';
            const labelLocalizacao     = custom_fields.label_localizacao     || 'PRÓXIMO À';
            const bairro               = custom_fields.bairro               || 'ESTAÇÃO\nGUAIANASES';
            const labelMorando         = custom_fields.label_morando         || 'PARCELA MORANDO DE';
            const precoMorando         = custom_fields.preco_morando         || '750';
            const faixaTexto1          = custom_fields.faixa_texto1          || 'SÓ FICA NO ALUGUEL';
            const faixaTexto2          = custom_fields.faixa_texto2          || 'QUEM QUER!';
            const ic1Txt               = custom_fields.ic1_txt               || 'DOCUMENTAÇÃO\nGRÁTIS!*';
            const ic1Sub               = custom_fields.ic1_sub               || 'CONSULTE CONDIÇÕES';
            const ic2Txt               = custom_fields.ic2_txt               || 'APTOS. DE\n1 E 2 DORMS.';
            const ic2Sub               = custom_fields.ic2_sub               || 'CONFORTO PARA\nSUA FAMÍLIA!';
            const ic3Txt               = custom_fields.ic3_txt               || 'SEGURANÇA\n24 HORAS';
            const ic3Sub               = custom_fields.ic3_sub               || '';
            const ic4Txt               = custom_fields.ic4_txt               || 'ÁREA VERDE\nE LAZER';
            const ic4Sub               = custom_fields.ic4_sub               || 'COMPLETO';
            const textoLegal           = custom_fields.texto_legal           || '*Consulte condições. Imagem meramente ilustrativa.';

            let bp_g  = '#0E2A47'; // brand-primary   → azul-marinho escuro
            let ba_g  = '#F6C915'; // brand-accent    → amarelo
            let tl_g  = '#FFFFFF'; // brand-text-light → branco
            let sec_g = '#1E63AA'; // secundária      → azul médio
            let stroke_g = '#000000'; // contorno

            const brandPrimary   = localStorage.getItem('imob_brand_color_primary');
            const brandSecondary = localStorage.getItem('imob_brand_color_secondary');
            if (brandPrimary)   bp_g = brandPrimary;
            if (brandSecondary) ba_g = brandSecondary;

            const isStory_g    = selectedFormat === 'story';
            const canvasH_g    = isStory_g ? 1920 : 1080;
            const safeTop_g    = isStory_g ? 250 : 60;
            const safeBottom_g = isStory_g ? 260 : 60;

            function resolvePos_g(cluster, edgeOffset, height, bleed = false) {
                let top;
                if (cluster === 'TOP') {
                    top = edgeOffset;
                    if (!bleed) top = Math.max(top, safeTop_g);
                } else {
                    top = canvasH_g - edgeOffset - height;
                    if (!bleed) {
                        const maxTop = canvasH_g - safeBottom_g - height;
                        top = Math.min(top, maxTop);
                    }
                }
                return top;
            }

            function addGuaianasesLayer(name, type, content, style, edgeTop, left, cluster, width, height, bleed = false) {
                const top = resolvePos_g(cluster, edgeTop, height, bleed);
                let cssText = '';
                const styleObj = {
                    ...style,
                    position: 'absolute',
                    width: `${width}px`,
                    height: `${height}px`,
                };
                for (const [k, v] of Object.entries(styleObj)) {
                    const kebabKey = k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
                    cssText += `${kebabKey}:${v}; `;
                }
                addLayer(name, type, content, cssText, `${top}px`, `${left}px`, 'NONE', `${width}px`, `${height}px`);
            }

            // ── CLUSTER SUPERIOR (TOP) ──

            // L01 — Selo pequeno "CHEGOU A SUA VEZ!" (Fundo html + texto editável)
            addGuaianasesLayer('L01_selo_chegou_sua_vez_bg', 'html',
                `<div style="display:flex;align-items:center;gap:6px;background:${tl_g};border-radius:20px;padding:6px 14px;box-shadow:0 2px 6px rgba(0,0,0,0.2);width:100%;height:100%;box-sizing:border-box;">` +
                    `<i class="fa-solid fa-star" style="color:${bp_g};font-size:14px;"></i>` +
                `</div>`,
                {}, 25, 25, 'TOP', 240, 42);

            addGuaianasesLayer('L01_selo_chegou_sua_vez_text', 'text', seloTop, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '14px',
                color: bp_g, textAlign: 'left', letterSpacing: '0.3px', lineHeight: '42px',
            }, 25, 52, 'TOP', 200, 42);

            // L02 — Título principal "GUAIANASES"
            addGuaianasesLayer('L02_titulo_guaianases', 'text', titulo, {
                fontFamily: "'Anton', 'Montserrat', sans-serif", fontWeight: 800, fontSize: '128px',
                color: ba_g, textAlign: 'left', letterSpacing: '0px', lineHeight: '0.95',
                webkitTextStroke: `4px ${stroke_g}`, textShadow: `3px 3px 0 ${stroke_g}`,
            }, 75, 20, 'TOP', 850, 170);

            // L03 — Selo circular de financiamento (Fundo html + textos editáveis)
            addGuaianasesLayer('L03_selo_financiamento_bg', 'html',
                `<div style="width:100%;height:100%;border-radius:50%;background:${bp_g};border:3px solid ${tl_g};display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:14px;box-shadow:0 4px 10px rgba(0,0,0,0.3);box-sizing:border-box;">` +
                    `<i class="fa-solid fa-house-chimney-window" style="color:${ba_g};font-size:22px;"></i>` +
                `</div>`,
                {}, 30, 900, 'TOP', 155, 155);

            addGuaianasesLayer('L03_selo_financiamento_t1', 'text', seloFinanciamentoT1, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '11px',
                color: tl_g, textAlign: 'center', lineHeight: '1.2',
            }, 72, 900, 'TOP', 155, 20);

            addGuaianasesLayer('L03_selo_financiamento_t2', 'text', seloFinanciamentoT2, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '10px',
                color: tl_g, textAlign: 'center', lineHeight: '1.1',
            }, 90, 900, 'TOP', 155, 30);

            addGuaianasesLayer('L03_selo_financiamento_t3', 'text', seloFinanciamentoT3, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '10px',
                color: ba_g, textAlign: 'center', lineHeight: '1.2',
            }, 122, 900, 'TOP', 155, 20);

            // L04 — Tagline linha 1 (branca)
            addGuaianasesLayer('L04_tagline_linha1', 'text', tagline1, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '34px',
                color: tl_g, textAlign: 'left', letterSpacing: '0.5px', lineHeight: '1', textShadow: '0 2px 4px rgba(0,0,0,0.5)',
            }, 265, 25, 'TOP', 450, 42);

            // L05 — Tagline linha 2 (amarela, maior)
            addGuaianasesLayer('L05_tagline_linha2', 'text', tagline2, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '46px',
                color: ba_g, textAlign: 'left', letterSpacing: '0.3px', lineHeight: '1', textShadow: '0 2px 4px rgba(0,0,0,0.5)',
            }, 308, 25, 'TOP', 450, 58);

            // L06/L07/L08 — Lista de pills de valor (Fundo html + Rótulo editável + Valor editável)
            const pillsTop_g = [
                { nome: 'L06_pill_renda_familiar', icon: 'fa-users',         lbl: labelRenda, valor: rendaVal, edgeTop: 390 },
                { nome: 'L07_pill_entrada',        icon: 'fa-key',           lbl: labelEntrada, valor: entradaVal, edgeTop: 480 },
                { nome: 'L08_pill_parcelas',       icon: 'fa-calendar-days', lbl: labelParcelas, valor: parcelasVal, edgeTop: 570 },
            ];

            pillsTop_g.forEach(p => {
                const decStr = p.valor.includes(',') ? '' : ',00';
                const fullValor = p.valor + decStr;

                // Fundo da pílula + Ícone em círculo azul
                addGuaianasesLayer(`${p.nome}_bg`, 'html',
                    `<div style="display:flex;align-items:center;background:${tl_g};border-radius:40px;padding:10px 18px;width:100%;height:100%;box-shadow:0 2px 6px rgba(0,0,0,0.15);box-sizing:border-box;">` +
                        `<div style="width:54px;height:54px;border-radius:50%;background:${sec_g};display:flex;align-items:center;justify-content:center;flex-shrink:0;">` +
                            `<i class="fa-solid ${p.icon}" style="color:${tl_g};font-size:24px;"></i>` +
                        `</div>` +
                    `</div>`,
                    {}, p.edgeTop, 25, 'TOP', 430, 78);

                // Texto do Rótulo
                addGuaianasesLayer(`${p.nome}_lbl`, 'text', p.lbl, {
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '15px',
                    color: bp_g, textAlign: 'left', lineHeight: '1.05',
                }, p.edgeTop + 10, 110, 'TOP', 330, 30);

                // Texto do Valor
                addGuaianasesLayer(`${p.nome}_val`, 'text', fullValor, {
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '26px',
                    color: bp_g, textAlign: 'left', lineHeight: '1.05',
                }, p.edgeTop + 38, 110, 'TOP', 330, 34);
            });

            // L09 — Badge amarelo de localização (Fundo html + Rótulo editável + Bairro editável)
            addGuaianasesLayer('L09_badge_localizacao_bg', 'html',
                `<div style="width:100%;height:100%;background:${ba_g};border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:8px 0;box-shadow:0 4px 10px rgba(0,0,0,0.25);box-sizing:border-box;">` +
                    `<i class="fa-solid fa-location-dot" style="color:${bp_g};font-size:20px;"></i>` +
                    `<i class="fa-solid fa-bus" style="color:${bp_g};font-size:14px;"></i>` +
                `</div>`,
                {}, 470, 690, 'TOP', 340, 110);

            addGuaianasesLayer('L09_badge_localizacao_lbl', 'text', labelLocalizacao, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '15px',
                color: bp_g, textAlign: 'center', lineHeight: '1.1',
            }, 498, 690, 'TOP', 340, 20);

            addGuaianasesLayer('L09_badge_localizacao_bairro', 'text', bairro, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '17px',
                color: bp_g, textAlign: 'center', lineHeight: '1.1',
            }, 518, 690, 'TOP', 340, 44);

            // ── CLUSTER INFERIOR (BOTTOM) ──

            // L10 — Pill "2 ANUAIS DE R$ 2 MIL" (Fundo html + Rótulo editável + Valor editável)
            addGuaianasesLayer('L10_pill_anuais_bg', 'html',
                `<div style="display:flex;align-items:center;background:${tl_g};border-radius:40px;padding:10px 18px;width:100%;height:100%;box-shadow:0 2px 6px rgba(0,0,0,0.15);box-sizing:border-box;">` +
                    `<div style="width:54px;height:54px;border-radius:50%;background:${sec_g};display:flex;align-items:center;justify-content:center;flex-shrink:0;">` +
                        `<i class="fa-solid fa-sack-dollar" style="color:${tl_g};font-size:24px;"></i>` +
                    `</div>` +
                `</div>`,
                {}, 790, 25, 'BOTTOM', 430, 78);

            addGuaianasesLayer('L10_pill_anuais_lbl', 'text', labelAnuais, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '15px',
                color: bp_g, textAlign: 'left', lineHeight: '1.05',
            }, 800, 110, 'BOTTOM', 330, 26);

            addGuaianasesLayer('L10_pill_anuais_val', 'text', anuaisVal, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '26px',
                color: bp_g, textAlign: 'left', lineHeight: '1.05',
            }, 826, 110, 'BOTTOM', 330, 34);

            // L11 — Rótulo "PARCELA MORANDO DE" (Fundo html + Texto editável)
            addGuaianasesLayer('L11_label_parcela_morando_bg', 'html',
                `<div style="width:100%;height:100%;background:${bp_g};border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.2);"></div>`,
                {}, 660, 30, 'BOTTOM', 320, 40);

            addGuaianasesLayer('L11_label_parcela_morando_txt', 'text', labelMorando, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '18px',
                color: tl_g, textAlign: 'center', lineHeight: '40px',
            }, 660, 30, 'BOTTOM', 320, 40);

            // L12 — Preço grande "R$ 750,00" (Texto editável)
            const precoFormatado = `R$ ${precoMorando},00`;
            addGuaianasesLayer('L12_preco_750', 'text', precoFormatado, {
                fontFamily: "'Anton', 'Montserrat', sans-serif", fontWeight: 800, fontSize: '130px',
                color: ba_g, textAlign: 'left', lineHeight: '1',
                webkitTextStroke: `3px ${stroke_g}`, textShadow: `2px 2px 4px rgba(0,0,0,0.5)`,
            }, 490, 25, 'BOTTOM', 500, 150);

            // L13 — Faixa azul de fundo "SÓ FICA NO ALUGUEL QUEM QUER!"
            addGuaianasesLayer('L13_faixa_bg_aluguel', 'html',
                `<div style="width:100%;height:100%;background:${bp_g};"></div>`,
                {}, 330, 0, 'BOTTOM', 1080, 95);

            // L13b — Texto sobreposto à faixa (Dividido em 2 layers de texto editáveis)
            addGuaianasesLayer('L13b_texto_aluguel_t1', 'text', faixaTexto1, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '27px',
                color: tl_g, textAlign: 'right', lineHeight: '95px',
            }, 330, 60, 'BOTTOM', 480, 95);

            addGuaianasesLayer('L13b_texto_aluguel_t2', 'text', faixaTexto2, {
                fontFamily: "'Kaushan Script', cursive, sans-serif", fontWeight: 400, fontSize: '36px',
                color: ba_g, textAlign: 'left', lineHeight: '95px',
            }, 330, 555, 'BOTTOM', 450, 95);

            // L13c — Ícone casa decorativo
            addGuaianasesLayer('L13c_icone_casa_decorativo', 'html',
                `<div style="width:100%;height:100%;background:${sec_g};border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.2);">` +
                    `<i class="fa-solid fa-house" style="color:${ba_g};font-size:24px;"></i>` +
                `</div>`,
                {}, 395, 10, 'BOTTOM', 55, 55);

            // L14 — Barra de rodapé escuro full-width (bleed=true)
            addGuaianasesLayer('L14_barra_rodape_bg', 'html',
                `<div style="width:100%;height:100%;background:${bp_g};"></div>`,
                {}, 0, 0, 'BOTTOM', 1080, 190, true);

            // L15 — Balcão branco arredondado com os 4 ícones institucionais (Fundo com ícones + 4 Balões com Textos editáveis)
            addGuaianasesLayer('L15_balcao_rodape_bg', 'html',
                `<div style="width:100%;height:100%;background:#FFFFFF;border-radius:50px;display:flex;align-items:center;justify-content:space-evenly;padding:0 16px;box-shadow:0 6px 18px rgba(0,0,0,0.3);box-sizing:border-box;">` +
                    `<div style="display:flex;align-items:center;gap:10px;flex:1;justify-content:flex-start;padding-left:12px;">` +
                        `<div style="width:46px;height:46px;border-radius:50%;background:${sec_g};display:flex;align-items:center;justify-content:center;flex-shrink:0;">` +
                            `<i class="fa-solid fa-file-circle-check" style="color:#FFFFFF;font-size:20px;"></i>` +
                        `</div>` +
                    `</div>` +
                    `<div style="width:1px;height:42px;background:#D0D7DE;flex-shrink:0;"></div>` +

                    `<div style="display:flex;align-items:center;gap:10px;flex:1;justify-content:flex-start;padding-left:12px;">` +
                        `<div style="width:46px;height:46px;border-radius:50%;background:${sec_g};display:flex;align-items:center;justify-content:center;flex-shrink:0;">` +
                            `<i class="fa-solid fa-building" style="color:#FFFFFF;font-size:20px;"></i>` +
                        `</div>` +
                    `</div>` +
                    `<div style="width:1px;height:42px;background:#D0D7DE;flex-shrink:0;"></div>` +

                    `<div style="display:flex;align-items:center;gap:10px;flex:1;justify-content:flex-start;padding-left:12px;">` +
                        `<div style="width:46px;height:46px;border-radius:50%;background:${sec_g};display:flex;align-items:center;justify-content:center;flex-shrink:0;">` +
                            `<i class="fa-solid fa-shield-halved" style="color:#FFFFFF;font-size:20px;"></i>` +
                        `</div>` +
                    `</div>` +
                    `<div style="width:1px;height:42px;background:#D0D7DE;flex-shrink:0;"></div>` +

                    `<div style="display:flex;align-items:center;gap:10px;flex:1;justify-content:flex-start;padding-left:12px;">` +
                        `<div style="width:46px;height:46px;border-radius:50%;background:${sec_g};display:flex;align-items:center;justify-content:center;flex-shrink:0;">` +
                            `<i class="fa-solid fa-tree" style="color:#FFFFFF;font-size:20px;"></i>` +
                        `</div>` +
                    `</div>` +
                `</div>`,
                {}, 60, 20, 'BOTTOM', 1040, 95);

            // Item 1: Documentação Grátis
            addGuaianasesLayer('L15_item1_txt', 'text', ic1Txt, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '12px',
                color: bp_g, textAlign: 'left', lineHeight: '1.1',
            }, 72, 105, 'BOTTOM', 160, 32);

            if (ic1Sub) {
                addGuaianasesLayer('L15_item1_sub', 'text', ic1Sub, {
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '9px',
                    color: '#666666', textAlign: 'left', lineHeight: '1.1',
                }, 108, 105, 'BOTTOM', 160, 20);
            }

            // Item 2: Aptos 1 e 2 Dorms
            addGuaianasesLayer('L15_item2_txt', 'text', ic2Txt, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '12px',
                color: bp_g, textAlign: 'left', lineHeight: '1.1',
            }, 72, 365, 'BOTTOM', 160, 32);

            if (ic2Sub) {
                addGuaianasesLayer('L15_item2_sub', 'text', ic2Sub, {
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '9px',
                    color: '#666666', textAlign: 'left', lineHeight: '1.1',
                }, 108, 365, 'BOTTOM', 160, 20);
            }

            // Item 3: Segurança 24 Horas
            addGuaianasesLayer('L15_item3_txt', 'text', ic3Txt, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '12px',
                color: bp_g, textAlign: 'left', lineHeight: '1.1',
            }, 78, 625, 'BOTTOM', 160, 32);

            if (ic3Sub) {
                addGuaianasesLayer('L15_item3_sub', 'text', ic3Sub, {
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '9px',
                    color: '#666666', textAlign: 'left', lineHeight: '1.1',
                }, 108, 625, 'BOTTOM', 160, 20);
            }

            // Item 4: Área Verde e Lazer
            addGuaianasesLayer('L15_item4_txt', 'text', ic4Txt, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '12px',
                color: bp_g, textAlign: 'left', lineHeight: '1.1',
            }, 72, 885, 'BOTTOM', 160, 32);

            if (ic4Sub) {
                addGuaianasesLayer('L15_item4_sub', 'text', ic4Sub, {
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '9px',
                    color: '#666666', textAlign: 'left', lineHeight: '1.1',
                }, 108, 885, 'BOTTOM', 160, 20);
            }

            // L16 — Texto legal no rodapé
            addGuaianasesLayer('L16_texto_legal', 'text', textoLegal, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: '12px',
                color: tl_g, textAlign: 'center', opacity: 0.85,
            }, 18, 0, 'BOTTOM', 1080, 22);

        } else if (selectedTemplateId === 'santa-marina') {
            // ══════════════════════════════════════════════════════════════════════
            // SANTA MARINA — MCMV (Composition of Atomic Layers)
            // ══════════════════════════════════════════════════════════════════════
            const lancamentoTxt = custom_fields.lancamento_txt || 'Lançamento';
            const titulo        = custom_fields.titulo         || 'Santa Marina';
            const metroBarTxt   = custom_fields.metro_bar_txt   || 'Próximo a Futura Estação de Metrô Santa Marina';
            const precoVal      = custom_fields.preco_val      || '280';
            const metroLinha    = custom_fields.metro_linha    || 'Linha 3 - Vermelha';
            const metroEstacao  = custom_fields.metro_estacao  || 'BELÉM';
            const numDorms      = custom_fields.num_dorms      || '1e2';
            const labelLazer    = custom_fields.label_lazer    || 'LAZER COMPLETO COM PISCINA';
            const dormsTxt      = custom_fields.dorms_txt      || 'DORMS';
            const barraOpcoes   = custom_fields.barra_opcoes   || 'OPÇÕES C/TERRAÇO E VAGA';

            let bp_sm  = '#0B1F4B'; // brand-primary (navy escuro)
            let ba_sm  = '#E2B65A'; // brand-accent (dourado)
            let tl_sm  = '#FFFFFF'; // text light
            let sec_sm = '#3FB6EC'; // azul claro
            let ter_sm = '#0A4C9E'; // azul escuro
            let qua_sm = '#D6261E'; // vermelho da plaquinha

            const GRAD_SM = {
                gold:    `linear-gradient(180deg, #F9E6A0 0%, ${ba_sm} 38%, #B9832B 72%, #E9C468 100%)`,
                blueBar: `linear-gradient(180deg, ${sec_sm} 0%, #1C7BC8 48%, ${ter_sm} 100%)`,
                navyBox: `linear-gradient(160deg, #2A4D8F 0%, #142B60 45%, #081736 100%)`,
                redPill: `linear-gradient(180deg, #E8483F 0%, ${qua_sm} 55%, #A81510 100%)`,
            };

            const isStory_sm    = selectedFormat === 'story';
            const canvasH_sm    = isStory_sm ? 1920 : 1080;
            const safeTop_sm    = isStory_sm ? 250 : 60;
            const safeBottom_sm = isStory_sm ? 260 : 60;
            const baseSafeTop   = 60;
            const baseSafeBottom= 60;

            function resolvePos_sm(cluster, edgeOffset, height) {
                if (cluster === 'TOP') {
                    const shift = safeTop_sm - baseSafeTop;
                    return Math.max(edgeOffset + shift, safeTop_sm);
                } else {
                    const shift = safeBottom_sm - baseSafeBottom;
                    const off = Math.max(edgeOffset + shift, safeBottom_sm);
                    return canvasH_sm - off - height;
                }
            }

            function addSantaMarinaLayer(name, type, content, style, edgeOffset, left, cluster, width, height) {
                const top = resolvePos_sm(cluster, edgeOffset, height);
                let cssText = '';
                const styleObj = {
                    ...style,
                    position: 'absolute',
                    width: `${width}px`,
                    height: `${height}px`,
                };
                for (const [k, v] of Object.entries(styleObj)) {
                    const kebabKey = k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
                    cssText += `${kebabKey}:${v}; `;
                }
                addLayer(name, type, content, cssText, `${top}px`, `${left}px`, 'NONE', `${width}px`, `${height}px`);
            }

            // ════════ CLUSTER SUPERIOR (TOP) ════════

            // L01 — "Lançamento" (serifada clara, centralizada no topo)
            addSantaMarinaLayer('L01_lancamento', 'text', lancamentoTxt, {
                fontFamily: "'Cinzel', serif", fontWeight: 400, fontSize: '58px',
                color: tl_sm, textAlign: 'center', letterSpacing: '2px', lineHeight: '70px',
                textShadow: '0 2px 6px rgba(0,0,0,.45)',
            }, 60, 0, 'TOP', 1080, 70);

            // L02 — Título "Santa Marina" (serifada, DEGRADÊ dourado no texto)
            addSantaMarinaLayer('L02_titulo_santa_marina', 'text', titulo, {
                fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: '96px',
                textAlign: 'center', letterSpacing: '6px', lineHeight: '110px',
                backgroundImage: GRAD_SM.gold, webkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                filter: 'drop-shadow(0 3px 5px rgba(0,0,0,.5))',
            }, 130, 0, 'TOP', 1080, 110);

            // L03 — Barra azul "Próximo a Futura Estação..." (Fundo html + Texto editável)
            addSantaMarinaLayer('L03_barra_metro_topo_bg', 'html',
                `<div style="width:100%;height:100%;background:${GRAD_SM.blueBar};border-radius:31px;box-shadow:0 3px 8px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.35);box-sizing:border-box;"></div>`,
                {}, 255, 18, 'TOP', 1044, 62);

            addSantaMarinaLayer('L03_barra_metro_topo_txt', 'text', metroBarTxt, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '34px',
                color: tl_sm, textAlign: 'center', letterSpacing: '.5px', lineHeight: '62px',
                textShadow: '0 2px 3px rgba(0,0,0,.45)',
            }, 255, 18, 'TOP', 1044, 62);

            // L04 — Selos Minha Casa Minha Vida + FGTS/CAIXA (HTML placeholder)
            addSantaMarinaLayer('L04_selos_mcmv', 'html',
                `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;">` +
                    `<div style="background:#FFFFFF;border-radius:50%;padding:6px 12px;box-shadow:0 3px 8px rgba(0,0,0,0.3);text-align:center;">` +
                        `<span style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:12px;color:#0B1F4B;display:block;">Minha Casa</span>` +
                        `<span style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:12px;color:#E2B65A;display:block;">Minha Vida</span>` +
                    `</div>` +
                    `<div style="background:#FFFFFF;border-radius:12px;padding:3px 8px;font-family:'Montserrat',sans-serif;font-weight:800;font-size:10px;color:#0B1F4B;box-shadow:0 2px 4px rgba(0,0,0,0.2);">` +
                        `FGTS | CAIXA` +
                    `</div>` +
                `</div>`,
                {}, 330, 850, 'TOP', 190, 130);

            // L05 — Bloco de preço (BG DEGRADÊ navy + textos editáveis)
            addSantaMarinaLayer('L05_bloco_preco_bg', 'html',
                `<div style="width:100%;height:100%;background:${GRAD_SM.navyBox};border-radius:26px 0 0 26px;box-shadow:0 4px 12px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.18);box-sizing:border-box;"></div>`,
                {}, 500, 710, 'TOP', 370, 155);

            addSantaMarinaLayer('L05_bloco_preco_lbl', 'text', 'Unidades a partir de', {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: '30px',
                color: tl_sm, textAlign: 'left', lineHeight: '34px',
            }, 516, 738, 'TOP', 320, 34);

            addSantaMarinaLayer('L05_bloco_preco_val', 'text', `R$ ${precoVal} MIL`, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '64px',
                color: tl_sm, textAlign: 'left', lineHeight: '90px', letterSpacing: '-1px',
            }, 550, 738, 'TOP', 330, 90);

            // ════════ CLUSTER INFERIOR (BOTTOM) ════════

            // L06 — Plaquinhas do metrô: "Linha 3 - Vermelha" + "◄ BELÉM"
            addSantaMarinaLayer('L06_placa_vermelha_bg', 'html',
                `<div style="width:100%;height:100%;background:${GRAD_SM.redPill};border-radius:20px;box-shadow:0 2px 5px rgba(0,0,0,.5);box-sizing:border-box;"></div>`,
                {}, 334, 565, 'BOTTOM', 215, 38);

            addSantaMarinaLayer('L06_placa_vermelha_txt', 'text', metroLinha, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '20px',
                color: tl_sm, textAlign: 'center', lineHeight: '38px',
            }, 334, 565, 'BOTTOM', 215, 38);

            addSantaMarinaLayer('L06_placa_belem_bg', 'html',
                `<div style="width:100%;height:100%;background:#15181C;border-radius:8px;box-shadow:0 2px 5px rgba(0,0,0,.5);box-sizing:border-box;"></div>`,
                {}, 380, 565, 'BOTTOM', 140, 35);

            addSantaMarinaLayer('L06_placa_belem_txt', 'text', `◄ ${metroEstacao}`, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '20px',
                color: tl_sm, textAlign: 'center', lineHeight: '35px',
            }, 380, 565, 'BOTTOM', 140, 35);

            // L07 — Número "1e2" (branco gigante)
            addSantaMarinaLayer('L07_numero_1e2', 'text', numDorms, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '150px',
                color: tl_sm, textAlign: 'left', lineHeight: '175px', letterSpacing: '-4px',
                textShadow: '0 4px 8px rgba(0,0,0,.55)',
            }, 128, 14, 'BOTTOM', 250, 175);

            // L08 — Label "LAZER COMPLETO COM PISCINA"
            addSantaMarinaLayer('L08_label_lazer', 'text', labelLazer, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '22px',
                color: tl_sm, textAlign: 'center', letterSpacing: '1px', lineHeight: '38px',
                borderTop: `2px solid rgba(255,255,255,.9)`, borderBottom: `2px solid rgba(255,255,255,.9)`,
                textShadow: '0 2px 4px rgba(0,0,0,.5)',
            }, 210, 268, 'BOTTOM', 350, 40);

            // L09 — "DORMS" (DEGRADÊ dourado)
            addSantaMarinaLayer('L09_dorms', 'text', dormsTxt, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '92px',
                textAlign: 'center', letterSpacing: '4px', lineHeight: '82px',
                backgroundImage: GRAD_SM.gold, webkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                filter: 'drop-shadow(0 3px 5px rgba(0,0,0,.5))',
            }, 122, 264, 'BOTTOM', 350, 82);

            // L10 — Barra inferior "OPÇÕES C/TERRAÇO E VAGA"
            addSantaMarinaLayer('L10_barra_opcoes_bg', 'html',
                `<div style="width:100%;height:100%;background:${GRAD_SM.blueBar};border-radius:0 35px 35px 0;box-shadow:0 3px 8px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.35);box-sizing:border-box;"></div>`,
                {}, 48, 0, 'BOTTOM', 690, 70);

            addSantaMarinaLayer('L10_barra_opcoes_txt', 'text', barraOpcoes, {
                fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '38px',
                color: tl_sm, textAlign: 'center', letterSpacing: '1px', lineHeight: '70px',
                textShadow: '0 2px 3px rgba(0,0,0,.45)',
            }, 48, 0, 'BOTTOM', 690, 70);

        } else if (selectedTemplateId === 'luv-tatuape') {
            // ══════════════════════════════════════════════════════════════════════
            // LUV TATUAPÉ — PROMOÇÃO COPA DO MUNDO
            // Engenharia reversa da peça original (339×588px → ref. 1080px)
            // Tokens: bp=#106122 verde escuro | ba=#EDC507 dourado | tl=#FFFFFF branco
            // ══════════════════════════════════════════════════════════════════════

            // — Leitura dos campos editáveis —
            const luv_nomeL1       = custom_fields.nome_l1        || 'LUV';
            const luv_nomeL2       = custom_fields.nome_l2        || '/ TATUAPÉ';
            const luv_pillPromocao = custom_fields.pill_promocao   || 'PROMOÇÃO COPA DO MUNDO';
            const luv_pillLuv      = custom_fields.pill_luv        || 'LUV NA COPA';
            const luv_headlineL1   = custom_fields.headline_l1    || 'A próxima copa';
            const luv_headlineL2   = custom_fields.headline_l2    || 'VOCÊ ASSISTE';
            const luv_headlineL3   = custom_fields.headline_l3    || 'NO SEU APÊ';
            const luv_visiteL1     = custom_fields.visite_l1      || 'Visite o Stand do LUV';
            const luv_visiteL2     = custom_fields.visite_l2      || 'Tatuapé e ganhe um';
            const luv_visiteL3     = custom_fields.visite_l3      || 'Kit Torcedor';
            const luv_labelPreco   = custom_fields.label_unidades || 'Unidades a partir de';
            const luv_valorPreco   = custom_fields.valor_preco    || '330';
            const luv_features     = custom_fields.features       || '2 DORMS | Use seu FGTS';
            const luv_ctaTxt       = (custom_fields.cta_texto     || 'Conheça as\ncondições\nespeciais').replace(/\\n/g, '\n');
            const luv_legal        = (custom_fields.texto_legal   || 'Promoção válida de 01 a 30/06/2026...').replace(/\\n/g, '\n');

            // — Tokens de cor —
            let luv_bp = '#106122'; // verde escuro
            let luv_ba = '#EDC507'; // dourado
            let luv_tl = '#FFFFFF'; // branco

            // Respeita identidade da marca se configurada
            const luv_brandPrimary   = localStorage.getItem('imob_brand_color_primary');
            const luv_brandSecondary = localStorage.getItem('imob_brand_color_secondary');
            if (luv_brandPrimary)   luv_bp = luv_brandPrimary;
            if (luv_brandSecondary) luv_ba = luv_brandSecondary;

            // — Formatos & Safe Zone —
            const luv_isStory    = selectedFormat === 'story';
            const luv_canvasH    = luv_isStory ? 1920 : 1080;
            const luv_safeTop    = luv_isStory ? 250  : 60;
            const luv_safeBottom = luv_isStory ? 260  : 60;

            function resolvePos_luv(cluster, edgeOffset, h) {
                if (cluster === 'TOP') {
                    return Math.max(edgeOffset, luv_safeTop);
                }
                const rawTop = luv_canvasH - edgeOffset - h;
                const maxTop = luv_canvasH - luv_safeBottom - h;
                return Math.min(rawTop, maxTop);
            }

            function addLuvLayer(name, type, content, style, edgeOffset, left, cluster, width, height) {
                const top = resolvePos_luv(cluster, edgeOffset, height);
                let cssText = '';
                const styleObj = { ...style, position: 'absolute', width: `${width}px`, height: `${height}px` };
                for (const [k, v] of Object.entries(styleObj)) {
                    const kebabKey = k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
                    cssText += `${kebabKey}:${v}; `;
                }
                addLayer(name, type, content, cssText, `${top}px`, `${left}px`, 'NONE', `${width}px`, `${height}px`);
            }

            // ════════ CLUSTER SUPERIOR (TOP) ════════

            // L01 — Selo Minha Casa Minha Vida
            addLuvLayer('L01_selo_mcmv', 'html',
                `<div style="display:flex;align-items:center;gap:8px;width:100%;height:100%;">
                   <i class="fa-solid fa-house" style="color:${luv_tl};font-size:22px;"></i>
                   <div style="font-family:'Montserrat',sans-serif;font-weight:700;font-size:13px;line-height:1.2;color:${luv_tl};text-shadow:0 1px 2px rgba(0,0,0,.5);">Minha Casa<br>Minha Vida</div>
                 </div>`,
                {}, 45, 25, 'TOP', 280, 83
            );

            // L02 — Crescente verde decorativo (canto sup. dir.)
            addLuvLayer('L02_crescente_verde', 'html',
                `<div style="width:100%;height:100%;border:12px solid ${luv_bp};border-right-color:transparent;border-bottom-color:transparent;border-radius:50%;opacity:0.75;transform:rotate(200deg);"></div>`,
                { overflow: 'visible' }, 105, 679, 'TOP', 51, 127
            );

            // L03 — Crescente dourado decorativo (canto sup. dir.)
            addLuvLayer('L03_crescente_dourado', 'html',
                `<div style="width:100%;height:100%;border:10px solid ${luv_ba};border-right-color:transparent;border-bottom-color:transparent;border-radius:50%;opacity:0.9;transform:rotate(205deg);"></div>`,
                { overflow: 'visible' }, 48, 933, 'TOP', 89, 185
            );

            // L06 — Título Nome (ex: "LUV")
            addLuvLayer('L06_titulo', 'text', luv_nomeL1,
                {
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '78px',
                    color: luv_tl, letterSpacing: '1px', lineHeight: '1',
                    textShadow: '0 2px 6px rgba(0,0,0,.3)',
                },
                239, 567, 'TOP', 188, 70
            );

            // L07 — Subtítulo (ex: "/ TATUAPÉ")
            addLuvLayer('L07_subtitulo', 'text', luv_nomeL2,
                {
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 300, fontSize: '32px',
                    color: luv_tl, letterSpacing: '6px', lineHeight: '1',
                },
                248, 765, 'TOP', 239, 41
            );

            // L08 — BG Pill "PROMOÇÃO COPA DO MUNDO"
            addLuvLayer('L08_pill_promocao_bg', 'html',
                `<div style="width:100%;height:100%;background:${luv_bp};border-radius:999px;border:2px solid rgba(255,255,255,.5);"></div>`,
                {}, 335, 567, 'TOP', 472, 51
            );

            // L09 — Texto Pill Promoção
            addLuvLayer('L09_pill_promocao_txt', 'html',
                `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-size:22px;color:${luv_tl};white-space:nowrap;">
                   <span style="font-weight:500;">PROMOÇÃO&nbsp;</span><span style="font-weight:800;">${luv_pillPromocao.replace('PROMOÇÃO ', '').replace('Promoção ', '')}</span>
                 </div>`,
                {}, 344, 583, 'TOP', 440, 35
            );

            // L10 — Ícone bola de futebol
            addLuvLayer('L10_icone_bola', 'html',
                `<i class="fa-solid fa-futbol" style="font-size:60px;color:${luv_tl};text-shadow:0 2px 4px rgba(0,0,0,.3);"></i>`,
                { display: 'flex', alignItems: 'center', justifyContent: 'center' }, 395, 618, 'TOP', 96, 83
            );

            // L11 — BG Pill LUV NA COPA (dourado)
            addLuvLayer('L11_pill_luv_bg', 'html',
                `<div style="width:100%;height:100%;background:${luv_ba};border-radius:999px;"></div>`,
                {}, 395, 723, 'TOP', 315, 76
            );

            // L12 — Texto Pill LUV NA COPA
            addLuvLayer('L12_pill_luv_txt', 'text', luv_pillLuv,
                {
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '30px',
                    color: luv_bp, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: '76px', textAlign: 'center',
                },
                408, 765, 'TOP', 255, 76
            );

            // L13 — BG Box Headline (verde, borda)
            addLuvLayer('L13_box_headline_bg', 'html',
                `<div style="width:100%;height:100%;background:${luv_bp};border:2px solid rgba(255,255,255,.55);border-radius:18px;"></div>`,
                {}, 484, 564, 'TOP', 472, 220
            );

            // L14 — Headline 3 linhas
            addLuvLayer('L14_headline', 'html',
                `<div style="font-family:'Montserrat',sans-serif;color:${luv_tl};line-height:1.18;">
                   <div style="font-weight:400;font-size:30px;">${luv_headlineL1}</div>
                   <div style="font-weight:800;font-size:38px;color:${luv_ba};">${luv_headlineL2}<br>${luv_headlineL3}</div>
                 </div>`,
                {}, 494, 612, 'TOP', 398, 185
            );

            // L15 — Ícone Presente (gift)
            addLuvLayer('L15_icone_gift', 'html',
                `<i class="fa-solid fa-gift" style="font-size:44px;color:${luv_tl};"></i>`,
                { display: 'flex', alignItems: 'center', justifyContent: 'center' }, 726, 478, 'TOP', 76, 76
            );

            // L16 — Texto "Visite o Stand..."
            addLuvLayer('L16_visite', 'html',
                `<div style="font-family:'Montserrat',sans-serif;font-weight:400;font-size:22px;color:${luv_tl};line-height:1.3;">
                   ${luv_visiteL1}<br>${luv_visiteL2}<br><span style="font-weight:800;color:${luv_ba};">${luv_visiteL3}</span>
                 </div>`,
                {}, 717, 573, 'TOP', 376, 115
            );

            // ════════ CLUSTER INFERIOR (BOTTOM) ════════

            // L17 — BG Bloco de Preço (degradê)
            addLuvLayer('L17_preco_bg', 'html',
                `<div style="width:100%;height:100%;background:linear-gradient(135deg, ${luv_bp} 0%, ${luv_ba} 100%);border:2px solid rgba(255,255,255,.45);border-radius:16px;"></div>`,
                {}, 293, 564, 'BOTTOM', 475, 252
            );

            // L18 — Label "Unidades a partir de"
            addLuvLayer('L18_label_preco', 'text', luv_labelPreco,
                {
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: '22px',
                    color: luv_tl, lineHeight: '1',
                },
                477, 583, 'BOTTOM', 366, 45
            );

            // L19 — Valor "R$ 330 mil"
            addLuvLayer('L19_valor', 'html',
                `<div style="display:flex;align-items:flex-end;gap:6px;font-family:'Montserrat',sans-serif;color:${luv_tl};line-height:1;">
                   <span style="font-weight:600;font-size:28px;padding-bottom:12px;">R$</span>
                   <span style="font-weight:800;font-size:96px;">${luv_valorPreco}</span>
                   <span style="font-weight:600;font-size:28px;padding-bottom:8px;">mil</span>
                 </div>`,
                {}, 384, 583, 'BOTTOM', 398, 108
            );

            // L20 — Linha divisória
            addLuvLayer('L20_linha', 'html',
                `<div style="width:100%;height:2px;background:rgba(255,255,255,.5);"></div>`,
                { display: 'flex', alignItems: 'center' }, 216, 583, 'BOTTOM', 382, 6
            );

            // L21 — Features ("2 DORMS | Use seu FGTS")
            addLuvLayer('L21_features', 'text', luv_features,
                {
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '24px',
                    color: luv_tl, lineHeight: '1', whiteSpace: 'nowrap',
                },
                208, 583, 'BOTTOM', 446, 38
            );

            // L22 — BG Badge CTA (dourado)
            addLuvLayer('L22_cta_bg', 'html',
                `<div style="width:100%;height:100%;background:${luv_ba};border-radius:20px;"></div>`,
                {}, 168, 688, 'BOTTOM', 347, 169
            );

            // L23 — Ícone CTA
            addLuvLayer('L23_cta_icone', 'html',
                `<i class="fa-solid fa-file-contract" style="font-size:40px;color:${luv_bp};"></i>`,
                { display: 'flex', alignItems: 'center', justifyContent: 'center' }, 106, 733, 'BOTTOM', 70, 70
            );

            // L24 — Texto CTA
            addLuvLayer('L24_cta_txt', 'text', luv_ctaTxt,
                {
                    fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: '22px',
                    color: luv_bp, lineHeight: '1.25', whiteSpace: 'pre-line',
                },
                82, 835, 'BOTTOM', 198, 96
            );

            // L25 — BG Box Rodapé Legal (degradê)
            addLuvLayer('L25_footer_bg', 'html',
                `<div style="width:100%;height:100%;background:linear-gradient(120deg, ${luv_bp} 0%, ${luv_ba} 100%);border:1px solid rgba(255,255,255,.35);border-radius:14px;"></div>`,
                {}, 197, 64, 'BOTTOM', 781, 185
            );

            // L26 — Texto Legal
            addLuvLayer('L26_legal', 'html',
                `<div style="font-family:'Montserrat',sans-serif;font-weight:400;font-size:13px;line-height:1.3;color:${luv_tl};">${luv_legal.replace(/\n/g, '<br>')}</div>`,
                {}, 215, 86, 'BOTTOM', 717, 153
            );

            // L27 — Selo HIS
            addLuvLayer('L27_his', 'html',
                `<div style="width:100%;height:100%;border-radius:50%;background:rgba(255,255,255,.9);border:2px solid #111;display:flex;align-items:center;justify-content:center;">
                   <span style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:20px;color:#111;letter-spacing:.5px;">HIS</span>
                 </div>`,
                {}, 193, 870, 'BOTTOM', 143, 143
            );

        } else {

            // 3) Insere as camadas de texto programaticamente
            const nome1 = custom_fields.nome1 || 'NOME';
            const nome2 = custom_fields.nome2 || 'EMPREENDIMENTO';
            const construtora = custom_fields.construtora || '';
            const impacto1 = custom_fields.impacto1 || 'NOVO LAR';
            const impacto2 = custom_fields.impacto2 || 'para a família';
            const loc = custom_fields.localizacao || 'BAIRRO • UF';
            const tagline = custom_fields.tagline || 'Tagline de duas linhas\naqui.';
            const entrada = custom_fields.entrada || '200';
            const dorms = custom_fields.dormitorios || '2';
            const vagas = custom_fields.vagas || '1';
            const andares = custom_fields.andares || '15';
            const lazer = custom_fields.destaque_lazer || 'LAZER';
            const amenidadesStr = custom_fields.amenidades || 'A,B,C,D,E,F';
            const amenidades = amenidadesStr.split(',').map(s=>s.trim());

            addLayer("Nome 1", "text", nome1.toUpperCase(), `font-size:4rem; font-weight:800; color:${c1}; font-family:${font}; text-transform:uppercase; max-width:40vw;`, '12%', '5%');
            addLayer("Nome 2", "text", nome2.toUpperCase(), `font-size:3rem; font-weight:800; color:${c1}; font-family:${font}; text-transform:uppercase; max-width:40vw;`, '20%', '5%');
            
            if (construtora) {
                addLayer("By Construtora", "text", "by <b>" + construtora + "</b>", `font-size:1.2rem; color:${c1}; font-family:${font};`, '26%', '5%');
            }
            
            addLayer("Headline 1", "text", impacto1.toUpperCase(), `font-size:2rem; font-weight:800; color:${c1}; font-family:${font}; text-align:right; text-transform:uppercase; max-width:35vw;`, '8%', '62%');
            addLayer("Headline 2", "text", impacto2.toLowerCase(), `font-size:2.5rem; font-family: 'Brush Script MT', cursive; color:#FFA726; text-align:right;`, '13%', '60%');
            
            addLayer("Pill Localização", "text", loc.toUpperCase(), `font-size:1rem; font-weight:700; color:#FFFFFF; font-family:${font}; text-transform:uppercase; max-width:30vw;`, '19%', '62%');
            
            addLayer("Tagline", "text", tagline, `font-size:1.2rem; color:${c1}; font-family:${font}; max-width: 45%;`, '34%', '5%');
            
            addLayer("Entrada Valor", "text", `ENTRADA A PARTIR DE<br><span style="font-size:4rem; color:#FFA726; font-weight:800;">R$ ${entrada}</span>`, `font-size:1.2rem; font-weight:700; color:${c1}; font-family:${font};`, '46%', '6%');

            addLayer("Feat 1", "text", `${dorms} DORMITÓRIOS`, `font-size:1.2rem; font-weight:700; color:${c1}; font-family:${font}; text-transform:uppercase;`, '60%', '14%');
            addLayer("Feat 2", "text", `${vagas} VAGA(S)`, `font-size:1.2rem; font-weight:700; color:${c1}; font-family:${font}; text-transform:uppercase;`, '66%', '14%');
            addLayer("Feat 3", "text", `${andares} ANDARES`, `font-size:1.2rem; font-weight:700; color:${c1}; font-family:${font}; text-transform:uppercase;`, '72%', '14%');
            addLayer("Feat 4", "text", `${lazer}`, `font-size:1.2rem; font-weight:700; color:${c1}; font-family:${font}; text-transform:uppercase;`, '78%', '14%');

            // Amenidades rodapé
            const amXStart = 2;
            const amXStep = 100 / 7;
            for (let i=0; i<Math.min(6, amenidades.length); i++) {
                addLayer("Amenidade " + (i+1), "text", amenidades[i].toUpperCase(), `font-size:0.8rem; font-weight:700; color:#FFFFFF; font-family:${font}; text-align:center; max-width:13%;`, '94%', `${amXStart + (i * amXStep)}%`);
            }
        }
    } else {
        const headline = custom_fields.headline || '';
        const text = custom_fields.text || '';
        const location = custom_fields.location || '';
        const desc = custom_fields.desc || '';
        const cta = custom_fields.cta || '';

        // Add layer for Location (badge style)
        if (location) {
            addLayer("Localização (Selo)", "text", location, `font-size:0.9rem; font-weight:700; color:#FFFFFF; background:${c2}; padding: 6px 16px; border-radius: 20px; font-family:${font}; max-width:280px; text-transform:uppercase; text-align:center; display:inline-block;`, '5%', '5%');
        }
        
        // Add layer for Headline (Título Principal)
        if (headline) {
            addLayer("Título Principal", "text", headline, `font-size:2.8rem; font-weight:800; color:${c1}; font-family:${font}; line-height:1.2; text-shadow: 0 2px 4px rgba(0,0,0,0.15);`, '12%', '5%');
        }

        // Add layer for Aux Text (Benefício)
        if (text) {
            addLayer("Texto Auxiliar", "text", text, `font-size:1.3rem; font-weight:500; color:${c1}; opacity:0.85; font-family:${font};`, '25%', '5%');
        }

        // Add layer for Descrição (Subtexto)
        if (desc) {
            addLayer("Descrição (Subtexto)", "text", desc, `font-size:1.1rem; font-weight:400; color:#FFFFFF; opacity:0.75; font-family:${font}; line-height:1.4;`, '74%', '5%');
        }

        // Add layer for CTA Button
        if (cta) {
            addLayer("Botão CTA", "text", cta, `font-size:1rem; font-weight:700; color:#000000; background:#FFFFFF; padding: 12px 28px; border-radius: 8px; font-family:${font}; text-transform: uppercase; letter-spacing:0.05em; box-shadow: 0 4px 12px rgba(0,0,0,0.15); text-align:center;`, '84%', '5%');
        }
    }
    
    const brandLogo = localStorage.getItem('imob_brand_logo') || (typeof loggedUser !== 'undefined' && loggedUser ? loggedUser.logo_url : null);
    if (brandLogo && category !== 'mcmv') {
        addLayer("Logo", "image", brandLogo, `max-width:180px; max-height:80px;`, '85%', '70%');
    }

    reflowLayout(editorLayers, selectedFormat);

    console.log('[EDITOR] renderInteractiveOverlay: total de camadas criadas:', editorLayers.length, editorLayers.map(l=>l.name));

    // Atualiza dinamicamente a imagem de fundo do editor (#success-preview-img) com o crop correto (1:1 ou 9:16)
    const approvalImg = document.getElementById('success-preview-img');
    if (approvalImg) {
        let targetBg = null;
        if (typeof uploadedProductImage !== 'undefined' && uploadedProductImage) {
            const isStory = selectedFormat === 'story';
            const isPlanta = isTemplate45();
            const cropW = 1080;
            const cropH = isStory ? 1920 : (isPlanta ? 1350 : 1080);
            targetBg = getCroppedBase64(uploadedProductImage, cropW, cropH);
        } else if (selectedFormat === 'story' && typeof croppedImage916 !== 'undefined' && croppedImage916) {
            targetBg = croppedImage916;
        } else if (selectedFormat !== 'story' && typeof croppedImage11 !== 'undefined' && croppedImage11) {
            targetBg = croppedImage11;
        }
        if (!targetBg) {
            targetBg = window.lastGeneratedBgImage || aiRawImageUrl || ((templateObj && templateObj.bgImage) ? templateObj.bgImage : '/imovel/Assets/lancamento_centro_niteroi.jpg');
        }

        approvalImg.src = targetBg;
        window.lastGeneratedBgImage = targetBg;
        aiRawImageUrl = targetBg;
        
        const canvasImg = new Image();
        canvasImg.onload = () => {
            window._studioBgImage = canvasImg;
            const canvas = document.getElementById('studio-canvas');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                const imgRatio = canvasImg.naturalWidth / canvasImg.naturalHeight;
                const canvasRatio = canvas.width / canvas.height;
                let drawW, drawH, drawX, drawY;
                if (imgRatio > canvasRatio) {
                    drawH = canvas.height;
                    drawW = canvas.height * imgRatio;
                    drawX = (canvas.width - drawW) / 2;
                    drawY = 0;
                } else {
                    drawW = canvas.width;
                    drawH = canvas.width / imgRatio;
                    drawX = 0;
                    drawY = (canvas.height - drawH) / 2;
                }
                ctx.drawImage(canvasImg, drawX, drawY, drawW, drawH);
            }
        };
        canvasImg.src = targetBg;
    }

    renderEditorProLayers();
}

// Renderiza tudo (Canvas, Sidebar Layers, Properties Panel)
function renderEditorProLayers() {
    const artboard = document.getElementById("text-overlay-layer");
    const listPanel = document.getElementById("editor-layer-list");
    console.log('[EDITOR] renderEditorProLayers. artboard:', !!artboard, 'listPanel:', !!listPanel, 'layers:', editorLayers.length);
    if (!artboard || !listPanel) return;

    artboard.innerHTML = "";
    listPanel.innerHTML = "";

    // ── SIDEBAR: exibe em ordem INVERSA (topo da lista = maior z-index = "frente") ──
    const reversedLayers = [...editorLayers].reverse();
    reversedLayers.forEach((layer) => {
        const item = document.createElement("div");
        item.id = "layer-item-" + layer.id;
        item.className = "editor-layer-item" + (activeLayerIds.includes(layer.id) ? " active" : "");
        item.onclick = (e) => { e.stopPropagation(); selectLayer(layer.id); };

        // HTML5 Drag and Drop
        item.setAttribute('draggable', 'true');
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', layer.id);
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            document.querySelectorAll('.editor-layer-item').forEach(el => el.classList.remove('drag-over'));
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        item.addEventListener('dragenter', (e) => {
            e.preventDefault();
            if (!item.classList.contains('dragging')) {
                item.classList.add('drag-over');
            }
        });

        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over');
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.classList.remove('drag-over');
            
            const draggedId = e.dataTransfer.getData('text/plain');
            if (draggedId === layer.id) return;

            const draggedIdx = editorLayers.findIndex(l => l.id === draggedId);
            const targetIdx = editorLayers.findIndex(l => l.id === layer.id);
            
            if (draggedIdx !== -1 && targetIdx !== -1) {
                saveEditorState();
                const [draggedLayer] = editorLayers.splice(draggedIdx, 1);
                // Insere no novo índice alvo recalculado
                editorLayers.splice(editorLayers.findIndex(l => l.id === layer.id), 0, draggedLayer);
                renderEditorProLayers();
            }
        });

        let iconClass = layer.type === 'text' ? 'fa-t' : (layer.type === 'image' ? 'fa-image' : 'fa-square');
        item.innerHTML = `
            <div class="editor-layer-icon"><i class="fa-solid ${iconClass}"></i></div>
            <div class="editor-layer-name" style="${!layer.visible ? 'text-decoration: line-through; opacity: 0.5;' : ''}">${layer.name}</div>
            <div class="editor-layer-actions">
                <i class="fa-solid fa-chevron-up layer-reorder-btn" title="Trazer para frente" onclick="event.stopPropagation(); moveLayerUp('${layer.id}')"></i>
                <i class="fa-solid fa-chevron-down layer-reorder-btn" title="Enviar para trás" onclick="event.stopPropagation(); moveLayerDown('${layer.id}')"></i>
                <i class="fa-solid ${layer.locked ? 'fa-lock' : 'fa-lock-open'}" onclick="event.stopPropagation(); toggleLayerLock('${layer.id}')"></i>
                <i class="fa-solid ${layer.visible ? 'fa-eye' : 'fa-eye-slash'}" onclick="event.stopPropagation(); toggleLayerVisibility('${layer.id}')"></i>
            </div>
        `;
        listPanel.appendChild(item);
    });

    // ── ARTBOARD: exibe em ordem NORMAL (índice 0 = z-index mais baixo = "fundo") ──
    // Shapes adicionados primeiro (■) ficam embaixo dos textos adicionados depois.
    // A imagem de fundo (bg-image) tem z-index:1 via CSS — sempre abaixo de tudo.
    editorLayers.forEach((layer, idx) => {
        if (!layer.visible) return;

        const el = document.createElement("div");
        el.className = "editor-element" + (activeLayerIds.includes(layer.id) ? " selected" : "");
        el.id = "el-" + layer.id;
        el.style.cssText = layer.cssText;
        el.style.top = layer.top;
        el.style.left = layer.left;
        // z-index explícito: garante que a ordem de sobreposição reflita o array
        el.style.zIndex = idx + 2; // +2 garante que fique sempre acima do bg (z-index:1)
        
        el.dataset.type = layer.type;

        if (layer.type === 'text') {
            el.innerHTML = escapeHTML(layer.content).replace(/\n/g, "<br>");
            if (!layer.locked) el.contentEditable = "true";
            
            el.addEventListener('focus', () => {
                saveEditorState();
            });
            
            el.addEventListener('input', (e) => {
                layer.content = e.target.innerText;
            });
        } else if (layer.type === 'image') {
            const img = document.createElement("img");
            img.src = layer.content;
            img.crossOrigin = "anonymous";
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.pointerEvents = "none";
            el.appendChild(img);
        } else if (layer.type === 'html') {
            el.innerHTML = layer.content;
            // Bloqueia eventos nos filhos para não interferir no drag
            el.querySelectorAll('*').forEach(child => {
                child.style.pointerEvents = 'none';
            });
        }

        // Drag Logic (if not locked)
        if (!layer.locked) {
            let isDragging = false;
            let startX, startY, initialLeft, initialTop;
            
            el.addEventListener('mousedown', (e) => {
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                    const isMulti = e.shiftKey || e.ctrlKey || e.metaKey;
                    if (!activeLayerIds.includes(layer.id) || isMulti) {
                        selectLayer(layer.id, isMulti);
                    }
                    saveEditorState();
                    isDragging = true;
                    startX = e.clientX;
                    startY = e.clientY;
                    
                    dragGroup = [];
                    activeLayerIds.forEach(id => {
                        const targetEl = document.getElementById("el-" + id);
                        if (targetEl) {
                            let cLeft = targetEl.offsetLeft;
                            let cTop = targetEl.offsetTop;
                            targetEl.style.left = cLeft + 'px';
                            targetEl.style.top = cTop + 'px';
                            dragGroup.push({ id: id, el: targetEl, initialLeft: cLeft, initialTop: cTop });
                        }
                    });
                    
                    e.stopPropagation();
                }
            });
            document.addEventListener('mousemove', (e) => {
                if (!isDragging || dragGroup.length === 0) return;
                const dx = (e.clientX - startX) / editorZoom;
                const dy = (e.clientY - startY) / editorZoom;
                
                dragGroup.forEach(item => {
                    item.el.style.left = (item.initialLeft + dx) + 'px';
                    item.el.style.top = (item.initialTop + dy) + 'px';
                    const lr = editorLayers.find(l => l.id === item.id);
                    if (lr) {
                        lr.left = item.el.style.left;
                        lr.top = item.el.style.top;
                    }
                });
            });
            document.addEventListener('mouseup', () => { isDragging = false; dragGroup = []; });
        }

        artboard.appendChild(el);

        // Attach resize handles for selected elements
        if (activeLayerIds.includes(layer.id) && (layer.type === 'html' || layer.type === 'image' || layer.type === 'text')) {
            setTimeout(() => attachResizeHandles(el, layer), 0);
        }
    });

    // --- 3. Guias de Alinhamento Central (Rulers) ---
    const rulerV = document.createElement("div");
    rulerV.className = "editor-ruler-v" + (activeLayerIds.length > 0 ? " visible" : "");
    artboard.appendChild(rulerV);

    const rulerH = document.createElement("div");
    rulerH.className = "editor-ruler-h" + (activeLayerIds.length > 0 ? " visible" : "");
    artboard.appendChild(rulerH);

    // --- 4. Guias de Safe Zone ---
    if (typeof drawSafeZoneGuides === 'function') {
        drawSafeZoneGuides();
    }

    renderPropertiesPanel();

    if (typeof captureReferenceSnapshot === 'function') {
        captureReferenceSnapshot();
    }
}

// ==========================================================================
// CONTROLE DE SAFE ZONES (ZONAS SEGURAS)
// ==========================================================================
window.showSafeZoneGuides = false;

window.toggleSafeZoneGuides = function() {
    window.showSafeZoneGuides = !window.showSafeZoneGuides;
    const btn = document.getElementById('toolbar-btn-safezone');
    if (btn) {
        btn.classList.toggle('active', window.showSafeZoneGuides);
    }
    renderEditorProLayers();
};

function drawSafeZoneGuides() {
    const artboard = document.getElementById("interactive-overlay-wrapper");
    if (!artboard || !window.showSafeZoneGuides) return;

    // Remove existing safe zone container if any
    const existing = document.getElementById("editor-safe-zone-container");
    if (existing) existing.remove();

    const isStory = selectedFormat === 'story';
    const isPlanta = isTemplate45();
    const W = 1080;
    const H = isStory ? 1920 : (isPlanta ? 1350 : 1080);

    const guideContainer = document.createElement("div");
    guideContainer.id = "editor-safe-zone-container";
    guideContainer.style.position = "absolute";
    guideContainer.style.top = "0";
    guideContainer.style.left = "0";
    guideContainer.style.width = "100%";
    guideContainer.style.height = "100%";
    guideContainer.style.pointerEvents = "none";
    guideContainer.style.zIndex = "99998";

    if (isStory) {
        // Stories & Reels (9:16): 15% top, 20% bottom free
        const topY = H * 0.15;
        const bottomY = H * 0.80; // 20% from bottom

        // Top horizontal line
        const topGuide = document.createElement("div");
        topGuide.className = "editor-safe-zone-guide";
        topGuide.style.top = topY + "px";
        topGuide.innerHTML = `<span class="editor-safe-zone-label" style="top: -16px; left: 20px;">⚠️ REELS/STORIES - LIVRE NO TOPO (15%)</span>`;
        guideContainer.appendChild(topGuide);

        // Bottom horizontal line
        const bottomGuide = document.createElement("div");
        bottomGuide.className = "editor-safe-zone-guide";
        bottomGuide.style.top = bottomY + "px";
        bottomGuide.innerHTML = `<span class="editor-safe-zone-label" style="top: 6px; left: 20px;">⚠️ REELS/STORIES - LIVRE NA BASE (20%)</span>`;
        guideContainer.appendChild(bottomGuide);
    } else {
        // Feed (1:1 or 4:5): margin on sides (8%) and bottom (10%)
        const leftX = W * 0.08;
        const rightX = W * 0.92;
        const bottomY = H * 0.90;

        // Left vertical line
        const leftGuide = document.createElement("div");
        leftGuide.className = "editor-safe-zone-guide vertical";
        leftGuide.style.left = leftX + "px";
        leftGuide.innerHTML = `<span class="editor-safe-zone-label" style="top: 40px; left: 8px; transform: rotate(90deg); transform-origin: top left;">⚠️ MARGEM ESQUERDA (FEED)</span>`;
        guideContainer.appendChild(leftGuide);

        // Right vertical line
        const rightGuide = document.createElement("div");
        rightGuide.className = "editor-safe-zone-guide vertical";
        rightGuide.style.left = rightX + "px";
        rightGuide.innerHTML = `<span class="editor-safe-zone-label" style="top: 150px; left: -140px; transform: rotate(-90deg); transform-origin: top right; text-align: right; width: 130px;">⚠️ MARGEM DIREITA (FEED)</span>`;
        guideContainer.appendChild(rightGuide);

        // Bottom horizontal line
        const bottomGuide = document.createElement("div");
        bottomGuide.className = "editor-safe-zone-guide";
        bottomGuide.style.top = bottomY + "px";
        bottomGuide.innerHTML = `<span class="editor-safe-zone-label" style="top: -16px; left: 20px;">⚠️ LIMITE INFERIOR (FEED 10%)</span>`;
        guideContainer.appendChild(bottomGuide);
    }

    artboard.appendChild(guideContainer);
}

function selectLayer(id, multi = false) {
    if (multi) {
        if (activeLayerIds.includes(id)) {
            activeLayerIds = activeLayerIds.filter(x => x !== id);
        } else {
            activeLayerIds.push(id);
        }
    } else {
        if (activeLayerIds.length === 1 && activeLayerIds[0] === id) return;
        activeLayerIds = [id];
    }
    
    // Atualiza a classe 'selected' no Artboard
    document.querySelectorAll('.editor-element').forEach(el => {
        const layerId = el.id.replace('el-', '');
        if (activeLayerIds.includes(layerId)) {
            el.classList.add('selected');
            const layer = editorLayers.find(l => l.id === layerId);
            if (layer && (layer.type === 'html' || layer.type === 'image' || layer.type === 'text')) {
                if (!el.querySelector('.resize-handle')) {
                    attachResizeHandles(el, layer);
                }
            }
        } else {
            el.classList.remove('selected');
            el.querySelectorAll('.resize-handle').forEach(h => h.remove());
        }
    });

    // Atualiza a classe 'active' na lista lateral
    document.querySelectorAll('.editor-layer-item').forEach(el => {
        const layerId = el.id.replace('layer-item-', '');
        if (activeLayerIds.includes(layerId)) el.classList.add('active');
        else el.classList.remove('active');
    });

    // Atualiza o painel de propriedades
    renderPropertiesPanel();
}

function selectLayers(ids) {
    activeLayerIds = ids;
    
    // Atualiza a classe 'selected' no Artboard
    document.querySelectorAll('.editor-element').forEach(el => {
        const layerId = el.id.replace('el-', '');
        if (activeLayerIds.includes(layerId)) {
            el.classList.add('selected');
            const layer = editorLayers.find(l => l.id === layerId);
            if (layer && (layer.type === 'html' || layer.type === 'image' || layer.type === 'text')) {
                if (!el.querySelector('.resize-handle')) {
                    attachResizeHandles(el, layer);
                }
            }
        } else {
            el.classList.remove('selected');
            el.querySelectorAll('.resize-handle').forEach(h => h.remove());
        }
    });

    // Atualiza a classe 'active' na lista lateral
    document.querySelectorAll('.editor-layer-item').forEach(el => {
        const layerId = el.id.replace('layer-item-', '');
        if (activeLayerIds.includes(layerId)) el.classList.add('active');
        else el.classList.remove('active');
    });

    // Atualiza o painel de propriedades
    renderPropertiesPanel();
}

function setupEditorDragSelection() {
    const artboard = document.getElementById("text-overlay-layer");
    if (!artboard) return;

    let isSelecting = false;
    let startX = 0;
    let startY = 0;
    let marquee = null;
    let initialSelection = [];

    artboard.addEventListener('mousedown', (e) => {
        // Apenas inicia a seleção por arraste se o clique foi diretamente no background (no próprio container)
        // E se for o botão esquerdo (button === 0)
        if (e.target !== artboard || e.button !== 0) return;

        isSelecting = true;
        
        // Verifica se está segurando Ctrl, Shift ou Meta para multi-seleção
        const isMulti = e.shiftKey || e.ctrlKey || e.metaKey;
        if (isMulti) {
            initialSelection = [...activeLayerIds];
        } else {
            initialSelection = [];
            selectLayers([]); // Limpa a seleção atual se clicar no fundo sem segurar modificadores
        }

        const rect = artboard.getBoundingClientRect();
        // Coordenadas locais (1080xH) levando em conta a escala (zoom)
        startX = (e.clientX - rect.left) / editorZoom;
        startY = (e.clientY - rect.top) / editorZoom;

        // Cria a marquee div
        marquee = document.createElement('div');
        marquee.className = 'editor-selection-marquee';
        marquee.style.left = startX + 'px';
        marquee.style.top = startY + 'px';
        marquee.style.width = '0px';
        marquee.style.height = '0px';
        artboard.appendChild(marquee);

        e.preventDefault();
        e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isSelecting || !marquee) return;

        const rect = artboard.getBoundingClientRect();
        const currentX = (e.clientX - rect.left) / editorZoom;
        const currentY = (e.clientY - rect.top) / editorZoom;

        const x = Math.min(startX, currentX);
        const y = Math.min(startY, currentY);
        const w = Math.abs(startX - currentX);
        const h = Math.abs(startY - currentY);

        marquee.style.left = x + 'px';
        marquee.style.top = y + 'px';
        marquee.style.width = w + 'px';
        marquee.style.height = h + 'px';

        // Descobre quais elementos interceptam a marquee
        const intersectingIds = [];
        
        // Percorre todas as camadas do editor
        editorLayers.forEach(layer => {
            // Apenas camadas visíveis e não travadas podem ser selecionadas
            if (!layer.visible || layer.locked) return;

            const el = document.getElementById("el-" + layer.id);
            if (!el) return;

            const elLeft = el.offsetLeft;
            const elTop = el.offsetTop;
            const elWidth = el.offsetWidth;
            const elHeight = el.offsetHeight;
            const elRight = elLeft + elWidth;
            const elBottom = elTop + elHeight;

            const marqueeRight = x + w;
            const marqueeBottom = y + h;

            const intersects = (elLeft < marqueeRight &&
                                elRight > x &&
                                elTop < marqueeBottom &&
                                elBottom > y);

            if (intersects) {
                intersectingIds.push(layer.id);
            }
        });

        // Atualiza a seleção
        let finalSelection = [...initialSelection];
        const isMulti = e.shiftKey || e.ctrlKey || e.metaKey;

        if (isMulti) {
            // Na multi-seleção por box, combinamos a seleção inicial com os novos elementos intersectados
            intersectingIds.forEach(id => {
                if (!finalSelection.includes(id)) {
                    finalSelection.push(id);
                }
            });
        } else {
            finalSelection = intersectingIds;
        }

        selectLayers(finalSelection);
    });

    document.addEventListener('mouseup', () => {
        if (isSelecting) {
            isSelecting = false;
            if (marquee) {
                marquee.remove();
                marquee = null;
            }
            initialSelection = [];
        }
    });
}

function toggleLayerVisibility(id) {
    const layer = editorLayers.find(l => l.id === id);
    if (layer) { saveEditorState(); layer.visible = !layer.visible; renderEditorProLayers(); }
}

function toggleLayerLock(id) {
    const layer = editorLayers.find(l => l.id === id);
    if (layer) { saveEditorState(); layer.locked = !layer.locked; renderEditorProLayers(); }
}

function renderPropertiesPanel() {
    const panel = document.getElementById("editor-props-panel");
    if (!panel) return;

    const bgSection = `
      <div class="props-bg-section">
        <div class="editor-prop-label" style="margin-bottom:8px;">IMAGEM DE FUNDO</div>
        <button class="props-bg-btn" onclick="triggerBgImageUpload()">
          <i class="fa-solid fa-image"></i> Trocar imagem de fundo
        </button>
        <input type="file" id="prop-bg-input" accept="image/*" style="display:none;" onchange="handleBgImageUpload(event)" />
      </div>`;

    if (activeLayerIds.length === 0) {
        panel.innerHTML = `<div class="editor-empty-props"><i class="fa-solid fa-hand-pointer"></i>Selecione um elemento para editar.</div>${bgSection}`;
        return;
    }

    let isMultiSameType = false;
    let typeName = "";
    if (activeLayerIds.length > 1) {
        const firstLayer = editorLayers.find(l => l.id === activeLayerIds[0]);
        if (firstLayer) {
            const hasSameType = activeLayerIds.every(id => {
                const l = editorLayers.find(ly => ly.id === id);
                return l && l.type === firstLayer.type;
            });
            if (hasSameType) {
                isMultiSameType = true;
                typeName = firstLayer.type === 'text' ? 'TEXTOS' : firstLayer.type === 'image' ? 'IMAGENS' : 'ÍCONES';
            }
        }
    }

    if (activeLayerIds.length > 1 && !isMultiSameType) {
        panel.innerHTML = `<div class="props-header"><span class="props-layer-name">MÚLTIPLOS (${activeLayerIds.length})</span></div>
            <div style="padding:20px; text-align:center; color:var(--color-text-muted); font-size:0.8rem;">Múltiplos formatos selecionados</div>
            <div style="padding:0 20px;"><button class="btn btn-secondary" style="margin-top:0px;border-color:#e74c3c;color:#e74c3c;width:100%;justify-content:center;" onclick="deleteActiveLayer()"><i class="fa-solid fa-trash"></i> Excluir Camadas</button></div>${bgSection}`;
        return;
    }

    const layer = editorLayers.find(l => l.id === activeLayerIds[0]);
    if (!layer) return;

    const cssMap = {};
    (layer.cssText || '').split(';').forEach(part => {
        const [k,...v] = part.split(':');
        if (k && v.length) cssMap[k.trim()] = v.join(':').trim();
    });

    const currentFontSize = cssMap['font-size']  ? parseFloat(cssMap['font-size'])  : 40;
    const currentColor    = cssMap['color']       || '#ffffff';
    const currentOpacity  = cssMap['opacity']     !== undefined ? parseFloat(cssMap['opacity']) * 100 : 100;
    const currentWidth    = cssMap['width']       ? parseFloat(cssMap['width'])  : 64;
    const currentHeight   = cssMap['height']      ? parseFloat(cssMap['height']) : 64;
    let currentRotate = 0;
    if (cssMap['transform']) {
        const rotMatch = cssMap['transform'].match(/rotate\(([^deg\)]+)deg\)/);
        if (rotMatch) {
            currentRotate = parseFloat(rotMatch[1]);
        }
    }

    const brandC1 = localStorage.getItem('imob_brand_color_primary')   || '#c8da42';
    const brandC2 = localStorage.getItem('imob_brand_color_secondary') || '#ffffff';
    const brandC3 = localStorage.getItem('imob_brand_color_tertiary')  || '#000000';

    const PRESET_COLORS = [brandC1, brandC2, brandC3, '#ffffff','#000000','#ff4444','#ff8800','#f5c518','#00cc66','#0088ff','#9966ff','#ff66aa'];
    const swatchesHtml = PRESET_COLORS.map(c => `<div class="prop-color-swatch" style="background:${c};" title="${c}" onclick="applyPropColor('${c}','${layer.id}')"></div>`).join('');

    const colorPickerHtml = (colorVal, layerId, applyFn, suffix = '') => {
        const wrapId = 'prop-color-picker-wrap' + suffix;
        const dotId = 'prop-color-dot' + suffix;
        const hexId = 'prop-color-hex' + suffix;
        const nativeId = 'prop-native-color' + suffix;
        const iconId = 'prop-hex-icon' + suffix;
        const inputId = 'prop-hex-input' + suffix;
        const solidId = 'prop-color-solid-panel' + suffix;
        const gradId = 'prop-color-gradient-panel' + suffix;
        const gradC1Id = 'prop-grad-c1' + suffix;
        const gradC2Id = 'prop-grad-c2' + suffix;
        const gradDirId = 'prop-grad-dir' + suffix;
        
        const localSwatches = PRESET_COLORS.map(c => `<div class="prop-color-swatch" style="background:${c};" title="${c}" onclick="${applyFn}('${c}','${layerId}','${suffix}')"></div>`).join('');
        
        return `
          <div class="prop-color-preview-container" style="position:relative; display:inline-block;">
            <div class="prop-color-preview" onclick="togglePropColorPicker('${wrapId}')">
              <div class="prop-color-dot" id="${dotId}" style="background:${colorVal};"></div>
              <span class="prop-color-hex" id="${hexId}">${colorVal.toUpperCase()}</span>
              <i class="fa-solid fa-chevron-down" style="margin-left:auto;font-size:0.7rem;color:var(--color-text-muted);"></i>
            </div>
            <div id="${wrapId}" class="prop-color-picker-wrap" style="display:none;">
              <div class="prop-color-tabs">
                <button class="prop-color-tab active" onclick="setPropColorMode('solid','${solidId}','${gradId}',this)"><i class="fa-solid fa-circle-half-stroke"></i> Sólida</button>
                <button class="prop-color-tab" onclick="setPropColorMode('gradient','${solidId}','${gradId}',this)"><i class="fa-solid fa-wand-magic-sparkles"></i> Gradiente</button>
              </div>
              <div id="${solidId}">
                <input type="color" id="${nativeId}" value="${colorVal}" oninput="${applyFn}(this.value,'${layerId}','${suffix}')" style="width:100%;height:36px;border:none;background:transparent;cursor:pointer;border-radius:6px;" />
                <div class="prop-swatches">${localSwatches}</div>
                <div class="prop-hex-row">
                  <i class="fa-solid fa-droplet" style="color:${colorVal};font-size:0.9rem;" id="${iconId}"></i>
                  <input type="text" id="${inputId}" class="editor-prop-input" value="${colorVal.toUpperCase()}" onchange="${applyFn}(this.value,'${layerId}','${suffix}')" placeholder="#FFFFFF" maxlength="7" style="flex:1;text-transform:uppercase;font-family:'Space Mono',monospace;font-size:0.82rem;" />
                </div>
              </div>
              <div id="${gradId}" style="display:none;">
                <div style="font-size:0.73rem;color:var(--color-text-muted);padding:4px 0 6px;">Cor inicial:</div>
                <input type="color" id="${gradC1Id}" value="${colorVal}" style="width:100%;height:30px;border:none;cursor:pointer;" oninput="applyPropGradient('${layerId}','${suffix}')" />
                <div style="font-size:0.73rem;color:var(--color-text-muted);padding:6px 0 4px;">Cor final:</div>
                <input type="color" id="${gradC2Id}" value="#000000" style="width:100%;height:30px;border:none;cursor:pointer;" oninput="applyPropGradient('${layerId}','${suffix}')" />
                <select id="${gradDirId}" class="input-control" style="margin-top:8px;font-size:0.78rem;padding:6px;" onchange="applyPropGradient('${layerId}','${suffix}')">
                  <option value="to right">&#8594; Esquerda para Direita</option>
                  <option value="to bottom">&#8595; Cima para Baixo</option>
                  <option value="to bottom right">&#8600; Diagonal</option>
                </select>
              </div>
            </div>
          </div>`;
    };

    const opacityHtml = `
      <div class="editor-prop-group" style="margin-top:10px;">
        <span class="editor-prop-label">OPACIDADE</span>
        <div class="prop-size-row">
          <input type="range" class="prop-range" id="prop-opacity-range" min="0" max="100" step="1" value="${Math.round(currentOpacity)}"
                 oninput="applyPropOpacity(this.value,'${layer.id}');document.getElementById('prop-opacity-val').textContent=this.value+'%'" />
          <span id="prop-opacity-val" class="prop-range-val">${Math.round(currentOpacity)}%</span>
        </div>
      </div>`;

    // Mostra picker de fundo para: qualquer layer HTML, ou layers com background explícito no cssText
    const hasBg = layer.type === 'html' || !!cssMap['background'] || !!cssMap['background-color'];
    // Extrai a cor de fundo atual: tenta pegar de cssText ou de dentro do HTML content (para shapes/balões)
    let currentBgColor = cssMap['background'] || cssMap['background-color'];
    if (!currentBgColor && layer.content) {
        const bgMatch = layer.content.match(/background\s*:\s*([^;"]+)/);
        if (bgMatch) {
            currentBgColor = bgMatch[1].trim();
        } else {
            const bgColorMatch = layer.content.match(/background-color\s*:\s*([^;"]+)/);
            if (bgColorMatch) {
                currentBgColor = bgColorMatch[1].trim();
            }
        }
    }
    if (!currentBgColor) {
        currentBgColor = '#c8da42';
    }
    // Se for gradiente ou possuir cores hex/rgb, extrai a primeira cor válida
    const colorRegex = /(#[0-9a-fA-F]{3,8}|rgba?\([^\)]+\))/g;
    const colorMatches = currentBgColor.match(colorRegex);
    if (colorMatches) {
        const validColor = colorMatches.find(c => !c.includes('rgba(0, 0, 0, 0)') && c !== 'transparent');
        if (validColor) currentBgColor = validColor;
    }
    const bgPickerHtml = hasBg ? `
      <div class="editor-prop-group" style="margin-top:12px;">
        <span class="editor-prop-label">COR DO FUNDO / BALÃO</span>
        ${colorPickerHtml(currentBgColor, layer.id, 'applyPropBgColor', '-bg')}
      </div>` : '';

    let typeHtml = '';

    if (layer.type === 'text') {
        typeHtml = `
        <div class="prop-tabs">
          <button class="prop-tab active" id="ptab-text" onclick="switchPropTab('text')"><i class="fa-solid fa-t"></i> Texto</button>
          <button class="prop-tab" id="ptab-box" onclick="switchPropTab('box')"><i class="fa-regular fa-square"></i> Caixa</button>
        </div>
        <div id="prop-tab-text" class="prop-tab-panel active">
          <div class="editor-prop-group">
            <span class="editor-prop-label">CONTEÚDO DO TEXTO</span>
            <textarea class="editor-prop-input" style="width:100%; min-height:50px; padding:8px; font-family:inherit; font-size:0.85rem; box-sizing:border-box; border-radius:6px; background:var(--color-bg-dark); border:1px solid var(--color-border); color:var(--color-text); resize:vertical;" oninput="applyPropTextContent(this.value,'${layer.id}')">${layer.content}</textarea>
          </div>
          <div class="editor-prop-group" style="margin-top:12px;">
            <span class="editor-prop-label">TAMANHO</span>
            <div class="prop-size-row">
              <input type="range" class="prop-range" id="prop-fontsize-range" min="8" max="200" step="1" value="${currentFontSize}"
                     oninput="applyPropFontSize(this.value,'${layer.id}');document.getElementById('prop-fontsize-val').textContent=this.value" />
              <span id="prop-fontsize-val" class="prop-range-val">${currentFontSize}</span>
              <span class="prop-range-unit">px</span>
            </div>
          </div>
          ${opacityHtml}
          <!-- Rotação para Textos -->
          <div class="editor-prop-group" style="margin-top:12px;">
            <span class="editor-prop-label">ROTAÇÃO</span>
            <div class="prop-size-row">
              <input type="range" class="prop-range" min="-180" max="180" step="1" value="${Math.round(currentRotate)}"
                     oninput="applyPropRotation(this.value,'${layer.id}');document.getElementById('prop-rotate-val').textContent=this.value+'°'" />
              <span id="prop-rotate-val" class="prop-range-val">${Math.round(currentRotate)}°</span>
            </div>
          </div>
          <div class="editor-prop-group">
            <span class="editor-prop-label">COR DA FONTE</span>
            ${colorPickerHtml(currentColor, layer.id, 'applyPropColor', '-font')}
          </div>
          ${bgPickerHtml}
        </div>
        <div id="prop-tab-box" class="prop-tab-panel" style="display:none;">
          <div class="editor-prop-group">
            <span class="editor-prop-label">POSIÇÃO X / Y</span>
            <div class="prop-size-row">
              <span class="prop-dim-lbl">X</span>
              <input type="number" class="editor-prop-input prop-dim-input" value="${Math.round(parseFloat(layer.left)||0)}" onchange="applyPropPosition('x',this.value,'${layer.id}')" />
              <span class="prop-dim-lbl">Y</span>
              <input type="number" class="editor-prop-input prop-dim-input" value="${Math.round(parseFloat(layer.top)||0)}" onchange="applyPropPosition('y',this.value,'${layer.id}')" />
            </div>
          </div>
          <div class="editor-prop-group">
            <span class="editor-prop-label">OPACIDADE</span>
            <div class="prop-size-row">
              <input type="range" class="prop-range" min="0" max="100" step="1" value="${Math.round(currentOpacity)}"
                     oninput="applyPropOpacity(this.value,'${layer.id}');document.getElementById('prop-op2-val').textContent=this.value+'%'" />
              <span id="prop-op2-val" class="prop-range-val">${Math.round(currentOpacity)}%</span>
            </div>
          </div>
        </div>`;
    } else {
        typeHtml = `
        <div class="prop-tabs">
          <button class="prop-tab active" id="ptab-text" onclick="switchPropTab('text')"><i class="fa-solid fa-vector-square"></i> Tamanho</button>
          <button class="prop-tab" id="ptab-box" onclick="switchPropTab('box')"><i class="fa-regular fa-square"></i> Caixa</button>
        </div>
        <div id="prop-tab-text" class="prop-tab-panel active">
          <div class="editor-prop-group">
            <span class="editor-prop-label">LARGURA</span>
            <div class="prop-size-row">
              <input type="range" class="prop-range" min="16" max="600" step="1" value="${currentWidth}"
                     oninput="applyPropSize('width',this.value,'${layer.id}');document.getElementById('prop-w-val').textContent=this.value" />
              <span id="prop-w-val" class="prop-range-val">${Math.round(currentWidth)}</span>
              <span class="prop-range-unit">px</span>
            </div>
          </div>
          <div class="editor-prop-group">
            <span class="editor-prop-label">ALTURA</span>
            <div class="prop-size-row">
              <input type="range" class="prop-range" min="16" max="600" step="1" value="${currentHeight}"
                     oninput="applyPropSize('height',this.value,'${layer.id}');document.getElementById('prop-h-val').textContent=this.value" />
              <span id="prop-h-val" class="prop-range-val">${Math.round(currentHeight)}</span>
              <span class="prop-range-unit">px</span>
            </div>
          </div>
          ${opacityHtml}
          <!-- Rotação para Imagens/HTML -->
          <div class="editor-prop-group" style="margin-top:12px;">
            <span class="editor-prop-label">ROTAÇÃO</span>
            <div class="prop-size-row">
              <input type="range" class="prop-range" min="-180" max="180" step="1" value="${Math.round(currentRotate)}"
                     oninput="applyPropRotation(this.value,'${layer.id}');document.getElementById('prop-rotate-val2').textContent=this.value+'°'" />
              <span id="prop-rotate-val2" class="prop-range-val">${Math.round(currentRotate)}°</span>
            </div>
          </div>
          ${(layer.content && layer.content.includes('<i')) ? `
          <div class="editor-prop-group">
            <span class="editor-prop-label">COR DO ÍCONE</span>
            ${colorPickerHtml(currentColor, layer.id, 'applyPropIconColor', '-icon')}
          </div>` : ''}
          ${bgPickerHtml}
        </div>
        <div id="prop-tab-box" class="prop-tab-panel" style="display:none;">
          <div class="editor-prop-group">
            <span class="editor-prop-label">POSIÇÃO X / Y</span>
            <div class="prop-size-row">
              <span class="prop-dim-lbl">X</span>
              <input type="number" class="editor-prop-input prop-dim-input" value="${Math.round(parseFloat(layer.left)||0)}" onchange="applyPropPosition('x',this.value,'${layer.id}')" />
              <span class="prop-dim-lbl">Y</span>
              <input type="number" class="editor-prop-input prop-dim-input" value="${Math.round(parseFloat(layer.top)||0)}" onchange="applyPropPosition('y',this.value,'${layer.id}')" />
            </div>
          </div>
        </div>`;
    }

    const headerName = isMultiSameType ? `GRUPO DE ${typeName} (${activeLayerIds.length})` : layer.name;

    panel.innerHTML = `
      <div class="props-header">
        <span class="props-layer-name"><i class="fa-solid ${layer.type==='text'?'fa-t':layer.type==='html'?'fa-icons':'fa-image'}" style="color:var(--color-primary);margin-right:6px;font-size:0.75rem;"></i>${headerName}</span>
        <button class="props-delete-btn" onclick="deleteActiveLayer()" title="Excluir"><i class="fa-solid fa-trash"></i></button>
      </div>
      ${typeHtml}
      ${bgSection}`;
}

function deleteActiveLayer() {
    if (activeLayerIds.length === 0) return;
    saveEditorState();
    editorLayers = editorLayers.filter(l => !activeLayerIds.includes(l.id));
    activeLayerIds = [];
    renderEditorProLayers();
}
// ==========================================================================
// PROP PANEL HELPER FUNCTIONS
// ==========================================================================

function switchPropTab(tab) {
    const textPanel = document.getElementById('prop-tab-text');
    const boxPanel  = document.getElementById('prop-tab-box');
    const tabText   = document.getElementById('ptab-text');
    const tabBox    = document.getElementById('ptab-box');
    if (tab === 'text') {
        if (textPanel) {
            textPanel.classList.add('active');
            textPanel.style.display = '';
        }
        if (boxPanel) {
            boxPanel.classList.remove('active');
            boxPanel.style.display = 'none';
        }
        if (tabText)   tabText.classList.add('active');
        if (tabBox)    tabBox.classList.remove('active');
    } else {
        if (textPanel) {
            textPanel.classList.remove('active');
            textPanel.style.display = 'none';
        }
        if (boxPanel) {
            boxPanel.classList.add('active');
            boxPanel.style.display = '';
        }
        if (tabText)   tabText.classList.remove('active');
        if (tabBox)    tabBox.classList.add('active');
    }
}

function makeElementDraggable(el) {
    if (el.dataset.draggableInitialized) return;
    el.dataset.draggableInitialized = 'true';
    
    el.style.cursor = 'grab';
    
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;
    
    el.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'INPUT' || 
            e.target.tagName === 'SELECT' || 
            e.target.tagName === 'BUTTON' || 
            e.target.closest('.prop-color-swatch') || 
            e.target.closest('.prop-color-tab') ||
            e.target.closest('i')) {
            return;
        }
        
        isDragging = true;
        el.style.cursor = 'grabbing';
        
        const rect = el.getBoundingClientRect();
        const parentRect = el.parentElement.getBoundingClientRect();
        
        if (!el.style.left) {
            el.style.left = (rect.left - parentRect.left) + 'px';
        }
        if (!el.style.top) {
            el.style.top = (rect.top - parentRect.top) + 'px';
        }
        
        initialLeft = parseFloat(el.style.left) || 0;
        initialTop = parseFloat(el.style.top) || 0;
        
        startX = e.clientX;
        startY = e.clientY;
        
        e.preventDefault();
        e.stopPropagation();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        el.style.left = (initialLeft + dx) + 'px';
        el.style.top = (initialTop + dy) + 'px';
        el.style.right = 'auto';
        el.style.bottom = 'auto';
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            el.style.cursor = 'grab';
        }
    });
}

function togglePropColorPicker(id) {
    const wrap = document.getElementById(id || 'prop-color-picker-wrap');
    if (wrap) {
        const isOpening = wrap.style.display === 'none' || wrap.style.display === '';
        document.querySelectorAll('.prop-color-picker-wrap').forEach(el => {
            if (el !== wrap) el.style.display = 'none';
        });
        wrap.style.display = isOpening ? 'flex' : 'none';
    }
}

function setPropColorMode(mode, solidId, gradId, btnEl) {
    const solid = document.getElementById(solidId);
    const grad  = document.getElementById(gradId);
    if (solid) solid.style.display = mode === 'solid' ? 'block' : 'none';
    if (grad)  grad.style.display  = mode === 'gradient' ? 'block' : 'none';
    if (btnEl && btnEl.parentElement) {
        const tabs = btnEl.parentElement.querySelectorAll('.prop-color-tab');
        tabs.forEach(t => t.classList.toggle('active', t === btnEl));
    }
}

function updateCssProp(cssText, prop, value) {
    const escaped = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped + '\\s*:[^;]+;?', 'i');
    const newProp = prop + ':' + value + ';';
    if (regex.test(cssText || '')) return (cssText || '').replace(regex, newProp);
    return (cssText || '') + ' ' + newProp;
}

function applyPropTextContent(value, layerId) {
    const targetIds = activeLayerIds.includes(layerId) ? activeLayerIds : [layerId];
    targetIds.forEach(id => {
        const layer = editorLayers.find(l => l.id === id);
        if (!layer || layer.type !== 'text') return;
        layer.content = value;
        const el = document.getElementById('el-' + id);
        if (el) {
            el.innerHTML = escapeHTML(value).replace(/\n/g, "<br>");
        }
    });
}

function applyPropRotation(value, layerId) {
    const targetIds = activeLayerIds.includes(layerId) ? activeLayerIds : [layerId];
    targetIds.forEach(id => {
        const layer = editorLayers.find(l => l.id === id);
        if (!layer) return;
        
        const newTransform = `rotate(${value}deg)`;
        layer.cssText = updateCssProp(layer.cssText, 'transform', newTransform);
        
        const el = document.getElementById('el-' + id);
        if (el) {
            el.style.transform = newTransform;
        }
    });
}

function applyPropFontSize(value, layerId) {
    const targetIds = activeLayerIds.includes(layerId) ? activeLayerIds : [layerId];
    targetIds.forEach(id => {
        const layer = editorLayers.find(l => l.id === id);
        if (!layer || layer.type !== 'text') return;
        layer.cssText = updateCssProp(layer.cssText, 'font-size', value + 'px');
        const el = document.getElementById('el-' + id);
        if (el) el.style.fontSize = value + 'px';
    });
}

function _syncColorUI(colorVal, suffix = '') {
    const dot  = document.getElementById('prop-color-dot' + suffix);
    const hex  = document.getElementById('prop-color-hex' + suffix);
    const ni   = document.getElementById('prop-native-color' + suffix);
    const hi   = document.getElementById('prop-hex-input' + suffix);
    const icon = document.getElementById('prop-hex-icon' + suffix);
    if (dot)  dot.style.background = colorVal;
    if (hex)  hex.textContent = colorVal.toUpperCase();
    if (ni && colorVal.startsWith('#')) ni.value = colorVal;
    if (hi)   hi.value = colorVal.toUpperCase();
    if (icon) icon.style.color = colorVal;
}

function applyPropColor(value, layerId, suffix = '') {
    const clean = (value.startsWith('#') || value.startsWith('rgb')) ? value : '#' + value;
    const targetIds = activeLayerIds.includes(layerId) ? activeLayerIds : [layerId];
    targetIds.forEach(id => {
        const layer = editorLayers.find(l => l.id === id);
        if (!layer) return;
        layer.cssText = updateCssProp(layer.cssText, 'color', clean);
        const el = document.getElementById('el-' + id);
        if (el) el.style.color = clean;
    });
    _syncColorUI(clean, suffix);
}

function applyPropBgColor(value, layerId, suffix = '') {
    const clean = (value.startsWith('#') || value.startsWith('rgb') || value.startsWith('linear-gradient')) ? value : '#' + value;
    const targetIds = activeLayerIds.includes(layerId) ? activeLayerIds : [layerId];
    targetIds.forEach(id => {
        const layer = editorLayers.find(l => l.id === id);
        if (!layer) return;
        
        const el = document.getElementById('el-' + id);
        if (el) {
            const hasOuterBg = layer.cssText && (layer.cssText.includes('background:') || layer.cssText.includes('background-color:'));
            
            if (hasOuterBg) {
                layer.cssText = updateCssProp(layer.cssText, 'background', clean);
                el.style.background = clean;
                const innerDiv = el.querySelector('div');
                if (innerDiv) {
                    innerDiv.style.background = 'transparent';
                }
            } else {
                const innerDiv = el.querySelector('div');
                if (innerDiv) {
                    innerDiv.style.background = clean;
                    if (layer.content) {
                        if (/background\s*:\s*[^;"]+/gi.test(layer.content)) {
                            layer.content = layer.content.replace(/background\s*:\s*[^;"]+/gi, 'background:' + clean);
                        } else if (/style\s*=\s*"/gi.test(layer.content)) {
                            layer.content = layer.content.replace(/style\s*=\s*"/gi, 'style="background:' + clean + '; ');
                        }
                    }
                } else {
                    layer.cssText = updateCssProp(layer.cssText, 'background', clean);
                    el.style.background = clean;
                }
            }
        }
    });
    _syncColorUI(clean, suffix);
}

function applyPropIconColor(value, layerId) {
    const clean = value.startsWith('#') ? value : '#' + value;
    const targetIds = activeLayerIds.includes(layerId) ? activeLayerIds : [layerId];
    targetIds.forEach(id => {
        const layer = editorLayers.find(l => l.id === id);
        if (!layer) return;
        layer.content = layer.content.replace(/color\s*:\s*#[0-9a-fA-F]{3,6}/g, 'color:' + clean);
        const el = document.getElementById('el-' + id);
        if (el) {
            const icon = el.querySelector('i');
            if (icon) icon.style.color = clean;
        }
    });
    _syncColorUI(clean);
}

function applyPropGradient(layerId, suffix = '') {
    const c1  = document.getElementById('prop-grad-c1' + suffix)?.value  || '#c8da42';
    const c2  = document.getElementById('prop-grad-c2' + suffix)?.value  || '#000000';
    const dir = document.getElementById('prop-grad-dir' + suffix)?.value || 'to right';
    const gradVal = `linear-gradient(${dir}, ${c1}, ${c2})`;
    
    const targetIds = activeLayerIds.includes(layerId) ? activeLayerIds : [layerId];
    targetIds.forEach(id => {
        const layer = editorLayers.find(l => l.id === id);
        if (!layer) return;
        
        if (suffix === '-bg') {
            // Gradiente no fundo (balão)
            const el = document.getElementById('el-' + id);
            if (el) {
                const hasOuterBg = layer.cssText && (layer.cssText.includes('background:') || layer.cssText.includes('background-color:'));
                if (hasOuterBg) {
                    layer.cssText = updateCssProp(layer.cssText, 'background', gradVal);
                    el.style.background = gradVal;
                    const innerDiv = el.querySelector('div');
                    if (innerDiv) {
                        innerDiv.style.background = 'transparent';
                    }
                } else {
                    const innerDiv = el.querySelector('div');
                    if (innerDiv) {
                        innerDiv.style.background = gradVal;
                        // Atualiza o HTML interno do layer para salvar o novo gradiente
                        if (/background\s*:\s*[^;"]+/g.test(layer.content)) {
                            layer.content = layer.content.replace(/background\s*:\s*[^;"]+/g, 'background:' + gradVal);
                        } else if (/style\s*=\s*"/g.test(layer.content)) {
                            layer.content = layer.content.replace(/style\s*=\s*"/g, 'style="background:' + gradVal + '; ');
                        }
                    } else {
                        layer.cssText = updateCssProp(layer.cssText, 'background', gradVal);
                        el.style.background = gradVal;
                    }
                }
            }
        } else {
            // Gradiente no texto
            layer.cssText = updateCssProp(layer.cssText, 'background', gradVal);
            layer.cssText = updateCssProp(layer.cssText, '-webkit-background-clip', 'text');
            layer.cssText = updateCssProp(layer.cssText, '-webkit-text-fill-color', 'transparent');
            const el = document.getElementById('el-' + id);
            if (el) {
                el.style.background = gradVal;
                el.style.webkitBackgroundClip = 'text';
                el.style.webkitTextFillColor = 'transparent';
            }
        }
    });
}

function applyPropOpacity(value, layerId) {
    const op = parseFloat(value) / 100;
    const targetIds = activeLayerIds.includes(layerId) ? activeLayerIds : [layerId];
    targetIds.forEach(id => {
        const layer = editorLayers.find(l => l.id === id);
        if (!layer) return;
        layer.cssText = updateCssProp(layer.cssText, 'opacity', String(op));
        const el = document.getElementById('el-' + id);
        if (el) el.style.opacity = op;
    });
}

function applyPropSize(dim, value, layerId) {
    const targetIds = activeLayerIds.includes(layerId) ? activeLayerIds : [layerId];
    targetIds.forEach(id => {
        const layer = editorLayers.find(l => l.id === id);
        if (!layer) return;

        // For html elements, scale the internal icons if width/height is changing
        if (layer.type === 'html') {
            const cssMap = {};
            (layer.cssText || '').split(';').forEach(part => {
                const [k,...v] = part.split(':');
                if (k && v.length) cssMap[k.trim()] = v.join(':').trim();
            });
            const oldVal = parseFloat(cssMap[dim]) || 64;
            const newVal = parseFloat(value);
            const scale = newVal / oldVal;

            const el = document.getElementById('el-' + id);
            if (el) {
                el.querySelectorAll('i').forEach(icon => {
                    const curFs = parseFloat(window.getComputedStyle(icon).fontSize) || 24;
                    const newFs = Math.max(4, Math.round(curFs * scale));
                    icon.style.fontSize = newFs + 'px';
                });
                // Update HTML content
                const clone = el.cloneNode(true);
                clone.querySelectorAll('.resize-handle').forEach(h => h.remove());
                layer.content = clone.innerHTML;
            }
        }

        layer.cssText = updateCssProp(layer.cssText, dim, value + 'px');
        const el = document.getElementById('el-' + id);
        if (el) {
            el.style[dim] = value + 'px';
            attachResizeHandles(el, layer);
        }
    });
}

function applyPropPosition(axis, value, layerId) {
    const px = parseFloat(value) + 'px';
    const targetIds = activeLayerIds.includes(layerId) ? activeLayerIds : [layerId];
    targetIds.forEach(id => {
        const layer = editorLayers.find(l => l.id === id);
        if (!layer) return;
        if (axis === 'x') layer.left = px; else layer.top = px;
        const el = document.getElementById('el-' + id);
        if (el) { if (axis === 'x') el.style.left = px; else el.style.top = px; }
    });
}

// ==========================================================================
// RESIZE HANDLES — alças de redimensionamento
// ==========================================================================

function attachResizeHandles(el, layer) {
    if (!el || !layer) return;
    el.querySelectorAll('.resize-handle').forEach(h => h.remove());

    const positions = ['nw','n','ne','e','se','s','sw','w'];
    positions.forEach(pos => {
        const handle = document.createElement('div');
        handle.className = 'resize-handle resize-handle-' + pos;
        handle.dataset.pos = pos;

        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            let startX = e.clientX, startY = e.clientY;
            let startW = el.offsetWidth, startH = el.offsetHeight;
            let startL = el.offsetLeft;
            let startT = el.offsetTop;
            let startFontSize = 16;
            if (layer.type === 'text') {
                startFontSize = parseFloat(window.getComputedStyle(el).fontSize) || 16;
            }

            // Capture start states for all active elements for group scaling
            const activeElements = [];
            let gMinX = Infinity, gMinY = Infinity, gMaxX = -Infinity, gMaxY = -Infinity;

            activeLayerIds.forEach(id => {
                const activeEl = document.getElementById('el-' + id);
                const activeLayer = editorLayers.find(l => l.id === id);
                if (activeEl && activeLayer && !activeLayer.locked) {
                    const l = activeEl.offsetLeft;
                    const t = activeEl.offsetTop;
                    const w = activeEl.offsetWidth;
                    const h = activeEl.offsetHeight;
                    let fs = 16;
                    if (activeLayer.type === 'text') {
                        fs = parseFloat(window.getComputedStyle(activeEl).fontSize) || 16;
                    }
                    
                    const startIconFonts = [];
                    if (activeLayer.type === 'html') {
                        activeEl.querySelectorAll('i').forEach(icon => {
                            startIconFonts.push({
                                iconEl: icon,
                                startFs: parseFloat(window.getComputedStyle(icon).fontSize) || 24
                            });
                        });
                    }

                    activeElements.push({
                        id: id,
                        el: activeEl,
                        layer: activeLayer,
                        startL: l,
                        startT: t,
                        startW: w,
                        startH: h,
                        startFontSize: fs,
                        startIconFonts: startIconFonts
                    });

                    if (l < gMinX) gMinX = l;
                    if (t < gMinY) gMinY = t;
                    if (l + w > gMaxX) gMaxX = l + w;
                    if (t + h > gMaxY) gMaxY = t + h;
                }
            });

            // Fallback if the element isn't in selection
            if (activeElements.length === 0 || !activeLayerIds.includes(layer.id)) {
                const startIconFonts = [];
                if (layer.type === 'html') {
                    el.querySelectorAll('i').forEach(icon => {
                        startIconFonts.push({
                            iconEl: icon,
                            startFs: parseFloat(window.getComputedStyle(icon).fontSize) || 24
                        });
                    });
                }
                activeElements.push({
                    id: layer.id,
                    el: el,
                    layer: layer,
                    startL: startL,
                    startT: startT,
                    startW: startW,
                    startH: startH,
                    startFontSize: startFontSize,
                    startIconFonts: startIconFonts
                });
                gMinX = startL;
                gMinY = startT;
                gMaxX = startL + startW;
                gMaxY = startT + startH;
            }

            // Anchor point is stationary during the resize
            let anchorX = gMinX;
            let anchorY = gMinY;
            if (pos.includes('w')) anchorX = gMaxX;
            if (pos.includes('n')) anchorY = gMaxY;

            const onMove = (me) => {
                const dx = (me.clientX - startX) / editorZoom;
                const dy = (me.clientY - startY) / editorZoom;
                let nW = startW, nH = startH;
                if (pos.includes('e')) nW = Math.max(20, startW + dx);
                if (pos.includes('s')) nH = Math.max(20, startH + dy);
                if (pos.includes('w')) nW = Math.max(20, startW - dx);
                if (pos.includes('n')) nH = Math.max(20, startH - dy);

                let scaleX = nW / startW;
                let scaleY = nH / startH;

                let scale = 1;
                let isSideResize = false;
                let isWidthResize = false;
                let isHeightResize = false;

                if (pos === 'e' || pos === 'w') {
                    isSideResize = true;
                    isWidthResize = true;
                    scaleY = 1;
                    scale = scaleX;
                } else if (pos === 'n' || pos === 's') {
                    isSideResize = true;
                    isHeightResize = true;
                    scaleX = 1;
                    scale = scaleY;
                } else {
                    // Corner handles: proportional resize
                    scale = (scaleX + scaleY) / 2;
                    scaleX = scale;
                    scaleY = scale;
                }

                activeElements.forEach(item => {
                    if (item.layer.type === 'text') {
                        if (isWidthResize) {
                            const newW = Math.max(20, item.startW * scaleX);
                            item.el.style.width = newW + 'px';
                            item.layer.cssText = updateCssProp(item.layer.cssText, 'width', newW + 'px');
                        } else if (isHeightResize) {
                            const newH = Math.max(20, item.startH * scaleY);
                            item.el.style.height = newH + 'px';
                            item.layer.cssText = updateCssProp(item.layer.cssText, 'height', newH + 'px');
                        } else {
                            // Proportional corner resize scales font size
                            const newFontSize = Math.max(8, Math.round(item.startFontSize * scale));
                            item.el.style.fontSize = newFontSize + 'px';
                            item.layer.cssText = updateCssProp(item.layer.cssText, 'font-size', newFontSize + 'px');
                            
                            // Adjust dimensions proportionally if they were set on the element
                            const cssMap = {};
                            (item.layer.cssText || '').split(';').forEach(part => {
                                const [k,...v] = part.split(':');
                                if (k && v.length) cssMap[k.trim()] = v.join(':').trim();
                            });
                            if (cssMap['width']) {
                                const newW = Math.max(20, item.startW * scale);
                                item.el.style.width = newW + 'px';
                                item.layer.cssText = updateCssProp(item.layer.cssText, 'width', newW + 'px');
                            }
                            if (cssMap['height']) {
                                const newH = Math.max(20, item.startH * scale);
                                item.el.style.height = newH + 'px';
                                item.layer.cssText = updateCssProp(item.layer.cssText, 'height', newH + 'px');
                            }
                        }
                    } else {
                        // Non-text layers: HTML or Image
                        const newW = Math.max(10, item.startW * scaleX);
                        const newH = Math.max(10, item.startH * scaleY);
                        item.el.style.width = newW + 'px';
                        item.el.style.height = newH + 'px';
                        item.layer.cssText = updateCssProp(item.layer.cssText, 'width', newW + 'px');
                        item.layer.cssText = updateCssProp(item.layer.cssText, 'height', newH + 'px');

                        if (item.layer.type === 'html' && item.startIconFonts) {
                            if (!isSideResize) {
                                item.startIconFonts.forEach(icon => {
                                    const newFs = Math.max(4, Math.round(icon.startFs * scale));
                                    icon.iconEl.style.fontSize = newFs + 'px';
                                });
                            }
                        }
                    }

                    const newL = anchorX + (item.startL - anchorX) * scaleX;
                    const newT = anchorY + (item.startT - anchorY) * scaleY;

                    item.el.style.left = newL + 'px';
                    item.el.style.top = newT + 'px';
                    item.layer.left = newL + 'px';
                    item.layer.top = newT + 'px';
                });

                // Update UI elements in properties panel if active for primary dragged element
                const fsRange = document.getElementById('prop-fontsize-range');
                const fsVal = document.getElementById('prop-fontsize-val');
                const wv = document.getElementById('prop-w-val');
                const hv = document.getElementById('prop-h-val');

                if (layer.type === 'text') {
                    const primaryEl = activeElements.find(item => item.id === layer.id);
                    if (primaryEl) {
                        if (!isSideResize) {
                            const curFs = Math.max(8, Math.round(primaryEl.startFontSize * scale));
                            if (fsRange) fsRange.value = curFs;
                            if (fsVal) fsVal.textContent = curFs;
                        } else {
                            const curW = Math.max(10, primaryEl.startW * scaleX);
                            const curH = Math.max(10, primaryEl.startH * scaleY);
                            if (wv) wv.textContent = Math.round(curW);
                            if (hv) hv.textContent = Math.round(curH);
                        }
                    }
                } else {
                    const primaryEl = activeElements.find(item => item.id === layer.id);
                    if (primaryEl) {
                        const curW = Math.max(10, primaryEl.startW * scaleX);
                        const curH = Math.max(10, primaryEl.startH * scaleY);
                        if (wv) wv.textContent = Math.round(curW);
                        if (hv) hv.textContent = Math.round(curH);
                    }
                }
            };

            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                
                // Save updated HTML content for html elements, cleaning resize handles first
                activeElements.forEach(item => {
                    if (item.layer.type === 'html') {
                        const clone = item.el.cloneNode(true);
                        clone.querySelectorAll('.resize-handle').forEach(h => h.remove());
                        item.layer.content = clone.innerHTML;
                    }
                });

                saveEditorState();
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
        el.appendChild(handle);
    });

    // Adiciona o handle de rotação interativo na tela
    const rotateLine = document.createElement('div');
    rotateLine.className = 'resize-handle rotate-connector-line';
    rotateLine.style.cssText = `
        position: absolute;
        top: -18px;
        left: calc(50% - 1px);
        width: 2px;
        height: 18px;
        background: #2ebd59;
        pointer-events: none;
    `;

    const rotateHandle = document.createElement('div');
    rotateHandle.className = 'resize-handle rotate-handle';
    rotateHandle.style.cssText = `
        position: absolute;
        top: -36px;
        left: calc(50% - 10px);
        width: 20px;
        height: 20px;
        background: #2ebd59;
        border: 2px solid #fff;
        border-radius: 50%;
        cursor: grab;
        z-index: 1000;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    rotateHandle.innerHTML = '<i class="fa-solid fa-rotate" style="font-size:10px; color:#fff; pointer-events:none;"></i>';

    rotateHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        saveEditorState();
        
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        
        const startMouseAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
        
        let startLayerAngle = 0;
        const cssMap = {};
        (layer.cssText || '').split(';').forEach(part => {
            const [k,...v] = part.split(':');
            if (k && v.length) cssMap[k.trim()] = v.join(':').trim();
        });
        if (cssMap['transform']) {
            const rotMatch = cssMap['transform'].match(/rotate\(([^deg\)]+)deg\)/);
            if (rotMatch) {
                startLayerAngle = parseFloat(rotMatch[1]);
            }
        }
        
        const onMove = (me) => {
            const newMouseAngle = Math.atan2(me.clientY - cy, me.clientX - cx) * 180 / Math.PI;
            let deltaAngle = newMouseAngle - startMouseAngle;
            
            let targetAngle = Math.round(startLayerAngle + deltaAngle);
            while (targetAngle > 180) targetAngle -= 360;
            while (targetAngle < -180) targetAngle += 360;
            
            applyPropRotation(targetAngle, layer.id);
            
            const rVal = document.getElementById('prop-rotate-val');
            if (rVal) rVal.textContent = targetAngle + '°';
            const rVal2 = document.getElementById('prop-rotate-val2');
            if (rVal2) rVal2.textContent = targetAngle + '°';
            
            const rRange = document.getElementById('prop-rotate-range');
            if (rRange) rRange.value = targetAngle;
        };
        
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            saveEditorState();
        };
        
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    el.appendChild(rotateLine);
    el.appendChild(rotateHandle);
}

// Add resize handles when element is selected
const _origSelectLayer = selectLayer;
// Patch: after selectLayer renders, add resize handles to selected elements
document.addEventListener('click', () => {
    setTimeout(() => {
        editorLayers.forEach(layer => {
            if (!activeLayerIds.includes(layer.id)) return;
            if (layer.type === 'html' || layer.type === 'image' || layer.type === 'text') {
                const el = document.getElementById('el-' + layer.id);
                if (el && !el.querySelector('.resize-handle')) attachResizeHandles(el, layer);
            }
        });
    }, 50);
});

// ==========================================================================
// TROCAR IMAGEM DE FUNDO — com CROP 1:1 automático
// ==========================================================================

function triggerBgImageUpload() {
    const input = document.getElementById('prop-bg-input');
    if (input) input.click();
}

function handleBgImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        cropImageTo1x1(ev.target.result, (cropped) => {
            const bgImg = document.getElementById('success-preview-img');
            if (bgImg) {
                bgImg.src = cropped;
                try { localStorage.setItem('editor_bg_image_temp', cropped); } catch(e) {}
            }
            aiRawImageUrl = cropped; // Sincroniza a imagem de fundo com o ajuste de IA
        });
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

function cropImageTo1x1(dataUrl, callback) {
    const img = new Image();
    img.onload = () => {
        const size = Math.min(img.width, img.height);
        const targetSize = Math.min(1080, size);
        const canvas = document.createElement('canvas');
        canvas.width = targetSize; canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        const sx = (img.width  - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, targetSize, targetSize);
        callback(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = dataUrl;
}

// Move a camada para FRENTE (aumenta z-index — sobe no array = índice maior)
function moveLayerUp(id) {
    const idx = editorLayers.findIndex(l => l.id === id);
    if (idx < 0 || idx >= editorLayers.length - 1) return; // já é o topo
    saveEditorState();
    // Troca com o próximo (índice maior = z-index maior = mais na frente)
    [editorLayers[idx], editorLayers[idx + 1]] = [editorLayers[idx + 1], editorLayers[idx]];
    renderEditorProLayers();
}

// Move a camada para TRÁS (diminui z-index — desce no array = índice menor)
function moveLayerDown(id) {
    const idx = editorLayers.findIndex(l => l.id === id);
    if (idx <= 0) return; // já é o fundo
    saveEditorState();
    // Troca com o anterior (índice menor = z-index menor = mais atrás)
    [editorLayers[idx], editorLayers[idx - 1]] = [editorLayers[idx - 1], editorLayers[idx]];
    renderEditorProLayers();
}


document.addEventListener('click', (e) => {
    const workspace = document.getElementById('editor-workspace');
    if (workspace && e.target === workspace) {
        activeLayerIds = [];
        renderEditorProLayers();
    }
});

// ==========================================================================
// MODAL DE SELEÇÃO DE IMAGENS DA IA
// ==========================================================================
function openImageSelectionModal(urls) {
    const modal = document.getElementById('ai-selection-modal');
    const grid = document.getElementById('ai-options-grid');
    const btnConfirm = document.getElementById('ai-selection-confirm');
    const btnCancel = document.getElementById('ai-selection-cancel');
    const btnClose = document.getElementById('ai-selection-close');
    
    if (!modal || !grid) return;

    // Reset selection state
    let selectedUrl = null;
    btnConfirm.disabled = true;

    // Build the grid
    grid.innerHTML = urls.map((url, index) => `
        <div class="ai-option-card" data-url="${url}">
            <img src="${url}" alt="Opção ${index + 1}" loading="lazy"/>
        </div>
    `).join('');

    // Handle clicks on cards
    const cards = grid.querySelectorAll('.ai-option-card');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            // Remove selection from all
            cards.forEach(c => c.classList.remove('selected'));
            
            // Select this one
            card.classList.add('selected');
            selectedUrl = card.getAttribute('data-url');
            btnConfirm.disabled = false;
        });
    });

    // Setup modal actions
    const closeModal = () => modal.classList.remove('open');
    
    // Clear old listeners by cloning buttons if needed, or simply overwrite onclick
    btnCancel.onclick = closeModal;
    btnClose.onclick = closeModal;
    
    btnConfirm.onclick = () => {
        if (!selectedUrl) return;
        
        btnConfirm.classList.add('loading');
        btnConfirm.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Aplicando...`;
        
        // Load the chosen image directly into the canvas background
        loadImageForCanvas(selectedUrl, (img) => {
            btnConfirm.classList.remove('loading');
            btnConfirm.innerHTML = `<i class="fa-solid fa-check"></i> Usar Imagem Selecionada`;
            closeModal();
            
            if (img) {
                uploadedProductImage = img;
                renderCreativeCanvas();
                
                // Show text editor panel and download button
                const textPanel = document.getElementById('studio-text-editor-panel');
                const downloadBtn = document.getElementById('studio-download-btn');
                if (textPanel) textPanel.style.display = 'block';
                if (downloadBtn) downloadBtn.style.display = 'flex'; // Usando flex para centralizar o icone e texto
                
                // Opcional: mostrar um micro alerta ou toast de sucesso
            } else {
                alert("Falha ao carregar a imagem gerada.");
            }
        });
    };

    // Show modal
    modal.classList.add('open');
}

function renderTemplateGallery(category = 'all') {
    const grid = document.getElementById('template-gallery-grid');
    if (!grid) return;

    const filtered = category === 'all'
        ? TEMPLATE_GALLERY
        : TEMPLATE_GALLERY.filter(t => t.category === category);

    grid.innerHTML = filtered.map(t => {
        const catLabels = { 'alto-padrao': 'Alto Padrão', 'medio-padrao': 'Médio Padrão', 'mcmv': 'MCMV' };
        return `
            <div class="template-card" data-template-id="${t.id}">
                <div class="template-card-thumb">
                    <img src="${t.previewImage || t.bgImage}" alt="${t.name}" loading="lazy"/>
                    <div class="template-card-use-btn">
                        <span><i class="fa-solid fa-wand-magic-sparkles"></i> Usar Template</span>
                    </div>
                </div>
                <div class="template-card-info">
                    <span class="template-card-name">${t.name}</span>
                    <span class="template-card-badge" data-cat="${t.category}">${catLabels[t.category]}</span>
                </div>
            </div>
        `;
    }).join('');

    // Attach click handlers
    grid.querySelectorAll('.template-card').forEach(card => {
        card.addEventListener('click', () => {
            const templateId = card.getAttribute('data-template-id');
            selectTemplate(templateId);
        });
    });
}

window.handleTemplateImageUpload = function(event, fieldId) {
    const file = event.target.files[0];
    if (!file) return;

    validateFileHeader(file).then(res => {
        if (!res.valid) {
            alert(res.reason);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            if (!window._templateUploadedImages) window._templateUploadedImages = {};
            window._templateUploadedImages[fieldId] = e.target.result;

            const statusSpan = document.getElementById(`file-status-${fieldId}`);
            if (statusSpan) {
                statusSpan.innerText = file.name;
                statusSpan.style.color = '#35D4DA';
            }

            renderInteractiveOverlay();
            if (canvasReady) renderCreativeCanvas();
        };
        reader.readAsDataURL(file);
    });
};

function selectTemplate(templateId) {
    const template = TEMPLATE_GALLERY.find(t => t.id === templateId);
    if (!template) return;

    selectedTemplateId = templateId;

    // Generate Editor Fields Dynamically
    const editorPanel = document.getElementById('studio-text-editor-panel');
    if (editorPanel) {
        let fieldsToRender = template.fields;

        // Fallback for older templates without 'fields' array
        if (!fieldsToRender) {
            fieldsToRender = [
                { id: 'headline', label: template.labels?.headline || 'Headline (Título Principal)', placeholder: 'Ex: Lançamento', default: template.defaults.headline || '' },
                { id: 'text', label: template.labels?.text || 'Texto Auxiliar (Benefício)', placeholder: 'Ex: 3 Suítes', default: template.defaults.text || '' },
                { id: 'location', label: template.labels?.location || 'Localização (Selo / Badge)', placeholder: 'Ex: SP', default: template.defaults.location || '' },
                { id: 'desc', label: template.labels?.desc || 'Mini Descrição (Subtexto)', placeholder: 'Ex: Aproveite', default: template.defaults.desc || '' },
                { id: 'cta', label: template.labels?.cta || 'Texto do CTA (Botão)', placeholder: 'Ex: Saiba Mais', default: template.defaults.cta || '' }
            ];
        }

        let html = '';
        fieldsToRender.forEach(f => {
            if (f.type === 'file') {
                html += `
                    <div class="filter-group">
                      <label for="dyn-input-${f.id}">${f.label}</label>
                      <div style="display: flex; gap: 8px; align-items: center;">
                        <input type="file" id="dyn-input-${f.id}" class="input-control dyn-template-file-input" data-field-id="${f.id}" accept="image/*" style="display:none;" onchange="handleTemplateImageUpload(event, '${f.id}')"/>
                        <button class="btn btn-secondary" onclick="document.getElementById('dyn-input-${f.id}').click()" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px;">
                          <i class="fa-solid fa-upload"></i> Upload
                        </button>
                        <span id="file-status-${f.id}" style="font-size: 0.72rem; color: var(--color-text-muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 120px;">Padrão</span>
                      </div>
                    </div>
                `;
            } else {
                html += `
                    <div class="filter-group">
                      <label for="dyn-input-${f.id}">${f.label}</label>
                      <input type="text" id="dyn-input-${f.id}" class="input-control dyn-template-input" data-field-id="${f.id}" placeholder="${f.placeholder}" value="${f.default}" oninput="renderInteractiveOverlay(); if(canvasReady) renderCreativeCanvas();"/>
                    </div>
                `;
            }
        });

        // Add hidden color input for fallback logic
        const defaultColor = template.defaults?.textColor || '#ffffff';
        html += `
            <div class="filter-group" style="display: none;">
              <label for="studio-color-input">Cor dos Textos</label>
              <div style="display: flex; gap: 8px; align-items: center; height: 100%;">
                <input type="color" id="studio-color-input" class="input-control" value="${defaultColor}" style="padding: 2px; width: 50px; height: 38px; cursor: pointer;"/>
                <span id="color-hex-label" style="font-size: 0.72rem; font-family: 'Space Mono', monospace;">${defaultColor}</span>
              </div>
            </div>
        `;
        editorPanel.innerHTML = html;
    }

    // Switch to editor view
    const galleryView = document.getElementById('studio-gallery-view');
    const editorView  = document.getElementById('studio-editor-view');
    const navGallery  = document.getElementById('studio-nav-gallery');
    const navEditor   = document.getElementById('studio-nav-editor');

    if (galleryView) galleryView.classList.remove('active');
    if (editorView) editorView.classList.add('active');
    if (navGallery) navGallery.classList.remove('active');
    if (navEditor) navEditor.classList.add('active');

    // --- Exibe preview do template no painel direito ---
    const previewWrap = document.getElementById('studio-template-preview-wrap');
    const previewImg  = document.getElementById('studio-template-preview-img');
    const previewName = document.getElementById('studio-template-preview-name');
    const previewBadge = document.getElementById('studio-template-preview-badge');
    const placeholder = document.getElementById('studio-preview-placeholder');
    const canvasEl    = document.getElementById('studio-canvas');
    const catLabels   = { 'alto-padrao': 'Alto Padrão', 'medio-padrao': 'Médio Padrão', 'mcmv': 'MCMV', 'editor-livre': 'Editor Livre' };

    if (previewWrap && previewImg && template) {
        const imgSrc = template.previewImage || template.bgImage;
        previewImg.src = imgSrc;
        if (previewName) previewName.textContent = template.name || '';
        if (previewBadge) previewBadge.textContent = catLabels[template.category] || template.category || '';
        previewWrap.style.display = 'flex';
        if (placeholder) placeholder.style.display = 'none';
        if (canvasEl) canvasEl.style.display = 'none';
    }

    // Reuse the already-loaded <img> from gallery cards (avoids file:// CORS block)
    uploadedProductImage = null;
    const existingImg = document.querySelector(`.template-card[data-template-id="${templateId}"] .template-card-thumb img`);
    if (existingImg && existingImg.naturalWidth > 0) {
        window._studioBgImage = existingImg;
        renderCreativeCanvas();
    } else {
        // Fallback: preload via hidden <img> in the DOM (works on file://)
        loadImageForCanvas(template.bgImage, (img) => {
            window._studioBgImage = img;
            renderCreativeCanvas();
        });
    }
}

function loadImageForCanvas(src, callback) {
    // Create a hidden img element in the DOM — this bypasses the file:// CORS block
    // that affects new Image() in JS
    let container = document.getElementById('_img-preload-container');
    if (!container) {
        container = document.createElement('div');
        container.id = '_img-preload-container';
        container.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
        document.body.appendChild(container);
    }
    const img = document.createElement('img');
    
    // Condicional para evitar bloqueio de CORS em arquivos locais (mesma origem)
    const isAbsolute = src.startsWith('http://') || src.startsWith('https://');
    const isSameOrigin = src.includes(window.location.host) || !isAbsolute;
    if (isAbsolute && !isSameOrigin) {
        img.crossOrigin = 'anonymous'; // Importante para exportação em Canvas quando usar URLs externas
    }
    
    img.onload = () => callback(img);
    img.onerror = () => {
        console.warn('Failed to load image:', src);
        // Draw canvas without bg
        callback(null);
    };
    img.src = src;
    container.appendChild(img);
}

function renderCreativeCanvas() {
    const canvas = document.getElementById('studio-canvas');
    const placeholder = document.getElementById('studio-preview-placeholder');
    const downloadBtn = document.getElementById('studio-download-btn');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const template = TEMPLATE_GALLERY.find(t => t.id === selectedTemplateId) || TEMPLATE_GALLERY[0];

    // Determine canvas size based on format
    let W, H;
    const isPlanta = isTemplate45();
    if (selectedFormat === 'feed') { W = 1080; H = isPlanta ? 1350 : 1080; }
    else if (selectedFormat === 'story') { W = 1080; H = 1920; }
    else { W = 1080; H = 566; } // carrossel

    canvas.width = W;
    canvas.height = H;

    // Get the background image (Sempre mostra o template no Editor)
    const bgImg = window._studioBgImage;
    if (!bgImg) {
        // Load default bg using DOM-based loader (works on file://)
        loadImageForCanvas(template.bgImage, (img) => {
            if (img) {
                window._studioBgImage = img;
                renderCreativeCanvas();
            } else {
                // No image available — render with solid gradient bg
                _renderCanvasWithoutBg(ctx, canvas, W, H, template);
            }
        });
        return;
    }

    // Draw background (cover)
    if (bgImg._isFallback) {
        // Fallback: already drawn gradient in _renderCanvasWithoutBg
        // Just draw a subtle dark gradient
        const fbGrd = ctx.createLinearGradient(0, 0, W, H);
        fbGrd.addColorStop(0, '#0a0a0a');
        fbGrd.addColorStop(0.5, '#1a1a2e');
        fbGrd.addColorStop(1, '#0a0a0a');
        ctx.fillStyle = fbGrd;
        ctx.fillRect(0, 0, W, H);
    } else {
        const imgRatio = bgImg.width / bgImg.height;
        const canvasRatio = W / H;
        let drawW, drawH, drawX, drawY;
        if (imgRatio > canvasRatio) {
            drawH = H;
            drawW = H * imgRatio;
            drawX = (W - drawW) / 2;
            drawY = 0;
        } else {
            drawW = W;
            drawH = W / imgRatio;
            drawX = 0;
            drawY = (H - drawH) / 2;
        }
        ctx.drawImage(bgImg, drawX, drawY, drawW, drawH);
    }

    // Text rendering logic removed. AI handles typography.

    // Show canvas, hide placeholder and template preview
    canvas.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
    const tmplPreviewWrap = document.getElementById('studio-template-preview-wrap');
    if (tmplPreviewWrap) tmplPreviewWrap.style.display = 'none';
    if (downloadBtn) downloadBtn.disabled = false;
    canvasReady = true;
}

function downloadCreative() {
    const canvas = document.getElementById('studio-canvas');
    if (!canvas) return;

    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const formatSuffix = selectedFormat === 'feed' ? '1080x1080' : selectedFormat === 'story' ? '1080x1920' : '1080x566';
        a.href = url;
        a.download = `imobgrowth-arte-${formatSuffix}-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Update credits
        packageState.artesFeitas++;
        updateSidebarCredits();
        updateDashboardMetrics();
    }, 'image/png', 1.0);
}

// Fallback: render canvas with gradient bg when image can't be loaded
function _renderCanvasWithoutBg(ctx, canvas, W, H, template) {
    // Dark gradient background
    const grd = ctx.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, '#0a0a0a');
    grd.addColorStop(0.5, '#1a1a2e');
    grd.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
    // Set as bg so text rendering proceeds
    window._studioBgImage = { width: W, height: H, _isFallback: true };
    renderCreativeCanvas();
}

// Canvas helper: rounded rectangle
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

// Helper: setup a generic upload box with preview
function setupUploadBox(boxId, inputId, previewId, allowMultiple, onFileCallback) {
    const box = document.getElementById(boxId);
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!box || !input) return;

    box.addEventListener('click', () => input.click());
    input.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const validation = await validateFileHeader(files[0]);
        if (!validation.valid) {
            alert(`Erro no upload do arquivo: ${validation.reason}`);
            input.value = '';
            return;
        }

        const iconEl = box.querySelector('i');
        const textEl = box.querySelector('p');
        if (files.length === 1) {
            if (textEl) textEl.innerText = `Arquivo carregado: ${files[0].name}`;
        } else {
            if (textEl) textEl.innerText = `${files.length} arquivos carregados`;
        }
        if (iconEl) iconEl.className = 'fa-solid fa-circle-check';

        if (preview) {
            preview.innerHTML = '';
            preview.style.display = 'flex';
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = document.createElement('img');
                    img.src = event.target.result;
                    img.className = 'upload-thumb';
                    preview.appendChild(img);
                };
                reader.readAsDataURL(file);
            });
        }

        if (onFileCallback && files[0]) {
            onFileCallback(files[0]);
        }
    });
}

// ==========================================================================
// MÓDULO: VÍDEOS — GALERIA + EDITOR
// ==========================================================================
function setupReelsMaker() {
    // --- Step Navigation ---
    const navGallery = document.getElementById('video-nav-gallery');
    const navEditor  = document.getElementById('video-nav-editor');
    const galleryView = document.getElementById('video-gallery-view');
    const editorView  = document.getElementById('video-editor-view');
    const backBtn     = document.getElementById('video-back-to-gallery');

    function showGallery() {
        if (galleryView) galleryView.classList.add('active');
        if (editorView) editorView.classList.remove('active');
        if (navGallery) navGallery.classList.add('active');
        if (navEditor) navEditor.classList.remove('active');
    }

    function showEditor() {
        if (editorView) editorView.classList.add('active');
        if (galleryView) galleryView.classList.remove('active');
        if (navEditor) navEditor.classList.add('active');
        if (navGallery) navGallery.classList.remove('active');
    }

    if (navGallery) navGallery.addEventListener('click', showGallery);
    if (navEditor) navEditor.addEventListener('click', showEditor);
    if (backBtn) backBtn.addEventListener('click', showGallery);

    // --- Render video templates gallery ---
    renderVideoTemplateGallery();

    // --- Upload box ---
    const uploadBox = document.getElementById('reels-upload-box');
    const fileInput = document.getElementById('reels-file-input');
    const mockupVideo = document.getElementById('mockup-reels-video');
    const captionText = document.getElementById('reels-caption-text');

    if (uploadBox && fileInput) {
        uploadBox.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const iconEl = uploadBox.querySelector('i');
            const textEl = uploadBox.querySelector('p');
            if (textEl) textEl.innerText = `Arquivo: ${file.name}`;
            if (iconEl) iconEl.className = 'fa-solid fa-circle-check';

            if (file.type.startsWith('video/') && mockupVideo) {
                const url = URL.createObjectURL(file);
                mockupVideo.src = url;
                mockupVideo.style.display = 'block';
                mockupVideo.play();

                // Simulate captions
                setInterval(() => {
                    if (!mockupVideo.paused) {
                        const headlineInput = document.getElementById('reels-headline-input');
                        const subtitleInput = document.getElementById('reels-subtitle-input');
                        const captions = [
                            headlineInput?.value || 'Conheça esse incrível apartamento...',
                            subtitleInput?.value || 'Agende sua visita!',
                            'Lazer completo para toda a família',
                            'Oportunidade imperdível!'
                        ];
                        const idx = Math.floor(mockupVideo.currentTime / 2) % captions.length;
                        if (captionText) captionText.innerText = captions[idx];
                    }
                }, 500);
            }
        });
    }

    // --- Caption style selector ---
    const selectCaptions = document.getElementById('reels-captions-style');
    if (selectCaptions && captionText) {
        selectCaptions.addEventListener('change', (e) => {
            const style = e.target.value;
            captionText.className = 'phone-caption-text';
            if (style === 'yellow') {
                captionText.style.color = '#FFEB3B';
                captionText.style.fontFamily = "Impact, sans-serif";
            } else if (style === 'neon') {
                captionText.style.color = '#c8da42';
                captionText.style.boxShadow = '0 0 15px rgba(200, 218, 66, 0.4)';
                captionText.style.fontFamily = "'Space Grotesk', sans-serif";
            } else {
                captionText.style.color = '#FFFFFF';
                captionText.style.fontFamily = "'Inter', sans-serif";
            }
        });
    }

    // --- Render button ---
    const renderBtn = document.getElementById('reels-render-btn');
    if (renderBtn) {
        renderBtn.addEventListener('click', () => {
            alert('🎬 Funcionalidade de renderização de vídeo avançada será ativada na próxima etapa!');
        });
    }
}

function renderVideoTemplateGallery() {
    const grid = document.getElementById('video-template-grid');
    if (!grid) return;

    grid.innerHTML = VIDEO_TEMPLATES.map(t => `
        <div class="video-template-card" data-video-template-id="${t.id}">
            <div class="video-template-preview">
                <div class="video-template-preview-icon">
                    <i class="${t.icon}"></i>
                </div>
            </div>
            <div class="video-template-body">
                <div class="video-template-name">${t.name}</div>
                <div class="video-template-desc">${t.desc}</div>
            </div>
            <div class="video-template-footer">
                <span class="video-template-duration">
                    <i class="fa-regular fa-clock"></i> ${t.duration}
                </span>
                <button class="video-template-use-btn">Usar Template</button>
            </div>
        </div>
    `).join('');

    // Attach click handlers
    grid.querySelectorAll('.video-template-card').forEach(card => {
        card.addEventListener('click', () => {
            const templateId = card.getAttribute('data-video-template-id');
            selectVideoTemplate(templateId);
        });
    });
}

function selectVideoTemplate(templateId) {
    const template = VIDEO_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    // Pre-fill editor
    const nameEl = document.getElementById('video-selected-template-name');
    const headlineInput = document.getElementById('reels-headline-input');
    const subtitleInput = document.getElementById('reels-subtitle-input');

    if (nameEl) nameEl.textContent = template.name;
    if (headlineInput) headlineInput.value = template.defaults.headline;
    if (subtitleInput) subtitleInput.value = template.defaults.subtitle;

    // Switch to editor
    const galleryView = document.getElementById('video-gallery-view');
    const editorView  = document.getElementById('video-editor-view');
    const navGallery  = document.getElementById('video-nav-gallery');
    const navEditor   = document.getElementById('video-nav-editor');

    if (galleryView) galleryView.classList.remove('active');
    if (editorView) editorView.classList.add('active');
    if (navGallery) navGallery.classList.remove('active');
    if (navEditor) navEditor.classList.add('active');
}



// ==========================================================================
// MÓDULO: BILLING & ASSINATURAS
// ==========================================================================
function setupBilling() {
    // Toggle Mensal / Anual
    const toggle = document.getElementById("billing-period-toggle");
    const lblMonthly = document.getElementById("toggle-lbl-monthly");
    const lblAnnual  = document.getElementById("toggle-lbl-annual");

    if (toggle) {
        toggle.addEventListener("change", () => {
            billingIsAnnual = toggle.checked;
            lblMonthly.classList.toggle("active", !billingIsAnnual);
            lblAnnual.classList.toggle("active",  billingIsAnnual);
            updatePlanPrices();
        });
    }

    // Botões de assinar plano
    document.querySelectorAll(".btn-subscribe").forEach(btn => {
        btn.addEventListener("click", () => {
            if (btn.classList.contains("is-current")) return;
            const planName       = btn.getAttribute("data-plan");
            const priceMonthly   = parseInt(btn.getAttribute("data-price-monthly"));
            const priceAnnual    = parseInt(btn.getAttribute("data-price-annual"));
            const chosenPrice    = billingIsAnnual ? priceAnnual : priceMonthly;
            openCheckoutModal(planName, chosenPrice, billingIsAnnual);
        });
    });

    renderInvoiceTable();
}

function updatePlanPrices() {
    const plans = [
        { idPrice: "price-starter",    monthly: 149, annual: 119 },
        { idPrice: "price-pro",        monthly: 299, annual: 239 },
        { idPrice: "price-enterprise", monthly: 599, annual: 479 },
    ];

    plans.forEach(p => {
        const el = document.getElementById(p.idPrice);
        if (el) el.textContent = billingIsAnnual ? p.annual : p.monthly;
    });
}

function renderInvoiceTable() {
    const tbody = document.getElementById("invoice-tbody");
    if (!tbody) return;

    tbody.innerHTML = MOCK_INVOICES.map((inv, idx) => `
        <tr>
            <td style="white-space:nowrap;">${inv.date}</td>
            <td>${inv.desc}</td>
            <td style="font-family:'Space Mono',monospace; font-weight:600; color:#fff;">${inv.amount}</td>
            <td><span class="invoice-badge ${inv.status}">${inv.status === 'paid' ? '✓ Pago' : '⏳ Pendente'}</span></td>
            <td><button class="btn-download" onclick="downloadInvoice(${idx})"><i class="fa-solid fa-download"></i> PDF</button></td>
        </tr>
    `).join('');
}

function downloadInvoice(idx) {
    const inv = MOCK_INVOICES[idx];
    if (!inv) return;
    alert(`📄 Download iniciado!\n\nFatura: ${inv.desc}\nValor: ${inv.amount}\nData: ${inv.date}\n\n(Simulação – nenhum arquivo foi gerado)`);
}

function updateCurrentPlanDisplay(planName, priceMonthly, priceAnnual, isAnnual) {
    const price = isAnnual ? priceAnnual : priceMonthly;
    const period = isAnnual ? "Anual" : "Mensal";
    const renewDate = new Date();
    renewDate.setMonth(renewDate.getMonth() + 1);
    const renewStr = renewDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const nameEl    = document.getElementById("current-plan-name");
    const billingEl = document.getElementById("current-plan-billing");
    if (nameEl)    nameEl.textContent    = planName;
    if (billingEl) billingEl.textContent = `R$ ${price}/mês · Renovação em ${renewStr}`;

    // Atualizar botões "Plano Atual"
    document.querySelectorAll(".btn-subscribe").forEach(btn => {
        btn.classList.remove("is-current");
        const bPlan = btn.getAttribute("data-plan");
        if (bPlan === planName) {
            btn.classList.add("is-current");
            btn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Plano Atual`;
        } else {
            btn.innerHTML = `<i class="fa-solid fa-arrow-up"></i> Selecionar ${bPlan}`;
        }
    });

    // Destacar card do plano ativo
    document.querySelectorAll(".plan-card").forEach(card => card.classList.remove("current-active"));
    const planKey = planName.toLowerCase().replace(" ai", "").replace(" ", "-");
    const activeCard = document.getElementById(`plan-card-${planKey}`);
    if (activeCard) activeCard.classList.add("current-active");
}

// ==========================================================================
// MODAL: CHECKOUT DE ASSINATURA
// ==========================================================================
let checkoutPlanData = {};

function openCheckoutModal(planName, price, isAnnual) {
    checkoutPlanData = { planName, price, isAnnual };

    const modal = document.getElementById("checkout-modal");
    const form  = document.getElementById("checkout-form-content");
    const success = document.getElementById("checkout-success");

    document.getElementById("co-plan-name").textContent   = planName;
    document.getElementById("co-plan-detail").textContent = `Assinatura ${isAnnual ? "anual" : "mensal"} · Renovação automática`;
    document.getElementById("co-plan-price").textContent  = `R$ ${price}/${isAnnual ? "mês" : "mês"}`;

    // Reset campos e estado
    ["co-card-name", "co-card-number", "co-card-expiry", "co-card-cvv"].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.value = ""; el.classList.remove("error"); }
    });

    if (form)    form.style.display    = "block";
    if (success) success.classList.remove("show");

    const btn = document.getElementById("btn-confirm-payment");
    if (btn)  { btn.classList.remove("loading"); btn.disabled = false; }

    modal.classList.add("open");
}

function setupCheckoutModal() {
    const modal   = document.getElementById("checkout-modal");
    const closeBtn = document.getElementById("checkout-modal-close");
    const confirmBtn = document.getElementById("btn-confirm-payment");
    const successCloseBtn = document.getElementById("btn-close-success");

    // Fechar modal
    [closeBtn, modal].forEach(el => {
        if (!el) return;
        el.addEventListener("click", (e) => {
            if (e.target === modal || e.target === closeBtn || e.target === closeBtn.querySelector("i")) {
                modal.classList.remove("open");
            }
        });
    });

    // Formatação automática do número do cartão
    const cardNumberInput = document.getElementById("co-card-number");
    if (cardNumberInput) {
        cardNumberInput.addEventListener("input", (e) => {
            let val = e.target.value.replace(/\D/g, "").slice(0, 16);
            e.target.value = val.replace(/(.{4})/g, "$1 ").trim();
        });
    }

    // Formatação do vencimento
    const expiryInput = document.getElementById("co-card-expiry");
    if (expiryInput) {
        expiryInput.addEventListener("input", (e) => {
            let val = e.target.value.replace(/\D/g, "").slice(0, 4);
            if (val.length > 2) val = val.slice(0, 2) + "/" + val.slice(2);
            e.target.value = val;
        });
    }

    // Somente números no CVV
    const cvvInput = document.getElementById("co-card-cvv");
    if (cvvInput) {
        cvvInput.addEventListener("input", (e) => {
            e.target.value = e.target.value.replace(/\D/g, "").slice(0, 3);
        });
    }

    // Confirmar pagamento
    if (confirmBtn) {
        confirmBtn.addEventListener("click", () => {
            const name   = document.getElementById("co-card-name").value.trim();
            const number = document.getElementById("co-card-number").value.replace(/\s/g, "");
            const expiry = document.getElementById("co-card-expiry").value;
            const cvv    = document.getElementById("co-card-cvv").value;

            let valid = true;
            if (!name)                   { document.getElementById("co-card-name").classList.add("error");   valid = false; }
            if (number.length < 16)      { document.getElementById("co-card-number").classList.add("error"); valid = false; }
            if (!/^\d{2}\/\d{2}$/.test(expiry)) { document.getElementById("co-card-expiry").classList.add("error"); valid = false; }
            if (cvv.length < 3)          { document.getElementById("co-card-cvv").classList.add("error");    valid = false; }
            if (!valid) return;

            confirmBtn.classList.add("loading");
            confirmBtn.disabled = true;

            setTimeout(() => {
                // Sucesso: atualiza plano
                const { planName, price, isAnnual } = checkoutPlanData;
                const planDef = {
                    "Starter":       { monthly: 149, annual: 119 },
                    "Pro AI":        { monthly: 299, annual: 239 },
                    "Enterprise AI": { monthly: 599, annual: 479 },
                };
                const def = planDef[planName] || { monthly: price, annual: price };
                updateCurrentPlanDisplay(planName, def.monthly, def.annual, isAnnual);

                // Adiciona fatura ao histórico
                const now = new Date();
                const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                MOCK_INVOICES.unshift({
                    date: dateStr,
                    desc: `Plano ${planName} — ${isAnnual ? "Anual" : "Mensal"}`,
                    amount: `R$ ${price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                    status: "paid"
                });
                renderInvoiceTable();

                // Mostrar tela de sucesso
                document.getElementById("checkout-form-content").style.display = "none";
                document.getElementById("success-plan-msg").textContent = `Seu plano ${planName} foi ativado com sucesso! Aproveite todos os recursos de inteligência artificial.`;
                document.getElementById("checkout-success").classList.add("show");

                confirmBtn.classList.remove("loading");
            }, 2200);
        });
    }

    // Fechar tela de sucesso
    if (successCloseBtn) {
        successCloseBtn.addEventListener("click", () => {
            modal.classList.remove("open");
        });
    }
}

// ==========================================================================
// MODAL: ADICIONAR CARTÃO
// ==========================================================================
function setupCardModal() {
    const openBtn  = document.getElementById("btn-open-card-modal");
    const modal    = document.getElementById("card-modal");
    const closeBtn = document.getElementById("card-modal-close");
    const saveBtn  = document.getElementById("btn-save-card");

    if (openBtn)  openBtn.addEventListener("click", () => { resetCardModal(); modal.classList.add("open"); });
    if (closeBtn) closeBtn.addEventListener("click", () => modal.classList.remove("open"));
    if (modal)    modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("open"); });

    // Formatação automática
    const ncNumber = document.getElementById("nc-number");
    if (ncNumber) {
        ncNumber.addEventListener("input", (e) => {
            let val = e.target.value.replace(/\D/g, "").slice(0, 16);
            e.target.value = val.replace(/(.{4})/g, "$1 ").trim();
        });
    }
    const ncExpiry = document.getElementById("nc-expiry");
    if (ncExpiry) {
        ncExpiry.addEventListener("input", (e) => {
            let val = e.target.value.replace(/\D/g, "").slice(0, 4);
            if (val.length > 2) val = val.slice(0, 2) + "/" + val.slice(2);
            e.target.value = val;
        });
    }
    const ncCvv = document.getElementById("nc-cvv");
    if (ncCvv) ncCvv.addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 3); });

    // Salvar Cartão
    if (saveBtn) {
        saveBtn.addEventListener("click", () => {
            const holder = document.getElementById("nc-holder").value.trim();
            const number = document.getElementById("nc-number").value.replace(/\s/g, "");
            const expiry = document.getElementById("nc-expiry").value;
            const cvv    = document.getElementById("nc-cvv").value;

            // Limpa erros anteriores
            ["nc-holder-err", "nc-number-err", "nc-expiry-err", "nc-cvv-err"].forEach(id => {
                document.getElementById(id).classList.remove("visible");
            });
            ["nc-holder", "nc-number", "nc-expiry", "nc-cvv"].forEach(id => {
                document.getElementById(id).classList.remove("error");
            });

            let valid = true;
            if (!holder) {
                document.getElementById("nc-holder").classList.add("error");
                document.getElementById("nc-holder-err").classList.add("visible");
                valid = false;
            }
            if (number.length < 16) {
                document.getElementById("nc-number").classList.add("error");
                document.getElementById("nc-number-err").classList.add("visible");
                valid = false;
            }
            if (!/^\d{2}\/\d{2}$/.test(expiry)) {
                document.getElementById("nc-expiry").classList.add("error");
                document.getElementById("nc-expiry-err").classList.add("visible");
                valid = false;
            }
            if (cvv.length < 3) {
                document.getElementById("nc-cvv").classList.add("error");
                document.getElementById("nc-cvv-err").classList.add("visible");
                valid = false;
            }
            if (!valid) return;

            saveBtn.classList.add("loading");
            saveBtn.disabled = true;

            setTimeout(() => {
                // Atualiza o cartão virtual no painel
                const holderNameEl = document.getElementById("card-holder-name");
                if (holderNameEl) holderNameEl.textContent = holder.toUpperCase();

                modal.classList.remove("open");
                saveBtn.classList.remove("loading");
                saveBtn.disabled = false;

                // Pequeno feedback visual
                const openBtnEl = document.getElementById("btn-open-card-modal");
                if (openBtnEl) {
                    openBtnEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Cartão •••• ${number.slice(-4)} adicionado`;
                    openBtnEl.style.color = "var(--color-success)";
                    setTimeout(() => {
                        openBtnEl.innerHTML = `<i class="fa-solid fa-plus"></i> Adicionar novo cartão`;
                        openBtnEl.style.color = "";
                    }, 4000);
                }
            }, 1400);
        });
    }
}

function resetCardModal() {
    ["nc-holder", "nc-number", "nc-expiry", "nc-cvv"].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.value = ""; el.classList.remove("error"); }
    });
    ["nc-holder-err", "nc-number-err", "nc-expiry-err", "nc-cvv-err"].forEach(id => {
        document.getElementById(id).classList.remove("visible");
    });
    const btn = document.getElementById("btn-save-card");
    if (btn) { btn.classList.remove("loading"); btn.disabled = false; }
}

// ==========================================================================
// FUNÇÕES AUXILIARES DE IMAGEM
// ==========================================================================
function getCroppedBase64(img, targetWidth, targetHeight) {
    if (!img || !img.naturalWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    const imgRatio = img.naturalWidth / img.naturalHeight;
    const targetRatio = targetWidth / targetHeight;

    let drawW, drawH, drawX, drawY;

    if (imgRatio > targetRatio) {
        drawH = targetHeight;
        drawW = targetHeight * imgRatio;
        drawX = (targetWidth - drawW) / 2;
        drawY = 0;
    } else {
        drawW = targetWidth;
        drawH = targetWidth / imgRatio;
        drawX = 0;
        drawY = (targetHeight - drawH) / 2;
    }

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    return canvas.toDataURL('image/jpeg', 0.9);
}


// ==========================================================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ==========================================================================
console.log("app.js fully loaded. document.readyState:", document.readyState);
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // MOVE O EDITOR PRO PARA O BODY PARA EVITAR BUGS DE POSITION: FIXED E TRANSFORM
        const editorProView = document.getElementById('editor-pro-view');
        if (editorProView) {
            document.body.appendChild(editorProView);
        }

        // Inicializa a aplicação
        initApp();
    });
} else {
    // MOVE O EDITOR PRO PARA O BODY SE O DOM JÁ ESTIVER CARREGADO
    const editorProView = document.getElementById('editor-pro-view');
    if (editorProView) {
        document.body.appendChild(editorProView);
    }
    initApp();
}

// ==========================================================================
// MÓDULO 5: IDENTIDADE DA MARCA
// ==========================================================================
function setupBrandIdentity() {
    const brandLogoUploadBox = document.getElementById('brand-logo-upload-box');
    const brandLogoUploadInput = document.getElementById('brand-logo-upload');
    const brandLogoPreview = document.getElementById('brand-logo-preview');
    const brandLogoPlaceholder = document.getElementById('brand-logo-placeholder');
    
    // Novas cores e fontes
    const colorPrimary = document.getElementById('brand-color-primary');
    const colorSecondary = document.getElementById('brand-color-secondary');
    const colorTertiary = document.getElementById('brand-color-tertiary');
    const labelPrimary = document.getElementById('label-color-primary');
    const labelSecondary = document.getElementById('label-color-secondary');
    const labelTertiary = document.getElementById('label-color-tertiary');
    
    const brandFontsInput = document.getElementById('brand-fonts-input');
    const btnSaveBrand = document.getElementById('btn-save-brand-identity');

    // Estado e atualização dos seletores de cor da marca
    const updateColorState = (colorId, isDisabled) => {
        const box = document.querySelector(`.color-picker-box[data-color-id="${colorId}"]`);
        const input = document.getElementById(colorId);
        const overlay = document.getElementById('overlay-' + colorId);
        const btn = document.querySelector(`.btn-clear-color[data-color-target="${colorId}"]`);
        const label = document.getElementById('label-' + colorId.replace('brand-color-', 'color-'));

        if (!box || !input || !overlay || !btn || !label) return;

        if (isDisabled) {
            box.setAttribute('data-disabled', 'true');
            overlay.style.display = 'flex';
            overlay.style.pointerEvents = 'auto'; // permite clique para reativar
            btn.innerHTML = '<i class="fa-solid fa-plus"></i> Ativar';
            label.textContent = 'NENHUMA';
        } else {
            box.removeAttribute('data-disabled');
            overlay.style.display = 'none';
            overlay.style.pointerEvents = 'none';
            btn.innerHTML = '<i class="fa-solid fa-ban"></i> Remover';
            label.textContent = input.value.toUpperCase();
        }
    };

    // Configura botões de remover cor
    document.querySelectorAll('.btn-clear-color').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetId = btn.getAttribute('data-color-target');
            const box = document.querySelector(`.color-picker-box[data-color-id="${targetId}"]`);
            const isDisabled = box && box.getAttribute('data-disabled') === 'true';
            updateColorState(targetId, !isDisabled);
        });
    });

    // Configura cliques nos overlays para reativar e abrir o color picker
    document.querySelectorAll('.color-disabled-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const targetId = overlay.id.replace('overlay-', '');
            updateColorState(targetId, false);
            const input = document.getElementById(targetId);
            if (input) input.click();
        });
    });

    // Funções para atualizar labels de cor
    const bindColorLabel = (inputEl, labelEl) => {
        if (!inputEl || !labelEl) return;
        inputEl.addEventListener('input', (e) => {
            const targetId = inputEl.id;
            updateColorState(targetId, false);
            labelEl.textContent = e.target.value.toUpperCase();
        });
    };
    bindColorLabel(colorPrimary, labelPrimary);
    bindColorLabel(colorSecondary, labelSecondary);
    bindColorLabel(colorTertiary, labelTertiary);

    // Definir a função global para carregar e atualizar a UI de marca
    window.loadBrandIdentityUI = function() {
        const savedLogo = localStorage.getItem('imob_brand_logo');
        const savedColorPrimary = localStorage.getItem('imob_brand_color_primary');
        const savedColorSecondary = localStorage.getItem('imob_brand_color_secondary');
        const savedColorTertiary = localStorage.getItem('imob_brand_color_tertiary');
        const savedFonts = localStorage.getItem('imob_brand_fonts');

        if (savedLogo && brandLogoPreview && brandLogoPlaceholder) {
            brandLogoPreview.src = savedLogo;
            brandLogoPreview.style.display = 'block';
            brandLogoPlaceholder.style.display = 'none';
        } else if (brandLogoPreview && brandLogoPlaceholder) {
            brandLogoPreview.src = '';
            brandLogoPreview.style.display = 'none';
            brandLogoPlaceholder.style.display = 'flex';
            brandLogoPlaceholder.innerHTML = `
                <i class="fa-solid fa-upload" style="font-size: 1.5rem; margin-bottom: 8px;"></i>
                <p>Clique ou arraste a logo (.PNG, .JPG, .SVG)</p>
            `;
        }
        
        if (savedColorPrimary === "") {
            updateColorState('brand-color-primary', true);
        } else {
            if (colorPrimary) {
                colorPrimary.value = savedColorPrimary || '#000000';
            }
            updateColorState('brand-color-primary', savedColorPrimary ? false : true);
        }

        if (savedColorSecondary === "") {
            updateColorState('brand-color-secondary', true);
        } else {
            if (colorSecondary) {
                colorSecondary.value = savedColorSecondary || '#000000';
            }
            updateColorState('brand-color-secondary', savedColorSecondary ? false : true);
        }

        if (savedColorTertiary === "") {
            updateColorState('brand-color-tertiary', true);
        } else {
            if (colorTertiary) {
                colorTertiary.value = savedColorTertiary || '#000000';
            }
            updateColorState('brand-color-tertiary', savedColorTertiary ? false : true);
        }

        if (brandFontsInput) {
            brandFontsInput.value = savedFonts || '';
        }
    };

    // Executar o carregamento inicial
    loadBrandIdentityUI();

    // Função auxiliar para verificar se a imagem possui transparência (canal alpha < 240, proporção > 1.5%)
    const checkImageTransparency = (base64Str) => {
        return new Promise((resolve) => {
            if (base64Str.startsWith('data:image/svg+xml')) {
                resolve(true); // SVGs geralmente são transparentes ou vetoriais
                return;
            }
            const img = new Image();
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const maxDim = 150; // tamanho reduzido para escaneamento rápido
                    let w = img.width;
                    let h = img.height;
                    if (w > maxDim || h > maxDim) {
                        if (w > h) {
                            h = Math.round((h * maxDim) / w);
                            w = maxDim;
                        } else {
                            w = Math.round((w * maxDim) / h);
                            h = maxDim;
                        }
                    }
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    const imgData = ctx.getImageData(0, 0, w, h);
                    const data = imgData.data;
                    
                    let transparentPixels = 0;
                    for (let i = 3; i < data.length; i += 4) {
                        if (data[i] < 240) {
                            transparentPixels++;
                        }
                    }
                    const totalPixels = data.length / 4;
                    const ratio = transparentPixels / totalPixels;
                    // Se mais de 1.5% dos pixels possuírem canal alfa reduzido, consideramos transparente
                    resolve(ratio > 0.015);
                } catch (e) {
                    console.error('[TRANSPARENCY-CHECK] Falha ao ler pixels:', e);
                    resolve(true); // Fallback amigável
                }
            };
            img.onerror = () => resolve(true);
            img.src = base64Str;
        });
    };

    // Upload de Logo com detecção de transparência e remoção de fundo com IA
    if (brandLogoUploadBox && brandLogoUploadInput) {
        brandLogoUploadBox.addEventListener('click', () => {
            brandLogoUploadInput.click();
        });

        brandLogoUploadInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const validation = await validateFileHeader(file);
            if (!validation.valid) {
                alert(`Erro no upload da logo: ${validation.reason}`);
                brandLogoUploadInput.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = async (ev) => {
                const base64Str = ev.target.result;
                
                // Mostrar preview inicial temporário
                if (brandLogoPreview && brandLogoPlaceholder) {
                    brandLogoPreview.src = base64Str;
                    brandLogoPreview.style.display = 'block';
                    brandLogoPlaceholder.style.display = 'none';
                }

                // Verificar se é necessário remover o fundo
                const isTransparent = await checkImageTransparency(base64Str);
                
                if (isTransparent) {
                    console.log('[LOGO-UPLOAD] A imagem já possui transparência. Salvando diretamente.');
                    localStorage.setItem('imob_brand_logo', base64Str);
                    // Atualiza o editor imediatamente
                    if (typeof renderInteractiveOverlay === 'function') renderInteractiveOverlay();
                    return;
                }

                // Se não for transparente (fundo sólido/branco), enviamos para a IA
                console.log('[LOGO-UPLOAD] Imagem sem transparência detectada. Enviando para remoção de fundo com IA...');
                
                if (brandLogoPlaceholder && brandLogoPreview) {
                    brandLogoPreview.style.display = 'none';
                    brandLogoPlaceholder.innerHTML = `
                        <i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem; margin-bottom: 8px; color: var(--color-primary);"></i>
                        <p>IA removendo fundo da logo...</p>
                    `;
                    brandLogoPlaceholder.style.display = 'block';
                }

                try {
                    const token = loggedUser?.token || '';
                    const res = await fetch('/imovel/api/remove-bg', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ image_data: base64Str })
                    });

                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Erro desconhecido na API.');

                    if (data.image_data) {
                        console.log('[LOGO-UPLOAD] Fundo removido com sucesso pela IA!');
                        localStorage.setItem('imob_brand_logo', data.image_data);
                        
                        if (brandLogoPreview && brandLogoPlaceholder) {
                            brandLogoPreview.src = data.image_data;
                            brandLogoPreview.style.display = 'block';
                            brandLogoPlaceholder.style.display = 'none';
                            
                            // Restaurar o HTML original do placeholder para uploads futuros
                            brandLogoPlaceholder.innerHTML = `
                                <i class="fa-solid fa-upload" style="font-size: 1.5rem; margin-bottom: 8px;"></i>
                                <p>Clique ou arraste a logo (.PNG, .JPG, .SVG)</p>
                            `;
                        }
                        // Atualiza o editor imediatamente
                        if (typeof renderInteractiveOverlay === 'function') renderInteractiveOverlay();
                    } else {
                        throw new Error('Nenhuma imagem retornada pelo serviço.');
                    }
                } catch (err) {
                    console.error('[LOGO-UPLOAD] Erro ao remover fundo:', err);
                    alert('Aviso: Não conseguimos remover o fundo branco automaticamente através da IA (' + err.message + '). Mantivemos a imagem original.');
                    
                    // Manter original
                    localStorage.setItem('imob_brand_logo', base64Str);
                    if (brandLogoPreview && brandLogoPlaceholder) {
                        brandLogoPreview.src = base64Str;
                        brandLogoPreview.style.display = 'block';
                        brandLogoPlaceholder.style.display = 'none';
                        brandLogoPlaceholder.innerHTML = `
                            <i class="fa-solid fa-upload" style="font-size: 1.5rem; margin-bottom: 8px;"></i>
                            <p>Clique ou arraste a logo (.PNG, .JPG, .SVG)</p>
                        `;
                    }
                    // Atualiza o editor imediatamente
                    if (typeof renderInteractiveOverlay === 'function') renderInteractiveOverlay();
                }
            };
            reader.readAsDataURL(file);
        });
    }

    // Botão Salvar
    if (btnSaveBrand) {
        btnSaveBrand.addEventListener('click', () => {
            const originalHtml = btnSaveBrand.innerHTML;
            btnSaveBrand.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
            
            const tempLogo = localStorage.getItem('imob_brand_logo_temp');
            if (tempLogo) {
                localStorage.setItem('imob_brand_logo', tempLogo);
                localStorage.removeItem('imob_brand_logo_temp');
            }

            const isColorDisabled = (colorId) => {
                const box = document.querySelector(`.color-picker-box[data-color-id="${colorId}"]`);
                return box && box.getAttribute('data-disabled') === 'true';
            };

            if (colorPrimary) {
                localStorage.setItem('imob_brand_color_primary', isColorDisabled('brand-color-primary') ? '' : colorPrimary.value);
            }
            if (colorSecondary) {
                localStorage.setItem('imob_brand_color_secondary', isColorDisabled('brand-color-secondary') ? '' : colorSecondary.value);
            }
            if (colorTertiary) {
                localStorage.setItem('imob_brand_color_tertiary', isColorDisabled('brand-color-tertiary') ? '' : colorTertiary.value);
            }
            if (brandFontsInput) localStorage.setItem('imob_brand_fonts', brandFontsInput.value);

            // Adiciona o listener de Debug
            const debugBtn = document.getElementById('debug-editor-btn');
            if (debugBtn) {
                debugBtn.addEventListener('click', () => {
                    console.log("Bypassing API, opening editor...");
                    const editorImage = document.getElementById('editor-preview-image');
                    if (editorImage) {
                        editorImage.src = 'https://via.placeholder.com/800x400?text=Editor+Pro+Preview';
                        document.getElementById('editor-modal').classList.add('open');
                    }
                });
            }

            setTimeout(() => {
                btnSaveBrand.innerHTML = '<i class="fa-solid fa-check-double"></i> Identidade Salva!';
                setTimeout(() => {
                    btnSaveBrand.innerHTML = originalHtml;
                }, 2000);
            }, 800);
        });
    }

    // Botão Apagar Informações
    const btnClearBrand = document.getElementById('btn-clear-brand-identity');
    if (btnClearBrand) {
        btnClearBrand.addEventListener('click', () => {
            if (!confirm('Tem certeza que deseja apagar todas as informações da marca? A IA voltará a usar as cores padrão dos templates.')) return;
            
            localStorage.removeItem('imob_brand_logo');
            localStorage.removeItem('imob_brand_logo_temp');
            localStorage.removeItem('imob_brand_color_primary');
            localStorage.removeItem('imob_brand_color_secondary');
            localStorage.removeItem('imob_brand_color_tertiary');
            localStorage.removeItem('imob_brand_fonts');
            
            // Resetar a interface
            if (brandLogoPreview && brandLogoPlaceholder) {
                brandLogoPreview.src = '';
                brandLogoPreview.style.display = 'none';
                brandLogoPlaceholder.style.display = 'block';
            }
            if (colorPrimary) {
                colorPrimary.value = '#c8da42';
                updateColorState('brand-color-primary', false);
            }
            if (colorSecondary) {
                colorSecondary.value = '#ffffff';
                updateColorState('brand-color-secondary', false);
            }
            if (colorTertiary) {
                colorTertiary.value = '#000000';
                updateColorState('brand-color-tertiary', false);
            }
            if (brandFontsInput) brandFontsInput.value = '';
            
            const originalHtml = btnClearBrand.innerHTML;
            btnClearBrand.innerHTML = '<i class="fa-solid fa-check"></i> Apagado!';
            setTimeout(() => {
                btnClearBrand.innerHTML = originalHtml;
            }, 2000);
        });
    }
}

// ==========================================================================
// ADICIONAR ÍCONE AO ARTBOARD
// Chamado pelo painel de ícones na toolbar do Editor Pro
// ==========================================================================
function addIconToArtboard(iconClass) {
    const c1 = localStorage.getItem('imob_brand_color_primary') || '#0a4635';
    const c2 = localStorage.getItem('imob_brand_color_secondary') || '#c8da42';
    
    const id = 'layer-' + (++layerIdCounter);
    const layer = {
        id,
        name: 'Ícone ' + iconClass.replace('fa-', ''),
        type: 'html',
        content: `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${c1};border-radius:50%;"><i class="fa-solid ${iconClass}" style="color:${c2};font-size:32px;"></i></div>`,
        cssText: `width:64px;height:64px;position:absolute;`,
        top: '460px',
        left: '460px',
        visible: true,
        locked: false
    };
    editorLayers.push(layer);
    renderEditorProLayers();
    selectLayer(id);
    
    // Fecha o painel
    const panel = document.getElementById('editor-icon-panel');
    if (panel) panel.style.display = 'none';
}

// ==========================================================================
// ADICIONAR LOGOTIPO MCMV AO ARTBOARD (IMG MCMV 1 E 2)
// Chamado pelos botões de ação rápida na toolbar do Editor Pro
// ==========================================================================
function addMcmvLogoToArtboard(num) {
    const logoSrc = num === 1 ? '/imovel/Assets/mcmv_logo_1.png' : '/imovel/Assets/mcmv_logo_2.png';
    const logoName = num === 1 ? 'Logo MCMV Vertical' : 'Logo MCMV Horizontal';
    const width = num === 1 ? '240px' : '320px';
    const height = num === 1 ? '160px' : '120px';

    const id = 'layer-' + (++layerIdCounter);
    const layer = {
        id,
        name: logoName,
        type: 'html',
        content: `<img src="${logoSrc}" style="width:100%;height:100%;object-fit:contain;pointer-events:none;" alt="${logoName}" />`,
        cssText: `width:${width};height:${height};position:absolute;`,
        top: '460px',
        left: '380px',
        cluster: 'NONE',
        edgeTop: '460px',
        visible: true,
        locked: false
    };
    editorLayers.push(layer);
    renderEditorProLayers();
    selectLayer(id);
    if (typeof saveEditorState === 'function') saveEditorState();
}

// ==========================================================================
// ADICIONAR SELO HIS SP (HABITAÇÃO DE INTERESSE SOCIAL) AO ARTBOARD
// Chamado pelo botão 'HIS SP' na toolbar do Editor Pro
// ==========================================================================
function addHisSpLogoToArtboard() {
    const logoSrc = '/imovel/Assets/his_sp.png';
    const logoName = 'Selo HIS SP';
    const width = '360px';
    const height = '180px';

    const id = 'layer-' + (++layerIdCounter);
    const layer = {
        id,
        name: logoName,
        type: 'html',
        content: `<img src="${logoSrc}" style="width:100%;height:100%;object-fit:contain;pointer-events:none;" alt="${logoName}" />`,
        cssText: `width:${width};height:${height};position:absolute;`,
        top: '460px',
        left: '360px',
        cluster: 'NONE',
        edgeTop: '460px',
        visible: true,
        locked: false
    };
    editorLayers.push(layer);
    renderEditorProLayers();
    selectLayer(id);
    if (typeof saveEditorState === 'function') saveEditorState();
}

// ==========================================================================
// ADICIONAR PLACA / TOTEM METRÔ AO ARTBOARD
// Chamado pelo botão 'Placa Metrô' na toolbar do Editor Pro
// ==========================================================================
function addPlacaMetroToArtboard() {
    const logoSrc = '/imovel/Assets/placa_metro.png';
    const logoName = 'Placa Metrô';
    const width = '220px';
    const height = '880px';

    const id = 'layer-' + (++layerIdCounter);
    const layer = {
        id,
        name: logoName,
        type: 'html',
        content: `<img src="${logoSrc}" style="width:100%;height:100%;object-fit:contain;pointer-events:none;" alt="${logoName}" />`,
        cssText: `width:${width};height:${height};position:absolute;`,
        top: '100px',
        left: '430px',
        cluster: 'NONE',
        edgeTop: '100px',
        visible: true,
        locked: false
    };
    editorLayers.push(layer);
    renderEditorProLayers();
    selectLayer(id);
    if (typeof saveEditorState === 'function') saveEditorState();
}

// ==========================================================================
// MÓDULO: EDITOR LIVRE (IA)
// ==========================================================================
let elUploadedImageBase64 = null;
let elSelectedFormat = 'feed'; // 'feed' ou 'story'

function setupEditorLivre() {
    console.log('[EDITOR LIVRE] Inicializando módulo...');

    const uploadZone   = document.getElementById('el-upload-zone');
    const photoInput   = document.getElementById('el-photo-input');
    const previewWrap  = document.getElementById('el-upload-preview');
    const previewImg   = document.getElementById('el-preview-img');
    const removePhoto  = document.getElementById('el-remove-photo');

    const fmtFeed      = document.getElementById('el-fmt-feed');
    const fmtStory     = document.getElementById('el-fmt-story');
    const fmtPortrait  = document.getElementById('el-fmt-portrait');

    const tomSelector  = document.getElementById('el-tom-selector');
    const estiloSelector = document.getElementById('el-estilo-selector');

    const generateBtn  = document.getElementById('el-generate-btn');
    const retryBtn     = document.getElementById('el-btn-retry');
    const regenerateBtn = document.getElementById('el-btn-regenerate');
    const downloadBtn  = document.getElementById('el-btn-download');

    // Mapeamento de Estados Visuais
    const stateIdle    = document.getElementById('el-result-idle');
    const stateLoading = document.getElementById('el-result-loading');
    const stateOutput  = document.getElementById('el-result-output');
    const stateError   = document.getElementById('el-result-error');

    function setVisualState(state) {
        stateIdle.style.display = state === 'idle' ? 'flex' : 'none';
        stateLoading.style.display = state === 'loading' ? 'flex' : 'none';
        stateOutput.style.display = state === 'output' ? 'flex' : 'none';
        stateError.style.display = state === 'error' ? 'flex' : 'none';
    }

    // 1. Upload e Preview
    if (uploadZone && photoInput) {
        uploadZone.addEventListener('click', () => photoInput.click());

        // Drag & Drop
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.style.borderColor = 'var(--color-primary)';
            uploadZone.style.background = 'rgba(200, 218, 66, 0.04)';
        });

        uploadZone.addEventListener('dragleave', () => {
            uploadZone.style.borderColor = '';
            uploadZone.style.background = '';
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.style.borderColor = '';
            uploadZone.style.background = '';
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleElPhotoFile(e.dataTransfer.files[0]);
            }
        });

        photoInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleElPhotoFile(e.target.files[0]);
            }
        });
    }

    function compressAndResizeImage(base64Str, maxWidth = 1200, maxHeight = 1200, quality = 0.85) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = (err) => reject(err);
            img.src = base64Str;
        });
    }

    function handleElPhotoFile(file) {
        // Validar tamanho
        if (file.size > 10 * 1024 * 1024) {
            alert('A foto deve ter no máximo 10MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const originalBase64 = e.target.result;
                const compressedBase64 = await compressAndResizeImage(originalBase64, 1200, 1200, 0.85);
                elUploadedImageBase64 = compressedBase64;
                if (previewImg) previewImg.src = elUploadedImageBase64;
                if (uploadZone) uploadZone.style.display = 'none';
                if (previewWrap) previewWrap.style.display = 'block';
                
                const geminiSuggestBtn = document.getElementById('el-btn-gemini-suggest');
                if (geminiSuggestBtn) geminiSuggestBtn.style.display = 'flex';
            } catch (err) {
                console.error("Erro ao comprimir imagem:", err);
                alert("Erro ao processar imagem. Tente usar outro arquivo.");
            }
        };
        reader.readAsDataURL(file);
    }

    if (removePhoto) {
        removePhoto.addEventListener('click', () => {
            elUploadedImageBase64 = null;
            if (photoInput) photoInput.value = '';
            if (uploadZone) uploadZone.style.display = 'block';
            if (previewWrap) previewWrap.style.display = 'none';
            
            const geminiSuggestBtn = document.getElementById('el-btn-gemini-suggest');
            if (geminiSuggestBtn) geminiSuggestBtn.style.display = 'none';
        });
    }

    const geminiSuggestBtn = document.getElementById('el-btn-gemini-suggest');
    if (geminiSuggestBtn) {
        geminiSuggestBtn.addEventListener('click', async () => {
            if (!elUploadedImageBase64) return;

            const originalHtml = geminiSuggestBtn.innerHTML;
            geminiSuggestBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sugerindo...';
            geminiSuggestBtn.disabled = true;

            try {
                const token = localStorage.getItem('imob_token') || sessionStorage.getItem('imob_token');
                const response = await fetch('/imovel/api/suggest-copy', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        image_data: elUploadedImageBase64
                    })
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error || 'Falha ao sugerir textos com Gemini.');
                }

                const data = await response.json();
                if (data.success) {
                    const elNomeEmpreendimento = document.getElementById('el-nome-empreendimento');
                    const elIncorporadora = document.getElementById('el-incorporadora');
                    const elTipoImovel = document.getElementById('el-tipo-imovel');
                    const elLocalizacao = document.getElementById('el-localizacao');
                    const elAreaPrivativa = document.getElementById('el-area-privativa');
                    const elDormitorios = document.getElementById('el-dormitorios');
                    const elSuites = document.getElementById('el-suites');
                    const elVagas = document.getElementById('el-vagas');
                    const elCondicoesPreco = document.getElementById('el-condicoes-preco');
                    const elBanheiros = document.getElementById('el-banheiros');
                    const elPublicoAlvo = document.getElementById('el-publico-alvo');
                    const elTomVoz = document.getElementById('el-tom-voz');
                    const elObjetivo = document.getElementById('el-objetivo');

                    if (elNomeEmpreendimento) elNomeEmpreendimento.value = data.nomeEmpreendimento || '';
                    if (elIncorporadora) elIncorporadora.value = data.incorporadora || '';
                    if (elTipoImovel && data.tipoImovel) elTipoImovel.value = data.tipoImovel;
                    if (elLocalizacao) elLocalizacao.value = data.localizacao || '';
                    if (elAreaPrivativa) elAreaPrivativa.value = data.areaPrivativa || '';
                    if (elDormitorios && data.dormitorios) elDormitorios.value = data.dormitorios;
                    if (elSuites && data.suites) elSuites.value = data.suites;
                    if (elVagas && data.vagas) elVagas.value = data.vagas;
                    if (elCondicoesPreco) elCondicoesPreco.value = data.condicoesPreco || '';
                    if (elBanheiros && data.banheiros) elBanheiros.value = data.banheiros;
                    if (elPublicoAlvo && data.publicoAlvo) elPublicoAlvo.value = data.publicoAlvo;
                    if (elTomVoz && data.tomVoz) elTomVoz.value = data.tomVoz;
                    if (elObjetivo && data.objetivo) elObjetivo.value = data.objetivo;

                    // Ativar diferenciais recebidos
                    if (data.diferenciais && Array.isArray(data.diferenciais)) {
                        const difContainer = document.getElementById('el-diferenciais-container');
                        if (difContainer) {
                            difContainer.querySelectorAll('.el-diferencial-pill').forEach(pill => {
                                pill.classList.remove('active');
                            });

                            data.diferenciais.forEach(val => {
                                let pill = Array.from(difContainer.querySelectorAll('.el-diferencial-pill'))
                                    .find(p => p.getAttribute('data-value').toLowerCase() === val.toLowerCase());
                                
                                if (pill) {
                                    pill.classList.add('active');
                                } else {
                                    const newPill = document.createElement('span');
                                    newPill.className = 'el-diferencial-pill active';
                                    newPill.setAttribute('data-value', val);
                                    newPill.textContent = `+ ${val}`;
                                    difContainer.appendChild(newPill);
                                }
                            });
                        }
                    }

                    alert('Sugestões geradas com sucesso pelo Gemini!');
                }
            } catch (err) {
                console.error('[GEMINI] Erro ao obter sugestões:', err);
                alert(err.message || 'Erro ao consultar a IA do Gemini.');
            } finally {
                geminiSuggestBtn.innerHTML = originalHtml;
                geminiSuggestBtn.disabled = false;
            }
        });
    }

    // Gerenciamento dos Diferenciais (Pills)
    const elDiferenciaisContainer = document.getElementById('el-diferenciais-container');
    const elNovoDiferencialInput = document.getElementById('el-novo-diferencial');
    const elBtnAddDiferencial = document.getElementById('el-btn-add-diferencial');

    if (elDiferenciaisContainer) {
        elDiferenciaisContainer.addEventListener('click', (e) => {
            const pill = e.target.closest('.el-diferencial-pill');
            if (pill) {
                pill.classList.toggle('active');
            }
        });
    }

    if (elBtnAddDiferencial && elNovoDiferencialInput && elDiferenciaisContainer) {
        const addPill = () => {
            const value = elNovoDiferencialInput.value.trim();
            if (value) {
                // Verificar se já não existe
                let exists = Array.from(elDiferenciaisContainer.querySelectorAll('.el-diferencial-pill'))
                    .some(p => p.getAttribute('data-value').toLowerCase() === value.toLowerCase());
                
                if (!exists) {
                    const newPill = document.createElement('span');
                    newPill.className = 'el-diferencial-pill active';
                    newPill.setAttribute('data-value', value);
                    newPill.textContent = `+ ${value}`;
                    elDiferenciaisContainer.appendChild(newPill);
                }
                elNovoDiferencialInput.value = '';
            }
        };

        elBtnAddDiferencial.addEventListener('click', addPill);
        elNovoDiferencialInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addPill();
            }
        });
    }

    // 2. Formato
    if (fmtFeed && fmtStory && fmtPortrait) {
        fmtFeed.addEventListener('click', () => {
            elSelectedFormat = 'feed';
            selectedFormat = 'feed';
            fmtFeed.classList.add('active');
            fmtStory.classList.remove('active');
            fmtPortrait.classList.remove('active');
        });
        fmtStory.addEventListener('click', () => {
            elSelectedFormat = 'story';
            selectedFormat = 'story';
            fmtStory.classList.add('active');
            fmtFeed.classList.remove('active');
            fmtPortrait.classList.remove('active');
        });
        fmtPortrait.addEventListener('click', () => {
            elSelectedFormat = 'portrait';
            selectedFormat = 'portrait';
            fmtPortrait.classList.add('active');
            fmtFeed.classList.remove('active');
            fmtStory.classList.remove('active');
        });
    }

    // 3. Tom e Estilo (Pills)
    if (tomSelector) {
        tomSelector.addEventListener('click', (e) => {
            const btn = e.target.closest('.el-pill');
            if (!btn) return;
            tomSelector.querySelectorAll('.el-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    }

    if (estiloSelector) {
        estiloSelector.addEventListener('click', (e) => {
            const btn = e.target.closest('.el-pill');
            if (!btn) return;
            estiloSelector.querySelectorAll('.el-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    }

    // 4. Fluxo de Geração
    async function triggerGeneration() {
        if (!elUploadedImageBase64) {
            alert('Por favor, carregue uma foto do imóvel para a IA trabalhar.');
            return;
        }

        const nomeEmpreendimento = document.getElementById('el-nome-empreendimento').value.trim();
        if (!nomeEmpreendimento) {
            alert('Por favor, digite o nome do empreendimento.');
            return;
        }
        
        const incorporadora = document.getElementById('el-incorporadora').value.trim();
        const tipoImovel = document.getElementById('el-tipo-imovel').value;
        const localizacao = document.getElementById('el-localizacao').value.trim();
        if (!localizacao) {
            alert('Por favor, digite a localização do imóvel.');
            return;
        }

        const areaPrivativa = document.getElementById('el-area-privativa').value.trim();
        const dormitorios = document.getElementById('el-dormitorios').value;
        const suites = document.getElementById('el-suites').value;
        const vagas = document.getElementById('el-vagas').value;
        const condicoesPreco = document.getElementById('el-condicoes-preco').value.trim();
        const banheiros = document.getElementById('el-banheiros').value;

        const publicoAlvo = document.getElementById('el-publico-alvo').value;
        const tomVoz = document.getElementById('el-tom-voz').value;
        const objetivo = document.getElementById('el-objetivo').value;

        // Pegar diferenciais ativos
        const differentials = Array.from(document.querySelectorAll('.el-diferencial-pill.active'))
            .map(pill => pill.getAttribute('data-value'));

        // Pega valores dos pills ativos de estilo visual
        const activeTomBtn = tomSelector ? tomSelector.querySelector('.el-pill.active') : null;
        const activeEstiloBtn = estiloSelector ? estiloSelector.querySelector('.el-pill.active') : null;
        const tomValue = activeTomBtn ? activeTomBtn.getAttribute('data-value') : 'moderno';
        const estiloValue = activeEstiloBtn ? activeEstiloBtn.getAttribute('data-value') : 'fotografico';
        
        const extraPrompt = document.getElementById('el-extra-prompt').value.trim();

        const formatText = elSelectedFormat === 'feed' ? '1:1' : (elSelectedFormat === 'portrait' ? '4:5' : '9:16');

        // Construção do super prompt
        let builtPrompt = `Você é um Diretor de Arte Sênior especializado em criativos para anúncios imobiliários de alta conversão (Meta Ads, Instagram e Google Display). Você domina hierarquia visual, psicologia de cores, tipografia publicitária e copywriting persuasivo para o mercado imobiliário brasileiro.

## MANDATO CRÍTICO E INVIOLÁVEL: MANTER A FOTO ORIGINAL 100% INALTERADA
Você deve manter a foto de fundo original do imóvel 100% inalterada e intacta. NÃO redesenhe, NÃO modifique e NÃO altere as paredes, móveis, arquitetura, decoração, janelas, vista ou iluminação da imagem enviada pelo usuário. Os textos e elementos gráficos devem ser aplicados apenas como uma camada de overlay (sobreposição) profissional por cima da foto original, sem jamais alterá-la ou descaracterizá-la.

## SUA TAREFA
Analise a imagem enviada pelo usuário (foto do imóvel/decorado) e crie uma peça publicitária profissional a partir dela, transformando-a em um anúncio pronto para tráfego pago, mantendo a foto de fundo completamente intacta.

## DADOS DO ANÚNCIO (use EXATAMENTE estes textos, sem alterar nomes, valores ou grafia)
- Empreendimento: ${nomeEmpreendimento}
- Incorporadora/Construtora: ${incorporadora || 'Não informado'}
- Tipo de imóvel: ${tipoImovel}
- Localização: ${localizacao}
- Área privativa: ${areaPrivativa || 'Não informado'} m²
- Dormitórios: ${dormitorios} | Suítes: ${suites} | Banheiros: ${banheiros} | Vagas: ${vagas}
- Condição de preço (DESTAQUE PRINCIPAL): ${condicoesPreco || 'Não informado'}
- Diferenciais selecionados: ${differentials.length > 0 ? differentials.join(', ') : 'Nenhum'}

## DIRECIONAMENTO ESTRATÉGICO
- Público-alvo: ${publicoAlvo} — adapte linguagem, estética e gatilhos mentais para este perfil.
- Tom de voz: ${tomVoz} — todo o copy da peça deve seguir este tom.
- Objetivo da campanha: ${objetivo} — o CTA (chamada para ação) deve conduzir diretamente a este objetivo.

## ESTILO VISUAL OBRIGATÓRIO
- Tom da arte: ${tomValue}
- Estilo da arte: ${estiloValue}

## FORMATO DA PEÇA
- Formato solicitado: ${formatText} (valores possíveis: "1:1", "4:5" ou "9:16")

## SAFE ZONES (OBRIGATÓRIO — respeite rigorosamente conforme o formato)

### Se o formato for 1:1 (1080x1080px — Feed):
- Mantenha TODOS os elementos essenciais (headline, preço, atributos, CTA, logo) dentro da área central de segurança: margem mínima de 70px em todas as bordas.
- Nenhum texto ou logo pode encostar nas bordas da peça.
- A imagem de fundo original deve preencher toda a tela, mas informação crítica não.

### Se o formato for 4:5 (1080x1350px — Feed vertical):
- ZONA SUPERIOR DE ATENÇÃO: os 120px do topo podem ser parcialmente sobrepostos pelo cabeçalho do post (nome do perfil) em algumas visualizações. Evite posicionar textos importantes nesta faixa.
- ZONA INFERIOR DE ATENÇÃO: os 150px da base podem ser sobrepostos por ícones de interação e legenda em algumas visualizações. NÃO posicione CTA, preço ou logo nesta faixa.
- LATERAIS: margem mínima de 70px em cada lado para textos.
- Concentre toda a informação crítica (headline, preço, atributos, diferenciais, CTA, logo) na área central segura: entre 120px do topo e 150px da base (faixa útil de ~1080px de altura).
- A imagem de fundo original deve preencher o frame inteiro, apenas os elementos gráficos/textuais respeitam a safe zone.
- ATENÇÃO: este formato também é frequentemente reaproveitado em Stories com corte automático — priorize manter os elementos essenciais o mais próximo possível do centro vertical da peça.

### Se o formato for 9:16 (1080x1920px — Stories/Reels):
- ZONA SUPERIOR BLOQUEADA: os 250px do topo são cobertos pela UI da plataforma (nome do perfil, câmera, barra de progresso). NÃO posicione nenhum texto, logo ou elemento essencial nesta faixa.
- ZONA INFERIOR BLOQUEADA: os 340px da base são cobertos pela UI (botão de CTA da plataforma, caixa de resposta, ícones de interação). NÃO posicione nenhum texto, logo ou CTA nesta faixa.
- LATERAIS: margem mínima de 60px em cada lado para textos.
- Toda a informação crítica (headline, preço, atributos, diferenciais, CTA, logo) deve ficar concentrada na área central segura: entre 250px do topo e 340px da base (faixa útil de ~1330px de altura).
- A imagem de fundo original deve preencher o frame inteiro, apenas os elementos gráficos/textuais respeitam a safe zone.
- Lembre-se: em Stories o CTA nativo da plataforma aparece na base — posicione seu CTA visual logo acima da zona bloqueada inferior, apontando/conduzindo para ele quando fizer sentido.

## INSTRUÇÕES ADICIONAIS DO USUÁRIO (prioridade máxima — se conflitarem com regras acima, estas vencem, EXCETO as safe zones e a regra de manter a foto original inalterada, que são invioláveis)
${extraPrompt || 'Nenhuma'}

## REGRAS DE COMPOSIÇÃO
1. A FOTO ORIGINAL DO IMÓVEL É SAGRADA E DEVE SER MANTIDA 100% INALTERADA. É TERMINANTEMENTE PROIBIDO alterar móveis, cores de paredes, janelas, decoração, revestimentos ou estrutura arquitetônica do local. Aplique textos e formas apenas como elementos gráficos flutuantes/overlay por cima da imagem real.
2. Hierarquia visual obrigatória: (1º) headline de impacto, (2º) condição de preço em destaque, (3º) atributos do imóvel (metragem, quartos, vagas) em ícones ou selos compactos, (4º) diferenciais como tags/badges, (5º) CTA claro, (6º) logo/nome da incorporadora discreto.
3. Todo texto da peça deve estar em português do Brasil, com ortografia impecável e legível em telas de celular (contraste alto, fonte mínima equivalente a 14pt na peça final).
4. Não invente informações: use somente os dados fornecidos. Não crie preços, prazos, condições ou promessas que não estejam nos campos acima.
5. Evite poluição visual: máximo de 2 famílias tipográficas, respiro entre elementos, e no máximo 20% da área coberta por texto (boas práticas de Meta Ads).
6. O CTA deve ser curto e imperativo, coerente com o objetivo (ex.: "Agende sua visita ao decorado").

## ENTREGA E REQUISITO FINAL
Gere a peça final pronta para publicação, contendo a FOTO ORIGINAL DO IMÓVEL COMPLETAMENTE INALTERADA DE FUNDO. Os elementos gráficos, textuais e botões devem estar sobrepostos de forma limpa, respeitando a safe zone do formato solicitado. NÃO invente, modifique, alucine ou altere nenhum detalhe da foto original do imóvel.`;

        // Ativar estado Loading com passos interativos
        setVisualState('loading');
        updateLoadingProgress(1);

        try {
            const token = localStorage.getItem('imob_token') || sessionStorage.getItem('imob_token');
            const response = await fetch('/imovel/api/generate-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    prompt: builtPrompt,
                    format: elSelectedFormat,
                    category: 'editor-livre',
                    image_data: elUploadedImageBase64,
                    is_adjustment: false
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'Falha ao processar a geração de imagem.');
            }

            const data = await response.json();
            if (data.success && data.image_urls && data.image_urls.length > 0) {
                const resultUrl = data.image_urls[0];
                
                // Exibir resultado
                const outputImg = document.getElementById('el-result-img');
                if (outputImg) outputImg.src = resultUrl;

                const metaWrap = document.getElementById('el-result-meta');
                if (metaWrap) {
                    let fmtText = '1080×1080 (Feed)';
                    if (elSelectedFormat === 'story') {
                        fmtText = '1080×1920 (Story)';
                    } else if (elSelectedFormat === 'portrait') {
                        fmtText = '1080×1350 (Retrato)';
                    }
                    metaWrap.textContent = `Formato: ${fmtText} · Processado por IA`;
                }

                // Atualizar créditos localmente
                if (data.credits_remaining !== undefined) {
                    updateCreditsUI(data.credits_remaining);
                }

                setVisualState('output');
            } else {
                throw new Error('Nenhuma imagem retornada pelo servidor.');
            }

        } catch (err) {
            console.error('[EDITOR LIVRE] Erro ao gerar:', err);
            const errEl = document.getElementById('el-error-msg');
            if (errEl) errEl.textContent = err.message || 'Erro de rede ou limite de cota atingido.';
            setVisualState('error');
        }
    }

    function updateLoadingProgress(step) {
        const steps = ['el-lstep-1', 'el-lstep-2', 'el-lstep-3', 'el-lstep-4'];
        const msgs = [
            'Enviando imagem base...',
            'A IA está interpretando suas instruções...',
            'Refinando elementos gráficos e textos...',
            'Fazendo download da arte gerada...'
        ];

        const msgEl = document.getElementById('el-loading-msg');
        if (msgEl) msgEl.textContent = msgs[step - 1] || 'Processando...';

        steps.forEach((id, idx) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.className = 'el-load-step';
            if (idx + 1 < step) {
                el.classList.add('done');
                el.innerHTML = '<i class="fa-solid fa-check"></i> ' + el.textContent.replace(/.*?\s/, '');
            } else if (idx + 1 === step) {
                el.classList.add('active');
            }
        });

        // Simula progressão automática de passos para parecer interativo
        if (step < 4) {
            setTimeout(() => {
                if (stateLoading.style.display === 'flex') {
                    updateLoadingProgress(step + 1);
                }
            }, 3800);
        }
    }

    if (generateBtn) generateBtn.addEventListener('click', triggerGeneration);
    if (retryBtn) retryBtn.addEventListener('click', triggerGeneration);
    if (regenerateBtn) regenerateBtn.addEventListener('click', triggerGeneration);

    // 5. Baixar Imagem Gerada
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async () => {
            const outputImg = document.getElementById('el-result-img');
            if (!outputImg || !outputImg.src) return;

            try {
                downloadBtn.disabled = true;
                const originalHtml = downloadBtn.innerHTML;
                downloadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Baixando...';

                // Fetch real da imagem convertida em blob para forçar download local sem abrir nova aba
                const response = await fetch(outputImg.src);
                const blob = await response.blob();
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `anuncio-ia-${Date.now()}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                downloadBtn.innerHTML = originalHtml;
                downloadBtn.disabled = false;
            } catch (e) {
                console.error(e);
                // Fallback abrindo em nova aba
                window.open(outputImg.src, '_blank');
                downloadBtn.disabled = false;
            }
        });
    }

    // 6. Atualizar Créditos UI
    function updateCreditsUI(credits) {
        const remainingEl = document.getElementById('el-remaining-credits');
        if (remainingEl) remainingEl.textContent = credits;
        
        const badge = document.getElementById('el-credits-badge');
        if (badge) badge.style.display = 'block';

        // Atualizar também na sidebar se houver elementos correspondentes
        const sidebarArtes = document.getElementById('sidebar-credits-artes');
        if (sidebarArtes) {
            sidebarArtes.textContent = `${credits} / 50`;
            const bar = document.getElementById('sidebar-credits-artes-bar');
            if (bar) {
                const percentage = Math.min(100, Math.max(0, (credits / 50) * 100));
                bar.style.width = `${percentage}%`;
            }
        }
    }

    // Buscar créditos iniciais do perfil
    async function loadInitialCredits() {
        try {
            const token = localStorage.getItem('imob_token') || sessionStorage.getItem('imob_token');
            if (!token) return;
            
            const response = await fetch('/imovel/api/user-profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const profile = await response.json();
                if (profile && profile.credits_images !== undefined) {
                    updateCreditsUI(profile.credits_images);
                }
            }
        } catch (e) {
            console.warn('[EDITOR LIVRE] Falha ao carregar créditos:', e);
        }
    }

    loadInitialCredits();
}

// Global initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}





