// Vanya Downloader Content Script — IDM-style Video & Audio Detection with Live Stream Size Calculation

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function showToast(message, isSuccess = true) {
  try {
    const existing = document.querySelector('.vanya-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'vanya-toast';
    toast.innerHTML = `
      <span style="color: ${isSuccess ? '#38bdf8' : '#ef4444'}; font-size: 16px;">
        ${isSuccess ? '📥' : '⚠️'}
      </span>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast && toast.parentElement) {
        toast.style.transition = 'opacity 0.3s ease-out';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
      }
    }, 3500);
  } catch (err) {
    console.debug('Vanya toast error:', err);
  }
}

// Comprehensive IDM-Style downloadable file and archive extensions
const DOWNLOADABLE_EXTENSIONS = [
  // Executables, Installers & Mobile Packages
  '.exe', '.msi', '.apk', '.xapk', '.appx', '.msix', '.dmg', '.pkg', '.deb', '.rpm', '.jar', '.crx', '.xpi', '.bin', '.run',
  // Documents, Spreadsheets & E-Books
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.csv', '.epub', '.mobi', '.azw3', '.djvu', '.txt', '.rtf', '.odt', '.ods', '.odp',
  // Archives, Compressed & Disk Images
  '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.iso', '.img', '.vhd', '.vhdx', '.tgz', '.tbz2', '.z', '.cab', '.arj', '.lzh', '.ace',
  // Music & Audio Songs
  '.mp3', '.m4a', '.wav', '.aac', '.flac', '.ogg', '.wma', '.opus', '.mid', '.midi', '.aif', '.aiff', '.alac', '.ape',
  // Video Files & Movies
  '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.3gp', '.3g2', '.ts', '.m2ts', '.mts', '.vob', '.ogv',
  // Torrents & Other Data
  '.torrent', '.dat'
];

function isDownloadableUrl(urlStr, anchorElement) {
  if (!urlStr || typeof urlStr !== 'string') return false;
  const trimmed = urlStr.trim().toLowerCase();
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('filesystem:') ||
    trimmed.startsWith('chrome-extension:')
  ) {
    return false;
  }

  try {
    const parsed = new URL(urlStr, window.location.href);
    const protocol = parsed.protocol ? parsed.protocol.toLowerCase() : '';
    if (protocol !== 'http:' && protocol !== 'https:' && protocol !== 'ftp:') {
      return false;
    }

    const pathname = parsed.pathname.toLowerCase();

    // 1. Check direct file extension
    for (const ext of DOWNLOADABLE_EXTENSIONS) {
      if (pathname.endsWith(ext) || pathname.includes(ext + '?')) {
        return true;
      }
    }

    // 2. Check if anchor has download attribute
    if (anchorElement && anchorElement.hasAttribute('download')) {
      return true;
    }

    // 3. Check query parameters for direct download links
    const search = parsed.search.toLowerCase();
    if (
      search.includes('download=') ||
      search.includes('download=1') ||
      search.includes('download=true') ||
      search.includes('get_file') ||
      search.includes('dl=1') ||
      search.includes('format=mp3') ||
      search.includes('type=audio')
    ) {
      return true;
    }

    // 4. SongsPK, PagalWorld, and song portals download button text patterns
    if (anchorElement) {
      const text = (anchorElement.innerText || anchorElement.textContent || '').trim().toLowerCase();
      const href = parsed.href.toLowerCase();
      if (
        (text.includes('download') || text.includes('320 kbps') || text.includes('128 kbps') || text.includes('mp3 song')) &&
        (href.includes('.mp3') || href.includes('audio') || href.includes('song') || href.includes('download') || href.includes('stream') || href.includes('file'))
      ) {
        return true;
      }
    }
  } catch (e) {
    return false;
  }

  return false;
}

// Global Capture-Phase Link Interception: Intercepts clicks on direct download links and blocks dummy/ad popup tabs!
document.addEventListener(
  'click',
  (e) => {
    const anchor = e.target.closest('a');
    if (!anchor) return;

    const rawHref = (anchor.getAttribute('href') || '').trim();
    if (!rawHref) return;

    const rawHrefLower = rawHref.toLowerCase();
    if (
      rawHrefLower.startsWith('blob:') ||
      rawHrefLower.startsWith('data:') ||
      rawHrefLower.startsWith('filesystem:') ||
      rawHrefLower.startsWith('javascript:') ||
      rawHrefLower.startsWith('#') ||
      rawHrefLower.startsWith('mailto:')
    ) {
      return; // Do NOT preventDefault or intercept blob/data URLs - let the browser save dynamically generated PDFs & files!
    }

    const fullHref = anchor.href || '';
    const fullHrefLower = fullHref.toLowerCase();
    if (
      fullHrefLower.startsWith('blob:') ||
      fullHrefLower.startsWith('data:') ||
      fullHrefLower.startsWith('filesystem:')
    ) {
      return;
    }

    if (isDownloadableUrl(fullHref, anchor)) {
      // Prevent the browser from navigating or opening dummy popup ad tabs!
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const hrefLower = fullHref.toLowerCase();
      const textLower = (anchor.innerText || '').toLowerCase();

      const isAudio =
        hrefLower.includes('.mp3') ||
        hrefLower.includes('.m4a') ||
        hrefLower.includes('.wav') ||
        hrefLower.includes('.aac') ||
        hrefLower.includes('.flac') ||
        textLower.includes('kbps') ||
        textLower.includes('song') ||
        textLower.includes('mp3');

      const isVideo =
        hrefLower.includes('.mp4') ||
        hrefLower.includes('.mkv') ||
        hrefLower.includes('.avi') ||
        hrefLower.includes('.webm') ||
        hrefLower.includes('.mov');

      sendDownloadToVanya(fullHref, isAudio ? 'audio' : isVideo ? 'video' : 'file', '', true);
    }
  },
  true // Use capture phase so we run BEFORE website's popup ad scripts
);

function getMediaDownloadUrl(element, isAudio = false) {
  const hostname = window.location.hostname;
  const isVideoPlatform =
    hostname.includes('youtube.com') ||
    hostname.includes('youtu.be') ||
    hostname.includes('vimeo.com') ||
    hostname.includes('twitter.com') ||
    hostname.includes('x.com') ||
    hostname.includes('tiktok.com') ||
    hostname.includes('instagram.com') ||
    hostname.includes('facebook.com') ||
    hostname.includes('dailymotion.com');

  const isAudioPlatform =
    hostname.includes('soundcloud.com') ||
    hostname.includes('spotify.com') ||
    hostname.includes('bandcamp.com') ||
    hostname.includes('gaana.com') ||
    hostname.includes('jiosaavn.com');

  if (isVideoPlatform || isAudioPlatform) {
    return window.location.href;
  }

  const rawSrc = (element.currentSrc || element.src || '').trim();
  if (
    !rawSrc ||
    rawSrc.startsWith('blob:') ||
    rawSrc.startsWith('data:') ||
    rawSrc.startsWith('mediasource:') ||
    rawSrc.startsWith('filesystem:')
  ) {
    // Media uses in-memory blob / MSE buffer — pass the actual webpage URL so yt-dlp / extractor parses the video stream!
    return window.location.href;
  }

  return rawSrc;
}

function triggerBrowserNativeDownload(url) {
  if (!url) return;
  try {
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', '');
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try { a.remove(); } catch {}
    }, 1000);
  } catch {
    try { window.open(url, '_blank'); } catch {}
  }
}

function sendDownloadToVanya(targetUrl, mediaType, quality = '', startImmediately = false, formatId = '') {
  try {
    let finalTarget = (targetUrl || '').trim();
    if (!finalTarget || finalTarget.startsWith('blob:') || finalTarget.startsWith('data:')) {
      finalTarget = window.location.href;
    }

    if (!chrome.runtime?.id) {
      triggerBrowserNativeDownload(finalTarget);
      return;
    }

    chrome.runtime.sendMessage(
      {
        action: 'downloadMedia',
        url: finalTarget,
        title: document.title,
        mediaType: mediaType,
        quality: quality,
        formatId: formatId,
        startImmediately: startImmediately,
      },
      (response) => {
        if (chrome.runtime.lastError || !response || !response.success) {
          // If Vanya desktop app is closed or offline, smoothly fallback to native browser download!
          console.debug('Vanya Downloader offline, allowing native browser download:', finalTarget);
          triggerBrowserNativeDownload(finalTarget);
          return;
        }

        showToast(
          startImmediately
            ? `⚡ Started ${quality || ''} download in Vanya Downloader!`
            : 'Opening format selector in Vanya Downloader...'
        );
      }
    );
  } catch (err) {
    console.debug('Send download error:', err);
    triggerBrowserNativeDownload(targetUrl);
  }
}

function estimateMediaDuration() {
  try {
    const video = document.querySelector('video');
    if (video && video.duration && !isNaN(video.duration) && video.duration > 0) {
      return video.duration;
    }
    const audio = document.querySelector('audio');
    if (audio && audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
      return audio.duration;
    }
    const ytDur = document.querySelector('.ytp-time-duration');
    if (ytDur && ytDur.textContent) {
      const parts = ytDur.textContent.trim().split(':').map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return parts[0] * 60 + parts[1];
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2]))
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
  } catch {}
  return 0;
}

function createDropdownMenu(wrapper, targetUrl, isAudio) {
  // Remove existing open menus
  document.querySelectorAll('.vanya-dropdown-menu').forEach((d) => d.remove());

  const menu = document.createElement('div');
  menu.className = 'vanya-dropdown-menu';

  const dur = estimateMediaDuration();

  // Base list of video formats with instant realistic calculated MB sizes
  const videoItems = [
    {
      label: '1. 1080p Full HD',
      res: '1080p',
      ext: 'MP4',
      size: dur > 0 ? `~${Math.max(1, Math.round(dur * 0.44))} MB` : '1080p MP4',
      formatId: 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
    },
    {
      label: '2. 720p HD',
      res: '720p',
      ext: 'MP4',
      size: dur > 0 ? `~${Math.max(1, Math.round(dur * 0.22))} MB` : '720p MP4',
      formatId: 'bestvideo[height<=720]+bestaudio/best[height<=720]',
    },
    {
      label: '3. 480p SD',
      res: '480p',
      ext: 'MP4',
      size: dur > 0 ? `~${Math.max(1, Math.round(dur * 0.11))} MB` : '480p MP4',
      formatId: 'bestvideo[height<=480]+bestaudio/best[height<=480]',
    },
    {
      label: '4. 360p Fast',
      res: '360p',
      ext: 'MP4',
      size: dur > 0 ? `~${Math.max(1, Math.round(dur * 0.06))} MB` : '360p MP4',
      formatId: 'bestvideo[height<=360]+bestaudio/best[height<=360]',
    },
  ];

  // Base list of audio formats with instant realistic calculated MB sizes
  const audioItems = [
    {
      label: '1. High Quality 320 kbps',
      quality: '320k',
      ext: 'MP3',
      size: dur > 0 ? `~${(dur * 0.04).toFixed(1)} MB` : '320k MP3',
      formatId: 'bestaudio[abr<=320]/bestaudio/best',
    },
    {
      label: '2. Standard 256 kbps',
      quality: '256k',
      ext: 'MP3',
      size: dur > 0 ? `~${(dur * 0.032).toFixed(1)} MB` : '256k MP3',
      formatId: 'bestaudio[abr<=256]/bestaudio/best',
    },
    {
      label: '3. Normal 192 kbps',
      quality: '192k',
      ext: 'MP3',
      size: dur > 0 ? `~${(dur * 0.024).toFixed(1)} MB` : '192k MP3',
      formatId: 'bestaudio[abr<=192]/bestaudio/best',
    },
    {
      label: '4. Compact 128 kbps',
      quality: '128k',
      ext: 'MP3',
      size: dur > 0 ? `~${(dur * 0.016).toFixed(1)} MB` : '128k MP3',
      formatId: 'bestaudio[abr<=128]/bestaudio/best',
    },
  ];

  function renderMenuContent() {
    if (isAudio) {
      // ONLY show Audio streaming for audio files (IDM behavior)
      menu.innerHTML = `
        <div class="vanya-dropdown-header" style="color: #c084fc;">
          <span>🎵 AUDIO STREAMS</span>
          <span style="cursor:pointer; font-size:13px;" id="vanyaCloseMenu">✕</span>
        </div>

        <div class="vanya-dropdown-section-title">🎵 Audio Quality (MP3)</div>
        ${audioItems
          .map(
            (a) => `
          <div class="vanya-dropdown-item" data-type="audio" data-quality="${a.quality}" data-format-id="${a.formatId || ''}">
            <span class="vanya-item-label">${a.label}</span>
            <span class="vanya-item-badge" style="color: #c084fc; border-color: rgba(192, 132, 252, 0.4);">${a.size || a.ext}</span>
          </div>
        `
          )
          .join('')}

        <div class="vanya-dropdown-divider"></div>

        <div class="vanya-dropdown-item vanya-full-selector" id="vanyaFullModal" style="color: #c084fc; border-color: rgba(192, 132, 252, 0.3);">
          <span class="vanya-item-label">⚡ Open in Vanya App (Audio Tracks)</span>
        </div>
      `;
    } else {
      // ONLY show Video streaming for video files (IDM behavior)
      menu.innerHTML = `
        <div class="vanya-dropdown-header">
          <span>🎬 VIDEO STREAMS</span>
          <span style="cursor:pointer; font-size:13px;" id="vanyaCloseMenu">✕</span>
        </div>

        <div class="vanya-dropdown-section-title">🎬 Video Quality (MP4)</div>
        ${videoItems
          .map(
            (v) => `
          <div class="vanya-dropdown-item" data-type="video" data-quality="${v.res}" data-format-id="${v.formatId || ''}">
            <span class="vanya-item-label">${v.label}</span>
            <span class="vanya-item-badge">${v.size || v.ext}</span>
          </div>
        `
          )
          .join('')}

        <div class="vanya-dropdown-divider"></div>

        <div class="vanya-dropdown-item vanya-full-selector" id="vanyaFullModal">
          <span class="vanya-item-label">⚡ Open in Vanya App (All Video Formats)</span>
        </div>
      `;
    }

    // Reattach listeners
    menu.querySelectorAll('.vanya-dropdown-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.remove();

        if (item.id === 'vanyaFullModal') {
          sendDownloadToVanya(targetUrl, isAudio ? 'audio' : 'video', '', false);
        } else {
          const type = item.getAttribute('data-type') || (isAudio ? 'audio' : 'video');
          const quality = item.getAttribute('data-quality') || '';
          const formatId = item.getAttribute('data-format-id') || '';
          sendDownloadToVanya(targetUrl, type, quality, true, formatId);
        }
      });
    });

    menu.querySelector('#vanyaCloseMenu')?.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.remove();
    });
  }

  // Initial render with calculating badges
  renderMenuContent();

  // Asynchronously query live exact stream sizes from Vanya Downloader backend
  try {
    if (chrome.runtime?.id) {
      chrome.runtime.sendMessage({ action: 'inspectVideo', url: targetUrl }, (res) => {
        if (chrome.runtime.lastError) return;

        if (res && res.success) {
          const vFormats = res.videoFormats || [];
          const aFormats = res.audioFormats || [];

          if (isAudio) {
            // Map real sizes to audio items
            audioItems.forEach((a) => {
              const match = aFormats.find(
                (f) => f.quality?.includes(a.quality) || f.qualityLabel?.includes(a.quality) || f.bitrate?.includes(a.quality)
              );
              if (match) {
                a.formatId = match.formatId;
                const bytes = match.filesize || match.filesizeApprox;
                if (bytes > 0) {
                  a.size = `${formatBytes(bytes)}`;
                } else {
                  a.size = 'MP3';
                }
              } else {
                a.size = 'MP3';
              }
            });
          } else {
            // Map real sizes to video items
            videoItems.forEach((v) => {
              const match = vFormats.find(
                (f) => f.resolution?.includes(v.res) || f.qualityLabel?.includes(v.res)
              );
              if (match) {
                v.formatId = match.formatId;
                const bytes = match.filesize || match.filesizeApprox;
                if (bytes > 0) {
                  v.size = `${formatBytes(bytes)}`;
                } else {
                  v.size = 'MP4';
                }
              } else {
                v.size = 'MP4';
              }
            });
          }

          // Update menu with real stream sizes
          renderMenuContent();
        }
      });
    }
  } catch (err) {
    console.debug('Inspection error:', err);
  }

  // Close on outside click
  const outsideClickListener = (e) => {
    if (!wrapper.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', outsideClickListener);
    }
  };
  setTimeout(() => document.addEventListener('click', outsideClickListener), 10);

  wrapper.appendChild(menu);
}

function attachDownloadBarToMedia(element, isAudio = false) {
  if (!element) return;

  const currentMediaSignature = element.currentSrc || element.src || window.location.href;

  // If user previously closed/dismissed the bar for this exact video, do not re-attach
  if (element.dataset.vanyaDismissedSig === currentMediaSignature) {
    return;
  }

  if (element.dataset.vanyaAttached === 'true') {
    // Check if the wrapper is still in DOM; if removed, allow re-attachment
    const existing = document.querySelector(`.vanya-media-overlay-wrapper[data-media-id="${element.dataset.vanyaMediaId}"]`);
    if (existing) return;
  }

  const mediaId = 'vanya_' + Math.random().toString(36).substring(2, 9);
  element.dataset.vanyaMediaId = mediaId;
  element.dataset.vanyaAttached = 'true';

  let container = element.parentElement || element;

  // On YouTube, prefer #movie_player
  if (window.location.hostname.includes('youtube.com')) {
    const player = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
    if (player) container = player;
  }

  // Ensure relative positioning
  const style = window.getComputedStyle(container);
  if (style.position === 'static') {
    container.style.position = 'relative';
  }

  const wrapper = document.createElement('div');
  wrapper.className = `vanya-media-overlay-wrapper ${isAudio ? 'vanya-audio-bar' : 'vanya-video-bar'}`;
  wrapper.dataset.mediaId = mediaId;

  // Main Download Action Button
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'vanya-media-overlay-btn';
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2.3; stroke-linecap: round; stroke-linejoin: round; shrink: 0;">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
    <span style="font-weight: 700; white-space: nowrap;">${isAudio ? '🎵 Download Song' : '📥 Download Video'}</span>
    <svg class="vanya-chevron" viewBox="0 0 24 24" style="width: 11px; height: 11px; margin-left: 2px; fill: none; stroke: currentColor; stroke-width: 2.3; stroke-linecap: round; stroke-linejoin: round; opacity: 0.85;">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  `;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const targetUrl = getMediaDownloadUrl(element, isAudio);
    const existingMenu = wrapper.querySelector('.vanya-dropdown-menu');
    if (existingMenu) {
      existingMenu.remove();
    } else {
      createDropdownMenu(wrapper, targetUrl, isAudio);
    }
  });

  // IDM-Style Dedicated Close Button (✕) with SVG Icon
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'vanya-media-overlay-close';
  closeBtn.title = 'Hide download bar for this video';
  closeBtn.innerHTML = `
    <svg viewBox="0 0 24 24" style="width: 13px; height: 13px; stroke: #ffffff; stroke-width: 2.5; fill: none; stroke-linecap: round; stroke-linejoin: round; display: block;">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `;

  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Mark current video as dismissed so it does not reappear while watching
    const currentSig = element.currentSrc || element.src || window.location.href;
    element.dataset.vanyaDismissedSig = currentSig;

    // Remove any open dropdown menu and remove the overlay bar
    document.querySelectorAll('.vanya-dropdown-menu').forEach((d) => d.remove());
    wrapper.remove();
  });

  wrapper.appendChild(btn);
  wrapper.appendChild(closeBtn);
  container.appendChild(wrapper);

  // Listen for video source change: when user plays a NEW video, clear dismissed state so bar reappears
  const handleMediaSourceChange = () => {
    const newSig = element.currentSrc || element.src || window.location.href;
    if (element.dataset.vanyaDismissedSig && element.dataset.vanyaDismissedSig !== newSig) {
      element.dataset.vanyaDismissedSig = '';
      element.dataset.vanyaAttached = '';
      scanMediaElements();
    }
  };

  element.addEventListener('loadstart', handleMediaSourceChange, { passive: true });
  element.addEventListener('loadedmetadata', handleMediaSourceChange, { passive: true });
  element.addEventListener('play', handleMediaSourceChange, { passive: true });
}

