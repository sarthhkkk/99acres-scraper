import asyncio
from playwright.async_api import async_playwright

async def inspect(url):
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-web-security",
                "--disable-features=IsolateOrigins,site-per-process",
            ]
        )
        ctx = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
            locale="en-IN",
            timezone_id="Asia/Kolkata",
        )
        await ctx.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-IN', 'en'] });
        """)
        page = await ctx.new_page()

        try:
            resp = await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            print(f"Status: {resp.status if resp else 'None'}")
        except Exception as e:
            print(f"Navigation error: {e}")

        await asyncio.sleep(5)
        text = await page.inner_text("body")
        print("=== PAGE TEXT (first 2000) ===")
        print(text[:2000])

        print("\n=== COOKIES ===")
        cookies = await ctx.cookies()
        for c in cookies[:5]:
            print(f"  {c['name']}={c['value'][:30]}")

        await browser.close()

asyncio.run(inspect("https://www.99acres.com/search/properties/buy/delhi?city=1"))
