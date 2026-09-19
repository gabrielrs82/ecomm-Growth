async function run() {
    try {
        const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'demo@imobgrowth.com.br',
                password: 'growth123'
            })
        });
        const data = await response.json();
        console.log("Status code:", response.status);
        console.log("Response JSON:", data);
    } catch (e) {
        console.error("Request failed:", e);
    }
}
run();
