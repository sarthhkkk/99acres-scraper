import asyncio
from playwright.async_api import async_playwright

async def inspect(url):
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            channel="chrome",
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-web-security",
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

        resp = await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        print(f"Status: {resp.status if resp else 'None'}")
        print(f"Headers: {dict(resp.headers) if resp else {}}")

        await asyncio.sleep(5)

        body_text = await page.inner_text("body")
        print("\n=== BODY (first 1500) ===")
        print(body_text[:1500])

        print(f"\n=== URL after redirect: {page.url}")

        title = await page.title()
        print(f"\n=== TITLE: {title}")

        if "Access Denied" not in body_text and len(body_text) > 500:
            print("\n=== SUCCESS! Page loaded ===")
            sel_list = [
                '[class*="card"]', '[class*="tuple"]', '[class*="project"]',
                '[class*="listing"]', '[class*="srp"]', 'article',
                '[data-testid*="listing"]', '[class*="property"]',
                'a[href*="/property/"]', 'a[href*="/projects/"]'
            ]
            for sel in sel_list:
                els = await page.query_selector_all(sel)
                if els:
                    print(f"\n  '{sel}': {len(els)} elements")
                    for e in els[:2]:
                        cls = await e.get_attribute("class")
                        tag = await e.evaluate("el => el.tagName")
                        print(f"    <{tag}> class='{(cls or '')[:120]}'")

        await browser.close()

asyncio.run(inspect("https://www.99acres.com/search/properties/buy/delhi?city=1"))
