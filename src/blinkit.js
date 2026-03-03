import { chromium } from 'playwright';

export async function scrapeBlinkit(searchQuery, location, maxItems) {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
    });
    const page = await context.newPage();
    const results = [];

    try {
        await page.goto("https://blinkit.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForTimeout(2000);

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
                await page.waitForTimeout(1000);

                // Trigger suggestions
                await page.keyboard.press("Backspace");
                await page.keyboard.press("Backspace");
                await page.waitForTimeout(1500);

                // Click first result
                await page.click('div.LocationSearchList__LocationListContainer-sc-93rfr7-0 > div');
                await page.waitForTimeout(2000);
            }
        } catch (e) {
            console.log("Could not set exact location, proceeding with default. " + e.message);
        }

        console.log(`Blinkit: Navigating to search URL for "${searchQuery}"`);
        await page.goto(`https://blinkit.com/s/?q=${encodeURIComponent(searchQuery)}`, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForTimeout(3000);

        let previousHeight = 0;
        let retries = 0;

        console.log("Blinkit: Extracting products...");
        while (results.length < maxItems && retries < 10) {
            const products = await page.$$eval('div[data-pf="reset"]', (cards) => {
                return cards.map(c => {
                    const imageElem = c.querySelector('img[alt]');
                    // Filter out non-product cards
                    if (!imageElem && !(c.innerText || '').includes('ADD')) return null;

                    const name = c.querySelector('div.Product__UpdatedTitle-sc-11dk8zk-9, div.tw-text-300.\\!tw-font-semibold, div.tw-line-clamp-2')?.innerText?.trim() || 'No name';
                    if (name === 'No name') return null;

                    const priceElems = Array.from(c.querySelectorAll('div'));
                    let price = 'No price';
                    for (const el of priceElems) {
                        const txt = el.innerText ? el.innerText.trim() : '';
                        if (txt.startsWith('₹')) {
                            price = txt;
                            break;
                        }
                    }

                    const weight = c.querySelector('div.tw-text-200.tw-font-medium.tw-line-clamp-1, div.Product__UpdatedWeight-sc-11dk8zk-10')?.innerText?.trim() || 'No weight';
                    const image = imageElem?.src || '';
                    return { platform: 'Blinkit', name, price, weight, image };
                }).filter(Boolean);
            });

            // Deduplicate and push
            for (const p of products) {
                if (!results.find(existing => existing.name === p.name && existing.weight === p.weight)) {
                    results.push(p);
                }
            }

            console.log(`Blinkit: Found ${results.length} products so far...`);

            if (results.length >= maxItems) break;

            await page.evaluate(() => window.scrollBy(0, 1500));
            await page.waitForTimeout(1500);

            const currentHeight = await page.evaluate(() => document.body.scrollHeight);
            if (currentHeight === previousHeight) {
                retries++;
            } else {
                retries = 0;
                previousHeight = currentHeight;
            }
        }
    } catch (e) {
        console.error("Blinkit scraping error: " + e.message);
    } finally {
        await browser.close();
    }

    return results.slice(0, maxItems);
}
