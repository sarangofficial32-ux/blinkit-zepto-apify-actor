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
        console.log(`Blinkit: Navigating to search URL for "${searchQuery}"`);
        await page.goto(`https://blinkit.com/s/?q=${encodeURIComponent(searchQuery)}`, { waitUntil: "domcontentloaded", timeout: 90000 });
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
                await page.waitForTimeout(3000); // Give it time to refresh products after location change
                console.log('Blinkit: Location set to', location);
            }
        } catch (e) {
            console.log("Blinkit: Could not set location: " + e.message);
        }

        // Wait for product nodes to show up
        await page.waitForSelector('div[data-pf="reset"]', { timeout: 15000 }).catch(() => {
            console.log('Blinkit: Product selector not found within 15s');
        });

        let previousCount = 0;
        let scrollCount = 0;

        console.log("Blinkit: Extracting products...");

        let retries = 0;
        while (results.length < maxItems && retries < 15) {
            const products = await page.$$eval('div[data-pf="reset"]', (cards) => {
                return cards.map(c => {
                    const imageElem = c.querySelector('img[alt]') || c.querySelector('img');
                    if (!imageElem && !(c.innerText || '').includes('ADD')) return null;

                    const name = c.querySelector(
                        'div.Product__UpdatedTitle-sc-11dk8zk-9, div.tw-text-300.\\!tw-font-semibold, div.tw-line-clamp-2'
                    )?.innerText?.trim() || 'No name';
                    if (name === 'No name') return null;

                    const priceElems = Array.from(c.querySelectorAll('div'));
                    let price = 'No price';
                    for (const el of priceElems) {
                        const txt = el.innerText ? el.innerText.trim() : '';
                        if (txt.startsWith('₹')) {
                            price = txt.split('\n')[0];
                            break;
                        }
                    }

                    const weight = c.querySelector(
                        'div.tw-text-200.tw-font-medium.tw-line-clamp-1, div.Product__UpdatedWeight-sc-11dk8zk-10'
                    )?.innerText?.trim() || 'No weight';

                    const image = imageElem ? (imageElem.getAttribute('data-src') || imageElem.src || '') : '';

                    let url = c.closest('a')?.href || '';
                    if (!url) {
                        const idNode = c.querySelector('[id]') || c;
                        const idStr = idNode.getAttribute('id') || '';
                        url = idStr ? `https://blinkit.com/prn/-/prid/${idStr}` : '';
                    }
                    return { platform: 'Blinkit', name, price, weight, image, url };
                }).filter(Boolean);
            });

            let newAdded = 0;
            const newProductsToPush = [];
            for (const p of products) {
                if (!results.find(e => e.name === p.name && e.weight === p.weight)) {
                    results.push(p);
                    newProductsToPush.push(p);
                    newAdded++;
                }
            }

            // Immediately map data into Apify output instead of waiting for the scrape to finish
            if (newProductsToPush.length > 0) {
                try {
                    await Actor.pushData(newProductsToPush);
                } catch (e) {
                    console.log("Failed to push to Apify Dataset (local run?):", e.message);
                }
            }

            console.log(`Blinkit: Found ${results.length} products so far...`);
            if (results.length >= maxItems) break;

            // Hover over the last product card to ensure our scroll context is correct
            await page.locator('div[data-pf="reset"]').last().hover({ timeout: 2000 }).catch(() => { });

            // Evaluate scroll to trigger dynamic loading more reliably across headless environments
            await page.evaluate(() => window.scrollBy(0, 1500));
            await page.waitForTimeout(500);
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(1500);

            // Also try pressing PageDown as a fallback
            await page.keyboard.press('PageDown');
            await page.waitForTimeout(1000);

            // Live View / Debug update for Apify Console
            try {
                const screenshot = await page.screenshot();
                await Actor.setValue('LIVE_VIEW', screenshot, { contentType: 'image/png' });
            } catch (e) {
                // Ignore live view errors
            }

            // Check if new products were appended rather than relying on body height
            if (newAdded === 0) {
                retries++;
            } else {
                retries = 0;
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
