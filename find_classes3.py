import asyncio, sys
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(channel="chrome", headless=True, args=["--disable-blink-features=AutomationControlled"])
        ctx = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080}, locale="en-IN"
        )
        page = await ctx.new_page()
        resp = await page.goto("https://www.99acres.com/property-in-mumbai-ffid", timeout=30000)
        await asyncio.sleep(5)

        print(f"URL: {page.url}")
        print(f"Status: {resp.status if resp else 'N/A'}")

        # Try different selectors
        for sel in ['[class*="tupleNew"]', '[class*="Tuple"]', '[class*="property"]', '[class*="listing"]', '[class*="card"]']:
            count = await page.evaluate(f'document.querySelectorAll(\'{sel}\').length')
            print(f"  {count:4d} | {sel}")

        # Also check body length and first 100 chars
        html = await page.evaluate('document.body.innerHTML.substring(0, 3000)')
        print(f"\nBody HTML (first 3000):\n{html}")

        await browser.close()

asyncio.run(main())
