let currentTab = null;
let historyCache = [];
let lastScrapedData = null;
let selectedIndices = new Set();
let selectedHistoryData = null;
let streamCount = 0;
let allHistoryUrls = new Set();
let pinnedProps = [];

function $(id) { return document.getElementById(id); }

function showToast(msg, type) {
  const t = $("toast");
  t.textContent = msg;
  t.className = `toast ${type} show`;
  clearTimeout(t._hide);
  t._hide = setTimeout(() => t.classList.remove("show"), 3000);
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    $(`tab-${tab.dataset.tab}`).classList.add("active");
    if (tab.dataset.tab === "pins") renderPins();
  });
});

// --- Live stream listener ---
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "scrapeStream") {
    console.log("[99acres] stream msg received", msg.items?.length, "items, total:", msg.total);
    if (msg.msg) {
      $("progressLabel").textContent = msg.msg;
    }
    if (msg.items?.length) {
      const newTotal = msg.total || msg.items.length;
      $("totalCount").textContent = newTotal;
      $("liveCount").textContent = newTotal;
      $("liveCount").style.display = "inline-block";
      $("progressCount").textContent = `${newTotal} found`;
      const list = $("resultList");
      console.log("[99acres] resultList exists:", !!list);
      let added = 0;
      msg.items.forEach((item, i) => {
        try {
          const idx = streamCount + i;
          const div = document.createElement("div");
          div.className = "prop-item";
          div.innerHTML = `<input type="checkbox" checked><div class="info"><div class="title">${escapeHtml(item.title || item.url || "-")}</div><div class="meta">${[item.price, item.bhk, item.area, item.location].filter(Boolean).join(" · ")}</div></div>`;
          list.appendChild(div);
          added++;
        } catch (e) {
          console.error("[99acres] Error creating element:", e, item);
        }
      });
      streamCount += msg.items.length;
      console.log("[99acres] added", added, "items to resultList, total children:", list.children.length);
      const dEl = $("debugInfo");
      if (dEl) { dEl.style.display = "block"; dEl.textContent = `List: ${list.children.length} items · Stream: ${streamCount}`; }
    }
    return false;
  }
});

