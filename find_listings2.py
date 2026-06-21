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

        # Check visible listing area
        els = await page.query_selector_all("[class*='tupleNew']")
        print(f"[class*='tupleNew']: {len(els)} elements")

        for el in els[:10]:
            cls = await el.get_attribute("class")
            tag = await el.evaluate("el => el.tagName")
            text = (await el.inner_text())[:150].replace("\n"," | ")
            print(f"  <{tag}> .{cls} -> {text}")

        print("\n=== Checking for 'srp' related classes ===")
        for sel in ["[class*=srp]", "[class*=Srp]", "[class*=SRP]", "[class*=list"]:
            els = await page.query_selector_all(sel)
            if els:
                print(f"'{sel}': {len(els)}")
                for e in els[:5]:
                    cls = await e.get_attribute("class")
                    tag = await e.evaluate("el => el.tagName")
                    print(f"  <{tag}> .{(cls or '')[:100]}")

        # Check for lazy-loaded content by scrolling
        print("\n=== Scrolling down ===")
        for i in range(3):
            await page.evaluate("window.scrollBy(0, 1000)")
            await asyncio.sleep(2)
        
        # Check again for tupleNew
        els2 = await page.query_selector_all("[class*='tupleNew']")
        print(f"[class*='tupleNew'] after scroll: {len(els2)}")

        # Price elements
        print("\n=== Price elements ===")
        for sel in ["[class*=price]", "[class*=Price]", "[class*=amount]", "[class*=Amount]"]:
            els = await page.query_selector_all(sel)
            if els:
                print(f"'{sel}': {len(els)}")
                for e in els[:3]:
                    text = (await e.inner_text())[:100]
                    print(f"  text: {text}")

        await browser.close()

asyncio.run(main())
