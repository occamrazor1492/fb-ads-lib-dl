const SCAN_RETRY_COUNT = 8;
const SCAN_RETRY_DELAY_MS = 1500;
const LIBRARY_ITEMS_KEY = "libraryItems";
const DRIVE_SETTINGS_KEY = "driveSettings";
const DRIVE_FOLDER_NAME = "Ads Library Media Saver";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

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
    case "INSTALL_INLINE_BUTTONS":
      return { result: await installInlineButtonsCurrentTab() };
    case "DOWNLOAD_ITEM":
      await downloadItem(message.item);
      return {};
    case "SAVE_ITEM":
      return { item: await saveLibraryItem(message.item) };
    case "LIST_LIBRARY":
      return { items: await listLibraryItems() };
    case "UPDATE_LIBRARY_ITEM":
      return { item: await updateLibraryItem(message.itemId, message.patch) };
    case "DELETE_LIBRARY_ITEM":
      await deleteLibraryItem(message.itemId);
      return {};
    case "OPEN_LIBRARY":
      await chrome.tabs.create({ url: chrome.runtime.getURL("library.html") });
      return {};
    case "CONNECT_DRIVE":
      return { status: await connectDrive() };
    case "GET_DRIVE_STATUS":
      return { status: await getDriveStatus() };
    case "UPLOAD_ITEM_TO_DRIVE":
      return { item: await uploadLibraryItemToDrive(message.itemId) };
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
  const inlineButtons = await installInlineButtons(tabId);
  return {
    ...normalizeScanResult(lastResult, sourceUrl),
    inlineButtons
  };
}

async function installInlineButtonsCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) throw new Error("No active tab found.");
  normalizeFacebookUrl(tab.url);

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["scanner.js"]
  });

  return installInlineButtons(tab.id);
}

async function installInlineButtons(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.__adsLibraryMediaSaverInstallButtons?.()
    });
    return result || { ok: true, added: 0, buttons: 0 };
  } catch {
    return { ok: false, added: 0, buttons: 0 };
  }
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

  if (!isAdsLibraryPath(url)) {
    throw new Error("Open or paste a Meta Ads Library URL, such as https://www.facebook.com/ads/library/?id=...");
  }

  url.hostname = "www.facebook.com";
  url.protocol = "https:";
  return url.toString();
}

function isAdsLibraryPath(url) {
  const pathname = url.pathname.replace(/\/+$/, "");
  return pathname === "/ads/library";
}