function scanMediaElements() {
  try {
    // 1. Video elements (YouTube, Vimeo, Twitter, etc.)
    const videos = document.querySelectorAll('video');
    videos.forEach((video) => {
      if (video.clientWidth > 180 || video.clientHeight > 100 || window.location.hostname.includes('youtube.com')) {
        attachDownloadBarToMedia(video, false);
      }
    });

    // 2. Audio elements (SoundCloud, Spotify web, etc.)
    const audios = document.querySelectorAll('audio');
    audios.forEach((audio) => {
      attachDownloadBarToMedia(audio, true);
    });

    // 3. YouTube specific check
    if (window.location.hostname.includes('youtube.com')) {
      const ytPlayer = document.querySelector('#movie_player');
      if (ytPlayer) {
        const video = ytPlayer.querySelector('video') || ytPlayer;
        attachDownloadBarToMedia(video, false);
      }
    }
  } catch (err) {
    console.debug('Vanya media scan error:', err);
  }
}

// Initial scan
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scanMediaElements);
} else {
  scanMediaElements();
}

// Handle YouTube and Single-Page-App video transitions
window.addEventListener('yt-navigate-finish', () => {
  // Clear YouTube player attached flag so new video gets fresh overlay
  const ytPlayer = document.querySelector('#movie_player');
  if (ytPlayer) {
    const video = ytPlayer.querySelector('video') || ytPlayer;
    if (video) {
      video.dataset.vanyaAttached = '';
      video.dataset.vanyaDismissedSig = '';
    }
  }
  setTimeout(scanMediaElements, 300);
});

window.addEventListener('popstate', () => {
  setTimeout(scanMediaElements, 300);
});

// Debounced MutationObserver to detect dynamically loaded players without loop
let scanTimeout = null;
const observer = new MutationObserver(() => {
  if (scanTimeout) clearTimeout(scanTimeout);
  scanTimeout = setTimeout(() => {
    scanMediaElements();
  }, 400);
});

try {
  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
  });
} catch (e) {
  console.debug('Observer error:', e);
}
