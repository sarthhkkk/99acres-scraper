const DEFAULT_CONFIG = {
  errorWebhook: "https://discord.com/api/webhooks/1517953901964558387/pLtPZUL1mMVKzlXOQUpyP1OTj9S7LNZRfYm0ixlFeisG1_rOXOnjPaieL-msukxef_kd",
  eventWebhook: "https://discord.com/api/webhooks/1517957654738112750/Om7ApikcJXD2No_zRvvM397z_AwpRuOGWRgm62QJThUWw7V4uUGTd2LYP1OBZYIpmWwQ",
  autoScroll: true,
  maxScrolls: 15,
  maxPages: 3,
  downloadImages: false,
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "scrape-99acres",
    title: "Scrape this 99acres page",
    documentUrlPatterns: ["https://www.99acres.com/*"],
    contexts: ["page", "link"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "scrape-99acres") {
    const targetUrl = info.linkUrl || info.pageUrl;
    if (targetUrl && targetUrl.includes("99acres.com")) {
      chrome.tabs.update(tab.id, { url: targetUrl }, () => {
        chrome.tabs.onUpdated.addListener(function listener(tabId, change) {
          if (tabId === tab.id && change.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener);
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, { action: "scrape" }).catch(() => {});
            }, 2000);
          }
        });
      });
    }
  }
});

async function getConfig() {
  const result = await chrome.storage.sync.get(DEFAULT_CONFIG);
  return { ...DEFAULT_CONFIG, ...result };
}

async function sendToDiscord(webhookUrl, data) {
  let payload;
  if (typeof data === "string") {
    payload = { content: data.slice(0, 1900) };
  } else {
    const FIELD_LABELS = {
      property_id: "Property ID", title: "Title", price: "Price", area: "Area",
      bhk: "BHK", bath: "Bath", floor: "Floor", facing: "Facing",
      status: "Status", furnished: "Furnished", possession: "Possession",
      parking: "Parking", location: "Location", society: "Society",
      listed_by: "Listed By", seller_name: "Seller", phone: "Phone",
      transaction: "Transaction", posted_on: "Posted On",
      owner_profile_url: "Profile URL", url: "Property URL", description: "Description",
    };
    const FLOAT_FIELDS = new Set(["property_id", "url", "owner_profile_url", "image_url", "price_numeric", "scraped_at"]);
    const fields = Object.entries(data)
      .filter(([k, v]) => v && !FLOAT_FIELDS.has(k))
      .map(([k, v]) => ({
        name: FIELD_LABELS[k] || k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        value: typeof v === "object" ? JSON.stringify(v).slice(0, 1024) : String(v).slice(0, 1024),
        inline: true,
      }));
    payload = {
      embeds: [{
        title: "99acres Property Data",
        color: 3066993,
        fields,
        footer: { text: `Scraped at ${new Date().toLocaleString("en-IN")}` },
        timestamp: new Date().toISOString(),
      }],
    };
  }
  const resp = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`Discord HTTP ${resp.status}`);
}

async function saveToFile(data, filename, format) {
  let content, mime;
  if (format === "csv") {
    content = jsonToCsv(data);
    mime = "text/csv";
    filename += ".csv";
  } else {
    content = JSON.stringify(data, null, 2);
    mime = "application/json";
    filename += ".json";
  }
  const dataUrl = `data:${mime};charset=utf-8,${encodeURIComponent(content)}`;
  return chrome.downloads.download({ url: dataUrl, filename: `99acres_${filename}`, saveAs: false });
}

function jsonToCsv(data) {
  let rows = [];
  if (data.listings?.length) {
    rows = data.listings;
  } else if (data.property) {
    rows = [data.property];
  } else {
    return "No data";
  }
  const keys = [...new Set(rows.flatMap(Object.keys))];
  const csv = [keys.join(","), ...rows.map(r => keys.map(k => `"${(r[k] ?? "").replace(/"/g, '""')}"`).join(","))];
  return csv.join("\n");
}

async function addHistory(data) {
  const { history = [] } = await chrome.storage.local.get("history");
  history.unshift({
    id: Date.now(),
    url: data.url,
    title: data.title,
    page_type: data.page_type,
    count: data.listings?.length || (data.property?.title ? 1 : 0),
    scraped_at: data.scraped_at,
    data,
  });
  if (history.length > 200) history.length = 200;
  await chrome.storage.local.set({ history });
}

async function sendToErrorChannel(msg) {
  try {
    const config = await getConfig();
    await sendToDiscord(config.errorWebhook, `**Scraper Error**\n\`\`\`${msg.slice(0, 1900)}\`\`\``);
  } catch (e) { console.error("Discord error send failed:", e); }
}

