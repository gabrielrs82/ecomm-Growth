const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL || 'https://ijmyhgybjinlqkcdjusq.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    {
        auth: { autoRefreshToken: false, persistSession: false }
    }
);

async function confirmAll() {
    console.log("Listing users...");
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
        console.error("Error listing users:", listError);
        return;
    }

    for (const user of users) {
        if (!user.email_confirmed_at) {
            console.log(`Confirming user: ${user.email} (${user.id})...`);
            const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
                user.id,
                { email_confirm: true }
            );
            if (error) {
                console.error(`Failed to confirm ${user.email}:`, error.message);
            } else {
                console.log(`Successfully confirmed ${user.email}!`);
            }
        } else {
            console.log(`User ${user.email} is already confirmed.`);
        }
    }
}

confirmAll();
