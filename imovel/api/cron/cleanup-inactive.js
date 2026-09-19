// ============================================================
// GET /api/cron/cleanup-inactive — Rotina de Minimização de Dados (LGPD)
// ============================================================
// Remove automaticamente contas inativas há mais de 365 dias.
// Executado via Vercel Cron ou trigger externo autenticado.
// ============================================================

const { supabaseAdmin } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
    // 1. Validar autenticação do Cron (CRON_SECRET)
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET || 'local-cron-secret-123';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Não autorizado. Token de cron inválido.' });
    }

    try {
        console.log('[LGPD-CRON] Iniciando rotina de limpeza de contas inativas...');
        
        let usersToDelete = [];
        let page = 1;
        const perPage = 100;
        const now = new Date();
        const INACTIVITY_LIMIT_DAYS = 365;
        const limitDate = new Date(now.getTime() - (INACTIVITY_LIMIT_DAYS * 24 * 60 * 60 * 1000));

        // 2. Paginar usuários do Supabase Auth para verificar inatividade
        while (true) {
            const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({
                page: page,
                perPage: perPage
            });

            if (error) {
                console.error('[LGPD-CRON] Erro ao listar usuários:', error);
                return res.status(500).json({ error: 'Erro ao listar usuários para verificação.' });
            }

            if (!users || users.length === 0) break;

            for (const user of users) {
                // Pular a conta de demonstração e admin principal
                if (user.email === 'demo@imobgrowth.com.br') continue;

                // Verificar data de último login ou de criação (se nunca logou)
                const lastSeenStr = user.last_sign_in_at || user.created_at;
                const lastSeen = new Date(lastSeenStr);

                if (lastSeen < limitDate) {
                    usersToDelete.push({
                        id: user.id,
                        email: user.email,
                        lastSeen: lastSeenStr
                    });
                }
            }

            if (users.length < perPage) break;
            page++;
        }

        console.log(`[LGPD-CRON] Total de contas inativas identificadas: ${usersToDelete.length}`);

        // 3. Executar remoção lógica/física de cada conta inativa
        let successCount = 0;
        let failCount = 0;

        for (const user of usersToDelete) {
            try {
                // A deleção do usuário no Auth do Supabase apaga em cascata (ON DELETE CASCADE)
                // os registros nas tabelas "profiles", "generations" e "video_renders".
                const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
                
                if (error) {
                    console.error(`[LGPD-CRON] Falha ao deletar usuário ${user.email}:`, error);
                    failCount++;
                } else {
                    console.log(`[LGPD-CRON] Conta inativa excluída com sucesso: ${user.email} (último acesso: ${user.lastSeen})`);
                    successCount++;
                }
            } catch (err) {
                console.error(`[LGPD-CRON] Erro crítico ao processar usuário ${user.email}:`, err);
                failCount++;
            }
        }

        return res.status(200).json({
            success: true,
            processed: usersToDelete.length,
            deleted: successCount,
            failed: failCount,
            message: `Limpeza de contas inativas concluída com sucesso. ${successCount} contas removidas.`
        });
    } catch (err) {
        console.error('[LGPD-CRON] Erro interno crítico:', err);
        return res.status(500).json({ error: 'Erro interno ao executar a rotina de minimização.' });
    }
};
