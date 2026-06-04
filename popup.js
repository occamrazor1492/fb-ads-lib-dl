const scanCurrentBtn = document.querySelector("#scanCurrentBtn");
const openLibraryBtn = document.querySelector("#openLibraryBtn");
const connectDriveBtn = document.querySelector("#connectDriveBtn");
const statusText = document.querySelector("#statusText");
const driveStatusText = document.querySelector("#driveStatusText");
const resultsPanel = document.querySelector("#resultsPanel");
const summary = document.querySelector("#summary");
const mediaList = document.querySelector("#mediaList");
const downloadBestBtn = document.querySelector("#downloadBestBtn");

let lastResult = null;
let driveStatus = null;

function setBusy(isBusy, text) {
  scanCurrentBtn.disabled = isBusy;
  openLibraryBtn.disabled = isBusy;
  connectDriveBtn.disabled = isBusy || driveStatus?.connected;
  statusText.textContent = text;
}

function extensionMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
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

function openExtensionPage(path) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url: chrome.runtime.getURL(path) }, tab => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(tab);
    });
  });
}

function escapeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);
}

function describeItem(item) {
  const parts = [];
  if (item.kind) parts.push(item.kind.toUpperCase());
  if (item.quality) parts.push(`${item.quality}p`);
  if (item.bitrate) parts.push(`${Math.round(item.bitrate / 1000)} kbps`);
  if (item.duration) parts.push(`${item.duration}s`);
  if (item.videoId) parts.push(`video ${item.videoId}`);
  return parts.join(" · ") || "Media";
}

function renderResult(result) {
  lastResult = result;
  const media = Array.isArray(result.media) ? result.media : [];
  const buttonCount = result.inlineButtons?.buttons || 0;
  resultsPanel.hidden = false;
  downloadBestBtn.disabled = !result.best;
  summary.textContent = media.length
    ? `${buttonCount || "Page"} action button group${buttonCount === 1 ? "" : "s"} added beside visible media.`
    : "No downloadable media was found on the loaded page.";

  mediaList.innerHTML = media.map((item, index) => `
    <article class="mediaItem">
      <div class="mediaTitle">
        <strong>${escapeText(describeItem(item))}</strong>
        <span class="pill">${escapeText(item.progressive ? "MP4" : item.kind || "media")}</span>
      </div>
      <div class="mediaMeta">${escapeText(item.filename || item.url)}</div>
      <div class="mediaActions">
        <button type="button" class="secondary" data-download-index="${index}">Download</button>
        <button type="button" class="secondary" data-save-index="${index}">Save</button>
      </div>
    </article>
  `).join("");
}

function renderDriveStatus(status) {
  driveStatus = status || {};

  if (!driveStatus.configured) {
    driveStatusText.textContent = "Google OAuth setup is required before users can connect.";
    connectDriveBtn.textContent = "Drive setup";
    connectDriveBtn.disabled = false;
    return;
  }

  if (driveStatus.connected) {
    driveStatusText.textContent = driveStatus.folderId
      ? "Connected. Uploads go to the Ads Library Media Saver folder."
      : "Connected. The upload folder will be created on first upload.";
    connectDriveBtn.textContent = "Connected";
    connectDriveBtn.disabled = true;
    return;
  }

  driveStatusText.textContent = "Connect your Google Drive to upload saved creatives.";
  connectDriveBtn.textContent = "Connect Drive";
  connectDriveBtn.disabled = false;
}

async function loadDriveStatus() {
  try {
    const response = await extensionMessage({ type: "GET_DRIVE_STATUS" });
    renderDriveStatus(response.status);
  } catch (error) {
    driveStatusText.innerHTML = `<span class="error">${escapeText(error.message)}</span>`;
    connectDriveBtn.disabled = true;
  }
}

async function connectDrive() {
  if (!driveStatus?.configured) {
    await openExtensionPage("drive-setup.html");
    return;
  }

  connectDriveBtn.disabled = true;
  connectDriveBtn.textContent = "Connecting...";
  driveStatusText.textContent = "Opening Google authorization...";

  try {
    const response = await extensionMessage({ type: "CONNECT_DRIVE" });
    renderDriveStatus(response.status);
    statusText.textContent = "Google Drive connected.";
  } catch (error) {
    driveStatusText.innerHTML = `<span class="error">${escapeText(error.message)}</span>`;
    connectDriveBtn.textContent = driveStatus?.configured ? "Connect Drive" : "Drive setup";
    connectDriveBtn.disabled = false;
  }
}

async function startScan() {
  setBusy(true, "Adding page buttons...");
  resultsPanel.hidden = true;
  mediaList.innerHTML = "";

  try {
    const response = await extensionMessage({
      type: "SCAN_CURRENT_TAB",
      url: ""
    });
    renderResult(response.result);
    statusText.textContent = response.result?.inlineButtons?.buttons
      ? "Buttons added beside visible media."
      : "Scan complete. Scroll the page if media is still loading.";
  } catch (error) {
    statusText.innerHTML = `<span class="error">${escapeText(error.message)}</span>`;
  } finally {
    setBusy(false, statusText.textContent || "Ready.");
  }
}

scanCurrentBtn.addEventListener("click", () => {
  startScan();
});

openLibraryBtn.addEventListener("click", async () => {
  try {
    await extensionMessage({ type: "OPEN_LIBRARY" });
  } catch (error) {
    statusText.innerHTML = `<span class="error">${escapeText(error.message)}</span>`;
  }
});

connectDriveBtn.addEventListener("click", connectDrive);

downloadBestBtn.addEventListener("click", async () => {
  if (!lastResult?.best) return;
  try {
    await extensionMessage({ type: "DOWNLOAD_ITEM", item: lastResult.best });
    statusText.textContent = "Download started.";
  } catch (error) {
    statusText.innerHTML = `<span class="error">${escapeText(error.message)}</span>`;
  }
});

loadDriveStatus();

mediaList.addEventListener("click", async event => {
  const button = event.target.closest("[data-download-index],[data-save-index]");
  if (!button || !lastResult) return;
  const index = button.dataset.downloadIndex ?? button.dataset.saveIndex;
  const item = lastResult.media[Number(index)];
  if (!item) return;
  try {
    if (button.dataset.saveIndex) {
      await extensionMessage({ type: "SAVE_ITEM", item });
      statusText.textContent = "Saved to library.";
    } else {
      await extensionMessage({ type: "DOWNLOAD_ITEM", item });
      statusText.textContent = "Download started.";
    }
  } catch (error) {
    statusText.innerHTML = `<span class="error">${escapeText(error.message)}</span>`;
  }
});
