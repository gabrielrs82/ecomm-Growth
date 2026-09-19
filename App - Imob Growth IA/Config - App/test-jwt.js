const { createClient } = require('@supabase/supabase-js');


const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

async function test() {
    let { data, error } = await supabase.auth.signInWithPassword({
        email: "demo@imobgrowth.com.br",
        password: "growth123"
    });

    if (error) {
        console.log("Login failed, trying to create user...");
        const res = await supabase.auth.signUp({
            email: "demo@imobgrowth.com.br",
            password: "growth123"
        });
        data = res.data;
        if (res.error) {
            console.error("Signup failed:", res.error);
            return;
        }
    }

    const token = data.session.access_token;
    console.log("Logged in! Token:", token.substring(0, 15) + "...");

    // Call Vercel server
    try {
        const res = await fetch("http://localhost:3000/api/generate-image", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ prompt: "A modern house", style: "luxo-minimalista", format: "feed" })
        });
        
        const json = await res.json();
        console.log("Status:", res.status);
        console.log("Response:", json);
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}
test();