function createPropElement(item, idx) {
  const div = document.createElement("div");
  div.className = "prop-item";
  const dedupText = item.url && allHistoryUrls.has(item.url) ? " 🔄" : "";

  div.innerHTML = `
    <input type="checkbox" class="item-check" data-idx="${idx}" checked>
    <div class="info">
      <div class="title" data-idx="${idx}">${escapeHtml(item.title || "-")}${dedupText}</div>
      <div class="meta">${[item.price, item.bhk, item.area, item.location].filter(Boolean).join(" · ")}</div>
    </div>
    <span class="pin ${isPinned(item) ? "active" : ""}" data-idx="${idx}" title="Pin property">${isPinned(item) ? "★" : "☆"}</span>
    <div class="prop-detail" id="detail-${idx}">
      <div class="field"><span class="lbl">ID</span><span class="val">${escapeHtml(item.property_id || "-")}</span></div>
      <div class="field"><span class="lbl">Price</span><span class="val">${escapeHtml(item.price || "-")}</span></div>
      <div class="field"><span class="lbl">BHK</span><span class="val">${escapeHtml(item.bhk || "-")}</span></div>
      <div class="field"><span class="lbl">Area</span><span class="val">${escapeHtml(item.area || "-")}</span></div>
      <div class="field"><span class="lbl">Bath</span><span class="val">${escapeHtml(item.bath || "-")}</span></div>
      <div class="field"><span class="lbl">Floor</span><span class="val">${escapeHtml(item.floor || "-")}</span></div>
      <div class="field"><span class="lbl">Facing</span><span class="val">${escapeHtml(item.facing || "-")}</span></div>
      <div class="field"><span class="lbl">Status</span><span class="val">${escapeHtml(item.status || "-")}</span></div>
      <div class="field"><span class="lbl">Furnished</span><span class="val">${escapeHtml(item.furnished || "-")}</span></div>
      <div class="field"><span class="lbl">Possession</span><span class="val">${escapeHtml(item.possession || "-")}</span></div>
      <div class="field"><span class="lbl">Parking</span><span class="val">${escapeHtml(item.parking || "-")}</span></div>
      <div class="field"><span class="lbl">Location</span><span class="val">${escapeHtml(item.location || "-")}</span></div>
      <div class="field"><span class="lbl">Society</span><span class="val">${escapeHtml(item.society || "-")}</span></div>
      <div class="field"><span class="lbl">Listed By</span><span class="val">${escapeHtml(item.listed_by || "-")}</span></div>
      <div class="field"><span class="lbl">Seller</span><span class="val">${escapeHtml(item.seller_name || "-")}</span></div>
      ${item.owner_profile_url ? `<div class="field"><span class="lbl">Profile</span><span class="val"><a href="${escapeHtml(item.owner_profile_url)}" target="_blank">View</a></span></div>` : ""}
      <div class="field"><span class="lbl">Phone</span><span class="val">${escapeHtml(item.phone || "-")}</span></div>
      <div class="field"><span class="lbl">Transaction</span><span class="val">${escapeHtml(item.transaction || "-")}</span></div>
      <div class="field"><span class="lbl">Posted On</span><span class="val">${escapeHtml(item.posted_on || "-")}</span></div>
      ${item.description ? `<div class="field"><span class="lbl">Description</span><span class="val">${escapeHtml(item.description)}</span></div>` : ""}
      ${item.url ? `<div class="field"><span class="lbl">URL</span><span class="val" style="word-break:break-all;">${escapeHtml(item.url)}</span></div>` : ""}
      ${item.image_url ? `<div class="field"><span class="lbl">Image</span><span class="val"><a href="${escapeHtml(item.image_url)}" target="_blank">View</a></span></div>` : ""}
    </div>
  `;

  div.querySelector(".item-check").addEventListener("change", (e) => {
    e.stopPropagation();
    toggleSelection(idx, e.target.checked);
  });

  div.querySelector(".title").addEventListener("click", (e) => {
    e.stopPropagation();
    const detail = $(`detail-${idx}`);
    if (detail) detail.classList.toggle("open");
  });

  const pinEl = div.querySelector(".pin");
  pinEl.addEventListener("click", (e) => {
    e.stopPropagation();
    togglePin(item, idx, pinEl);
  });

  div.addEventListener("click", (e) => {
    if (e.target.type !== "checkbox" && !e.target.classList.contains("pin") && !e.target.closest(".prop-detail")) {
      const cb = div.querySelector(".item-check");
      cb.checked = !cb.checked;
      toggleSelection(idx, cb.checked);
    }
  });

  return div;
}

// --- Pinned properties ---
async function loadPins() {
  const result = await chrome.storage.local.get("pinnedProps");
  pinnedProps = result.pinnedProps || [];
}

function isPinned(item) {
  const key = item.url || item.title;
  return pinnedProps.some(p => (p.url || p.title) === key);
}

async function togglePin(item, idx, el) {
  const key = item.url || item.title;
  const existing = pinnedProps.findIndex(p => (p.url || p.title) === key);
  if (existing >= 0) {
    pinnedProps.splice(existing, 1);
    el.textContent = "☆";
    el.classList.remove("active");
    showToast("Unpinned", "success");
  } else {
    pinnedProps.unshift({ ...item, pinned_at: new Date().toISOString() });
    el.textContent = "★";
    el.classList.add("active");
    showToast("Pinned ⭐", "success");
  }
  await chrome.storage.local.set({ pinnedProps });
}

