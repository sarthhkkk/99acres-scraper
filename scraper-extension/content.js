console.log("[99acres Scraper] Content script loaded");

window.__debug99acres = function() {
  console.log("=== 99acres Debug ===");
  console.log("URL:", location.href);
  console.log("Title:", document.title);
  const allLinks = [].filter.call(document.querySelectorAll('a[href]'), a => a.href && a.href.includes('99acres') && !a.href.includes('#'));
  console.log("99acres links:", allLinks.length);
  allLinks.slice(0, 10).forEach(a => console.log("  Link:", a.href.substring(0, 120), "| Text:", (a.innerText||'').trim().substring(0, 60)));
  const priceTexts = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let n;
  while (n = walker.nextNode()) {
    if (/[\u20b9₹]|Rs/i.test(n.textContent)) priceTexts.push(n.textContent.trim().substring(0, 100));
  }
  console.log("Price text nodes:", priceTexts.length);
  priceTexts.slice(0, 10).forEach(t => console.log("  Price text:", t));
  const cards = findAllCards();
  console.log("findAllCards result:", cards.length);
  cards.slice(0, 5).forEach((c, i) => {
    const t = (c.innerText||'').replace(/\s+/g,' ').trim();
    console.log("  Card", i, ":", t.substring(0, 150), "| children:", c.children.length, "| tag:", c.tagName, "| classes:", c.className.substring(0, 80));
  });
  console.log("=== Debug End ===");
  return { links: allLinks.length, priceNodes: priceTexts.length, cards: cards.length };
};

function extractPrice(text) {
  if (!text) return null;
  let m = text.match(/(?:Rs\.?|INR|\u20b9)\s*([\d,]+(?:\.\d+)?)\s*(Cr|Lac|K|Crore|Lakh)?/i);
  if (!m) m = text.match(/([\d,]+(?:\.\d+)?)\s*(Cr|Lac|K|Crore|Lakh)/i);
  if (!m) return null;
  let num = parseFloat(m[1].replace(/,/g, ""));
  const suffix = (m[2] || "").toLowerCase();
  if (suffix === "cr" || suffix === "crore") num *= 1e7;
  else if (suffix === "lac" || suffix === "lakh") num *= 1e5;
  else if (suffix === "k") num *= 1e3;
  return { display: "Rs." + num.toLocaleString("en-IN"), numeric: num };
}

function extractArea(text) {
  if (!text) return null;
  const m = text.match(/([\d,]+(?:\.\d+)?)\s*(sq\.?\s*ft|sqft|square\s*feet|sq\.?\s*m|sqm|square\s*meter|acre|yard)/i);
  return m ? m[0].trim() : null;
}

function extractBhk(text) {
  if (!text) return null;
  const m = text.match(/(\d+)\s*(?:BHK|RK|Bedroom|BED)/i);
  return m ? m[0].trim() : null;
}

function extractBath(text) {
  if (!text) return null;
  const m = text.match(/(\d+)\s*(?:Bath|bath|Bathroom|bathroom)/i);
  return m ? m[0].trim() : null;
}

function extractFloor(text) {
  if (!text) return null;
  const m = text.match(/(\d+)\w{2}\s*(?:floor|out of)\s*(\d+)/i);
  return m ? `${m[1]}/${m[2]}` : null;
}

function extractFacing(text) {
  if (!text) return null;
  const dirs = ["north", "south", "east", "west", "north-east", "north-west", "south-east", "south-west"];
  for (const d of dirs) {
    if (text.toLowerCase().includes(d + "-facing") || text.toLowerCase().includes(d + " facing")) {
      return d.charAt(0).toUpperCase() + d.slice(1) + " Facing";
    }
  }
  return null;
}

function extractStatus(text) {
  if (!text) return null;
  const kws = ["ready to move", "under construction", "resale", "new project", "pre-launch", "newly constructed"];
  for (const kw of kws) {
    if (text.toLowerCase().includes(kw)) return kw.replace(/\b\w/g, c => c.toUpperCase());
  }
  return null;
}