function normalizeScanResult(result, sourceUrl) {
  const adId = result.adId || extractAdId(sourceUrl);
  const title = cleanName(result.title || "Meta Ads Library media");
  const media = (result.media || [])
    .map((item, index) => ({
      ...item,
      adId,
      title,
      sourceUrl,
      sourceLabel: item.sourceLabel || (adId ? `ad-${adId}` : title),
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

async function saveLibraryItem(rawItem) {
  if (!rawItem?.url) throw new Error("No media URL found to save.");

  const items = await listLibraryItems();
  const existingIndex = items.findIndex(item => item.url === rawItem.url);
  const existing = existingIndex >= 0 ? items[existingIndex] : null;
  const item = normalizeLibraryItem(rawItem, existing);

  if (existingIndex >= 0) {
    items[existingIndex] = item;
  } else {
    items.unshift(item);
  }

  await saveLibraryItems(items);
  return item;
}

async function listLibraryItems() {
  const data = await chrome.storage.local.get([LIBRARY_ITEMS_KEY]);
  return Array.isArray(data[LIBRARY_ITEMS_KEY]) ? data[LIBRARY_ITEMS_KEY] : [];
}

async function saveLibraryItems(items) {
  await chrome.storage.local.set({
    [LIBRARY_ITEMS_KEY]: items.slice(0, 1000)
  });
}

async function updateLibraryItem(itemId, patch = {}) {
  if (!itemId) throw new Error("No saved item was selected.");

  const items = await listLibraryItems();
  const index = items.findIndex(item => item.id === itemId);
  if (index === -1) throw new Error("Saved item was not found.");

  const current = items[index];
  const updated = {
    ...current,
    title: cleanLoose(patch.title ?? current.title).slice(0, 160),
    category: normalizeCategory(patch.category ?? current.category),
    tags: normalizeTags(patch.tags ?? current.tags),
    notes: cleanLoose(patch.notes ?? current.notes).slice(0, 1200),
    updatedAt: new Date().toISOString()
  };

  items[index] = updated;
  await saveLibraryItems(items);
  return updated;
}

async function deleteLibraryItem(itemId) {
  if (!itemId) throw new Error("No saved item was selected.");
  const items = await listLibraryItems();
  await saveLibraryItems(items.filter(item => item.id !== itemId));
}

function normalizeLibraryItem(rawItem, existing = null) {
  const now = new Date().toISOString();
  const item = {
    ...existing,
    ...rawItem,
    id: existing?.id || rawItem.id || createItemId(rawItem.url),
    url: rawItem.url,
    kind: rawItem.kind || existing?.kind || "media",
    title: cleanLoose(rawItem.title || existing?.title || "Meta Ads Library media").slice(0, 160),
    sourceUrl: cleanLoose(rawItem.sourceUrl || existing?.sourceUrl || ""),
    sourceLabel: cleanLoose(rawItem.sourceLabel || existing?.sourceLabel || "").slice(0, 160),
    adId: cleanLoose(rawItem.adId || existing?.adId || ""),
    videoId: cleanLoose(rawItem.videoId || existing?.videoId || ""),
    assetId: cleanLoose(rawItem.assetId || existing?.assetId || ""),
    filename: rawItem.filename || existing?.filename || buildFilename({
      item: rawItem,
      title: rawItem.title || existing?.title,
      adId: rawItem.adId || existing?.adId,
      index: 0
    }),
    category: normalizeCategory(rawItem.category || existing?.category),
    tags: normalizeTags(rawItem.tags ?? existing?.tags),
    notes: cleanLoose(rawItem.notes ?? existing?.notes ?? "").slice(0, 1200),
    savedAt: existing?.savedAt || now,
    updatedAt: now
  };

  if (existing?.driveFileId) item.driveFileId = existing.driveFileId;
  if (existing?.driveWebViewLink) item.driveWebViewLink = existing.driveWebViewLink;
  if (existing?.driveUploadedAt) item.driveUploadedAt = existing.driveUploadedAt;

  return item;
}

async function connectDrive() {
  ensureDriveConfigured();
  await getDriveToken(true);
  const settings = await getDriveSettings();
  const status = {
    configured: true,
    connected: true,
    folderId: settings.folderId || "",
    connectedAt: new Date().toISOString()
  };
  await chrome.storage.local.set({
    [DRIVE_SETTINGS_KEY]: {
      ...settings,
      connectedAt: status.connectedAt
    }
  });
  return status;
}

async function getDriveStatus() {
  const settings = await getDriveSettings();
  return {
    configured: isDriveConfigured(),
    connected: Boolean(settings.connectedAt),
    folderId: settings.folderId || "",
    folderLink: settings.folderLink || "",
    connectedAt: settings.connectedAt || ""
  };
}

async function uploadLibraryItemToDrive(itemId) {
  if (!itemId) throw new Error("Save the item before uploading it to Google Drive.");
  ensureDriveConfigured();

  const items = await listLibraryItems();
  const index = items.findIndex(item => item.id === itemId);
  if (index === -1) throw new Error("Saved item was not found.");

  const item = items[index];
  const token = await getDriveToken(true);
  const folder = await getOrCreateDriveFolder(token);
  const blob = await fetchMediaBlob(item);
  const upload = await uploadBlobToDrive({ token, blob, item, folderId: folder.id });
  const updated = {
    ...item,
    driveFileId: upload.id || "",
    driveWebViewLink: upload.webViewLink || "",
    driveUploadedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  items[index] = updated;
  await saveLibraryItems(items);
  return updated;
}

async function getOrCreateDriveFolder(token) {
  const settings = await getDriveSettings();
  if (settings.folderId) {
    return {
      id: settings.folderId,
      webViewLink: settings.folderLink || ""
    };
  }

  const response = await driveFetch(
    "https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8"
      },
      body: JSON.stringify({
        name: DRIVE_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder"
      })
    },
    token
  );
  const folder = await response.json();

  await chrome.storage.local.set({
    [DRIVE_SETTINGS_KEY]: {
      ...settings,
      folderId: folder.id || "",
      folderLink: folder.webViewLink || "",
      connectedAt: settings.connectedAt || new Date().toISOString()
    }
  });

  return folder;
}

async function uploadBlobToDrive({ token, blob, item, folderId }) {
  const mimeType = blob.type || mimeTypeForItem(item);
  const metadata = {
    name: item.filename || buildFilename({ item, title: item.title, adId: item.adId, index: 0 }),
    parents: folderId ? [folderId] : undefined
  };

  const session = await driveFetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mimeType,
        "X-Upload-Content-Length": String(blob.size)
      },
      body: JSON.stringify(metadata)
    },
    token
  );

  const uploadUrl = session.headers.get("Location");
  if (!uploadUrl) throw new Error("Google Drive did not return an upload URL.");

  const upload = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(blob.size)
    },
    body: blob
  });

  if (!upload.ok) {
    throw new Error(`Google Drive upload failed: ${await readResponseText(upload)}`);
  }

  return upload.json();
}

