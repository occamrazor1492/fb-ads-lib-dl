(function installAdsLibraryMediaSaverScanner() {
  if (window.__adsLibraryMediaSaverScan) {
    window.__adsLibraryMediaSaverInstallButtons?.();
    return;
  }

  const GROUP_CLASS = "ads-library-media-saver-action-group";
  const BUTTON_CLASS = "ads-library-media-saver-action-button";
  const STYLE_ID = "ads-library-media-saver-inline-style";
  const HOST_ATTR = "data-ads-library-media-saver-host";
  const MEDIA_ATTR = "data-ads-library-media-saver-id";
  const BUTTON_ATTR = "data-ads-library-media-saver-button";
  const OBSERVER_KEY = "__adsLibraryMediaSaverObserver";
  const MIN_MEDIA_WIDTH = 120;
  const MIN_MEDIA_HEIGHT = 90;
  const MIN_MEDIA_AREA = 14000;

  let installTimer = 0;

  window.__adsLibraryMediaSaverScan = function scanAdsLibraryPage() {
    const html = document.documentElement?.innerHTML || "";
    const sourceUrl = location.href;
    const adId = extractAdId(sourceUrl);
    const title = document.title || "Meta Ads Library media";
    const scopedUrls = adId ? extractUrlsNearId(html, adId) : [];
    const allUrls = extractMediaUrls(html);
    const scopedMedia = dedupe(scopedUrls.map(toMediaItem).filter(Boolean), item => item.url);
    const media = dedupe(allUrls.map(toMediaItem).filter(Boolean), item => item.url);

    return {
      ok: true,
      title,
      adId,
      sourceUrl,
      media: scopedMedia.length ? scopedMedia : scopeMedia(media, adId),
      scannedAt: new Date().toISOString()
    };
  };

  window.__adsLibraryMediaSaverInstallButtons = installDownloadButtons;
  window.__adsLibraryMediaSaverResolveMedia = element => resolveMediaForElement(element);

  startInlineDownloader();

  function startInlineDownloader() {
    installInlineStyles();

    const start = () => {
      installDownloadButtons();
      observePage();
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      start();
    }

    window.addEventListener("scroll", scheduleInstall, { passive: true });
  }

  function observePage() {
    if (!document.body || window[OBSERVER_KEY]) return;

    const observer = new MutationObserver(mutations => {
      if (mutations.some(hasRelevantAddedNode)) scheduleInstall();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    window[OBSERVER_KEY] = observer;
  }

  function hasRelevantAddedNode(mutation) {
    return [...mutation.addedNodes].some(node => {
      if (node.nodeType !== Node.ELEMENT_NODE) return false;
      if (node.classList?.contains(GROUP_CLASS)) return false;
      if (node.classList?.contains(BUTTON_CLASS)) return false;
      if (node.closest?.(`.${GROUP_CLASS},.${BUTTON_CLASS}`)) return false;
      return node.matches?.("video,img,[style*='background-image']") ||
        node.querySelector?.("video,img,[style*='background-image']");
    });
  }

  function scheduleInstall() {
    clearTimeout(installTimer);
    installTimer = setTimeout(installDownloadButtons, 500);
  }

  function installDownloadButtons() {
    installInlineStyles();
    const mediaElements = getCandidateMediaElements();
    let added = 0;

    for (const mediaElement of mediaElements) {
      const mediaId = ensureMediaId(mediaElement);
      if (findButtonForMediaId(mediaId)) continue;

      const host = findButtonHost(mediaElement);
      if (!host) continue;

      prepareButtonHost(host);
      host.appendChild(createActionGroup(mediaId, mediaElement));
      added += 1;
    }

    cleanupOrphanButtons();
    return {
      ok: true,
      added,
      buttons: document.querySelectorAll(`.${GROUP_CLASS}`).length
    };
  }

  function installInlineStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .${GROUP_CLASS} {
        position: absolute;
        right: 10px;
        top: 10px;
        z-index: 2147483647;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        justify-content: flex-end;
        max-width: calc(100% - 20px);
        pointer-events: auto;
      }
      .${BUTTON_CLASS} {
        appearance: none;
        border: 0;
        border-radius: 6px;
        background: #0b57d0;
        color: #fff;
        cursor: pointer;
        font: 600 12px/1.2 Arial, sans-serif;
        min-height: 30px;
        padding: 8px 10px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.24);
        white-space: nowrap;
      }
      .${BUTTON_CLASS}:hover {
        background: #0842a0;
      }
      .${BUTTON_CLASS}[data-action="save"] {
        background: #137333;
      }
      .${BUTTON_CLASS}[data-action="save"]:hover {
        background: #0f5d2a;
      }
      .${BUTTON_CLASS}[data-action="drive"] {
        background: #5f6368;
      }
      .${BUTTON_CLASS}[data-action="drive"]:hover {
        background: #3c4043;
      }
      .${BUTTON_CLASS}:disabled {
        cursor: progress;
        opacity: 0.82;
      }
      [${HOST_ATTR}="1"] {
        isolation: isolate;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function getCandidateMediaElements() {
    return [...document.querySelectorAll("video,img,[style*='background-image']")]
      .filter(isLikelyCreativeElement);
  }

  function isLikelyCreativeElement(element) {
    if (element.closest(`.${GROUP_CLASS},.${BUTTON_CLASS}`)) return false;
    if (element.closest("[aria-label='Google Account']")) return false;

    const rect = element.getBoundingClientRect();
    if (rect.width < MIN_MEDIA_WIDTH || rect.height < MIN_MEDIA_HEIGHT) return false;
    if (rect.width * rect.height < MIN_MEDIA_AREA) return false;

    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
      return false;
    }

    const tag = element.tagName;
    if (tag === "IMG") {
      const url = element.currentSrc || element.src || "";
      const alt = element.alt || element.getAttribute("aria-label") || "";
      if (/emoji|static\.xx\.fbcdn\.net/i.test(url)) return false;
      if (/profile|avatar|logo|icon/i.test(alt) && rect.width < 180 && rect.height < 180) return false;
      if (element.naturalWidth && element.naturalWidth < MIN_MEDIA_WIDTH) return false;
      if (element.naturalHeight && element.naturalHeight < MIN_MEDIA_HEIGHT) return false;
    }

    if (tag !== "IMG" && tag !== "VIDEO") {
      return collectBackgroundImageUrls(element).some(isLikelyMediaUrl);
    }

    return true;
  }

  function ensureMediaId(element) {
    let id = element.getAttribute(MEDIA_ATTR);
    if (!id) {
      id = `alms-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      element.setAttribute(MEDIA_ATTR, id);
    }
    return id;
  }

  function findButtonForMediaId(mediaId) {
    return [...document.querySelectorAll(`.${GROUP_CLASS}`)]
      .find(group => group.getAttribute(BUTTON_ATTR) === mediaId);
  }

  function findMediaById(mediaId) {
    return [...document.querySelectorAll(`[${MEDIA_ATTR}]`)]
      .find(element => element.getAttribute(MEDIA_ATTR) === mediaId);
  }

  function findButtonHost(mediaElement) {
    let host = mediaElement.parentElement;
    if (!host) return null;

    if (host.tagName === "PICTURE") host = host.parentElement;
    while (host && /^(A|BUTTON)$/i.test(host.tagName)) host = host.parentElement;
    if (!host || host === document.body || host === document.documentElement) return null;

    const mediaRect = mediaElement.getBoundingClientRect();
    let best = host;
    let current = host;

    for (let depth = 0; current && current !== document.body && depth < 5; depth += 1) {
      if (/^(A|BUTTON)$/i.test(current.tagName)) {
        current = current.parentElement;
        continue;
      }

      const rect = current.getBoundingClientRect();
      const tooLarge = rect.width > Math.max(mediaRect.width * 3.5, 900) ||
        rect.height > Math.max(mediaRect.height * 4, 900);
      const mediaCount = current.querySelectorAll("video,img,[style*='background-image']").length;

      if (!tooLarge && mediaCount <= 4) best = current;
      current = current.parentElement;
    }

    return best;
  }

  function prepareButtonHost(host) {
    if (getComputedStyle(host).position === "static") {
      host.style.position = "relative";
    }
    host.setAttribute(HOST_ATTR, "1");
  }

  function createActionGroup(mediaId, mediaElement) {
    const group = document.createElement("div");
    const isVideo = mediaElement.tagName === "VIDEO";
    group.className = GROUP_CLASS;
    group.setAttribute(BUTTON_ATTR, mediaId);

    group.appendChild(createMediaActionButton({
      mediaId,
      mediaElement,
      action: "download",
      idleText: isVideo ? "Download video" : "Download image",
      busyText: "Finding..."
    }));
    group.appendChild(createMediaActionButton({
      mediaId,
      mediaElement,
      action: "save",
      idleText: "Save",
      busyText: "Saving..."
    }));
    group.appendChild(createMediaActionButton({
      mediaId,
      mediaElement,
      action: "drive",
      idleText: "Drive",
      busyText: "Uploading..."
    }));

    return group;
  }

  function createMediaActionButton({ mediaId, mediaElement, action, idleText, busyText }) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = BUTTON_CLASS;
    button.dataset.action = action;
    button.setAttribute("aria-label", idleText);
    button.textContent = idleText;

    button.addEventListener("click", async event => {
      event.preventDefault();
      event.stopPropagation();

      const currentMedia = findMediaById(mediaId) || mediaElement;
      button.disabled = true;
      button.textContent = busyText;

      try {
        const item = resolveMediaForElement(currentMedia);
        if (!item?.url) throw new Error("No downloadable media URL was found for this card.");
        await runMediaAction(action, item);
        button.textContent = successTextForAction(action);
        setTimeout(() => resetButton(button, idleText), action === "drive" ? 2200 : 1400);
      } catch (error) {
        button.textContent = errorTextForAction(action);
        button.title = error.message || String(error);
        setTimeout(() => resetButton(button, idleText), 2600);
      }
    }, true);

    return button;
  }

  async function runMediaAction(action, item) {
    if (action === "download") {
      await sendRuntimeMessage({ type: "DOWNLOAD_ITEM", item });
      return;
    }

    const saveResponse = await sendRuntimeMessage({ type: "SAVE_ITEM", item });
    if (action === "drive") {
      await sendRuntimeMessage({
        type: "UPLOAD_ITEM_TO_DRIVE",
        itemId: saveResponse.item?.id
      });
    }
  }

  function resetButton(button, text) {
    button.textContent = text;
    button.disabled = false;
  }

  function successTextForAction(action) {
    if (action === "save") return "Saved";
    if (action === "drive") return "Uploaded";
    return "Download started";
  }

  function errorTextForAction(action) {
    if (action === "save") return "Save failed";
    if (action === "drive") return "Drive setup";
    return "Not found";
  }

  function cleanupOrphanButtons() {
    for (const buttonGroup of document.querySelectorAll(`.${GROUP_CLASS}`)) {
      const mediaId = buttonGroup.getAttribute(BUTTON_ATTR);
      const mediaElement = findMediaById(mediaId);
      if (!mediaElement || !mediaElement.isConnected) buttonGroup.remove();
    }
  }

  function resolveMediaForElement(element) {
    const expectedKind = element.tagName === "VIDEO" ? "video" : "image";
    const card = findAdCard(element);
    const directUrls = collectDirectMediaUrls(element);
    const cardUrls = collectMediaUrlsFromElement(card);
    const directItems = directUrls.map(toMediaItem).filter(Boolean);
    const cardItems = cardUrls.map(toMediaItem).filter(Boolean);
    const cardIds = extractNumericIds(`${card?.innerText || ""} ${card?.outerHTML || ""}`);
    const pageItems = window.__adsLibraryMediaSaverScan().media || [];
    const idMatches = pageItems.filter(item =>
      (item.videoId && cardIds.has(item.videoId)) ||
      (item.assetId && cardIds.has(item.assetId))
    );

    let items = dedupe([...directItems, ...cardItems, ...idMatches], item => item.url);

    if (!items.length) {
      const sameKind = pageItems.filter(item => item.kind === expectedKind);
      if (sameKind.length === 1) items = sameKind;
    }

    const selected = chooseMediaItem(items, expectedKind);
    if (!selected) return null;

    return {
      ...selected,
      title: document.title || "Meta Ads Library media",
      sourceUrl: location.href,
      adId: extractAdId(location.href) || inferAdIdFromCard(card),
      sourceLabel: buildSourceLabel(card, element)
    };
  }

  function findAdCard(element) {
    let current = element;
    let best = element.parentElement;

    for (let depth = 0; current && current !== document.body && depth < 12; depth += 1) {
      const text = current.innerText || "";
      const rect = current.getBoundingClientRect();

      if (
        current.getAttribute("role") === "article" ||
        /Library ID|Ad details|Sponsored|Active|Inactive/i.test(text)
      ) {
        return current;
      }

      if (rect.width > 260 && rect.height > 220 && current.querySelector("video,img,[style*='background-image']")) {
        best = current;
      }

      current = current.parentElement;
    }

    return best;
  }

  function collectMediaUrlsFromElement(element) {
    if (!element) return [];
    const urls = new Set();
    const html = element.outerHTML || "";

    for (const url of extractMediaUrls(html)) urls.add(url);
    for (const mediaElement of element.querySelectorAll("video,img,source,[style*='background-image']")) {
      for (const url of collectDirectMediaUrls(mediaElement)) urls.add(url);
    }

    return [...urls];
  }

  function collectDirectMediaUrls(element) {
    const urls = new Set();

    for (const attr of ["currentSrc", "src", "poster"]) {
      const value = element[attr] || element.getAttribute?.(attr);
      if (value && isLikelyMediaUrl(value)) urls.add(cleanUrl(value));
    }

    for (const attr of ["srcset", "data-src", "data-store", "data-uri"]) {
      const value = element.getAttribute?.(attr);
      if (!value) continue;
      for (const url of parsePossibleUrls(value)) {
        if (isLikelyMediaUrl(url)) urls.add(cleanUrl(url));
      }
    }

    for (const source of element.querySelectorAll?.("source") || []) {
      for (const url of collectDirectMediaUrls(source)) urls.add(url);
    }

    for (const url of collectBackgroundImageUrls(element)) {
      if (isLikelyMediaUrl(url)) urls.add(cleanUrl(url));
    }

    return [...urls];
  }

  function collectBackgroundImageUrls(element) {
    const urls = [];
    const values = [
      element.style?.backgroundImage || "",
      getComputedStyle(element).backgroundImage || ""
    ];

    for (const value of values) {
      for (const match of String(value).matchAll(/url\((["']?)(.*?)\1\)/gi)) {
        urls.push(match[2]);
      }
    }

    return urls;
  }

  function parsePossibleUrls(value) {
    const decoded = decodeText(value);
    const output = [];
    const urlRe = /https?:\/\/[^\s"',)]+/gi;
    let match;

    while ((match = urlRe.exec(decoded))) {
      output.push(match[0]);
    }

    if (!output.length && decoded.includes(",")) {
      for (const part of decoded.split(",")) {
        const candidate = part.trim().split(/\s+/)[0];
        if (candidate) output.push(candidate);
      }
    }

    return output;
  }

  function chooseMediaItem(items, expectedKind) {
    if (!items.length) return null;

    const sameKind = items.filter(item => item.kind === expectedKind);
    const pool = sameKind.length ? sameKind : items;

    if (expectedKind === "image") {
      return pool.find(item => item.kind === "image") || pool[0];
    }

    return pool.slice().sort(compareMediaForDownload)[0];
  }

  function compareMediaForDownload(a, b) {
    if (a.kind !== b.kind) return a.kind === "video" ? -1 : 1;
    if (a.progressive !== b.progressive) return a.progressive ? -1 : 1;
    if (a.audio !== b.audio) return a.audio ? 1 : -1;
    const qualityDiff = Number(b.quality || 0) - Number(a.quality || 0);
    if (qualityDiff) return qualityDiff;
    return Number(b.bitrate || 0) - Number(a.bitrate || 0);
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
      if (!globalThis.chrome?.runtime?.sendMessage) {
        reject(new Error("Chrome extension messaging is unavailable on this page."));
        return;
      }

      chrome.runtime.sendMessage(message, response => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        if (response?.ok === false) {
          reject(new Error(response.error || "Request failed."));
          return;
        }
        resolve(response);
      });
    });
  }

  function extractAdId(url) {
    try {
      const parsed = new URL(url);
      return parsed.searchParams.get("id") || parsed.searchParams.get("ad_id") || "";
    } catch {
      return "";
    }
  }

  function inferAdIdFromCard(card) {
    const text = card?.innerText || "";
    return firstMatch(text, /Library ID[:\s]+(\d{8,25})/i) ||
      firstMatch(text, /\bAd ID[:\s]+(\d{8,25})/i) ||
      "";
  }

  function buildSourceLabel(card, element) {
    const adId = inferAdIdFromCard(card);
    if (adId) return `ad-${adId}`;

    const text = String(card?.innerText || "")
      .replace(/\s+/g, " ")
      .trim();
    if (text) return text.slice(0, 80);

    return element.tagName === "VIDEO" ? "video" : "image";
  }

  function extractNumericIds(text) {
    const ids = new Set();
    for (const match of String(text || "").matchAll(/\b\d{8,25}\b/g)) {
      ids.add(match[0]);
    }
    return ids;
  }

  function extractMediaUrls(text) {
    return [
      ...extractMp4Urls(text),
      ...extractImageUrls(text)
    ];
  }

  function extractUrlsNearId(text, id) {
    const output = new Set();
    const haystack = String(text || "");
    const needle = String(id || "");
    if (!needle) return [];

    let offset = 0;
    while (true) {
      const index = haystack.indexOf(needle, offset);
      if (index === -1) break;
      const start = Math.max(0, index - 600000);
      const end = Math.min(haystack.length, index + 900000);
      for (const url of extractMediaUrls(haystack.slice(start, end))) {
        output.add(url);
      }
      offset = index + needle.length;
      if (output.size > 40) break;
    }
    return [...output];
  }

  function extractMp4Urls(text) {
    const decoded = decodeText(text);
    const urls = new Set();
    const re = /https?:\\?\/\\?\/[^\s"'<>\\]+?\.mp4[^\s"'<>\\]*/gi;
    let match;
    while ((match = re.exec(decoded))) {
      urls.add(cleanUrl(match[0]));
    }
    return [...urls];
  }

  function extractImageUrls(text) {
    const decoded = decodeText(text);
    const urls = new Set();
    const re = /https?:\\?\/\\?\/[^\s"'<>\\]+?\.(?:jpg|jpeg|png|webp)[^\s"'<>\\]*/gi;
    let match;
    while ((match = re.exec(decoded))) {
      const url = cleanUrl(match[0]);
      if (/scontent-|fbcdn\.net/i.test(url) && !/emoji|static\.xx\.fbcdn\.net/i.test(url)) {
        urls.add(url);
      }
    }
    return [...urls];
  }

  function isLikelyMediaUrl(url) {
    const value = cleanUrl(url);
    if (!/^https?:\/\//i.test(value)) return false;
    if (/emoji|static\.xx\.fbcdn\.net|\/rsrc\.php/i.test(value)) return false;
    return /\.mp4(?:[?#]|$)/i.test(value) ||
      /\.(?:jpg|jpeg|png|webp)(?:[?#]|$)/i.test(value) ||
      /scontent-|fbcdn\.net/i.test(value);
  }

  function decodeText(value) {
    return String(value || "")
      .replace(/\\\//g, "/")
      .replace(/\\u0025/gi, "%")
      .replace(/\\u0026/gi, "&")
      .replace(/\\u003d/gi, "=")
      .replace(/\\u003a/gi, ":")
      .replace(/\\u002f/gi, "/")
      .replace(/&amp;/g, "&")
      .replace(/&#039;/g, "'")
      .replace(/&quot;/g, "\"");
  }

  function cleanUrl(rawUrl) {
    let url = decodeText(rawUrl);
    url = url.replace(/\\+$/g, "");
    try {
      return new URL(url, location.href).toString();
    } catch {
      return url;
    }
  }

  function toMediaItem(url) {
    const lower = url.toLowerCase();
    const kind = lower.includes(".mp4") ? "video" : "image";
    const efg = parseEfg(url);
    const parsed = safeUrl(url);
    const tag = parsed?.searchParams.get("tag") || "";
    const bitrateParam = Number(parsed?.searchParams.get("bitrate") || 0);
    const vencode = efg.vencode_tag || "";
    const audio = /audio/i.test(vencode) || /audio/i.test(tag);
    const progressive = kind === "video" && (
      /progressive/i.test(vencode) ||
      /progressive|sve_|h264-basic/i.test(tag) ||
      /_nc_sid=8bf8fe/i.test(url)
    );
    const quality = firstMatch(tag, /(\d{3,4})p/i) ||
      firstMatch(vencode, /(\d{3,4})p?/i) ||
      "";

    return {
      url,
      kind,
      videoId: String(efg.video_id || ""),
      assetId: String(efg.xpv_asset_id || ""),
      duration: efg.duration_s || null,
      bitrate: Number(efg.bitrate || bitrateParam || 0),
      quality,
      tag,
      vencode,
      progressive,
      audio
    };
  }

  function parseEfg(url) {
    try {
      const parsed = new URL(url);
      const value = parsed.searchParams.get("efg");
      if (!value) return {};
      const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
      return JSON.parse(atob(padded));
    } catch {
      return {};
    }
  }

  function safeUrl(url) {
    try {
      return new URL(url);
    } catch {
      return null;
    }
  }

  function firstMatch(value, regex) {
    const match = String(value || "").match(regex);
    return match?.[1] || "";
  }

  function scopeMedia(media, adId) {
    if (!adId) return media.slice(0, 20);

    const adIdMatches = media.filter(item => item.videoId === adId || item.assetId === adId);
    if (adIdMatches.length) return adIdMatches;

    const likelyVideoIds = inferVisibleVideoIds();
    if (!likelyVideoIds.size) return media.slice(0, 20);

    const visibleMatches = media.filter(item => likelyVideoIds.has(item.videoId) || likelyVideoIds.has(item.assetId));
    return visibleMatches.length ? visibleMatches : media.slice(0, 20);
  }

  function inferVisibleVideoIds() {
    const text = document.body?.innerText || "";
    const ids = new Set();
    for (const match of text.matchAll(/\b\d{12,20}\b/g)) {
      ids.add(match[0]);
    }
    return ids;
  }

  function dedupe(items, keyFn) {
    const seen = new Set();
    const output = [];
    for (const item of items) {
      const key = keyFn(item);
      if (seen.has(key)) continue;
      seen.add(key);
      output.push(item);
    }
    return output;
  }
})();
