import sys, json, os, re, asyncio
from datetime import datetime
from urllib.parse import urlparse
import httpx
from playwright.async_api import async_playwright

ERROR_WEBHOOK = "https://discord.com/api/webhooks/1517953901964558387/pLtPZUL1mMVKzlXOQUpyP1OTj9S7LNZRfYm0ixlFeisG1_rOXOnjPaieL-msukxef_kd"
EVENT_WEBHOOK = "https://discord.com/api/webhooks/1517957654738112750/Om7ApikcJXD2No_zRvvM397z_AwpRuOGWRgm62QJThUWw7V4uUGTd2LYP1OBZYIpmWwQ"
OUTPUT_DIR = os.path.expanduser("~/scraped_data")
os.makedirs(OUTPUT_DIR, exist_ok=True)

ANTI_DETECT_JS = """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] });
Object.defineProperty(navigator, 'languages', { get: () => ['en-IN', 'en'] });
window.chrome = { runtime: {} };
"""

def ep(text):
    if not text: return None
    m = re.search(r'(?:Rs\.?|INR|\u20b9)\s*([\d,]+(?:\.\d+)?)\s*(Cr|Lac|K|Crore|Lakh)?', text, re.I)
    if m:
        num_str = m.group(1).replace(",", "")
        suffix = (m.group(2) or "").lower()
        v = float(num_str)
        if suffix in ("cr", "crore"): v *= 1e7
        elif suffix in ("lac", "lakh"): v *= 1e5
        elif suffix == "k": v *= 1e3
        return f"Rs.{v:,.0f}" if v >= 1 else f"Rs.{num_str}"
    m2 = re.search(r'([\d,]+(?:\.\d+)?)\s*(Cr|Lac|K|Crore|Lakh)', text, re.I)
    if m2:
        num_str = m2.group(1).replace(",", "")
        suffix = m2.group(2).lower()
        v = float(num_str)
        if suffix in ("cr", "crore"): v *= 1e7
        elif suffix in ("lac", "lakh"): v *= 1e5
        elif suffix == "k": v *= 1e3
        return f"Rs.{v:,.0f}"
    return None

def ea(text):
    if not text: return None
    m = re.search(r'([\d,]+(?:\.\d+)?)\s*(sq\.?\s*ft|sqft|square\s*feet|sq\.?\s*m|sqm|square\s*meter|acre|yard)', text, re.I)
    return m.group(0).strip() if m else None

def eb(text):
    if not text: return None
    m = re.search(r'(\d+)\s*(?:BHK|RK|Bedroom|BED)', text, re.I)
    return m.group(0).strip() if m else None

def es(text):
    if not text: return None
    for kw in ["ready to move", "under construction", "resale", "new project", "pre-launch"]:
        if kw in text.lower(): return kw.title()
    return None

def ct(text):
    if not text: return ""
    return re.sub(r'\s+', ' ', text).strip()

async def sd(webhook_url, data, is_error=False):
    if is_error:
        payload = {"content": f"**Scraper Error**\n```{str(data)[:1900]}```"}
    elif isinstance(data, str):
        payload = {"content": data[:1900]}
    else:
        fields = [{"name": k, "value": str(v)[:1024], "inline": True} for k, v in data.items() if v]
        payload = {
            "embeds": [{
                "title": "99acres Property Data",
                "color": 3066993,
                "fields": fields,
                "footer": {"text": f"Scraped at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"},
                "timestamp": datetime.now().isoformat()
            }]
        }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            await client.post(webhook_url, json=payload)
    except: pass

def sv(data, url):
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    domain = urlparse(url).netloc.replace(".", "_")
    fname = os.path.join(OUTPUT_DIR, f"{domain}_{ts}.json")
    with open(fname, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"[+] Saved: {fname}")
    return fname

def is_listing_page(url):
    u = url.lower()
    return any(x in u for x in ["-ffid", "/search/", "property-in-", "flats-in-"])

def is_detail_page(url):
    u = url.lower()
    return any(x in u for x in ["-spid-", "-npspid-", "-npxid-"])

