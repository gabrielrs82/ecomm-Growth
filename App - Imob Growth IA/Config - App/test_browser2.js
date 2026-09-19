const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
        page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

        await page.goto('http://localhost:3000/app', { waitUntil: 'networkidle0' });
        
        // Wait a bit just in case
        await new Promise(r => setTimeout(r, 1000));

        // Test if login button exists
        const btnLoginExists = await page.evaluate(() => !!document.getElementById('btn-login'));
        console.log('Login button exists:', btnLoginExists);
        
        if (btnLoginExists) {
            console.log('Typing demo credentials...');
            await page.type('#login-email', 'demo@imobgrowth.com.br');
            await page.type('#login-pass', 'growth123');
            
            console.log('Clicking login...');
            await page.click('#btn-login');
            
            // Wait for simulateLogin timeout
            await new Promise(r => setTimeout(r, 2000));
            
            const authHidden = await page.evaluate(() => {
                const p = document.getElementById('auth-screen');
                return p ? p.style.display === 'none' : false;
            });
            console.log('Auth screen is hidden:', authHidden);
            
            const appVisible = await page.evaluate(() => {
                const p = document.querySelector('.app-container');
                return p ? p.style.display === 'flex' : false;
            });
            console.log('App container is visible:', appVisible);
        }

        await browser.close();
    } catch (e) {
        console.error('SCRIPT ERROR:', e);
    }
})();
