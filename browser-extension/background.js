// Vanya Downloader Background Service Worker

let autoInterceptDownloads = true;

function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create(
      {
        id: "download-with-vanya",
        title: "Download with Vanya Downloader",
        contexts: ["link", "video", "audio", "image"]
      },
      () => {
        if (chrome.runtime.lastError) {
          console.debug("ContextMenu setup note:", chrome.runtime.lastError.message);
        }
      }
    );
  });
}

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenu();

  chrome.storage.local.get(['autoIntercept'], (res) => {
    if (res.autoIntercept !== undefined) {
      autoInterceptDownloads = res.autoIntercept;
    }
  });
});

chrome.runtime.onStartup.addListener(() => {
  setupContextMenu();
});

// Check if Vanya desktop app is active on port 18792
async function isDesktopAppRunning() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600);
    const res = await fetch("http://127.0.0.1:18792/ping", {
      method: "GET",
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

// Auto-wake Vanya Downloader using Chrome/Edge Native Messaging Host
async function wakeVanyaViaNativeMessaging(payload) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendNativeMessage(
        "com.vanya.downloader",
        { action: "launch", ...payload },
        (res) => {
          if (chrome.runtime.lastError) {
            console.debug("Native messaging note:", chrome.runtime.lastError.message);
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(res || { success: true });
          }
        }
      );
    } catch (e) {
      resolve({ success: false, error: e.message });
    }
  });
}

// Send download request to Vanya desktop app (with automatic on-demand launch)
async function sendToDesktopApp(url, filename, type = 'auto', quality = '', startImmediately = true) {
  if (!url || typeof url !== 'string') return { success: false, error: "Invalid URL provided." };
  const trimmed = url.trim();
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:') || trimmed.startsWith('filesystem:')) {
    return { success: false, error: "Blob and Data URLs are generated locally inside your web browser and cannot be downloaded by external applications." };
  }

  const payload = { url: trimmed, filename, type, quality, startImmediately };

  // 1. First attempt direct HTTP connection (fast path, <10ms if already running)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);
    const response = await fetch("http://127.0.0.1:18792/add-download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.debug("Vanya desktop app not immediately reachable. Triggering auto-launch...", err);
  }

  // 2. Vanya is not running! Trigger automatic background launch via Native Messaging
  const nativeRes = await wakeVanyaViaNativeMessaging(payload);
  console.log("Wake Vanya result:", nativeRes);

  // Poll port 18792 for up to 4 seconds while background process initializes
  for (let attempt = 0; attempt < 8; attempt++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const retryRes = await fetch("http://127.0.0.1:18792/add-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (retryRes.ok) {
        return await retryRes.json();
      }
    } catch {}
  }

  return {
    success: false,
    error: "Could not auto-start Vanya Downloader. Please ensure Vanya Downloader is installed."
  };
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.action === 'inspectVideo') {
    fetch('http://127.0.0.1:18792/inspect-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: request.url }),
    })
      .then((res) => res.json())
      .then((data) => sendResponse(data))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response
  }

  if (request && request.action === 'downloadMedia') {
    let mediaUrl = (request.url || '').trim();
    if (mediaUrl.startsWith('blob:') || mediaUrl.startsWith('data:')) {
      mediaUrl = sender.tab?.url || '';
    }

    sendToDesktopApp(
      mediaUrl,
      request.title,
      request.mediaType || 'video',
      request.quality || '',
      request.startImmediately !== false
    )
      .then((res) => {
        sendResponse(res);
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep message channel open for async response
  }
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "download-with-vanya") {
    let targetUrl = (info.linkUrl || info.srcUrl || info.pageUrl || tab?.url || '').trim();
    const isAudio = info.mediaType === 'audio';
    const isVideo = info.mediaType === 'video';

    if (targetUrl.startsWith('blob:') || targetUrl.startsWith('data:') || targetUrl.startsWith('filesystem:')) {
      targetUrl = (tab?.url || info.pageUrl || '').trim();
    }

    if (targetUrl) {
      await sendToDesktopApp(targetUrl, undefined, isAudio ? 'audio' : isVideo ? 'video' : 'file', '', true);
    }
  }
});

// Track recently opened tabs to auto-close dummy ad/blank popup pages
let recentTabCreated = null;
chrome.tabs.onCreated.addListener((tab) => {
  recentTabCreated = { id: tab.id, time: Date.now(), url: tab.url || tab.pendingUrl || '' };
});

// Intercept browser downloads automatically & close dummy download tabs
chrome.downloads.onCreated.addListener(async (downloadItem) => {
  try {
    const settings = await chrome.storage.local.get(['autoIntercept']);
    const isEnabled = settings.autoIntercept !== false;

    if (!isEnabled) return;

    const url = (downloadItem.finalUrl || downloadItem.url || '').trim();
    if (
      !url ||
      url.startsWith('blob:') ||
      url.startsWith('data:') ||
      url.startsWith('filesystem:') ||
      url.startsWith('chrome:') ||
      url.startsWith('chrome-extension:')
    ) {
      return; // Do NOT cancel or intercept blob/data/system downloads
    }

    // Only intercept standard web protocols
    const lowerUrl = url.toLowerCase();
    if (!lowerUrl.startsWith('http://') && !lowerUrl.startsWith('https://') && !lowerUrl.startsWith('ftp://')) {
      return;
    }

    // If a dummy tab was spawned within the last 3 seconds for this download, close it
    if (recentTabCreated && Date.now() - recentTabCreated.time < 3000) {
      try {
        chrome.tabs.get(recentTabCreated.id, (tab) => {
          if (
            tab &&
            (!tab.url ||
              tab.url === 'about:blank' ||
              tab.url.startsWith('chrome://') ||
              tab.url.includes(downloadItem.url) ||
              tab.url.toLowerCase().includes('download'))
          ) {
            chrome.tabs.remove(recentTabCreated.id);
          }
        });
      } catch (err) {
        console.debug('Tab close note:', err);
      }
    }

    // Cancel browser's native download and forward to Vanya Downloader (with auto-wake)
    chrome.downloads.cancel(downloadItem.id, () => {
      if (chrome.runtime.lastError) {
        console.debug('Cancel error:', chrome.runtime.lastError.message);
      }
      chrome.downloads.erase({ id: downloadItem.id }, async () => {
        if (chrome.runtime.lastError) {
          console.debug('Erase error:', chrome.runtime.lastError.message);
        }
        await sendToDesktopApp(url, downloadItem.filename, 'file', '', true);
      });
    });
  } catch (err) {
    console.debug('Download intercept error:', err);
  }
});
