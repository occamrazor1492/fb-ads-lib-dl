const itemsList = document.querySelector("#itemsList");
const emptyState = document.querySelector("#emptyState");
const itemTemplate = document.querySelector("#itemTemplate");
const librarySummary = document.querySelector("#librarySummary");
const driveStatus = document.querySelector("#driveStatus");
const messageBar = document.querySelector("#messageBar");
const refreshBtn = document.querySelector("#refreshBtn");
const connectDriveBtn = document.querySelector("#connectDriveBtn");
const searchInput = document.querySelector("#searchInput");
const categoryFilter = document.querySelector("#categoryFilter");
const tagFilter = document.querySelector("#tagFilter");
const clearFiltersBtn = document.querySelector("#clearFiltersBtn");

let savedItems = [];
let currentDriveStatus = null;

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

async function loadLibrary() {
  setLoading(true);
  try {
    const [libraryResponse, driveResponse] = await Promise.all([
      extensionMessage({ type: "LIST_LIBRARY" }),
      extensionMessage({ type: "GET_DRIVE_STATUS" })
    ]);
    savedItems = libraryResponse.items || [];
    currentDriveStatus = driveResponse.status || null;
    renderAll();
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    setLoading(false);
  }
}

function renderAll() {
  renderSummary();
  renderDriveStatus();
  renderFilters();
  renderItems();
}

function renderSummary() {
  const count = savedItems.length;
  librarySummary.textContent = `${count} saved item${count === 1 ? "" : "s"}`;
}

function renderDriveStatus() {
  driveStatus.className = "statusLine";
  connectDriveBtn.disabled = false;

  if (!currentDriveStatus?.configured) {
    driveStatus.classList.add("warning");
    driveStatus.textContent = "Google Drive setup required: add a Chrome extension OAuth Client ID in manifest.json.";
    connectDriveBtn.disabled = true;
    return;
  }

  if (currentDriveStatus.connected) {
    driveStatus.classList.add("ready");
    driveStatus.textContent = currentDriveStatus.folderId
      ? "Google Drive connected. Uploads will go to the Ads Library Media Saver folder."
      : "Google Drive connected. The upload folder will be created on first upload.";
    return;
  }

  driveStatus.classList.add("warning");
  driveStatus.textContent = "Google Drive is configured but not connected.";
}

function renderFilters() {
  const selectedCategory = categoryFilter.value;
  const selectedTag = tagFilter.value;
  const categories = uniqueSorted(savedItems.map(item => item.category || "Uncategorized"));
  const tags = uniqueSorted(savedItems.flatMap(item => item.tags || []));

  replaceOptions(categoryFilter, "All categories", categories);
  replaceOptions(tagFilter, "All tags", tags);

  if (categories.includes(selectedCategory)) categoryFilter.value = selectedCategory;
  if (tags.includes(selectedTag)) tagFilter.value = selectedTag;
}

function renderItems() {
  const filtered = getFilteredItems();
  itemsList.replaceChildren();

  emptyState.hidden = filtered.length > 0;
  if (!filtered.length) {
    emptyState.querySelector("h2").textContent = savedItems.length ? "No matching saved items" : "No saved media yet";
    emptyState.querySelector("p").textContent = savedItems.length
      ? "Adjust the filters to show more saved media."
      : "Open Meta Ads Library and click Save beside a creative.";
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const item of filtered) {
    fragment.appendChild(renderItem(item));
  }
  itemsList.appendChild(fragment);
}

function renderItem(item) {
  const node = itemTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.id = item.id;

  node.querySelector(".itemTitle").textContent = item.sourceLabel || item.title || "Meta Ads Library media";
  node.querySelector(".itemMeta").textContent = buildItemMeta(item);
  node.querySelector(".kindPill").textContent = item.kind || "media";
  node.querySelector('[data-field="category"]').value = item.category || "Uncategorized";
  node.querySelector('[data-field="tags"]').value = (item.tags || []).join(", ");
  node.querySelector('[data-field="notes"]').value = item.notes || "";

  const driveMeta = node.querySelector(".driveMeta");
  if (item.driveWebViewLink) {
    const link = document.createElement("a");
    link.href = item.driveWebViewLink;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = `Uploaded ${formatDate(item.driveUploadedAt)}`;
    driveMeta.replaceChildren(link);
  } else {
    driveMeta.textContent = "Not uploaded to Drive";
  }

  renderPreview(node.querySelector(".preview"), item);
  return node;
}

function renderPreview(preview, item) {
  preview.replaceChildren();
  if (item.kind === "image") {
    const image = document.createElement("img");
    image.alt = item.sourceLabel || item.title || "Saved creative";
    image.loading = "lazy";
    image.src = item.url;
    preview.appendChild(image);
    return;
  }

  if (item.kind === "video") {
    const video = document.createElement("video");
    video.controls = true;
    video.muted = true;
    video.preload = "metadata";
    video.src = item.url;
    preview.appendChild(video);
    return;
  }

  const fallback = document.createElement("div");
  fallback.className = "previewFallback";
  fallback.textContent = "MEDIA";
  preview.appendChild(fallback);
}

