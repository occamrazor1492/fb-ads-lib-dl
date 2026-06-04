# Google Drive Setup

Google Drive upload needs a Google OAuth Client ID for the published Chrome extension. The OAuth client ID is not a secret, but it must match the Chrome Web Store extension ID.

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

Open Credentials:

https://console.cloud.google.com/apis/credentials

Create an OAuth Client ID:

- Application type: `Chrome Extension`
- Application ID: `enfijcghckbajcdnckjjcibiphimfipi`

Copy the generated client ID.

## 5. Update manifest.json

Replace the placeholder in `manifest.json`:

```json
"oauth2": {
  "client_id": "REPLACE_WITH_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/drive.file"
  ]
}
```

with the real client ID from Google Cloud.

## 6. Repackage The Extension

Run:

```bash
./scripts/package-extension.sh
```

Upload the generated `ads-library-media-saver-v0.4.0.zip` to the Chrome Web Store draft.

## Notes For Store Review

- The extension uses Google sign-in only for optional Drive upload.
- The extension does not create a developer-hosted account or backend profile.
- Saved media records, tags, categories, and notes stay in local Chrome extension storage.
- When the user uploads to Drive, the selected media file is sent from Chrome to Google Drive through Google's API.
- Do not submit a package with the placeholder OAuth client ID if Drive upload is listed as a working feature.
