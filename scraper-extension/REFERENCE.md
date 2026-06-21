# 99acres Chrome Extension — Reference

## Quick Start

1. Open `chrome://extensions` → Developer mode ON → Load unpacked → select `C:\Users\sarth\scripts\scraper-extension\`
2. Navigate to any 99acres listing page (e.g., `https://www.99acres.com/property-in-bangalore-ffid/`)
3. Click extension icon → click "Scrape" (or right-click any 99acres link → "Scrape this 99acres page")
4. Results appear in real-time with live counter

## How Pages Are Detected

**Any URL that is NOT a detail page is treated as a listing page.**

Detail page = URL matches `/\/property\/[\w-]+-spid-|99acres\.com\/[\w-]+(?:-\d+)?$/i`

Everything else = listing (search results, FFID pages, area listings, etc.)

## How Cards Are Found (`findAllCards()` in content.js)

3-step approach, tries each step in order:

1. **Price-class elements**: Find elements with CSS classes containing `price`, `cost`, `amount`, `rate`, `value`. Check if text has `₹`, `Rs`, `Lac`, `Cr`, `Lakh`. Walk up 5 parent levels looking for a container that also has BHK or area text.

2. **Property URL links**: Find `<a>` tags with `-spid-` or `property-in-` in their href. Walk up parent levels to find container with card-like structure.

3. **Brute-force**: Scan all `<div>` and `<li>` elements for any text containing `₹` or `Rs` with at least 50 characters of text. Filter by checking that text has price-like numbers.

**Quality gate**: `getCardData()` rejects items with `text.length < 30 && !item.price && !item.title`

## All Extracted Fields (per property item)

Simple fields from `getCardData()`:
| Field | Description | Extraction method |
|-------|-------------|-------------------|
| `title` | Property title | `h2`, heading, or `aria-label` |
| `url` | Full property URL | From `<a>` href, prepend `https://www.99acres.com` if relative |
| `price` | Display price text | `.//text()` nodes with ₹/Rs, filtered and joined |
| `price_numeric` | Parsed numeric price | `extractPrice()` — regex for digits + Cr/Lac/Thousand |
| `bhk` | BHK / bedroom info | Regex: `(\d+\s*(?:BHK|Bedroom|bed|RK))` |
| `area` | Area (sqft/sqm/acre) | Regex: `(\d[\d,]*\s*(?:sq\s*ft|sqft|sq\.ft\.|sqm?|acre|sq\.\s*yd|sq\.\s*m\b))` |
| `bath` | Bathroom count | `(\d+\s*(?:bath|Bathroom|toilet))` |
| `floor` | Floor info | `(Lower\s*Ground|Upper\s*Ground|Ground|Basement|\d+\w*(?:st|nd|rd|th)\s*Floor|Top\s*Floor)` |
| `facing` | Facing direction | `(North|East|West|South|North-East|North-West|South-East|South-West)\s*(Facing)?` |
| `status` | Construction status | `(Ready to Move|Under Construction|New Launch|Resale|Pre-launch)` |
| `furnished` | Furnishing | `extractFurnished()` — `(Fully Furnished|Semi Furnished|Unfurnished|Furnished|Semifurnished)` |
| `possession` | Possession date | `extractPossession()` — possesion/possession by month/year |
| `parking` | Parking info | `extractParking()` — number of covered/open/two-wheeler/four-wheeler |
| `posted_on` | Posting date | `extractPostedOn()` — `Posted on|Added on|Posted:\s*` followed by date |
| `location` | Location text | Text nodes with locality/pincode patterns |
| `society` | Society/building name | Regex for society/project/apartment names |
| `listed_by` | Listing type | `(Builder|Agent|Owner)\s*:?` |
| `seller_name` | Seller/contact name | After listed_by label or contact area |
| `phone` | Phone number | First valid 10-digit Indian mobile found |
| `transaction` | Transaction type | `(New Property|Resale|Rental|Lease)` |
| `image_url` | First image URL | `<img>` src with `cloudfront` or `99acres` in URL |
| `description` | Full description text | `description` class or `p` tags with 50+ chars |
| `property_id` | Property ID | `extractPropertyId()` — spid/pid from URL or link |
| `owner_profile_url` | Seller profile URL | `<a>` pointing to broker/builder/owner profile |
| `scraped_at` | ISO timestamp | `new Date().toISOString()` |