async def scrape(url):
    print(f"[*] Opening: {url}")
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            channel="chrome",
            headless=True,
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"]
        )
        ctx = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
            locale="en-IN",
            timezone_id="Asia/Kolkata",
        )
        await ctx.add_init_script(ANTI_DETECT_JS)
        page = await ctx.new_page()

        resp = await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        print(f"[*] HTTP {resp.status if resp else '?'}")
        await page.wait_for_load_state("networkidle", timeout=30000)
        await asyncio.sleep(4)

        text = await page.inner_text("body") or ""
        title = await page.title() or ""

        data = {
            "url": url,
            "title": ct(title),
            "scraped_at": datetime.now().isoformat(),
            "page_type": "listing" if is_listing_page(url) else ("detail" if is_detail_page(url) else "unknown"),
            "listings": [],
            "property": {}
        }

        if data["page_type"] == "listing":
            print("[*] Detected as listing/search page")

            seen_urls = set()
            for scroll_round in range(5):
                cards = await page.query_selector_all("[class*='tupleNew__outerTupleWrap']")
                print(f"[*] Round {scroll_round+1}: {len(cards)} cards visible")

                for card in cards:
                    card_text = ct(await card.inner_text())
                    if not card_text or len(card_text) < 20:
                        continue

                    item = {
                        "title": "", "price": ep(card_text) or "",
                        "area": ea(card_text) or "", "bhk": eb(card_text) or "",
                        "status": es(card_text) or "", "location": "", "url": ""
                    }

                    heading = await card.query_selector("a[class*='propertyHeading']")
                    if heading:
                        item["title"] = ct(await heading.inner_text())
                        href = await heading.get_attribute("href")
                        if href:
                            item["url"] = href if href.startswith("http") else f"https://www.99acres.com{href}"

                    for sel in ['[class*="address"i]', '[class*="locality"i]', '[class*="location"i]']:
                        el = await card.query_selector(sel)
                        if el:
                            lt = ct(await el.inner_text())
                            if lt and len(lt) > 5 and not item["location"]:
                                item["location"] = lt

                    if not item["title"]:
                        parts = [p.strip() for p in card_text.split("|") if p.strip()]
                        item["title"] = (parts[0] if parts else card_text.split("\n")[0])[:100]

                    if item["url"] and item["url"] not in seen_urls:
                        seen_urls.add(item["url"])
                        data["listings"].append(item)
                    elif not item["url"] and card_text not in seen_urls:
                        seen_urls.add(card_text[:100])
                        data["listings"].append(item)

                await page.evaluate("window.scrollBy(0, 2000)")
                await asyncio.sleep(3)

            print(f"[*] Total unique listings: {len(data['listings'])}")

        elif data["page_type"] == "detail":
            print("[*] Detected as property detail page")
            pd = data["property"]

            for h in ["h1", "h2", "h3"]:
                for el in await page.query_selector_all(h):
                    t = ct(await el.inner_text())
                    if t and len(t) > 10 and not pd.get("title"):
                        pd["title"] = t

            pd["price"] = ep(text) or ""
            pd["area"] = ea(text) or ""
            pd["bhk"] = eb(text) or ""
            pd["status"] = es(text) or ""

            for sel in ['[class*="price"i]', '[class*="amount"i]', '[class*="cost"i]', '[class*="rate"i]']:
                for el in await page.query_selector_all(sel):
                    t = ct(await el.inner_text())
                    if t and re.search(r'[\d,]+', t) and not pd.get("price_raw"):
                        pd["price_raw"] = t

            for sel in ['[class*="address"i]', '[class*="locality"i]', '[class*="location"i]']:
                for el in await page.query_selector_all(sel):
                    t = ct(await el.inner_text())
                    if t and len(t) > 10 and not pd.get("location"):
                        pd["location"] = t

            desc_el = await page.query_selector('[class*="description"i], [class*="about"i], [class*="desc"i]')
            if desc_el:
                pd["description"] = ct(await desc_el.inner_text())[:2000]

            for el in await page.query_selector_all('[class*="feature"i] li, [class*="amenity"i] li, [class*="highlight"i] li'):
                t = ct(await el.inner_text())
                if t and len(t) < 100:
                    pd.setdefault("features", []).append(t)

            for el in await page.query_selector_all('[class*="label"i], [class*="tag"i], [class*="badge"i]'):
                t = ct(await el.inner_text())
                if t and len(t) < 50:
                    if "owner" in t.lower() or "agent" in t.lower() or "builder" in t.lower():
                        pd["listed_by"] = t
                    elif re.search(r'\d+', t) and ("floor" in t.lower() or "total" in t.lower()):
                        pd["floor_info"] = t

        await browser.close()

        fpath = sv(data, url)

        if data["page_type"] == "listing":
            count = len(data["listings"])
            await sd(EVENT_WEBHOOK, f"**99acres Search** | {count} listings | {url[:100]}")
            for item in data["listings"][:5]:
                await sd(EVENT_WEBHOOK, item)
                await asyncio.sleep(0.5)
            if count > 5:
                await sd(EVENT_WEBHOOK, f"... and {count-5} more listings saved to file")
        else:
            embed = {k: v for k, v in data["property"].items() if v}
            if embed:
                await sd(EVENT_WEBHOOK, embed)
            else:
                await sd(EVENT_WEBHOOK, f"**Scraped:** {url[:100]}\nNo structured data found. File saved.")

        print(f"\n[+] Done! Data saved to: {fpath}")
        return data

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scraper.py <url>")
        print()
        print("Examples:")
        print('  python scraper.py "https://www.99acres.com/property-in-mumbai-ffid"')
        print('  python scraper.py "https://www.99acres.com/2-bhk-flats-in-mumbai-ffid"')
        print('  python scraper.py "https://www.99acres.com/2-bhk-bedroom-apartment-flat-for-sale-spid-Q87747954"')
        print()
        print(f"Data saved to: {OUTPUT_DIR}")
        sys.exit(1)

    url = sys.argv[1].strip().strip("\"'")
    if not url.startswith("http"):
        url = "https://" + url

    try:
        data = asyncio.run(scrape(url))
        print(f"[+] Scraped {data['page_type']} page - {len(data.get('listings',[]))} listings, {len(data.get('property',{}))} fields")
    except Exception as e:
        print(f"[!] Error: {e}")
        import traceback
        traceback.print_exc()
        asyncio.run(sd(ERROR_WEBHOOK, str(e)[:1900], is_error=True))
