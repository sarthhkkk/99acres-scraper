import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(channel="chrome", headless=True, args=["--disable-blink-features=AutomationControlled"])
        ctx = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
            viewport={"width":1920,"height":1080}, locale="en-IN"
        )
        page = await ctx.new_page()
        await page.goto("https://www.99acres.com/property-in-mumbai-ffid", timeout=30000)
        await asyncio.sleep(5)

        count = await page.evaluate('document.querySelectorAll("[class*=\\"tupleNew__outerTupleWrap\\"]").length')
        print(f"outerTupleWrap count: {count}")

        # Check what the outer containers look like - find elements that contain BHK info
        outer_count = await page.evaluate("""() => {
            let n = 0;
            document.querySelectorAll('[class*="tupleNew"]').forEach(el => {
                if (el.className.includes('outerTupleWrap')) n++;
            });
            return n;
        }""")
        print(f"Actual outerTupleWrap: {outer_count}")

        # Find elements with price content
        price_elements = await page.evaluate("""() => {
            const results = [];
            document.querySelectorAll('[class*="tupleNew"]').forEach(el => {
                const text = el.innerText || '';
                if (/Rs|\\u20b9/.test(text) && /BHK/.test(text)) {
                    results.push(el.className.substring(0, 120));
                }
            });
            return [...new Set(results)].slice(0, 10);
        }""")
        print(f"\nClasses with price+BHK:")
        for c in price_elements:
            print(f"  {c}")

        await browser.close()

asyncio.run(main())
