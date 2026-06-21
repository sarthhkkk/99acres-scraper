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

        # Monitor API calls
        api_requests = []
        page.on("request", lambda req: api_requests.append({"url": req.url, "method": req.method, "type": req.resource_type}) if "api" in req.url.lower() or "search" in req.url.lower() or "property" in req.url.lower() else None)

        await page.goto("https://www.99acres.com", timeout=30000)
        await asyncio.sleep(3)

        # Fill city
        city_input = await page.query_selector('input[placeholder="City Name"]')
        if city_input:
            await city_input.click()
            await city_input.fill("Delhi")
            await asyncio.sleep(1)

            # Click search button
            search_btn = await page.query_selector("#searchform_search_btn")
            if search_btn:
                # Wait for navigation or API call
                async with page.expect_navigation(timeout=15000) as nav:
                    await search_btn.click()
                try:
                    await nav.value
                except:
                    pass
                await asyncio.sleep(5)

        print(f"Final URL: {page.url}")
        print(f"Title: {await page.title()}")

        body = await page.inner_text("body")
        print(f"Body preview: {body[:500]}")

        print(f"\nAPI requests captured ({len(api_requests)}):")
        for r in api_requests[:15]:
            print(f"  [{r['method']}] {r['url'][:150]} ({r['type']})")

        await browser.close()

asyncio.run(main())
