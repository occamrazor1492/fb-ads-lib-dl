# Ads Library Media Saver

Ads Library Media Saver is a Chrome Manifest V3 extension that adds local action buttons beside media on Meta Ads Library pages users can already access in their own browser session.

It runs in Chrome. There is no backend service, no shared Facebook account, and no cookie upload. Saved items, tags, categories, and notes are stored locally in Chrome extension storage. Google Drive upload is optional and requires the user to connect their own Google account.

## Features

- Add Download, Save, and Drive buttons beside visible Ads Library images and videos.
- Refresh buttons on the currently active Facebook Ads Library tab.
- Detect MP4 video assets and image assets already present in the loaded page data.
- Prefer media from the clicked creative card when one is available.
- Use Chrome's built-in downloads API to save selected media locally.
- Save media records to a local library.
- Edit categories, tags, and notes for saved creatives.
- Filter the local library by keyword, category, or tag.
- Upload a saved creative to the user's Google Drive after OAuth setup and user consent.

## Install Locally

1. Download or clone this repository.
2. Open `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the repository folder.
6. Pin `Ads Library Media Saver` from the Chrome extensions menu.

## Usage

1. Open a Meta Ads Library page.
2. Wait for the ad cards and media to load.
3. Click `Download video`, `Download image`, `Save`, or `Drive` beside the creative you want.
4. If buttons are not visible yet, open the extension popup and click `Add page buttons`.
5. Open `Library` from the popup to edit categories, tags, and notes.
6. Use `Upload Drive` in the library when Google Drive is configured.

If Facebook asks you to log in, complete the login in Chrome and scan again. The extension uses your own browser session and does not export your cookies.

## Google Drive

Drive upload uses Chrome's `identity` API and the Google Drive API with the `drive.file` scope. The extension cannot upload to Drive until you create a Google OAuth Client ID for the published Chrome extension ID and replace the placeholder in `manifest.json`.

See [GOOGLE_DRIVE_SETUP.md](GOOGLE_DRIVE_SETUP.md).

## Permissions

The extension requests:

- `downloads`: starts downloads when the user clicks a download button.
- `identity`: lets the user authorize Google Drive upload with their own Google account.
- `scripting`: refreshes the scanner and inline buttons on the current Facebook/Ads Library page.
- `storage`: saves media records, tags, categories, notes, and Drive folder metadata locally.
- `tabs`: opens the requested Ads Library tab and refreshes the active Ads Library tab.
- Facebook Ads Library host permissions: reads media URLs from Ads Library pages the user has opened and adds inline action buttons.
- Facebook CDN host permissions: reads a user-selected saved media URL when uploading that item to Drive.
- Google APIs host permission: uploads a user-selected saved media file to Google Drive.

## Privacy

The extension does not collect, sell, share, or transmit personal data to the developer. It does not have a server component. When the user chooses Google Drive upload, the selected media file is sent directly from Chrome to the user's Google Drive through Google's APIs. See [PRIVACY.md](PRIVACY.md) for the privacy policy.

## Limitations

- This is designed for user-selected downloads, not bulk scraping.
- Meta changes Ads Library page internals regularly, so the scanner may need maintenance.
- Some ads expose only separate DASH video/audio tracks. This MVP downloads exposed assets but does not merge separate tracks inside the extension.
- On video ads where Meta exposes only a streaming blob to the visible player, the button falls back to media URLs found near that card or in the loaded page data.
- The extension can only access content that the user's own browser session is allowed to load.
- Google Drive upload requires a configured OAuth Client ID and may fail when Meta serves a short-lived media URL that Chrome can no longer fetch.

## Development

The extension is plain HTML, CSS, and JavaScript:

- `manifest.json`: Chrome MV3 manifest.
- `background.js`: tab orchestration and downloads.
- `scanner.js`: page scanner and inline action button content script for Facebook pages.
- `popup.html`, `popup.css`, `popup.js`: popup UI.
- `library.html`, `library.css`, `library.js`: saved media library UI.

Quick checks:

```bash
node --check background.js
node --check popup.js
node --check scanner.js
node --check library.js
python3 -m json.tool manifest.json >/tmp/manifest-check.json
```

## Distribution Notes

Before publishing to the Chrome Web Store, prepare:

- Store icons and screenshots.
- A public privacy policy URL.
- A clear support contact.
- A policy review for Meta's terms and the Chrome Web Store Developer Program Policies.

See [STORE_LISTING.md](STORE_LISTING.md) for draft Chrome Web Store listing copy and review notes.