async function fetchMediaBlob(item) {
  try {
    const response = await fetch(item.url, { credentials: "include" });
    if (!response.ok) {
      throw new Error(`media request returned ${response.status}`);
    }
    return response.blob();
  } catch (error) {
    throw new Error(`Chrome could not read this media URL for Drive upload. Try downloading it locally first. ${error.message || error}`);
  }
}

async function driveFetch(url, options, token) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Google Drive request failed: ${await readResponseText(response)}`);
  }

  return response;
}

async function getDriveToken(interactive) {
  if (!chrome.identity?.getAuthToken) {
    throw new Error("Google Drive sign-in is unavailable in this Chrome profile.");
  }

  const result = await chrome.identity.getAuthToken({
    interactive,
    enableGranularPermissions: true,
    scopes: [DRIVE_SCOPE]
  });
  const token = typeof result === "string" ? result : result?.token;
  if (!token) throw new Error("Google Drive authorization did not return an access token.");
  return token;
}

async function getDriveSettings() {
  const data = await chrome.storage.local.get([DRIVE_SETTINGS_KEY]);
  return data[DRIVE_SETTINGS_KEY] || {};
}

function ensureDriveConfigured() {
  if (!isDriveConfigured()) {
    throw new Error("Google Drive is not configured yet. Add your Google OAuth Client ID to manifest.json before using Drive upload.");
  }
}

function isDriveConfigured() {
  const clientId = chrome.runtime.getManifest().oauth2?.client_id || "";
  return Boolean(clientId && !/REPLACE_WITH|YOUR_EXTENSION/i.test(clientId));
}

function buildFilename({ item, title, adId, index }) {
  const label = item.sourceLabel || title || "media";
  const parts = [
    "Ads Library",
    cleanName(label).slice(0, 70),
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

function cleanLoose(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCategory(value) {
  return cleanLoose(value || "Uncategorized").slice(0, 64) || "Uncategorized";
}

function normalizeTags(tags) {
  const values = Array.isArray(tags)
    ? tags
    : String(tags || "").split(",");

  const seen = new Set();
  const output = [];
  for (const tag of values) {
    const normalized = cleanLoose(tag).replace(/^#+/, "").slice(0, 40);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output.slice(0, 24);
}

function createItemId(url) {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `item-${Date.now()}-${Math.random().toString(36).slice(2)}-${hashString(url)}`;
}

function hashString(value) {
  let hash = 0;
  for (const char of String(value || "")) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function mimeTypeForItem(item) {
  if (item.kind === "video") return "video/mp4";
  const ext = imageExtension(item.url);
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

async function readResponseText(response) {
  const text = await response.text().catch(() => "");
  return text.slice(0, 500) || `${response.status} ${response.statusText}`;
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
