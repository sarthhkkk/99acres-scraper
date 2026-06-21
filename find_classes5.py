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

        try:
            # Just get a simple count first
            count = await page.evaluate("document.querySelectorAll('[class*=\"tupleNew\"]').length")
            print(f"Count: {count}")

            # Get class names using JS
            class_list = await page.evaluate("""() => {
                try {
                    const els = document.querySelectorAll('[class*="tupleNew"]');
                    const classes = [];
                    for (let i = 0; i < els.length; i++) {
                        const cn = els[i].className;
                        if (typeof cn === 'string' && classes.indexOf(cn) === -1) {
                            classes.push(cn.substring(0, 120));
                        }
                    }
                    return classes;
                } catch(e) { return ['ERROR: ' + e.message]; }
            }""")
            for c in class_list[:20]:
                print(f"  {c}")
        except Exception as e:
            print(f"Error: {e}")

        await browser.close()

asyncio.run(main())
