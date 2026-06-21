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
        await page.goto("https://www.99acres.com", timeout=30000)
        await asyncio.sleep(5)

        inputs = await page.query_selector_all("input")
        print(f"Total inputs: {len(inputs)}")
        for inp in inputs:
            html = await page.evaluate("el => el.outerHTML", inp)
            if "search" in html.lower() or "city" in html.lower() or "place" in html.lower():
                print(f"  {html[:200]}")

        buttons = await page.query_selector_all("button")
        print(f"\nTotal buttons: {len(buttons)}")
        for b in buttons[:15]:
            t = await b.inner_text()
            html = await page.evaluate("el => el.outerHTML", b)
            print(f"  '{t[:50]}' -> {html[:150]}")

        await browser.close()

asyncio.run(main())
