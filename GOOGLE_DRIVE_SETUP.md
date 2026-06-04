# Google Drive Setup

Google Drive upload uses `chrome.identity.launchWebAuthFlow` with a Google OAuth Web client. The OAuth client ID is not a secret, but every extension ID that runs Drive auth needs an authorized `chromiumapp.org` redirect URI.

The current extension already has a Web OAuth client configured in `background.js`. Use this document only if the Chrome Web Store extension ID changes, another local unpacked extension ID needs Drive testing, or a new Google Cloud project is needed.

Current Chrome Web Store extension ID:

```text
enfijcghckbajcdnckjjcibiphimfipi
```

## 1. Create Or Select A Google Cloud Project

Open Google Cloud Console and select the project you want to use for this extension:

https://console.cloud.google.com/

## 2. Enable The Drive API

Open the Google Drive API page and click `Enable`:

https://console.cloud.google.com/apis/library/drive.googleapis.com

## 3. Configure OAuth Consent

Open OAuth consent configuration:

https://console.cloud.google.com/apis/credentials/consent

Use an external user type if the extension will be used outside your Google Workspace organization.

Add this scope:

```text
https://www.googleapis.com/auth/drive.file
```

The `drive.file` scope lets the extension create and access files that the user chooses to create through the extension. It does not grant full Drive access.

## 4. Create The OAuth Client

Open OAuth clients:

https://console.cloud.google.com/auth/clients

Create an OAuth Client ID:

- Application type: `Web application`
- Name: `Ads Library Media Saver Drive WebAuthFlow`

Add authorized redirect URIs:

```text
https://enfijcghckbajcdnckjjcibiphimfipi.chromiumapp.org/drive
```

This URI is the Chrome Web Store extension. If Chrome assigns a local unpacked ID for development, add another URI in the same format:

```text
https://<extension-id>.chromiumapp.org/drive
```

Copy the generated Web client ID.

## 5. Update background.js

Replace the Web client ID in `background.js`:

```js
const DRIVE_OAUTH_CLIENT_ID = "430077276006-23lv6l53s2duv4gskmqohv5srhfoug2k.apps.googleusercontent.com";
```

with the real client ID from Google Cloud.

## Local Unpacked Testing

The extension uses `chrome.identity.getRedirectURL("drive")`, which resolves to:

```text
https://<current-extension-id>.chromiumapp.org/drive
```

If Drive auth fails with `redirect_uri_mismatch`, copy the redirect URI shown by the extension error and add it to the Web OAuth client's authorized redirect URIs in Google Cloud.

Google notes that OAuth client changes can take 5 minutes to a few hours to take effect. If the redirect URI was just added, reload the extension and try again later.

## 6. Repackage The Extension

Run:

```bash
./scripts/package-extension.sh
```

Upload the generated package to the Chrome Web Store draft.

## Notes For Store Review

- The extension uses Google sign-in only for optional Drive upload.
- The extension does not create a developer-hosted account or backend profile.
- Saved media records, tags, categories, and notes stay in local Chrome extension storage.
- When the user uploads to Drive, the selected media file is sent from Chrome to Google Drive through Google's API.
- Do not submit a package with a placeholder Web OAuth client ID if Drive upload is listed as a working feature.
