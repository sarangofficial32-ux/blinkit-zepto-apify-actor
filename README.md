# Blinkit & Zepto Product Scraper

Scrape product search results from **Blinkit** and **Zepto** — India's leading quick-commerce platforms. Enter any search keyword and get up to 250+ products per platform including name, price, weight, image, and product URL.

## ✨ Features

- 🔍 **Any search keyword** — milk, chips, detergent, shampoo, anything
- 📦 **250-300 products per platform** via infinite-scroll pagination
- 🛒 **Both Blinkit & Zepto** scraped in one run
- 📍 **Location-aware** — set your delivery location for accurate local pricing
- 💾 **Clean structured output** — ready for spreadsheet, database, or API use
- ☁️ **Runs on Apify cloud** — no local setup needed

## 🚀 Usage

1. Enter your **Search Query** (e.g. `milk`, `biscuit`, `chips`)
2. Optionally set a **Delivery Location** for Blinkit pricing
3. Set **Max Items** per platform (default: 250)
4. Click **Start** and get results in seconds

## 📋 Output Schema

| Field      | Description                          | Example                    |
|------------|--------------------------------------|----------------------------|
| `platform` | Source platform                      | `"Blinkit"` / `"Zepto"`   |
| `name`     | Product name                         | `"Amul Taza Homogenised Toned Fresh Milk"` |
| `price`    | Selling price (with ₹)              | `"₹28"`                   |
| `weight`   | Pack size                            | `"500 ml"`                 |
| `image`    | Product image URL                    | `"https://..."` |
| `url`      | Product page URL                     | `"https://..."` |

## 📍 Location Notes

- **Blinkit**: Set your locality in the `location` field for accurate local results (e.g. `"Andheri West, Mumbai"`).
- **Zepto**: Scrapes using Mumbai as the default. Products and pricing may vary by city.

## ⚙️ How It Works

- **Blinkit**: Uses infinite scroll on the search results page — scrolls until `maxItems` is reached.
- **Zepto**: Uses the `zepto.com/search?query=` endpoint (not `?q=`) which returns full paginated results via scroll.

## 💡 Tips

- Use broad keywords like `"milk"` or `"biscuit"` for 200+ results
- Use specific brand names like `"amul"` or `"britannia"` for targeted results
- Run with `maxItems: 500` to get the full catalog for popular categories

## 🛠️ Tech Stack

- Node.js (ES Modules)
- Playwright (headless Chromium)
- Apify SDK v3
