const { createClient } = require('@supabase/supabase-js');


const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: { autoRefreshToken: false, persistSession: false }
    }
);

async function confirmUser() {
    console.log("Buscando usuário...");
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    const user = users.find(u => u.email === 'gabrielrsantana21@gmail.com');
    if (!user) {
        console.error("Usuário não encontrado.");
        return;
    }

    console.log("Confirmando email do usuário:", user.id);
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        { email_confirm: true, password: 'growth123' } // Reseta a senha para garantir
    );

    if (error) {
        console.error("Erro ao confirmar:", error.message);
    } else {
        console.log("Usuário confirmado com sucesso! Email:", data.user.email);
        
        // Vamos dar créditos pra ele!
        await supabaseAdmin.from('profiles').upsert({
            id: data.user.id,
            credits_images: 100,
            credits_videos: 100
        });
        console.log("Créditos adicionados com sucesso!");
    }
}

confirmUser();
