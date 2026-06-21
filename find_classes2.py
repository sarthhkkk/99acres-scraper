import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(channel="chrome", headless=True, args=["--disable-blink-features=AutomationControlled"])
        ctx = await browser.new_context(viewport={"width":1920,"height":1080}, locale="en-IN")
        page = await ctx.new_page()
        await page.goto("https://www.99acres.com/property-in-mumbai-ffid", timeout=30000)
        await asyncio.sleep(5)

        # Count different tupleNew selector matches
        selectors = [
            '[class*="tupleNew__outerTupleWrap"]',
            '[class*="tupleNew__tupleWrap"]',
            '[class*="tupleNew__innerCont"]',
            '[class*="tupleNew"]',
            '[class*="tupleNew__outerCont"]',
            '[class*="tupleNew"]:not([class*="__"])',
        ]
        for sel in selectors:
            count = await page.evaluate(f'document.querySelectorAll(\'{sel}\').length')
            print(f"{count:4d} | {sel}")

        # Get sample HTML of one listing to see structure
        html = await page.evaluate("""() => {
            const el = document.querySelector('[class*="tupleNew__outerTupleWrap"]');
            return el ? el.outerHTML.substring(0, 2000) : 'NOT FOUND';
        }""")
        print(f"\nSample outerTupleWrap:\n{html[:1500]}")

        await browser.close()

asyncio.run(main())