function renderPins() {
  const list = $("pinList");
  const search = ($("pinSearch").value || "").toLowerCase();
  if (!pinnedProps.length) {
    list.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:30px 10px;">No pins yet.</div>';
    return;
  }
  const filtered = search ? pinnedProps.filter(p =>
    (p.title || "").toLowerCase().includes(search) ||
    (p.location || "").toLowerCase().includes(search) ||
    (p.price || "").toLowerCase().includes(search)
  ) : pinnedProps;

  list.innerHTML = filtered.map((p, i) => `
    <div class="card" style="padding:6px 8px;margin-bottom:3px;">
      <div class="flex items-center" style="justify-content:space-between;">
        <div style="flex:1;min-width:0;">
          <div class="title" style="font-size:10px;">${escapeHtml(p.title || "-")}</div>
          <div class="text-xs text-muted">${[p.price, p.bhk, p.area, p.location].filter(Boolean).join(" · ")}</div>
        </div>
        <button class="btn btn-tiny btn-outline" onclick="removePin(${i})" style="flex-shrink:0;">✕</button>
      </div>
      ${p.phone ? `<div class="text-xs text-muted mt-1">📞 ${escapeHtml(p.phone)}</div>` : ""}
      ${p.url ? `<div class="text-xs text-muted truncate" style="max-width:400px;">${escapeHtml(p.url)}</div>` : ""}
    </div>
  `).join("");
}

async function removePin(idx) {
  pinnedProps.splice(idx, 1);
  await chrome.storage.local.set({ pinnedProps });
  renderPins();
  showToast("Removed", "success");
}

$("pinSearch").addEventListener("input", renderPins);

$("clearPinsBtn").addEventListener("click", async () => {
  if (!confirm("Clear all pinned properties?")) return;
  pinnedProps = [];
  await chrome.storage.local.set({ pinnedProps });
  renderPins();
  showToast("Pins cleared", "success");
});

$("exportPinsJsonBtn").addEventListener("click", async () => {
  if (!pinnedProps.length) { showToast("No pins to export", "error"); return; }
  const res = await chrome.runtime.sendMessage({ action: "downloadFile", data: { page_type: "pins", listings: pinnedProps }, format: "json" });
  if (res.success) showToast("Pins JSON exported", "success"); else showToast(res.error, "error");
});

$("exportPinsCsvBtn").addEventListener("click", async () => {
  if (!pinnedProps.length) { showToast("No pins to export", "error"); return; }
  const res = await chrome.runtime.sendMessage({ action: "downloadFile", data: { page_type: "pins", listings: pinnedProps }, format: "csv" });
  if (res.success) showToast("Pins CSV exported", "success"); else showToast(res.error, "error");
});

// --- Status check ---
async function updateStatus() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tabs[0];
  if (!currentTab?.url) { setStatus("No tab", "red"); $("scrapeBtn").disabled = true; return; }
  if (currentTab.url.includes("99acres.com")) {
    setStatus("Ready", "green"); $("scrapeBtn").disabled = false;
    const u = currentTab.url;
    if (u.includes("-ffid") || u.includes("search") || u.includes("flats-in")) $("pageType").textContent = "Listing";
    else if (u.includes("-spid-") || u.includes("-npspid-")) $("pageType").textContent = "Detail";
    else $("pageType").textContent = "Unknown";
  } else {
    setStatus("Not on 99acres.com", "red"); $("scrapeBtn").disabled = true; $("pageType").textContent = "";
  }
}

function setStatus(text, color) {
  $("statusText").textContent = text;
  $("statusDot").className = "dot " + color;
}

function showProgress(show) {
  $("progressWrap").className = `progress-wrap ${show ? "active" : ""}`;
  $("progressFill").className = `progress-fill ${show ? "indeterminate" : ""}`;
  $("progressFill").style.width = show ? "30%" : "0%";
  $("progressCount").textContent = show ? "0 found" : "";
}

