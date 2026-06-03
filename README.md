# Ads Library Media Saver

Ads Library Media Saver is a Chrome Manifest V3 extension that helps users save media from Meta Ads Library pages they can already access in their own browser session.

It runs entirely in Chrome. There is no backend service, no shared Facebook account, and no cookie upload.

## Features

- Paste a Meta Ads Library URL and scan it in a normal Chrome tab.
- Scan the currently active Facebook Ads Library tab.
- Detect MP4 video assets and image assets already present in the loaded page data.
- Prefer the best progressive MP4 when one is available.
- Use Chrome's built-in downloads API to save selected media locally.
- Store only the last pasted Ads Library URL in local extension storage.

## Install Locally

1. Download or clone this repository.
2. Open `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the repository folder.
6. Pin `Ads Library Media Saver` from the Chrome extensions menu.

## Usage

1. Copy a Meta Ads Library ad link, ideally one containing `?id=...`.
2. Open the extension popup.
3. Paste the link and click `Scan`.
4. Wait for the Facebook tab to finish loading.
5. Click `Best MP4` or download a specific detected item.

If Facebook asks you to log in, complete the login in Chrome and scan again. The extension uses your own browser session and does not export your cookies.

## Permissions

The extension requests:

- `downloads`: starts downloads when the user clicks a download button.
- `scripting`: injects the scanner into the current Facebook/Ads Library page.
- `storage`: saves the last pasted URL locally.
- `tabs`: opens and scans the requested Ads Library tab.
- Facebook and Facebook CDN host permissions: reads media URLs from pages the user has opened.

## Privacy

The extension does not collect, sell, share, or transmit personal data. It does not have a server component. See [PRIVACY.md](PRIVACY.md) for the privacy policy draft.

## Limitations

- This is designed for single-ad workflows, not bulk scraping.
- Meta changes Ads Library page internals regularly, so the scanner may need maintenance.
- Some ads expose only separate DASH video/audio tracks. This MVP downloads exposed assets but does not merge separate tracks inside the extension.
- The extension can only access content that the user's own browser session is allowed to load.

## Development

The extension is plain HTML, CSS, and JavaScript:

- `manifest.json`: Chrome MV3 manifest.
- `background.js`: tab orchestration and downloads.
- `scanner.js`: page scanner injected into Facebook pages.
- `popup.html`, `popup.css`, `popup.js`: popup UI.

Quick checks:

```bash
node --check background.js
node --check popup.js
node --check scanner.js
python3 -m json.tool manifest.json >/tmp/manifest-check.json
```

## Distribution Notes

Before publishing to the Chrome Web Store, prepare:

- Store icons and screenshots.
- A public privacy policy URL.
- A clear support contact.
- A policy review for Meta's terms and the Chrome Web Store Developer Program Policies.
