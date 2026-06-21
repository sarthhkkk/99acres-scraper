import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(channel="chrome", headless=True, args=["--disable-blink-features=AutomationControlled"])
        ctx = await browser.new_context(viewport={"width":1920,"height":1080}, locale="en-IN")
        page = await ctx.new_page()
        await page.goto("https://www.99acres.com/property-in-mumbai-ffid", timeout=30000)
        await asyncio.sleep(5)

        classes = await page.evaluate("""() => {
            const els = document.querySelectorAll('*');
            const unique = {};
            els.forEach(el => {
                const cn = el.className;
                if (typeof cn === 'string' && cn.includes('tupleNew')) {
                    if (!unique[cn]) {
                        unique[cn] = { cls: cn.substring(0,120), count: 0, sample: (el.innerText || '').replace(/\\n/g,' ').substring(0,80) };
                    }
                    unique[cn].count++;
                }
            });
            return Object.values(unique).sort((a,b) => b.count - a.count).slice(0,15);
        }""")

        for c in classes:
            print(f"{c['count']:3d} | {c['cls']}")
            print(f"      | {c['sample']}")
            print()

        await browser.close()

asyncio.run(main())