// --- Scrape ---
$("scrapeBtn").addEventListener("click", async () => {
  if (!currentTab) return;
  const btn = $("scrapeBtn"), btnText = $("btnText"), btnIcon = $("btnIcon");
  const useAutoScroll = $("autoScrollCheck").checked;
  const keywords = $("keywordInput").value.split(",").map(k => k.trim()).filter(Boolean);

  btn.disabled = true; btnText.textContent = useAutoScroll ? "Scrolling..." : "Scraping...";
  btnIcon.innerHTML = '<span class="spinner"></span>';
  $("stopBtn").style.display = "block"; showProgress(true); setStatus("Scraping...", "yellow");

  $("resultArea").style.display = "block"; $("resultList").innerHTML = "";
  $("downloadActions").style.display = "none"; selectedIndices.clear(); lastScrapedData = null; streamCount = 0;

  try {
    try { await chrome.tabs.sendMessage(currentTab.id, { action: "ping" }); }
    catch {
      btnText.textContent = "Injecting scraper...";
      await chrome.scripting.executeScript({ target: { tabId: currentTab.id }, files: ["content.js"] });
      await new Promise(r => setTimeout(r, 400));
    }

    const config = await chrome.runtime.sendMessage({ action: "getConfig" });
    const u = currentTab.url;
    const isDetail = /\/property\/[\w-]+-spid-|99acres\.com\/[\w-]+(?:-\d+)?$/i.test(u);
    let data;

    if (useAutoScroll && !isDetail) {
      data = await chrome.tabs.sendMessage(currentTab.id, {
        action: "autoScrollScrape",
        maxScrolls: config.maxScrolls || 15,
        maxPages: config.maxPages || 3,
        keywords,
      });
    } else {
      data = await chrome.tabs.sendMessage(currentTab.id, { action: "scrape", keywords });
    }

    if (!data) throw new Error("No response from page.");

    const count = data.listings?.length || (data.property?.title ? 1 : 0);
    $("liveCount").textContent = count;
    $("totalCount").textContent = count;

    if (!data.listings?.length && !data.property?.title) {
      $("resultList").innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:20px;">No data found.</div>';
    } else {
      displayResults(data);
    }

    chrome.runtime.sendMessage({ action: "saveLastScrape", data });

    if (!lastScrapedData) lastScrapedData = data;
    else if (data.listings?.length) {
      const existingIds = new Set(lastScrapedData.listings.map(l => l.url || l.title));
      for (const item of data.listings) {
        const id = item.url || item.title;
        if (!existingIds.has(id)) { lastScrapedData.listings.push(item); existingIds.add(id); }
      }
    }

    $("downloadActions").style.display = "flex";
    updateSelectedCount();
    btnText.textContent = `Done! ${count} scraped`;
    showToast(`Scraped ${count} items`, "success");
    setStatus("Complete", "green");
    if ($("imageDownloadCheck").checked && lastScrapedData?.listings?.length) {
      const urls = lastScrapedData.listings.map(l => l.image_url).filter(Boolean);
      if (urls.length) {
        showToast(`Downloading ${urls.length} images...`, "success");
        chrome.runtime.sendMessage({ action: "downloadImages", urls }).catch(() => {});
      }
    }
  } catch (e) {
    btnText.textContent = "Error"; setStatus("Error", "red");
    showToast(e.message, "error"); console.error(e);
  }

  btnIcon.innerHTML = "&#9654;"; btn.disabled = false;
  $("stopBtn").style.display = "none"; showProgress(false);
  setTimeout(() => { btnText.textContent = "Scrape"; }, 3000);
});

$("stopBtn").addEventListener("click", async () => {
  if (!currentTab) return;
  $("stopBtn").disabled = true; $("stopBtn").textContent = "Stopping...";
  try { await chrome.tabs.sendMessage(currentTab.id, { action: "stopScrape" }); showToast("Stopped", "success"); }
  catch (e) { showToast("Stop failed", "error"); }
  $("stopBtn").disabled = false; $("stopBtn").textContent = "■ Stop";
});

// --- Export handlers ---
$("downloadJsonBtn").addEventListener("click", async () => { await exportFile("json"); });
$("downloadCsvBtn").addEventListener("click", async () => { await exportFile("csv"); });
$("downloadExcelBtn").addEventListener("click", async () => { await exportFile("excel"); });

