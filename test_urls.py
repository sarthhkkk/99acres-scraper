import asyncio
from playwright.async_api import async_playwright

async def test():
    urls = [
        "https://www.99acres.com",
        "https://www.99acres.com/search/properties/buy/delhi",
        "https://www.99acres.com/property-in-delhi",
        "https://www.99acres.com/flats-in-delhi",
        "https://www.99acres.com/property-in-new-delhi",
    ]
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(channel="chrome", headless=True, args=["--disable-blink-features=AutomationControlled"])
        ctx = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080}, locale="en-IN",
        )
        await ctx.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined})")

        for url in urls:
            page = await ctx.new_page()
            try:
                resp = await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                await asyncio.sleep(4)
                text = await page.inner_text("body")
                title = await page.title()
                print(f"\n[{resp.status if resp else '?'}] {url}")
                print(f"  Title: {title}")
                print(f"  Body len: {len(text)}")
                print(f"  First 200: {text[:200].strip()}")
            except Exception as e:
                print(f"\n[!] {url}: {e}")
            finally:
                await page.close()

        await browser.close()

asyncio.run(test())
