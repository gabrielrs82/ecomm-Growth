// ============================================================
// Supabase Client — Server-side (com Service Role Key)
// ============================================================
// Usado apenas nas Serverless Functions do Vercel.
// NUNCA exponha a Service Role Key no frontend!
// ============================================================

const { createClient } = require('@supabase/supabase-js');

const URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!URL || !ANON_KEY) {
    throw new Error("Variáveis de ambiente SUPABASE_URL e/ou SUPABASE_ANON_KEY ausentes.");
}

// Client para operações administrativas (bypass RLS)
const supabaseAdmin = createClient(
    URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || ANON_KEY, // Fallback se falhar
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

// Client para operações do usuário (respeita RLS)
function getSupabaseClient(accessToken) {
    return createClient(
        URL,
        ANON_KEY,
        {
            global: {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            },
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );
}

// Verifica o token JWT e retorna os dados do usuário
function parseCookies(cookieHeader) {
    const cookies = {};
    if (!cookieHeader) return cookies;
    cookieHeader.split(';').forEach(cookie => {
        const [name, ...rest] = cookie.split('=');
        if (name) {
            cookies[name.trim()] = rest.join('=').trim();
        }
    });
    return cookies;
}

async function verifyAuth(req, res) {
    try {
        const cookies = parseCookies(req.headers.cookie);
        let token = cookies['sb-access-token'];
        const refreshToken = cookies['sb-refresh-token'];

        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.replace('Bearer ', '');
            }
        }

        // Tenta renovar a sessão se o token expirou/está ausente, mas temos refresh token e objeto de resposta
        if (!token && refreshToken && res) {
            try {
                const { data, error } = await supabaseAdmin.auth.refreshSession({ refresh_token: refreshToken });
                if (!error && data.session) {
                    token = data.session.access_token;
                    const isProd = process.env.NODE_ENV === 'production';
                    const secureFlag = isProd ? '; Secure' : '';
                    res.setHeader('Set-Cookie', [
                        `sb-access-token=${data.session.access_token}; HttpOnly; Path=/; SameSite=Lax; MaxAge=3600${secureFlag}`,
                        `sb-refresh-token=${data.session.refresh_token || refreshToken}; HttpOnly; Path=/; SameSite=Lax; MaxAge=${30 * 24 * 3600}${secureFlag}`
                    ]);
                }
            } catch (e) {
                console.error('[AUTH] Auto-refresh failed:', e);
            }
        }

        if (!token) {
            return { user: null, error: 'Token não fornecido' };
        }

        // --- BYPASS PARA CONTA DEMO ---
        if (token === 'demo-token-12345' || token === 'mock-token') {
            return {
                user: {
                    id: '00000000-0000-0000-0000-000000000000',
                    email: 'demo@imobgrowth.com.br'
                },
                error: null,
                token
            };
        }
        // ------------------------------

        let userClient = getSupabaseClient(token);
        let { data, error } = await userClient.auth.getUser();

        // Se o token falhou (pode estar expirado), tenta refresh se disponível
        if ((error || !data.user) && refreshToken && res) {
            try {
                console.log('[AUTH] Token inválido ou expirado. Tentando refresh...');
                const { data: refreshData, error: refreshError } = await supabaseAdmin.auth.refreshSession({ refresh_token: refreshToken });
                if (!refreshError && refreshData.session) {
                    token = refreshData.session.access_token;
                    userClient = getSupabaseClient(token);
                    const { data: userData, error: userError } = await userClient.auth.getUser();
                    if (!userError && userData.user) {
                        data.user = userData.user;
                        error = null;
                        
                        const isProd = process.env.NODE_ENV === 'production';
                        const secureFlag = isProd ? '; Secure' : '';
                        res.setHeader('Set-Cookie', [
                            `sb-access-token=${refreshData.session.access_token}; HttpOnly; Path=/; SameSite=Lax; MaxAge=3600${secureFlag}`,
                            `sb-refresh-token=${refreshData.session.refresh_token || refreshToken}; HttpOnly; Path=/; SameSite=Lax; MaxAge=${30 * 24 * 3600}${secureFlag}`
                        ]);
                    }
                }
            } catch (e) {
                console.error('[AUTH] Auto-refresh failed during validation:', e);
            }
        }

        if (error || !data.user) {
            console.error("Auth Error:", error?.message, "Token start:", token.substring(0, 15));
            return { user: null, error: 'Token inválido ou expirado' };
        }

        // Exige confirmação de e-mail (exceto conta demo)
        const isDemo = data.user.email?.toLowerCase() === 'demo@imobgrowth.com.br';
        if (!isDemo && !data.user.email_confirmed_at && !data.user.confirmed_at) {
            return { user: null, error: 'Por favor, confirme seu e-mail para ativar sua conta.' };
        }

        return { user: data.user, error: null, token };
    } catch (e) {
        console.error("verifyAuth critical error:", e);
        return { user: null, error: 'Erro interno de autenticação: ' + e.message };
    }
}

module.exports = { supabaseAdmin, getSupabaseClient, verifyAuth };