function extractListedBy(text) {
  if (!text) return null;
  if (/owner/i.test(text)) return "Owner";
  if (/agent/i.test(text)) return "Agent";
  if (/builder/i.test(text)) return "Builder";
  return null;
}

function extractContactInfo(card) {
  const info = { phone: "", seller_name: "" };
  const text = card.innerText || "";
  const phoneMatch = text.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) info.phone = phoneMatch[0].trim();
  const nameEl = card.querySelector('[class*="seller"],[class*="owner"],[class*="contact"] a,[class*="name"]');
  if (nameEl) info.seller_name = nameEl.textContent.trim();
  const nameMatch = text.match(/(?:Posted by|Contact|Owner|Seller)[:\s]+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/);
  if (!info.seller_name && nameMatch) info.seller_name = nameMatch[1].trim();
  return info;
}

function ct(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function extractPropertyId(url) {
  if (!url) return "";
  const m = url.match(/spid[-=]([a-zA-Z0-9]+)/);
  if (m) return m[1];
  const m2 = url.match(/pid[-=](\d+)/i);
  if (m2) return m2[1];
  const m3 = url.match(/property\/([a-zA-Z0-9-]+)/);
  if (m3) return m3[1].split("-").pop();
  return "";
}

function extractFurnished(text) {
  if (!text) return "";
  if (/fully\s*furnished/i.test(text)) return "Fully Furnished";
  if (/semi[\s-]*furnished/i.test(text)) return "Semi Furnished";
  if (/unfurnished/i.test(text)) return "Unfurnished";
  return "";
}

function extractPossession(text) {
  if (!text) return "";
  const m = text.match(/(?:possession|ready\s*by|move[- ]in)\s*:\s*([A-Za-z]+\s*\d{4})/i);
  if (m) return m[1].trim();
  const m2 = text.match(/(\d{4})\s*(?:possession|delivery|ready)/i);
  if (m2) return m2[1];
  return "";
}

function extractParking(text) {
  if (!text) return "";
  const m = text.match(/(\d+)\s*(?:parking|car\s*parking|covered\s*parking)/i);
  if (m) return m[0].trim();
  if (/parking/i.test(text)) {
    if (/no\s*parking/i.test(text)) return "None";
    if (/covered/i.test(text)) return "Covered";
    return "Available";
  }
  return "";
}

function extractPostedOn(text) {
  if (!text) return "";
  const m = text.match(/(?:posted|added|listed)\s*(?:on|:)\s*([A-Za-z]+\s*\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i);
  if (m) return m[1].trim();
  const m2 = text.match(/(?:posted|added|listed)\s*(\d+)\s*(?:day|week|month|hr|min)/i);
  if (m2) return m2[0].trim();
  return "";
}

function getCardData(card) {
  const text = ct(card.innerText);
  if (!text || text.length < 10) return null;

  const priceResult = extractPrice(text);
  const item = {
    property_id: "", title: "", price: "", price_numeric: 0, area: "", bhk: "", bath: "",
    floor: "", facing: "", status: "", location: "", society: "",
    listed_by: "", url: "", image_url: "", owner_profile_url: "",
    phone: "", seller_name: "", transaction: "", furnished: "",
    possession: "", parking: "", description: "", posted_on: "",
    scraped_at: new Date().toISOString(),
  };

  if (priceResult) { item.price = priceResult.display; item.price_numeric = priceResult.numeric; }
  item.area = extractArea(text) || "";
  item.bhk = extractBhk(text) || "";
  item.bath = extractBath(text) || "";
  item.floor = extractFloor(text) || "";
  item.facing = extractFacing(text) || "";
  item.status = extractStatus(text) || "";
  item.furnished = extractFurnished(text);
  item.possession = extractPossession(text);
  item.parking = extractParking(text);
  item.posted_on = extractPostedOn(text);

  const heading = card.querySelector("a[class*='propertyHeading'], a[class*='title'], a[class*='heading'], a[class*='name'], a[class*='link'], h2 a, h3 a");
  if (heading) {
    item.title = ct(heading.innerText);
    item.url = heading.href || "";
  }
  if (!item.url) {
    const anyLink = card.querySelector('a[href*="-spid-"], a[href*="property-in-"], a[href*="99acres"]');
    if (anyLink) {
      item.url = anyLink.href || "";
      if (!item.title) item.title = ct(anyLink.innerText);
    }
  }
  item.property_id = extractPropertyId(item.url);

  const locEl = card.querySelector('[class*="address"], [class*="locality"], [class*="location"], [class*="place"], [class*="society"], [class*="project"], [class*="street"]');
  if (locEl) item.location = ct(locEl.innerText);
  if (!item.location) {
    const locMatch = text.match(/(?:in|at)\s+([A-Z][A-Za-z\s,]+?)(?:\s+\||\s+\d|\s+Rs|$)/);
    if (locMatch) item.location = locMatch[1].trim().slice(0, 60);
  }

  const parts = text.split("|").map(s => s.trim()).filter(Boolean);
  const societyMatch = text.match(/in\s+([A-Z][A-Za-z\s]+?)(?:\s+\||\s+\d|\s+Rs|$)/);
  if (societyMatch) item.society = societyMatch[1].trim().slice(0, 50);

  const badges = card.querySelectorAll('[class*="label"], [class*="tag"], [class*="badge"], [class*="posted"], [class*="tag"]');
  badges.forEach(el => {
    const t = ct(el.innerText);
    if (t && !item.listed_by) item.listed_by = extractListedBy(t) || "";
    if (t && !item.posted_on) item.posted_on = extractPostedOn(t);
  });

  const img = card.querySelector("img");
  if (img) item.image_url = img.src || "";

  if (/resale/i.test(text)) item.transaction = "Resale";
  else if (/new/i.test(text) && /project/i.test(text)) item.transaction = "New";

  // Owner profile link
  const profileLink = card.querySelector('a[href*="/agent/"], a[href*="/owner/"], a[href*="/builder/"], a[class*="profile"], a[class*="seller"], a[class*="posted"]');
  if (profileLink) {
    item.owner_profile_url = profileLink.href || "";
    if (!item.seller_name) item.seller_name = ct(profileLink.innerText);
  }

  const contact = extractContactInfo(card);
  if (contact.phone) item.phone = contact.phone;
  if (contact.seller_name) item.seller_name = contact.seller_name;

  // Description from any description-like element
  const descEl = card.querySelector('[class*="description"], [class*="about"], [class*="desc"],[class*="summary"]');
  if (descEl) item.description = ct(descEl.innerText).slice(0, 500);

  if (!item.title) {
    item.title = (parts[0] || text.split("\n")[0]).slice(0, 100);
  }

  if (text.length < 30 && !item.price && !item.title) return null;

  return item;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function findAllCards() {
  const containers = new Set();
  const priceClassEls = document.querySelectorAll('[class*="price"], [class*="cost"], [class*="amount"], [class*="rate"], [class*="value"]');
  for (const el of priceClassEls) {
    const t = (el.innerText || "").replace(/\s+/g, " ").trim();
    if (t.length > 5 && (/[\u20b9₹]|Rs/i.test(t) || /\d[\d,]*\s*(?:Cr|Lac|Lakh|K|Crore)\b/i.test(t))) {
      let p = el.parentElement;
      for (let d = 0; d < 5 && p; d++) {
        const pt = (p.innerText || "").replace(/\s+/g, " ").trim();
        if (pt.length > 50 && /\d+\s*(?:BHK|RK|Bed|sq\.?\s*(?:ft|m|yard)|sqft|sqm)/i.test(pt)) {
          containers.add(p);
          break;
        }
        if (p.children.length > 1 && pt.length > 100) containers.add(p);
        p = p.parentElement;
      }
    }
  }

  if (containers.size < 2) {
    // Fallback: find property links and use their parent containers
    const propLinks = document.querySelectorAll('a[href*="-spid-"], a[href*="property-in-"], a[href*="/projects-in-"], a[href*="/property/"]');
    for (const a of propLinks) {
      let p = a.parentElement;
      for (let d = 0; d < 5 && p; d++) {
        const pt = (p.innerText || "").replace(/\s+/g, " ").trim();
        if (pt.length > 50 && p.children.length >= 2) { containers.add(p); break; }
        p = p.parentElement;
      }
    }
  }

  if (containers.size < 1) {
    // Last resort: any element with ₹ or Rs text that looks like a listing
    const candidates = document.querySelectorAll('div, li');
    for (const el of candidates) {
      if (el.children.length < 2 || el.children.length > 30) continue;
      const t = (el.innerText || "").replace(/\s+/g, " ").trim();
      if (t.length < 50) continue;
      if (/[\u20b9₹]|Rs/i.test(t)) { containers.add(el); }
    }
  }

  const result = [...containers];
  console.log(`[99acres] findAllCards found ${result.length} cards`);
  return result;
}

function filterByKeywords(items, keywords) {
  if (!keywords || !keywords.length) return items;
  const lower = keywords.map(k => k.toLowerCase().trim()).filter(Boolean);
  if (!lower.length) return items;
  return items.filter(item => {
    const haystack = [item.title, item.location, item.society, item.bhk, item.price, item.area, item.status, item.floor, item.facing].filter(Boolean).join(" ").toLowerCase();
    return lower.every(kw => haystack.includes(kw));
  });
}

function scrapeListings(keywords) {
  const items = [];
  const seen = new Set();
  const cards = findAllCards();
  cards.forEach(card => {
    const item = getCardData(card);
    if (!item) return;
    const key = item.url || item.title;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  });
  console.log(`[99acres] scrapeListings found ${items.length} items`);
  return filterByKeywords(items, keywords);
}

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

let stopRequested = false;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "stopScrape") stopRequested = true;
});

