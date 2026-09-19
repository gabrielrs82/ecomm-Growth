
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: { autoRefreshToken: false, persistSession: false }
    }
);

console.log("Supabase URL:", process.env.SUPABASE_URL);
console.log("Service Key length:", process.env.SUPABASE_SERVICE_ROLE_KEY?.length);

async function test() {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) {
        console.error("Error connecting with Service Role:", error);
    } else {
        console.log("Success! Users count:", data.users.length);
    }
}
test();
