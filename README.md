# 99acres Scraper Tools

Chrome extension + Python Playwright scraper + PowerShell System Event Logger.

## What's Here

| Path | Description |
|------|-------------|
| `scraper-extension/` | Chrome extension (MV3) — scrape 99acres listings with live streaming, pagination, Discord export, pins, history |
| `scraper.py` | Python Playwright scraper (alternative, uses real Chrome to bypass Akamai) |
| `SystemEventLogger.ps1` | PowerShell script — streams Windows System Event Log to Discord in real-time |

## Quick Start (Extension)

1. Open `chrome://extensions` → Developer mode → Load unpacked
2. Select `scraper-extension/`
3. Go to any 99acres listing page → click extension icon → Scrape

## Quick Start (Python)

```bash
pip install playwright
playwright install chrome
python scraper.py
```

## Full Reference

See `scraper-extension/REFERENCE.md` for complete documentation of the Chrome extension.
