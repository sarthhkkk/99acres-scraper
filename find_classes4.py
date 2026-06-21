import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(channel="chrome", headless=True, args=["--disable-blink-features=AutomationControlled"])
        ctx = await browser.new_context(viewport={"width":1920,"height":1080}, locale="en-IN")
        page = await ctx.new_page()
        await page.goto("https://www.99acres.com/property-in-mumbai-ffid", timeout=30000)
        await asyncio.sleep(5)

        result = await page.evaluate("""() => {
            const seen = new Set();
            const list = [];
            const els = document.querySelectorAll('[class*="tupleNew"]');
            els.forEach(el => {
                let cn = el.className;
                if (typeof cn === 'string' && !seen.has(cn)) {
                    seen.add(cn);
                    list.push({cls: cn.substring(0,120), text: (el.innerText||'').replace(/\\n/g,' ').substring(0,60)});
                }
            });
            return list;
        }""")

        for r in result:
            print(f"  {r['cls']}")
            if r['text']:
                print(f"    text: {r['text']}")

        await browser.close()

asyncio.run(main())
