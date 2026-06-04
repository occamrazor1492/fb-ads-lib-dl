# Chrome Web Store Listing Draft

## Extension Name

Ads Library Media Saver

## Short Description

Add download buttons beside Meta Ads Library media you can access in Chrome.

## Detailed Description

Ads Library Media Saver helps researchers, marketers, and operators save media from Meta Ads Library pages they can already access in Chrome.

Open a Meta Ads Library page and the extension adds download buttons beside visible video and image creatives. Click the button next to the specific creative you want to save. You can also paste a Meta Ads Library link or refresh the current Ads Library tab from the popup if the page is still loading.

The extension detects media URLs already present in the loaded page data and asks Chrome to download the selected video or image asset locally.

The extension runs locally in Chrome. It has no backend service, does not use a shared Facebook account, and does not upload cookies, page content, or media URLs.

### Key Features

- Add download buttons beside visible Ads Library creatives.
- Refresh buttons on the current Ads Library tab.
- Open a pasted Meta Ads Library URL.
- Detect MP4 video assets and image assets.
- Prefer media from the clicked creative card when available.
- Save selected media locally through Chrome downloads.
- Store only the last pasted URL in local extension storage.

### Important Limitations

- Designed for user-selected downloads, not bulk scraping.
- Works only on Ads Library pages your browser session can access.
- Some ads expose separate video/audio tracks. This MVP does not merge separate tracks inside the extension.
- Some visible Meta video players use streaming blobs; in that case the extension falls back to URLs found near the creative card or in the loaded page data.
- Meta may change Ads Library internals, so detection may require future updates.

## Category

Productivity

## Language

English

## Permission Justifications

### downloads

Used only when the user clicks a download button. The extension asks Chrome to save the selected media URL to the user's local Downloads folder.

### scripting

Used to inject or refresh the scanner and inline download buttons on Meta Ads Library pages so the extension can inspect page data already loaded in the user's browser.

### storage

Used to remember the last pasted Ads Library URL locally in Chrome extension storage.

### tabs

Used to open the submitted Ads Library URL in a normal Chrome tab and to refresh the active Ads Library tab when the user clicks "Add page buttons."

### Host permissions

The extension requests access only to Meta Ads Library URL patterns:

- `https://www.facebook.com/ads/library*`
- `https://web.facebook.com/ads/library*`

These permissions allow the scanner and inline buttons to run on Ads Library pages opened by the user.

## Privacy Disclosure Draft

Data collection: No user data is collected, sold, shared, or transmitted.

Remote code: No remote code is loaded.

Remote server: No backend server is used.

Cookies: The extension uses the user's existing Chrome session but does not read, display, export, upload, or transmit cookie values.

Local storage: The extension stores only the last pasted Ads Library URL in Chrome local extension storage.

## Reviewer Notes

This extension has a single purpose: helping a user save media from Meta Ads Library pages they can already access. It does not automate bulk scraping, does not collect data, and does not send any data to an external server.

To test:

1. Load the extension.
2. Open a Meta Ads Library page containing visible image or video creatives.
3. Wait for ad cards to load.
4. Click the inline "Download video" or "Download image" button beside a creative.
5. If buttons are not visible yet, open the extension popup and click "Add page buttons."

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
