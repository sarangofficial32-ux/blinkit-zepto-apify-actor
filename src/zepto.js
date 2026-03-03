import { chromium } from 'playwright';

export async function scrapeZepto(searchQuery, maxItems, proxyConfig = null) {
    const launchOptions = { headless: true };
    if (proxyConfig) {
        launchOptions.proxy = proxyConfig; // { server, username, password }
    }

    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        viewport: { width: 1920, height: 1080 },
        locale: 'en-IN',
        ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    const results = [];
    const seenUrls = new Set();

    async function extractProducts() {
        return await page.$$eval('a:has([data-slot-id="ProductName"])', (cards) => {
            return cards.map(c => {
                const name = c.querySelector('[data-slot-id="ProductName"]')?.innerText?.trim() || '';
                const weight = c.querySelector('[data-slot-id="PackSize"]')?.innerText?.trim() || 'No weight';

                let price = 'No price';
                const priceEl = c.querySelector('.cptQT7') || c.querySelector('[data-slot-id="EdlpPrice"]');
                if (priceEl) {
                    const match = priceEl.innerText.match(/₹[\d,.]+/);
                    if (match) price = match[0];
                }
                if (price === 'No price') {
                    const match = c.innerText.match(/₹([\d,.]+)/);
                    if (match) price = `₹${match[1]}`;
                }

                const image = c.querySelector('img')?.src || '';
                const url = c.href || '';
                return { platform: 'Zepto', name, price, weight, image, url };
            }).filter(p => p.name.length > 0);
        });
    }

    try {
        // Set location via homepage UI
        console.log(`Zepto: Navigating to homepage to set location`);
        await page.goto(`https://www.zeptonow.com`, { waitUntil: 'domcontentloaded', timeout: 90000 });

        try {
            await page.waitForTimeout(3000);
            const selectLocationBtn = await page.$('button:has-text("Select Location"), button[aria-label="Select Location"]');
            if (selectLocationBtn) {
                await selectLocationBtn.click();
                await page.waitForTimeout(1000);
                const searchInput = await page.$('input[type="text"]');
                if (searchInput) {
                    await searchInput.fill('Mumbai');
                    await page.waitForTimeout(2000);
                    await page.keyboard.press('ArrowDown');
                    await page.keyboard.press('Enter');
                    await page.waitForTimeout(3000);
                    console.log('Zepto: Location set to Mumbai.');
                }
            }
        } catch (e) {
            console.log('Zepto: Location set skipped: ' + e.message);
        }

        // Use ?query= (NOT ?q=) - returns full paginated results
        const searchUrl = `https://www.zepto.com/search?query=${encodeURIComponent(searchQuery)}`;
        console.log(`Zepto: Navigating to ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await page.waitForTimeout(3000);

        let lastCount = 0;
        let noChangeRetries = 0;
        let scrollCount = 0;
        const MAX_SCROLLS = 30;

        console.log(`Zepto: Scrolling to load all products...`);

        while (results.length < maxItems && noChangeRetries < 4 && scrollCount < MAX_SCROLLS) {
            const products = await extractProducts();

            let newAdded = 0;
            for (const p of products) {
                if (results.length >= maxItems) break;
                const key = p.url || `${p.name}|${p.weight}`;
                if (!seenUrls.has(key)) {
                    seenUrls.add(key);
                    results.push(p);
                    newAdded++;
                }
            }

            if (newAdded > 0 || scrollCount % 5 === 0) {
                console.log(`Zepto: Found ${results.length} products so far...`);
            }

            if (results.length >= maxItems) break;

            if (newAdded === 0) {
                noChangeRetries++;
            } else {
                noChangeRetries = 0;
            }

            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(1500);
            scrollCount++;
        }

    } catch (e) {
        console.error("Zepto scraping error: " + e.message);
    } finally {
        await browser.close();
    }

    console.log(`Zepto: Total products scraped: ${results.length}`);
    return results.slice(0, maxItems);
}
