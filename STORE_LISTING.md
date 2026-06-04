# Chrome Web Store Listing Draft

## Extension Name

Ads Library Media Saver

## Short Description

Save, tag, download, and upload Meta Ads Library media you can access in Chrome.

## Detailed Description

Ads Library Media Saver helps researchers, marketers, and operators organize media from Meta Ads Library pages they can already access in Chrome.

Open a Meta Ads Library page and the extension adds Download, Save, and Drive buttons beside visible video and image creatives. Click the button next to the specific creative you want instead of working from an unlabeled result list.

Saved items appear in a local library where you can edit categories, tags, and notes, then filter by keyword, category, or tag. You can also download selected media locally through Chrome downloads. Optional Google Drive upload lets a user send a selected saved creative to their own Drive after Google authorization.

The extension runs in Chrome. It has no developer-controlled backend service, does not use a shared Facebook account, and does not upload cookies. Saved records stay in local Chrome extension storage unless the user chooses Google Drive upload.

### Key Features

- Add action buttons beside visible Ads Library creatives.
- Refresh buttons on the current Ads Library tab.
- Detect MP4 video assets and image assets.
- Prefer media from the clicked creative card when available.
- Save selected media locally through Chrome downloads.
- Save media records to a local library.
- Edit tags, categories, and notes.
- Filter saved creatives by keyword, tag, or category.
- Optionally upload selected saved media to the user's Google Drive.

### Important Limitations

- Designed for user-selected downloads, not bulk scraping.
- Works only on Ads Library pages your browser session can access.
- Some ads expose separate video/audio tracks. This MVP does not merge separate tracks inside the extension.
- Some visible Meta video players use streaming blobs; in that case the extension falls back to URLs found near the creative card or in the loaded page data.
- Meta may change Ads Library internals, so detection may require future updates.
- Google Drive upload requires a configured Google OAuth Client ID.

## Category

Productivity

## Language

English

## Permission Justifications

### downloads

Used only when the user clicks a download button. The extension asks Chrome to save the selected media URL to the user's local Downloads folder.

### identity

Used only for optional Google Drive authorization when the user clicks Connect Drive or Upload Drive.

### scripting

Used to inject or refresh the scanner and inline action buttons on Meta Ads Library pages so the extension can inspect page data already loaded in the user's browser.

### storage

Used to remember saved media records, tags, categories, notes, and Drive folder metadata locally in Chrome extension storage.

### tabs

Used to find and refresh the active Ads Library tab when the user clicks "Add page buttons" and to open the saved media library page.

### Host permissions

The extension requests these host permissions:

- `https://www.facebook.com/ads/library*`
- `https://web.facebook.com/ads/library*`
- `https://*.fbcdn.net/*`
- `https://*.fbsbx.com/*`
- `https://www.googleapis.com/*`

The Facebook Ads Library patterns allow the scanner and inline buttons to run on Ads Library pages opened by the user. Facebook CDN patterns are used only for selected media downloads and Drive uploads. The Google APIs pattern is used only for optional Google Drive upload.

## Privacy Disclosure Draft

Data collection: No user data is collected, sold, or shared with the developer.

Remote code: No remote code is loaded.

Remote server: No developer-controlled backend server is used.

Cookies: The extension uses the user's existing Chrome session but does not read, display, export, upload, or transmit cookie values.

Local storage: The extension stores saved media records, tags, categories, notes, and Drive folder metadata in Chrome local extension storage.

Google Drive: Optional. When a user connects Drive and uploads a saved item, the selected media file is sent from Chrome to the user's Google Drive through Google's APIs.

## Reviewer Notes

This extension has a single purpose: helping a user save media from Meta Ads Library pages they can already access. It does not automate bulk scraping, does not collect data, and does not send any data to an external server.

To test:

1. Load the extension.
2. Open a Meta Ads Library page containing visible image or video creatives.
3. Wait for ad cards to load.
4. Click the inline "Save" button beside a creative.
5. If buttons are not visible yet, open the extension popup and click "Add page buttons."
6. Open the popup and click "Library" to edit tags and categories.
7. If Google Drive OAuth is configured, click "Connect Drive" and "Upload Drive" for a saved item.

## Required Store Assets

Generated draft assets are in `store-assets/`:

- `screenshot-1280x800.png`
- `small-promo-440x280.png`
- `icon-128.png`

Before final submission, review the screenshots and replace them with product screenshots if desired.

## Support URL

https://github.com/occamrazor1492/fb-ads-lib-dl/issues

## Privacy Policy URL

https://occamrazor1492.github.io/fb-ads-lib-dl/privacy.html