async function waitForNewContent(container, timeoutMs) {
  const cards = findAllCards();
  if (cards.length > 0) return true;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    const obs = new MutationObserver(() => {
      const cards = findAllCards();
      if (cards.length > 0) {
        clearTimeout(timer);
        obs.disconnect();
        resolve(true);
      }
    });
    obs.observe(container || document.body, { childList: true, subtree: true });
  });
}

async function humanScroll() {
  const total = rand(300, 800);
  for (let s = 0; s < total; s++) {
    if (stopRequested) return;
    window.scrollBy(0, rand(5, 25));
    await sleep(rand(15, 45));
  }
}

async function humanPause() {
  await sleep(rand(1800, 4000));
}

async function findNextPage() {
  const selectors = [
    'a[class*="next"]', 'button[class*="next"]',
    'a[aria-label="Next"]', 'button[aria-label="Next"]',
    'a[rel="next"]', 'link[rel="next"]',
    '[class*="pagination"] a:not([class*="active"])',
    'a[href*="page="]', 'a[href*="/page-"]',
  ];
  for (const sel of selectors) {
    const els = document.querySelectorAll(sel);
    for (const el of els) {
      if (el.offsetParent !== null) {
        const text = (el.textContent || "").toLowerCase().trim();
        if (/next|»|→|›|page\s+\d+/.test(text) || el.getAttribute("rel") === "next") {
          return { element: el, url: el.href || "" };
        }
      }
    }
  }
  const numberedLinks = document.querySelectorAll('[class*="pagination"] a, [class*="pagi"] a, nav a[href*="99acres"]');
  const currentPageMatch = document.body.innerHTML.match(/class="[^"]*pagination[^"]*"[^>]*>.*?class="[^"]*active[^"]*"[^>]*>(\d+)<\/a>/i);
  const currentPage = currentPageMatch ? parseInt(currentPageMatch[1]) : 1;
  for (const link of numberedLinks) {
    const pageMatch = link.textContent.trim().match(/^(\d+)$/);
    if (pageMatch) {
      const pageNum = parseInt(pageMatch[1]);
      if (pageNum === currentPage + 1 && link.offsetParent !== null) {
        return { element: link, url: link.href || "" };
      }
    }
  }
  return null;
}

