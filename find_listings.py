import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(channel="chrome", headless=True, args=["--disable-blink-features=AutomationControlled"])
        ctx = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            viewport={"width": 1920, "height": 1080}, locale="en-IN"
        )
        page = await ctx.new_page()
        await page.goto("https://www.99acres.com/property-in-mumbai-ffid", timeout=30000)
        await asyncio.sleep(5)

        # Get all elements with common listing classes and their outer HTML
        selectors_to_try = [
            "a[href*='-spid-']",
            "a[href*='-npspid-']",
            "[class*='srpTuple']",
            "[class*='projectTuple']",
            "[class*='property']",
            "[class*='tuple__']",
            "[class*='listTuple']",
        ]

        for sel in selectors_to_try:
            els = await page.query_selector_all(sel)
            print(f"\n=== '{sel}': {len(els)} ===")
            for e in els[:3]:
                cls = await e.get_attribute("class")
                tag = await e.evaluate("el => el.tagName")
                text = (await e.inner_text())[:120].replace("\n"," | ")
                print(f"  <{tag}> class='{(cls or '')[:120]}'")
                print(f"  text: {text}")

        # Get HTML of the page body to find structure
        print("\n=== Looking for property listing structure ===")
        body_html = await page.evaluate("document.body.innerHTML.substring(0, 10000)")
        # Find elements with price-like content
        matches = []
        import re
        for m in re.finditer(r'(Rs\.?|₹|INR)\s*[\d,]+(?:\s*(?:Cr|Lac|K))?', body_html):
            start = max(0, m.start() - 200)
            end = min(len(body_html), m.end() + 200)
            matches.append(body_html[start:end])
        print(f"\nPrice mentions found: {len(matches)}")
        for m in matches[:5]:
            print(f"  ...{m}...")

        await browser.close()

asyncio.run(main())
