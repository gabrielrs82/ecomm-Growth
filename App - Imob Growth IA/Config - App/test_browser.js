const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
        page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

        await page.goto('http://localhost:3001/app.html', { waitUntil: 'networkidle0' });
        
        const btnExists = await page.evaluate(() => !!document.getElementById('tab-btn-register'));
        console.log('Tab button exists:', btnExists);
        
        if (btnExists) {
            await page.click('#tab-btn-register');
            console.log('Clicked register tab');
            await new Promise(r => setTimeout(r, 500));
            
            const activePanel = await page.evaluate(() => {
                const p = document.getElementById('panel-register');
                return p ? p.classList.contains('active') : false;
            });
            console.log('Panel register is active:', activePanel);
        }

        await browser.close();
    } catch (e) {
        console.error('SCRIPT ERROR:', e);
    }
})();
