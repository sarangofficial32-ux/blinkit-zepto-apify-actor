import { Actor } from 'apify';
import { scrapeBlinkit } from './blinkit.js';
import { scrapeZepto } from './zepto.js';

await Actor.init();

const input = await Actor.getInput() || {};
const {
    searchQuery = 'milk',
    platforms = ['blinkit', 'zepto'],
    location = 'Connaught Place, New Delhi',
    maxItems = 250,
    useProxy = true,
} = input;

if (!searchQuery) {
    throw new Error('searchQuery is required!');
}

// Set up Apify RESIDENTIAL proxy with Indian IP
// IMPORTANT: Playwright needs credentials split out separately from the URL
let proxyConfig = null;
if (useProxy) {
    try {
        const proxyConfiguration = await Actor.createProxyConfiguration({
            groups: ['RESIDENTIAL'],
            countryCode: 'IN',
        });
        const proxyUrl = await proxyConfiguration.newUrl();
        const parsed = new URL(proxyUrl);
        proxyConfig = {
            server: `${parsed.protocol}//${parsed.hostname}:${parsed.port}`,
            username: decodeURIComponent(parsed.username),
            password: decodeURIComponent(parsed.password),
        };
        console.log(`Using Apify RESIDENTIAL proxy: ${proxyConfig.server} (IN)`);
    } catch (e) {
        console.log('No proxy configured (local dev mode):', e.message);
    }
} else {
    console.log('Running without proxy (useProxy set to false).');
}

console.log(`Starting scrape for query: "${searchQuery}" on platforms: ${platforms.join(', ')} (maxItems: ${maxItems})`);

const results = [];

if (platforms.includes('blinkit')) {
    console.log('--- Scraping Blinkit ---');
    try {
        const blinkitResults = await scrapeBlinkit(searchQuery, location, maxItems, proxyConfig);
        results.push(...blinkitResults);
        console.log(`Successfully scraped ${blinkitResults.length} items from Blinkit.`);
    } catch (error) {
        console.error(`Error scraping Blinkit: ${error.message}`);
    }
}

if (platforms.includes('zepto')) {
    console.log('--- Scraping Zepto ---');
    try {
        const zeptoResults = await scrapeZepto(searchQuery, maxItems, proxyConfig);
        results.push(...zeptoResults);
        console.log(`Successfully scraped ${zeptoResults.length} items from Zepto.`);
    } catch (error) {
        console.error(`Error scraping Zepto: ${error.message}`);
    }
}

// Data is now pushed live from within the scraper functions
console.log(`Scraping finished. Total items saved: ${results.length}`);
await Actor.exit();
