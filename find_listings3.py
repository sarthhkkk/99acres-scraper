import asyncio, re, sys
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

        tuples = await page.query_selector_all("[class*='tupleNew']")
        print(f"Total tupleNew elements: {len(tuples)}")

        # Get the outerHTML of first few tupleNew elements in a batch
        sample_html = await page.evaluate("""() => {
            const els = document.querySelectorAll('[class*=\"tupleNew\"]');
            const results = [];
            for (let i = 0; i < Math.min(els.length, 5); i++) {
                const el = els[i];
                const cls = el.className;
                const tag = el.tagName;
                const html = el.outerHTML.substring(0, 1500);
                const text = el.innerText.replace(/\\n/g, ' | ').substring(0, 200);
                results.push({ tag, cls, text, html });
            }
            return results;
        }""")

        for item in sample_html:
            sys.stdout.reconfigure(encoding='utf-8')
            print(f"\n<{item['tag']}> class={item['cls'][:100]}")
            print(f"  text: {item['text']}")
            # Find key data in html
            for pat in ['Rs.', '\\u20b9', 'BHK', 'sq.ft', 'Crore', 'Lakh', 'spid']:
                if pat in item['html'] or pat.encode() in item['html'].encode():
                    idx = item['html'].find(pat)
                    if idx > 0:
                        print(f"  found '{pat}' at pos {idx}")

        # Find property card container class
        container_info = await page.evaluate("""() => {
            const cards = document.querySelectorAll('[class*=\"tupleNew\"][class*=\"property\"]');
            if (cards.length === 0) {
                const all = document.querySelectorAll('[class*=\"tupleNew\"]');
                // Find parent containers that have price content
                const containers = new Set();
                all.forEach(el => {
                    if (el.innerText.match(/Rs|\\u20b9|BHK/)) {
                        let parent = el.closest('[class]');
                        if (parent) containers.add(parent.className.substring(0,120));
                    }
                });
                return Array.from(containers).slice(0,5);
            }
            return ['found direct'];
        }""")
        print(f"\nContainers: {container_info}")

        await browser.close()

asyncio.run(main())