### Extraction Helper Functions

All in `content.js`:

```js
extractPrice(text)        // → { display: "₹ 1.5 Cr", numeric: 15000000 }
extractPropertyId(el)     // → "123456789" (from URL: /property/xyz-abc-spid-123456789 or pid=123456)
extractFurnished(el)      // → "Fully Furnished" | "Semi Furnished" | "Unfurnished" | ""
extractPossession(el)     // → "Dec 2025" | "2025" | ""
extractParking(el)        // → "2 Covered, 1 Open" | ""
extractPostedOn(el)       // → "15 Jun 2025" | "Posted on 15 Jun 2025" | ""
extractContactInfo(el)    // → { phone, seller_name }
```

## Auto-Scroll & Pagination

- **Scrolling**: Scrolls by random amounts (300-700px) with random delays (800-2000ms)
- **Load More**: After 2 consecutive scrolls with no new cards, clicks "Load More" button
- **Max empty streaks**: 4 consecutive empty scrolls → break
- **Pagination**: Clicks page buttons (2, 3, 4...) via AJAX only. No URL navigation (kills content script).
- **`waitForNewContent()`**: Checks `findAllCards()` immediately before observing DOM changes. Falls back to 3-second timeout + retry.
- **Max pages**: Configurable in Settings (default 3)
- **Max scrolls**: Configurable in Settings (default 15)

### Human-like Behavior
- Random scroll amounts (300-700px)
- Random delays (800-2000ms) between scrolls
- Random button click within page buttons (random pick from available)

## Live Streaming

During scroll, each batch of cards found is sent to the popup via `chrome.runtime.sendMessage({ action: "scrapeStream", items, total })`.

**Stream listener** (popup.js `chrome.runtime.onMessage`):
- Incrementally builds `resultList` using innerHTML
- Updates `$("liveCount")` and `$("totalCount")` counters
- Shows `$("debugInfo")` with `List: N items · Stream: N`

**Stop**: `$("stopBtn")` sets `stopRequested = true` in content script. Checked once per scroll iteration.

## Keyword Filtering

- **AND logic** (all keywords must match): `keywords.every(kw => text.includes(kw))`
- Keywords are comma-separated in the input field
- Applied during streaming via `streamItems` array in `scrapePageListings()`
- Final `autoScrollAndScrape()` returns `allItems` (unfiltered) — filtering is done at batch level

## Filters Presets

Stored in `chrome.storage.local` under key `filterPresets`.

- Save: enter keywords → click "Save preset" → type name
- Load: select from dropdown → populates keyword input
- Delete: select → click "Delete preset"

## Pins

Stored in `chrome.storage.local` under key `pinnedProps`.

- Star icon (☆/★) on every property result
- Click to toggle pin on/off
- Pins tab: search by keyword, export JSON/CSV, clear all
- Pins persist across scrapes and extension reloads

## History

Stored in `chrome.storage.local` under key `scrapeHistory`.

- Auto-saved after every scrape via `addHistory(data)` in background.js
- History tab: search by title/URL, view old scrapes, 💾 Save Here, 📤 Send to Discord, delete individual entries

## Data Export (buttons in popup)

- **💾 Save Here** — Downloads last scraped data as JSON file
- **Export CSV** — Downloads as CSV
- **Export Excel** — Downloads as `.xls` (HTML table format, opens in Excel/LibreOffice)
- **📤 Send to Discord** — Sends ALL items (no truncation):
  - First 5 items → detailed embeds with human-readable field names
  - Remaining items → compact code blocks (8 per message)
  - Rate-limited: 600ms between embeds, 800ms between batches

## Discord Configuration (Settings tab)

- **Error webhook**: `https://discord.com/api/webhooks/1517953901964558387/...`
- **Events webhook**: `https://discord.com/api/webhooks/1517957654738112750/...`

### `sendToDiscord()` (background.js)