async function exportFile(format) {
  if (!lastScrapedData) return;
  const data = getSelectedData();
  if (!data.listings?.length && !data.property?.title) { showToast("No items selected", "error"); return; }
  if (format === "excel") return exportExcel(data);
  const btn = format === "json" ? $("downloadJsonBtn") : $("downloadCsvBtn");
  btn.disabled = true;
  const res = await chrome.runtime.sendMessage({ action: "downloadFile", data, format });
  if (res.success) showToast(`${format.toUpperCase()} downloaded`, "success");
  else showToast(res.error, "error");
  btn.disabled = false;
}

async function exportExcel(data) {
  $("downloadExcelBtn").disabled = true;
  $("downloadExcelBtn").textContent = "Generating...";
  try {
    let rows = [];
    if (data.listings?.length) rows = data.listings;
    else if (data.property) rows = [data.property];
    if (!rows.length) { showToast("No data", "error"); return; }

    const res = await chrome.runtime.sendMessage({ action: "downloadExcel", data });
    if (res.success) showToast("Excel downloaded", "success");
    else showToast(res.error, "error");
  } catch (e) { showToast(e.message, "error"); }
  $("downloadExcelBtn").textContent = "Excel";
  $("downloadExcelBtn").disabled = false;
}

function getSelectedData() {
  if (!lastScrapedData) return null;
  const d = { ...lastScrapedData };
  if (d.listings?.length) {
    const sel = [...selectedIndices].sort((a, b) => a - b);
    d.listings = sel.map(i => d.listings[i]).filter(Boolean);
  }
  return d;
}

$("sendSelectedBtn").addEventListener("click", async () => {
  const data = getSelectedData();
  if (!data || (!data.listings?.length && !data.property?.title)) { showToast("No items selected", "error"); return; }
  $("sendSelectedBtn").disabled = true; $("sendSelectedBtn").textContent = "Sending...";
  const result = await chrome.runtime.sendMessage({ action: "sendScrapedData", data });
  if (result.success) showToast("Sent to Discord", "success");
  else showToast(result.error, "error");
  $("sendSelectedBtn").disabled = false; $("sendSelectedBtn").textContent = "📤 Discord";
  updateSelectedCount();
});

$("selectAllBtn2").addEventListener("click", selectAllItems);
$("deselectAllBtn2").addEventListener("click", deselectAllItems);

function selectAllItems() {
  document.querySelectorAll(".item-check").forEach(cb => { cb.checked = true; toggleSelection(parseInt(cb.dataset.idx), true); });
}

function deselectAllItems() {
  document.querySelectorAll(".item-check").forEach(cb => { cb.checked = false; toggleSelection(parseInt(cb.dataset.idx), false); });
}

$("saveHereBtn").addEventListener("click", async () => {
  if (!lastScrapedData) return;
  const data = getSelectedData();
  if (!data.listings?.length && !data.property?.title) { showToast("No items selected", "error"); return; }
  $("saveHereBtn").disabled = true; $("saveHereBtn").textContent = "Saving...";
  const res = await chrome.runtime.sendMessage({ action: "downloadFile", data, format: "json" });
  if (res.success) showToast("Saved!", "success"); else showToast(res.error, "error");
  $("saveHereBtn").textContent = "💾 Save Here"; $("saveHereBtn").disabled = false;
});

function updateSelectedCount() {
  const total = lastScrapedData?.listings?.length || 0;
  $("selectedCount").textContent = selectedIndices.size;
  $("totalCount").textContent = total;
}

function toggleSelection(idx, checked) {
  if (checked) selectedIndices.add(idx);
  else selectedIndices.delete(idx);
  updateSelectedCount();
}

