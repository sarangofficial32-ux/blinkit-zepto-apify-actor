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
} = input;

if (!searchQuery) {
    throw new Error('searchQuery is required!');
}

console.log(`Starting scrape for query: "${searchQuery}" on platforms: ${platforms.join(', ')} (maxItems: ${maxItems})`);

const results = [];

// Scrape Blinkit
if (platforms.includes('blinkit')) {
    console.log('--- Scraping Blinkit ---');
    try {
        const blinkitResults = await scrapeBlinkit(searchQuery, location, maxItems);
        results.push(...blinkitResults);
        console.log(`Successfully scraped ${blinkitResults.length} items from Blinkit.`);
    } catch (error) {
        console.error(`Error scraping Blinkit: ${error.message}`);
    }
}

// Scrape Zepto
if (platforms.includes('zepto')) {
    console.log('--- Scraping Zepto ---');
    try {
        const zeptoResults = await scrapeZepto(searchQuery, maxItems);
        results.push(...zeptoResults);
        console.log(`Successfully scraped ${zeptoResults.length} items from Zepto.`);
    } catch (error) {
        console.error(`Error scraping Zepto: ${error.message}`);
    }
}

// Push all results to Apify dataset
await Actor.pushData(results);

console.log(`Scraping finished. Total items saved: ${results.length}`);

await Actor.exit();
