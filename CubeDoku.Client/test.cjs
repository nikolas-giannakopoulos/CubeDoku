const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ignoreHTTPSErrors: true});
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    
    await page.goto('https://localhost:5173/');
    await new Promise(r => setTimeout(r, 6000));
    await browser.close();
})();