function displayResults(data) {
  console.log("[99acres] displayResults called, listings:", data.listings?.length, "type:", data.page_type);
  selectedIndices.clear(); $("selectAllBtn2").style.display = "inline";
  $("resultArea").style.display = "block";

  if (data.page_type === "listing" && data.listings.length) {
    for (let i = 0; i < data.listings.length; i++) selectedIndices.add(i);
    let html = "";
    data.listings.forEach((item, idx) => {
      try {
        const title = escapeHtml(item.title || item.url || "-");
        const meta = [item.price, item.bhk, item.area, item.location].filter(Boolean).join(" · ");
        html += `<div class="prop-item"><input type="checkbox" class="item-check" data-idx="${idx}" checked><div class="info"><div class="title" data-idx="${idx}">${title}</div><div class="meta">${meta}</div></div></div>`;
      } catch (e) { console.error("[99acres] Error building item", idx, e); }
    });
    $("resultList").innerHTML = html;
    updateSelectedCount();
    console.log("[99acres] rendered via innerHTML, list children:", $("resultList").children.length);
    const dEl = $("debugInfo");
    if (dEl) { dEl.style.display = "block"; dEl.textContent = `List: ${$("resultList").children.length} items (of ${data.listings.length})`; }
    const fEl = $("fallbackBar");
    if (fEl) fEl.style.display = "block";
  } else if (data.property) {
    $("selectAllBtn2").style.display = "none";
    const pd = data.property;
    const div = document.createElement("div");
    div.className = "card"; div.style.padding = "6px 8px";
    let html = `<div style="font-weight:600;font-size:12px;margin-bottom:4px;">${escapeHtml(pd.title || "Property Details")}</div><div style="font-size:11px;">`;
    const fields = { ID: pd.property_id, Price: pd.price, Area: pd.area, BHK: pd.bhk, Bath: pd.bath, Floor: pd.floor, Facing: pd.facing, Status: pd.status, Furnished: pd.furnished, Possession: pd.possession, Parking: pd.parking, Location: pd.location, Society: pd.society, "Listed By": pd.listed_by, Phone: pd.phone, Seller: pd.seller_name, Posted: pd.posted_on };
    Object.entries(fields).forEach(([k, v]) => { if (v) html += `<div><span class="text-muted">${k}:</span> ${escapeHtml(v)}</div>`; });
    html += `</div>`;
    if (pd.description) html += `<div class="text-sm mt-1"><span class="text-muted">Description:</span> ${escapeHtml(pd.description.slice(0, 150))}...</div>`;
    if (pd.features?.length) html += `<div class="text-sm mt-1"><span class="text-muted">Features:</span> ${pd.features.slice(0, 8).join(", ")}${pd.features.length > 8 ? "..." : ""}</div>`;
    if (pd.owner_profile_url) html += `<div class="text-sm mt-1"><a href="${escapeHtml(pd.owner_profile_url)}" target="_blank">View Profile</a></div>`;
    if (pd.url) html += `<div class="text-sm mt-1 truncate" style="max-width:400px;"><span class="text-muted">URL:</span> ${escapeHtml(pd.url)}</div>`;
    div.innerHTML = html;
    list.appendChild(div);
  } else {
    list.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:20px;">No data found.</div>';
  }
}

// --- Filter presets ---
async function loadPresets() {
  const result = await chrome.storage.local.get("filterPresets");
  const presets = result.filterPresets || [];
  const sel = $("presetSelect");
  sel.innerHTML = '<option value="">— Save/load filters —</option>' +
    presets.map((p, i) => `<option value="${i}">${escapeHtml(p.name)}</option>`).join("");
  $("delPresetBtn").style.display = presets.length ? "inline-block" : "none";
}

$("savePresetBtn").addEventListener("click", async () => {
  const val = $("keywordInput").value.trim();
  if (!val) { showToast("Enter keywords first", "error"); return; }
  const name = prompt("Preset name:", val.split(",")[0].trim().slice(0, 30));
  if (!name) return;
  const result = await chrome.storage.local.get("filterPresets");
  const presets = result.filterPresets || [];
  presets.push({ name, keywords: val });
  if (presets.length > 20) presets.shift();
  await chrome.storage.local.set({ filterPresets: presets });
  await loadPresets();
  showToast(`Preset "${name}" saved`, "success");
});