function getFilteredItems() {
  const query = searchInput.value.trim().toLowerCase();
  const category = categoryFilter.value;
  const tag = tagFilter.value;

  return savedItems.filter(item => {
    if (category && item.category !== category) return false;
    if (tag && !(item.tags || []).includes(tag)) return false;
    if (!query) return true;

    const haystack = [
      item.title,
      item.sourceLabel,
      item.adId,
      item.videoId,
      item.assetId,
      item.category,
      item.notes,
      ...(item.tags || [])
    ].join(" ").toLowerCase();
    return haystack.includes(query);
  });
}

function buildItemMeta(item) {
  const parts = [];
  if (item.adId) parts.push(`Ad ${item.adId}`);
  if (item.category) parts.push(item.category);
  if (item.savedAt) parts.push(`Saved ${formatDate(item.savedAt)}`);
  if (item.sourceUrl) parts.push(shortUrl(item.sourceUrl));
  return parts.join(" · ") || shortUrl(item.url);
}

async function handleItemAction(action, card, button) {
  const item = savedItems.find(saved => saved.id === card.dataset.id);
  if (!item) return;

  const originalText = button.textContent;
  button.disabled = true;

  try {
    if (action === "open-source") {
      await chrome.tabs.create({ url: item.sourceUrl || item.url });
      return;
    }

    if (action === "download") {
      button.textContent = "Starting...";
      await extensionMessage({ type: "DOWNLOAD_ITEM", item });
      showMessage("Download started.", "success");
      return;
    }

    if (action === "save-meta") {
      button.textContent = "Saving...";
      await extensionMessage({
        type: "UPDATE_LIBRARY_ITEM",
        itemId: item.id,
        patch: readCardPatch(card)
      });
      showMessage("Saved edits.", "success");
      await loadLibrary();
      return;
    }

    if (action === "upload-drive") {
      button.textContent = "Uploading...";
      await extensionMessage({ type: "UPLOAD_ITEM_TO_DRIVE", itemId: item.id });
      showMessage("Uploaded to Google Drive.", "success");
      await loadLibrary();
      return;
    }

    if (action === "delete") {
      if (!confirm("Delete this saved item?")) return;
      button.textContent = "Deleting...";
      await extensionMessage({ type: "DELETE_LIBRARY_ITEM", itemId: item.id });
      showMessage("Deleted.", "success");
      await loadLibrary();
    }
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    button.textContent = originalText;
    button.disabled = false;
  }
}

function readCardPatch(card) {
  return {
    category: card.querySelector('[data-field="category"]').value,
    tags: card.querySelector('[data-field="tags"]').value,
    notes: card.querySelector('[data-field="notes"]').value
  };
}

async function connectDrive() {
  connectDriveBtn.disabled = true;
  const originalText = connectDriveBtn.textContent;
  connectDriveBtn.textContent = "Connecting...";

  try {
    const response = await extensionMessage({ type: "CONNECT_DRIVE" });
    currentDriveStatus = response.status;
    renderDriveStatus();
    showMessage("Google Drive connected.", "success");
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    connectDriveBtn.textContent = originalText;
    connectDriveBtn.disabled = currentDriveStatus?.configured === false;
  }
}

function replaceOptions(select, firstLabel, values) {
  const first = document.createElement("option");
  first.value = "";
  first.textContent = firstLabel;
  select.replaceChildren(first);

  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function shortUrl(value) {
  try {
    const url = new URL(value);
    const id = url.searchParams.get("id") || url.searchParams.get("ad_id");
    return id ? `${url.hostname} ad ${id}` : url.hostname;
  } catch {
    return "";
  }
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function showMessage(text, kind = "success") {
  messageBar.hidden = false;
  messageBar.className = `messageBar ${kind}`;
  messageBar.textContent = text;
  clearTimeout(showMessage.timer);
  showMessage.timer = setTimeout(() => {
    messageBar.hidden = true;
  }, 4200);
}

function setLoading(isLoading) {
  refreshBtn.disabled = isLoading;
  searchInput.disabled = isLoading;
  categoryFilter.disabled = isLoading;
  tagFilter.disabled = isLoading;
}

itemsList.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  const card = event.target.closest(".item");
  if (!button || !card) return;
  handleItemAction(button.dataset.action, card, button);
});

refreshBtn.addEventListener("click", loadLibrary);
connectDriveBtn.addEventListener("click", connectDrive);

for (const control of [searchInput, categoryFilter, tagFilter]) {
  control.addEventListener("input", renderItems);
}

clearFiltersBtn.addEventListener("click", () => {
  searchInput.value = "";
  categoryFilter.value = "";
  tagFilter.value = "";
  renderItems();
});

loadLibrary();
