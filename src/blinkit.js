import { chromium } from 'playwright';
import { Actor } from 'apify';

export async function scrapeBlinkit(searchQuery, location, maxItems, proxyConfig = null) {
    const launchOptions = {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // critical for constrained memory environments
            '--disable-gpu',
        ],
    };
    if (proxyConfig) {
        launchOptions.proxy = proxyConfig;
    }

    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 720 }, // smaller viewport = less memory
        locale: 'en-IN',
        ignoreHTTPSErrors: true,
    });

    // Block images and fonts to save memory – we still read img[src] from DOM attributes
    // await context.route('**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf}', route => route.abort());

    const page = await context.newPage();
    const results = [];

    try {
        await page.goto("https://blinkit.com/", { waitUntil: "domcontentloaded", timeout: 90000 });
        await page.waitForTimeout(3000);

        // Location modal handling
        try {
            const selectManually = await page.$('div.GetLocationModal__SelectManually-sc-jc7b49-7, div:has-text("Select Manually")');
            if (selectManually) {
                await selectManually.click();
                await page.waitForTimeout(1000);
            }
            const locationInput = await page.$('input[name="select-locality"]');
            if (locationInput) {
                await locationInput.click();
                await locationInput.type(location, { delay: 50 });
                await page.waitForTimeout(1500);
                await page.keyboard.press("Backspace");
                await page.keyboard.press("Backspace");
                await page.waitForTimeout(1500);
                await page.click('div.LocationSearchList__LocationListContainer-sc-93rfr7-0 > div');
                await page.waitForTimeout(2000);
                console.log('Blinkit: Location set to', location);
            }
        } catch (e) {
            console.log("Blinkit: Could not set location: " + e.message);
        }

        console.log(`Blinkit: Navigating to search URL for "${searchQuery}"`);
        await page.goto(`https://blinkit.com/s/?q=${encodeURIComponent(searchQuery)}`, { waitUntil: "domcontentloaded", timeout: 90000 });
        await page.waitForTimeout(3000);

        let previousCount = 0;
        let scrollCount = 0;

        console.log("Blinkit: Extracting products...");

        let previousHeight = 0;
        let retries = 0;
        while (results.length < maxItems && retries < 15) {
            const products = await page.$$eval('div[data-pf="reset"]', (cards) => {
                return cards.map(c => {
                    const imageElem = c.querySelector('img[alt]');
                    if (!imageElem && !(c.innerText || '').includes('ADD')) return null;

                    const name = c.querySelector(
                        'div.Product__UpdatedTitle-sc-11dk8zk-9, div.tw-text-300.\\!tw-font-semibold, div.tw-line-clamp-2'
                    )?.innerText?.trim() || 'No name';
                    if (name === 'No name') return null;

                    const priceElems = Array.from(c.querySelectorAll('div'));
                    let price = 'No price';
                    for (const el of priceElems) {
                        const txt = el.innerText ? el.innerText.trim() : '';
                        if (txt.startsWith('₹')) { price = txt; break; }
                    }

                    const weight = c.querySelector(
                        'div.tw-text-200.tw-font-medium.tw-line-clamp-1, div.Product__UpdatedWeight-sc-11dk8zk-10'
                    )?.innerText?.trim() || 'No weight';

                    const image = imageElem?.getAttribute('data-src') || imageElem?.src || '';
                    const url = c.closest('a')?.href || '';
                    return { platform: 'Blinkit', name, price, weight, image, url };
                }).filter(Boolean);
            });

            let newAdded = 0;
            for (const p of products) {
                if (!results.find(e => e.name === p.name && e.weight === p.weight)) {
                    results.push(p);
                    newAdded++;
                }
            }

            console.log(`Blinkit: Found ${results.length} products so far...`);
            if (results.length >= maxItems) break;

            // Use native Playwright inputs for more reliable scroll event firing
            await page.mouse.wheel(0, 3000);
            await page.keyboard.press('PageDown');
            await page.waitForTimeout(500);
            await page.keyboard.press('PageDown');
            await page.waitForTimeout(1500);
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

            const currentHeight = await page.evaluate(() => document.body.scrollHeight);
            if (currentHeight === previousHeight) {
                retries++;
            } else {
                retries = 0;
                previousHeight = currentHeight;
            }
        }

        // Debugging for Apify
        await Actor.setValue('BLINKIT_HTML', await page.content());
        await page.screenshot({ path: 'blinkit-final.png', fullPage: true });

    } catch (e) {
        console.error("Blinkit scraping error: " + e.message);
    } finally {
        await browser.close();
    }

    return results.slice(0, maxItems);
}