$("presetSelect").addEventListener("change", async () => {
  const idx = parseInt($("presetSelect").value);
  if (isNaN(idx)) return;
  const result = await chrome.storage.local.get("filterPresets");
  const presets = result.filterPresets || [];
  const preset = presets[idx];
  if (preset) $("keywordInput").value = preset.keywords;
});

$("delPresetBtn").addEventListener("click", async () => {
  const idx = parseInt($("presetSelect").value);
  if (isNaN(idx)) return;
  const result = await chrome.storage.local.get("filterPresets");
  const presets = result.filterPresets || [];
  presets.splice(idx, 1);
  await chrome.storage.local.set({ filterPresets: presets });
  await loadPresets();
  showToast("Preset deleted", "success");
});

// --- History ---
async function loadHistory() {
  const history = await chrome.runtime.sendMessage({ action: "getHistory" });
  historyCache = history || [];
  allHistoryUrls = new Set();
  historyCache.forEach(h => {
    if (h.data?.listings) h.data.listings.forEach(l => { if (l.url) allHistoryUrls.add(l.url); });
  });
  renderHistory(historyCache);
}

function renderHistory(items) {
  const list = $("historyList");
  const search = ($("historySearch").value || "").toLowerCase();
  if (!items.length) { list.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:20px;">No history yet.</div>'; return; }
  const filtered = search ? items.filter(h =>
    (h.title || "").toLowerCase().includes(search) || (h.url || "").toLowerCase().includes(search) ||
    h.data?.listings?.some(l => (l.location || "").toLowerCase().includes(search))
  ) : items;
  list.innerHTML = filtered.map(h => `
    <div class="card" style="padding:6px 8px;margin-bottom:3px;">
      <div class="flex items-center" style="justify-content:space-between;">
        <div style="flex:1;min-width:0;">
          <div class="title" style="font-size:10px;">${escapeHtml(h.title || "Untitled")}</div>
          <div class="text-xs text-muted">${h.page_type === "listing" ? `${h.count} listings` : "Detail page"} · ${new Date(h.scraped_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
        </div>
        <div style="display:flex;gap:2px;flex-shrink:0;">
          <button class="btn btn-tiny btn-outline" onclick="viewHistory(${h.id})">View</button>
          <button class="btn btn-tiny btn-danger" onclick="deleteHistory(${h.id})">Del</button>
        </div>
      </div>
      <div class="text-xs text-muted truncate" style="max-width:400px;">${escapeHtml(h.url || "")}</div>
    </div>
  `).join("");
}

function viewHistory(id) {
  const h = historyCache.find(x => x.id === id);
  if (!h) return;
  selectedHistoryData = h.data; lastScrapedData = h.data;
  $("historyActions").style.display = "flex";
  displayResults(h.data); $("downloadActions").style.display = "flex";
  document.querySelector('[data-tab="scrape"]').click();
}

async function deleteHistory(id) {
  await chrome.runtime.sendMessage({ action: "deleteHistoryItem", id });
  await loadHistory(); showToast("Deleted", "success");
}

$("clearHistoryBtn").addEventListener("click", async () => {
  if (!confirm("Clear all history?")) return;
  await chrome.runtime.sendMessage({ action: "clearHistory" });
  await loadHistory(); showToast("History cleared", "success");
});

$("historySearch").addEventListener("input", () => renderHistory(historyCache));

$("historySaveBtn").addEventListener("click", async () => {
  if (!selectedHistoryData) { showToast("Click a history item first", "error"); return; }
  $("historySaveBtn").disabled = true; $("historySaveBtn").textContent = "Saving...";
  const res = await chrome.runtime.sendMessage({ action: "downloadFile", data: selectedHistoryData, format: "json" });
  if (res.success) showToast("Saved!", "success"); else showToast(res.error, "error");
  $("historySaveBtn").textContent = "💾 Save"; $("historySaveBtn").disabled = false;
});

$("historySendBtn").addEventListener("click", async () => {
  if (!selectedHistoryData) { showToast("Click a history item first", "error"); return; }
  $("historySendBtn").disabled = true; $("historySendBtn").textContent = "Sending...";
  const result = await chrome.runtime.sendMessage({ action: "sendScrapedData", data: selectedHistoryData });
  if (result.success) showToast("Sent to Discord", "success"); else showToast(result.error, "error");
  $("historySendBtn").disabled = false; $("historySendBtn").textContent = "📤 Discord";
});

// --- Settings ---
async function loadSettings() {
  const config = await chrome.runtime.sendMessage({ action: "getConfig" });
  if (config) {
    $("errorWebhook").value = config.errorWebhook || "";
    $("eventWebhook").value = config.eventWebhook || "";
    $("maxScrolls").value = config.maxScrolls || 15;
    $("maxPages").value = config.maxPages || 3;
    $("autoScrollCheck").checked = config.autoScroll !== false;
    $("imageDownloadCheck").checked = config.downloadImages === true;
  }
}

$("saveWebhooksBtn").addEventListener("click", async () => {
  const config = {
    errorWebhook: $("errorWebhook").value.trim(),
    eventWebhook: $("eventWebhook").value.trim(),
    maxScrolls: parseInt($("maxScrolls").value) || 15,
    maxPages: parseInt($("maxPages").value) || 3,
    autoScroll: $("autoScrollCheck").checked,
    downloadImages: $("imageDownloadCheck").checked,
  };
  await chrome.runtime.sendMessage({ action: "saveConfig", config });
  showToast("Settings saved", "success");
});

// --- Init ---
document.addEventListener("DOMContentLoaded", async () => {
  await updateStatus();
  await loadHistory();
  await loadSettings();
  await loadPresets();
  await loadPins();

  const last = await chrome.runtime.sendMessage({ action: "getLastScrape" });
  if (last && (last.listings?.length || last.property?.title)) {
    displayResults(last);
    lastScrapedData = last;
    $("downloadActions").style.display = "flex";
    updateSelectedCount();
    setStatus("Loaded last scrape (" + (last.listings?.length || 1) + " items)", "green");
  }
});

$("forceRenderBtn")?.addEventListener("click", async () => {
  if (lastScrapedData) {
    displayResults(lastScrapedData);
    showToast("Re-rendered " + (lastScrapedData.listings?.length || 1) + " items", "success");
  } else {
    const last = await chrome.runtime.sendMessage({ action: "getLastScrape" });
    if (last) {
      lastScrapedData = last;
      $("downloadActions").style.display = "flex";
      displayResults(last);
      updateSelectedCount();
      showToast("Loaded & rendered " + (last.listings?.length || 1) + " items", "success");
    } else {
      showToast("No data to render", "error");
    }
  }
});

$("testRenderBtn")?.addEventListener("click", () => {
  const list = $("resultList");
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 10; i++) {
    const div = document.createElement("div");
    div.className = "prop-item";
    div.innerHTML = `<input type="checkbox" checked><div class="info"><div class="title">Test Property ${i+1}</div><div class="meta">₹ 1.5 Cr · 3 BHK · 1200 sqft · Mumbai</div></div>`;
    frag.appendChild(div);
  }
  list.appendChild(frag);
  const dEl = $("debugInfo");
  if (dEl) { dEl.style.display = "block"; dEl.textContent = `List: ${list.children.length} items (test added 10)`; }
  $("resultArea").style.display = "block";
  showToast("Added 10 test items", "success");
});

$("showRawBtn")?.addEventListener("click", () => {
  if (!lastScrapedData) { showToast("No data to show", "error"); return; }
  const list = $("resultList");
  list.innerHTML = `<pre style="font-size:9px;white-space:pre-wrap;word-break:break-all;max-height:500px;overflow:auto;background:var(--card);padding:8px;border-radius:4px;">${escapeHtml(JSON.stringify(lastScrapedData, null, 2))}</pre>`;
  showToast("Showing raw JSON", "success");
});
