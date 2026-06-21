# 99acres Scraper Tools

Chrome extension + Python Playwright scraper + PowerShell System Event Logger.

---

## Setup Guide for New Users

### 1. Chrome Extension

**Requirements:** Google Chrome or any Chromium-based browser.

```
scripts/
└── scraper-extension/    ← this is the extension folder
    ├── manifest.json
    ├── content.js
    ├── background.js
    ├── popup.html
    ├── popup.js
    ├── REFERENCE.md
    └── icon.png
```

**Steps:**
1. Open Chrome → go to `chrome://extensions`
2. Toggle **Developer mode** (top-right corner)
3. Click **Load unpacked**
4. Select the `scraper-extension/` folder
5. Pin the extension (puzzle icon → pin 📌 next to "99acres Scraper")
6. Go to any 99acres listing page (e.g., `https://www.99acres.com/property-in-bangalore-ffid`)
7. Click the extension icon → click **Scrape**

> **Note:** The extension auto-injects its content script. If you see "Could not establish connection", just reload the 99acres page and try again.

**To update:** Replace the `scraper-extension/` folder with new files, then go to `chrome://extensions` → click the 🔄 reload icon on the extension card.

---

### 2. Python Scraper (Alternative)

**Requirements:** Python 3.8+, Google Chrome installed.

```bash
# Install Playwright
pip install playwright

# Install Chrome browser for Playwright
playwright install chrome

# Run the scraper
python scraper.py
```

The script will ask for a 99acres URL and save results to `~/scraped_data/`.

> **Why `channel="chrome"`?** 99acres uses Akamai CDN which blocks Playwright's bundled Chromium. Using your real Chrome installation bypasses this.

---

### 3. Discord Webhooks (Optional)

Both the extension and Python scraper can send results to Discord. You need two webhook URLs:

1. Open Discord → Server Settings → Integrations → Webhooks
2. Create two webhooks:
   - **Errors webhook** → receives errors/warnings
   - **Events webhook** → receives successful scrapes and info
3. Copy the webhook URLs and paste them in the extension's **Settings tab** (webhook fields)
4. Or edit them directly in `background.js`:

```js
// background.js — find the sendToDiscord function and update these:
const ERROR_WEBHOOK = "https://discord.com/api/webhooks/YOUR_ERROR_WEBHOOK";
const EVENT_WEBHOOK = "https://discord.com/api/webhooks/YOUR_EVENT_WEBHOOK";
```

---

### 4. System Event Logger (Windows Only)

**Purpose:** Streams Windows System Event Log (errors/warnings/info) to your Discord events channel in real-time.

```powershell
# Test run
powershell -File SystemEventLogger.ps1
```

**Auto-start on login:**
1. Press `Win + R` → type `shell:startup` → Enter
2. Create a shortcut to:
   ```
   C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -File "C:\path\to\SystemEventLogger.ps1"
   ```

> The script uses the webhook URLs hardcoded at the top of the file. Edit them before running.

---

## What's Inside

| Path | Description |
|------|-------------|
| `scraper-extension/` | Chrome extension (MV3) — scrape 99acres listings with live streaming, pagination, Discord export, pins, history |
| `scraper-extension/REFERENCE.md` | Full documentation: extraction helpers, architecture, debugging, common fixes |
| `scraper.py` | Python Playwright scraper — alternative to the extension, uses real Chrome |
| `SystemEventLogger.ps1` | PowerShell script — real-time Windows Event Log → Discord streaming |
| `find_*.py` / `inspect_*.py` | Experimental/exploratory scripts used during development |

## Quick Start (Extension)

1. Load unpacked at `chrome://extensions` → select `scraper-extension/`
2. Go to a 99acres listing page
3. Click extension icon → **Scrape**

## Quick Start (Python)

```bash
pip install playwright
playwright install chrome
python scraper.py
```

## Full Reference

See `scraper-extension/REFERENCE.md` for complete documentation of the Chrome extension, including:
- How `findAllCards()` works (3-step detection)
- All 20+ extracted fields
- Auto-scroll & pagination behavior
- Live streaming architecture
- Discord batch sending format
- Keyword filtering (AND logic)
- Pin/History system
- Common issues & fixes
- Complete FIELD_LABELS map