function getListingsContainer() {
  return document.querySelector('[class*="listWrap"],[class*="srp"],[class*="listTuple"],[class*="result"],#listMain') || document.body;
}

async function scrapePageListings(seen, items, streamItems, keywords) {
  const cards = findAllCards();
  let added = 0;
  const newStreamItems = [];
  cards.forEach(card => {
    const item = getCardData(card);
    if (item) {
      const key = item.url || item.title;
      if (!seen.has(key)) { seen.add(key); items.push(item); added++; }
      const matches = !keywords || !keywords.length || filterByKeywords([item], keywords).length > 0;
      if (matches && !seen.has("s:" + key)) { seen.add("s:" + key); streamItems.push(item); newStreamItems.push(item); }
    }
  });
  if (newStreamItems.length > 0) {
    chrome.runtime.sendMessage({ action: "scrapeStream", items: newStreamItems, total: streamItems.length }).catch(() => {});
  }
  return added;
}

async function autoScrollAndScrape(maxScrolls, keywords, maxPages) {
  const allItems = [];
  const streamItems = [];
  const seen = new Set();
  stopRequested = false;
  console.log(`[99acres] Starting scrape: maxScrolls=${maxScrolls}, maxPages=${maxPages}, keywords=${keywords?.join(",")}`);

  for (let page = 0; page < (maxPages || 3); page++) {
    if (stopRequested) break;
    if (page > 0) {
      const next = await findNextPage();
      if (!next) break;
      chrome.runtime.sendMessage({ action: "scrapeStream", msg: `Loading page ${page + 1}...`, items: [], total: allItems.length }).catch(() => {});
      try { next.element.click(); } catch (e) { next.element.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
      const container = getListingsContainer();
      const loaded = await waitForNewContent(container, 10000);
      if (!loaded) break;
      await sleep(rand(1000, 2500));
    }

    await sleep(rand(800, 2500));
    if (stopRequested) break;

    let initialAdded = await scrapePageListings(seen, allItems, streamItems, keywords);

    let emptyStreak = 0;
    for (let i = 0; i < (maxScrolls || 15); i++) {
      if (stopRequested) break;
      await humanScroll();
      if (stopRequested) break;
      await humanPause();
      window.scrollBy(0, rand(1500, 3500));
      await sleep(rand(800, 2000));
      window.scrollTo(0, document.documentElement.scrollHeight);
      const container = getListingsContainer();
      const changed = await waitForNewContent(container, 4000);
      if (!changed) await sleep(rand(1000, 2500));
      if (stopRequested) break;
      const added = await scrapePageListings(seen, allItems, streamItems, keywords);
      console.log(`[99acres] Page ${page+1}, scroll ${i+1}: found ${added} new items, total=${streamItems.length}`);
      emptyStreak = added > 0 ? 0 : emptyStreak + 1;

      if (emptyStreak >= 2) {
        const clickTargets = document.querySelectorAll('button, a, [role="button"], span[class*="link"]');
        for (const btn of clickTargets) {
          const text = (btn.textContent || "").toLowerCase().trim();
          if (/load more|show more|view more|next|page \d+|→|»|see all/i.test(text) && btn.offsetParent !== null) {
            try { btn.click(); await sleep(rand(2000, 3500)); break; } catch (e) {}
          }
        }
      }

      chrome.runtime.sendMessage({ action: "updateBadge", text: `${streamItems.length}`, color: "#ff9800" }).catch(() => {});
      if (emptyStreak >= 4) break;
    }
  }

  chrome.runtime.sendMessage({ action: "scrapeDone", total: streamItems.length }).catch(() => {});
  return streamItems;
}

function scrapeDetail() {
  const pd = {};
  const text = ct(document.body.innerText);

  for (const h of ["h1", "h2", "h3"]) {
    const els = document.querySelectorAll(h);
    for (const el of els) {
      const t = ct(el.innerText);
      if (t && t.length > 10 && !pd.title) pd.title = t;
    }
  }

  const priceResult = extractPrice(text);
  if (priceResult) { pd.price = priceResult.display; pd.price_numeric = priceResult.numeric; }
  pd.area = extractArea(text) || "";
  pd.bhk = extractBhk(text) || "";
  pd.bath = extractBath(text) || "";
  pd.floor = extractFloor(text) || "";
  pd.facing = extractFacing(text) || "";
  pd.status = extractStatus(text) || "";
  pd.furnished = extractFurnished(text);
  pd.possession = extractPossession(text);
  pd.parking = extractParking(text);
  pd.posted_on = extractPostedOn(text);

  const propLink = document.querySelector('a[href*="-spid-"], a[href*="/property/"]');
  if (propLink) { pd.url = propLink.href; pd.property_id = extractPropertyId(propLink.href); }

  for (const sel of ['[class*="price"]', '[class*="amount"]', '[class*="cost"]', '[class*="rate"]']) {
    const el = document.querySelector(sel);
    if (el) {
      const t = ct(el.innerText);
      if (t && /\d/.test(t) && !pd.price_raw) pd.price_raw = t;
    }
  }

  for (const sel of ['[class*="address"]', '[class*="locality"]', '[class*="location"]']) {
    const el = document.querySelector(sel);
    if (el) {
      const t = ct(el.innerText);
      if (t && t.length > 10 && !pd.location) pd.location = t;
    }
  }

  const societyEl = document.querySelector('[class*="projectName"], [class*="buildingName"], [class*="society"]');
  if (societyEl) pd.society = ct(societyEl.innerText);

  const descEl = document.querySelector('[class*="description"], [class*="about"], [class*="desc"]');
  if (descEl) pd.description = ct(descEl.innerText).slice(0, 2000);

  const features = [];
  document.querySelectorAll('[class*="feature"] li, [class*="amenity"] li, [class*="highlight"] li')
    .forEach(el => {
      const t = ct(el.innerText);
      if (t && t.length < 100) features.push(t);
    });
  if (features.length) pd.features = features;

  document.querySelectorAll('[class*="label"], [class*="tag"], [class*="badge"]').forEach(el => {
    const t = ct(el.innerText);
    if (t && t.length < 50 && !pd.listed_by) pd.listed_by = extractListedBy(t) || "";
  });

  const images = [];
  document.querySelectorAll("img[src*='99acres']").forEach(img => {
    if (img.src && images.length < 5) images.push(img.src);
  });
  if (images.length) pd.images = images;

  const phoneEl = document.querySelector('a[href^="tel:"], [class*="phone"], [class*="contact"] a, [class*="mobile"]');
  if (phoneEl) pd.phone = ct(phoneEl.innerText || phoneEl.getAttribute("href")?.replace("tel:", "") || "");
  const sellerEl = document.querySelector('[class*="sellerName"], [class*="ownerName"], [class*="postedBy"]');
  if (sellerEl) pd.seller_name = ct(sellerEl.innerText);
  const profileLink = document.querySelector('a[href*="/agent/"], a[href*="/owner/"], a[href*="/builder/"]');
  if (profileLink) pd.owner_profile_url = profileLink.href;

  pd.scraped_at = new Date().toISOString();
  return pd;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "scrape") {
    (async () => {
      const url = window.location.href;
      const isDetail = /\/property\/[\w-]+-spid-|99acres\.com\/[\w-]+(?:-\d+)?$/i.test(url);
      await sleep(rand(500, 2000));
      const data = {
        url, title: document.title, scraped_at: new Date().toISOString(),
        page_type: isDetail ? "detail" : "listing", listings: [], property: {},
      };
      if (!isDetail) data.listings = scrapeListings(msg.keywords);
      else data.property = scrapeDetail();
      sendResponse(data);
    })();
    return true;
  }

  if (msg.action === "autoScrollScrape") {
    (async () => {
      const url = window.location.href;
      const listings = await autoScrollAndScrape(msg.maxScrolls, msg.keywords, msg.maxPages);
      sendResponse({
        url, title: document.title, scraped_at: new Date().toISOString(),
        page_type: "listing", listings, property: {},
      });
    })();
    return true;
  }

  if (msg.action === "ping") {
    sendResponse({ alive: true });
    return true;
  }
});