async function sendToEventChannel(data) {
  try {
    const config = await getConfig();
    if (typeof data === "string") {
      await sendToDiscord(config.eventWebhook, data);
    } else {
      await sendToDiscord(config.eventWebhook, data);
    }
  } catch (e) { console.error("Discord send failed:", e); }

  chrome.action.setBadgeText({ text: "!" });
  chrome.action.setBadgeBackgroundColor({ color: "#4fc3f7" });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 5000);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "saveLastScrape") {
    (async () => {
      await chrome.storage.local.set({ lastScrape: { data: msg.data, ts: Date.now() } });
      sendResponse({ success: true });
    })();
    return true;
  }

  if (msg.action === "getLastScrape") {
    (async () => {
      const { lastScrape } = await chrome.storage.local.get("lastScrape");
      if (lastScrape && Date.now() - lastScrape.ts < 1800000) {
        await chrome.storage.local.remove("lastScrape");
        sendResponse(lastScrape.data);
      } else {
        sendResponse(null);
      }
    })();
    return true;
  }

  if (msg.action === "sendScrapedData") {
    (async () => {
      try {
        const d = msg.data;
        await addHistory(d);

        if (d.page_type === "listing") {
          await sendToEventChannel(`**99acres Search** | ${d.listings.length} listings | ${d.url.slice(0, 100)}`);
          const items = d.listings;
          // First 5 as detailed embeds
          for (const item of items.slice(0, 5)) {
            await sendToEventChannel(item);
            await new Promise(r => setTimeout(r, 600));
          }
          // Remaining items in batches as compact text
          const remaining = items.slice(5);
          if (remaining.length > 0) {
            const BATCH_SIZE = 8;
            for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
              const batch = remaining.slice(i, i + BATCH_SIZE);
              let text = `**Items ${5 + i + 1}–${Math.min(5 + i + BATCH_SIZE, items.length)} of ${items.length}**\n\`\`\`\n`;
              batch.forEach((item, j) => {
                text += `${i + j + 6}. ${item.title || "-"}`;
                if (item.price) text += ` | ${item.price}`;
                if (item.bhk) text += ` | ${item.bhk}`;
                if (item.area) text += ` | ${item.area}`;
                if (item.location) text += ` | ${item.location}`;
                if (item.seller_name) text += ` | Seller: ${item.seller_name}`;
                if (item.phone) text += ` | 📞 ${item.phone}`;
                text += "\n";
              });
              text += "```";
              await sendToEventChannel(text);
              await new Promise(r => setTimeout(r, 800));
            }
          }
        } else {
          await sendToEventChannel(d.property);
        }

        sendResponse({ success: true, count: d.listings?.length || 1 });
      } catch (e) {
        await sendToErrorChannel(e.message);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (msg.action === "updateBadge") {
    chrome.action.setBadgeText({ text: msg.text });
    chrome.action.setBadgeBackgroundColor({ color: msg.color || "#4fc3f7" });
    return true;
  }

  if (msg.action === "getConfig") {
    (async () => { sendResponse(await getConfig()); })();
    return true;
  }

  if (msg.action === "saveConfig") {
    (async () => {
      await chrome.storage.sync.set(msg.config);
      sendResponse({ success: true });
    })();
    return true;
  }

  if (msg.action === "getHistory") {
    (async () => {
      const { history = [] } = await chrome.storage.local.get("history");
      sendResponse(history);
    })();
    return true;
  }

  if (msg.action === "clearHistory") {
    (async () => {
      await chrome.storage.local.set({ history: [] });
      sendResponse({ success: true });
    })();
    return true;
  }

  if (msg.action === "deleteHistoryItem") {
    (async () => {
      const { history = [] } = await chrome.storage.local.get("history");
      await chrome.storage.local.set({ history: history.filter(h => h.id !== msg.id) });
      sendResponse({ success: true });
    })();
    return true;
  }

  if (msg.action === "downloadFile") {
    (async () => {
      try {
        const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const base = `${msg.data.page_type}_${ts}`;
        const id = await saveToFile(msg.data, base, msg.format || "json");
        sendResponse({ success: true, downloadId: id });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (msg.action === "downloadExcel") {
    (async () => {
      try {
        const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const base = `${msg.data.page_type}_${ts}`;
        const html = jsonToExcelHtml(msg.data);
        const dataUrl = `data:application/vnd.ms-excel;charset=utf-8,${encodeURIComponent(html)}`;
        const id = await chrome.downloads.download({ url: dataUrl, filename: `99acres_${base}.xls`, saveAs: false });
        sendResponse({ success: true, downloadId: id });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (msg.action === "downloadImages") {
    (async () => {
      try {
        const urls = msg.urls || [];
        let count = 0;
        for (const url of urls.slice(0, 20)) {
          try {
            const resp = await fetch(url);
            const blob = await resp.blob();
            const dataUrl = await new Promise(resolve => {
              const r = new FileReader();
              r.onload = () => resolve(r.result);
              r.readAsDataURL(blob);
            });
            const ext = url.split('.').pop()?.split('?')[0] || 'jpg';
            await chrome.downloads.download({ url: dataUrl, filename: `99acres_images/img_${Date.now()}_${count}.${ext}`, saveAs: false });
            count++;
            await new Promise(r => setTimeout(r, 300));
          } catch (e) { console.error("Image download failed:", url, e); }
        }
        sendResponse({ success: true, count });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (msg.action === "downloadImage") {
    (async () => {
      try {
        const resp = await fetch(msg.url);
        const blob = await resp.blob();
        const dataUrl = await new Promise(resolve => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.readAsDataURL(blob);
        });
        const ext = msg.url.split('.').pop()?.split('?')[0] || 'jpg';
        const id = await chrome.downloads.download({ url: dataUrl, filename: `99acres_images/${msg.filename || `image_${Date.now()}`}.${ext}`, saveAs: false });
        sendResponse({ success: true, downloadId: id });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }
});

function jsonToExcelHtml(data) {
  let rows = [];
  if (data.listings?.length) rows = data.listings;
  else if (data.property) rows = [data.property];
  else return "<table><tr><td>No data</td></tr></table>";
  const keys = ["title", "price", "bhk", "area", "bath", "floor", "facing", "status", "location", "society", "listed_by", "seller_name", "phone", "transaction"];
  const headers = keys.map(k => k.charAt(0).toUpperCase() + k.slice(1));
  let html = '<html><head><meta charset="utf-8"><style>td,th{border:1px solid #ccc;padding:4px 8px;font-size:11px;font-family:Arial}</style></head><body><table>';
  html += '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';
  rows.forEach(r => {
    html += '<tr>' + keys.map(k => `<td>${(r[k] ?? '').toString().replace(/"/g, '&quot;')}</td>`).join('') + '</tr>';
  });
  html += '</table></body></html>';
  return html;
}
