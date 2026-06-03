const SCAN_RETRY_COUNT = 8;
const SCAN_RETRY_DELAY_MS = 1500;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(result => sendResponse({ ok: true, ...result }))
    .catch(error => sendResponse({ ok: false, error: error.message || String(error) }));
  return true;
});

async function handleMessage(message) {
  switch (message?.type) {
    case "SCAN_URL":
      return { result: await scanUrl(message.url) };
    case "SCAN_CURRENT_TAB":
      return { result: await scanCurrentTab() };
    case "DOWNLOAD_ITEM":
      await downloadItem(message.item);
      return {};
    default:
      throw new Error("Unknown request.");
  }
}

async function scanUrl(rawUrl) {
  const url = normalizeFacebookUrl(rawUrl);
  await chrome.storage.local.set({ lastAdsLibraryUrl: url });
  const tab = await chrome.tabs.create({ url, active: true });
  await waitForTabLoad(tab.id);
  return scanTab(tab.id, url);
}

async function scanCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) throw new Error("No active tab found.");
  normalizeFacebookUrl(tab.url);
  return scanTab(tab.id, tab.url);
}

async function scanTab(tabId, sourceUrl) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["scanner.js"]
  });

  let lastResult = null;
  for (let attempt = 0; attempt < SCAN_RETRY_COUNT; attempt += 1) {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.__adsLibraryMediaSaverScan?.()
    });
    lastResult = result;
    if (result?.media?.length) break;
    await delay(SCAN_RETRY_DELAY_MS);
  }

  if (!lastResult) throw new Error("Could not scan this page.");
  return normalizeScanResult(lastResult, sourceUrl);
}

async function waitForTabLoad(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (tab.status === "complete") {
    await delay(2000);
    return;
  }

  await new Promise(resolve => {
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
  await delay(4000);
}

function normalizeFacebookUrl(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl || "").trim());
  } catch {
    throw new Error("Paste a valid Meta Ads Library or Facebook URL.");
  }

  const allowedHosts = new Set(["www.facebook.com", "web.facebook.com", "facebook.com"]);
  if (!allowedHosts.has(url.hostname)) {
    throw new Error("Only facebook.com Ads Library links are supported.");
  }

  url.hostname = "www.facebook.com";
  url.protocol = "https:";
  return url.toString();
}

function normalizeScanResult(result, sourceUrl) {
  const adId = result.adId || extractAdId(sourceUrl);
  const title = cleanName(result.title || "Meta Ads Library media");
  const media = (result.media || [])
    .map((item, index) => ({
      ...item,
      adId,
      title,
      filename: buildFilename({ item, title, adId, index })
    }))
    .sort(compareMedia);

  return {
    ...result,
    adId,
    sourceUrl,
    title,
    media,
    best: media.find(item => item.progressive && !item.audio) || media[0] || null
  };
}

function compareMedia(a, b) {
  if (a.progressive !== b.progressive) return a.progressive ? -1 : 1;
  if (a.audio !== b.audio) return a.audio ? 1 : -1;
  const qualityDiff = Number(b.quality || 0) - Number(a.quality || 0);
  if (qualityDiff) return qualityDiff;
  return Number(b.bitrate || 0) - Number(a.bitrate || 0);
}

async function downloadItem(item) {
  if (!item?.url) throw new Error("No download URL found.");
  const filename = item.filename || buildFilename({ item, title: item.title, adId: item.adId, index: 0 });
  await chrome.downloads.download({
    url: item.url,
    filename,
    saveAs: false,
    conflictAction: "uniquify"
  });
}

function buildFilename({ item, title, adId, index }) {
  const parts = [
    "Ads Library",
    cleanName(title || "media").slice(0, 70),
    adId || item.videoId || item.assetId || `item-${index + 1}`,
    item.quality ? `${item.quality}p` : "",
    item.audio ? "audio" : ""
  ].filter(Boolean);
  const ext = item.kind === "image" ? imageExtension(item.url) : "mp4";
  return `${parts.join(" - ")}.${ext}`;
}

function imageExtension(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith(".png")) return "png";
    if (pathname.endsWith(".webp")) return "webp";
    if (pathname.endsWith(".jpeg")) return "jpeg";
  } catch {
    // Use the default below when the URL cannot be parsed.
  }
  return "jpg";
}

function cleanName(value) {
  return String(value || "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "media";
}

function extractAdId(url) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("id") || parsed.searchParams.get("ad_id") || "";
  } catch {
    return "";
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