Uses `FIELD_LABELS` map for human-readable names:
- `property_id` → "Property ID"
- `title` → "Title"
- `price` → "Price"
- `bhk` → "BHK"
- `area` → "Area"
- `bath` → "Bathrooms"
- `floor` → "Floor"
- `facing` → "Facing"
- `status` → "Status"
- `furnished` → "Furnished"
- `possession` → "Possession"
- `parking` → "Parking"
- `location` → "Location"
- `society` → "Society"
- `listed_by` → "Listed By"
- `seller_name` → "Seller"
- `phone` → "Phone"
- `transaction` → "Transaction"
- `description` → "Description"
- `posted_on` → "Posted On"
- `owner_profile_url` → "Owner Profile"

`FLOAT_FIELDS` set hides: `price_numeric`, `scraped_at`, `image_url`

## Popup Persistence

After each scrape, `saveLastScrape` stores `{ data, timestamp }` in `chrome.storage.local`. On popup open (`DOMContentLoaded`), `getLastScrape` retrieves it and auto-renders (expires after 30 min).

## Debugging Tools

- **Right-click popup → Inspect** to see Chrome DevTools for popup
- **`__debug99acres()`** — Run in 99acres page console. Dumps URL, links found, price texts, card count.
- **`$("debugInfo")`** — Shows `List: N items · Stream: N` live during/after scrape
- **"Force re-render"** — Re-renders from `lastScrapedData` (stored data)
- **"Test render 10"** — Adds 10 fake property items to test if DOM rendering works
- **"Show raw JSON"** — Shows complete scraped data as raw JSON (proves data exists)
- Console logs at every stage with `[99acres]` prefix

## Common Issues & Fixes

| Problem | Fix |
|---------|-----|
| "No response from page" | Reload 99acres page and try again. If persists, check content.js injection. |
| Popup hangs on "Checking..." | JS syntax error — check popup.js console for errors. `const kw` must not be redeclared. |
| Items found (counter shows N) but not visible | Click "Force re-render" or "Test render 10" to diagnose. Check popup console. |
| `URL.createObjectURL is not a function` | Must use `data:` URLs for downloads in MV3 service worker. |
| `Could not establish connection. Receiving end does not exist` | Content script not injected. Extension auto-falls back to `chrome.scripting.executeScript`. |
| Python ₹/Unicode errors | Use `sys.stdout.reconfigure(encoding='utf-8')` or avoid ₹ in print. |
| Akamai blocks Playwright | Use `channel="chrome"` (real Chrome) for Playwright, not bundled Chromium. |
| `selectedIndices` out of bounds | `.filter(Boolean)` on `getSelectedData()` when accessing `lastScrapedData.listings[idx]`. |
| Discord "and N more results" removed | Changed to batch all items. First 5 = embeds. Rest = code blocks (8 per msg). |

## File Structure

```
C:\Users\sarth\scripts\scraper-extension\
├── manifest.json        # Extension config (bumped to 3.0)
├── content.js           # Injected into 99acres pages — scraping, scrolling, pagination
├── background.js        # Service worker — messaging, downloads, Discord, history, save/load
├── popup.html           # Popup UI — dark theme, 4 tabs, all controls
└── popup.js             # Popup logic — event handlers, rendering, streaming, pins, exports
```

## Related Files

- `C:\Users\sarth\scripts\scraper.py` — Python Playwright scraper (alternative, channel="chrome")
- `C:\Users\sarth\scripts\SystemEventLogger.ps1` — PowerShell System Event Log → Discord monitor
- `C:\Users\sarth\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\SystemEventLogger.lnk` — Auto-start for event logger
- `C:\Users\sarth\scraped_data\` — Output directory for scraped JSON files

## Key Config Defaults

In background.js `DEFAULT_CONFIG`:
- `maxScrolls: 15`
- `maxPages: 3`
- `autoScroll: true`
- `downloadImages: false`

## Tasks for Next Session

- [ ] Reload extension → test if items render with new `innerHTML` approach
- [ ] Check popup console for `[99acres]` logs
- [ ] Test "Test render 10" to verify DOM rendering works
- [ ] Test "Show raw JSON" to verify data exists
- [ ] Test live streaming with debugInfo showing live count
- [ ] Test Discord batch sending (first 5 embeds + remaining code blocks)
- [ ] Test all new fields in detail panel: Property ID, Furnished, Possession, Parking, Posted On
- [ ] Test pin/unpin with all new fields
- [ ] Test Excel/CSV export includes `property_id`, `owner_profile_url`, etc.
- [ ] Test history re-export includes new fields
- [ ] Test pagination with maxPages=3
