(function installAdsLibraryMediaSaverScanner() {
  if (window.__adsLibraryMediaSaverScan) return;

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

  function extractAdId(url) {
    try {
      const parsed = new URL(url);
      return parsed.searchParams.get("id") || parsed.searchParams.get("ad_id") || "";
    } catch {
      return "";
    }
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
      return new URL(url).toString();
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
