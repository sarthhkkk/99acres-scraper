import asyncio, re
from playwright.async_api import async_playwright

async def inspect(url):
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(url, timeout=60000)
        await page.wait_for_load_state("networkidle", timeout=30000)
        await asyncio.sleep(4)

        text = await page.inner_text("body")
        print("=== PAGE TEXT (first 3000 chars) ===")
        print(text[:3000])

        print("\n=== TITLE ===")
        print(await page.title())

        print("\n=== ALL ELEMENTS WITH class= containing 'card' or 'list' or 'tuple' ===")
        for sel in ['[class*="card"]', '[class*="list"]', '[class*="tuple"]', '[class*="project"]', '[class*="srp"]']:
            els = await page.query_selector_all(sel)
            print(f"\n  Selector '{sel}': {len(els)} elements")
            for e in els[:3]:
                cls = await e.get_attribute("class")
                tag = await e.evaluate("el => el.tagName")
                print(f"    <{tag}> class='{cls[:100] if cls else ''}'")

        print("\n=== ALL LINKS (first 10) ===")
        links = await page.query_selector_all("a[href]")
        for link in links[:10]:
            href = await link.get_attribute("href")
            lt = await link.inner_text()
            if href:
                print(f"  {href[:100]} -> {lt[:60].strip() if lt else '(no text)'}")

        await browser.close()

asyncio.run(inspect("https://www.99acres.com/search/properties/buy/delhi?city=1"))
