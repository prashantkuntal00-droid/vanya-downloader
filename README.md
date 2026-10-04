# Vanya Downloader — High-Performance Windows Download Manager

**Vanya Downloader** is a robust, production-ready Windows desktop download manager built with Electron, React, TypeScript, aria2, FFmpeg, yt-dlp, and Native Messaging integration.

It is designed to deliver a modern, seamless IDM-style experience:
- **Zero-click browser activation**: When clicking any downloadable link in Chrome/Edge/Brave, Vanya activates automatically via Native Messaging without requiring the GUI to be opened first.
- **Universal file support**: Downloads any legitimate internet file stream (PDF, EXE, ZIP, MSI, ISO, JPG, MP3, MP4, JSON, and unknown binary types) without restrictive whitelists.
- **100% Free**: No subscriptions, no ads, no trials, no limits.

---

## Key Features

- **Automatic Browser Interception**: Native Messaging host (`com.vanya.downloader`) launches Vanya silently in the background when downloads are initiated in Chrome or Edge.
- **Universal HTTP/HTTPS Engine**: Streams arbitrary binary objects directly to disk using `.part` temporary protection, handling redirects, RFC 5987 Unicode/Hindi filenames, Content-Disposition, and Range requests.
- **Multi-Connection Segmented Downloads**: Powered by `aria2c` for maximum throughput with automatic fallback to native streaming if needed.
- **Intelligent Transient Auto-Retry**: Automatically retries 408, 429, 5xx, and network connection drops using exponential backoff.
- **Safe Duplicate Protection**: Concurrency-safe reservation prevents file collisions (`file (1).ext`) across completed and in-flight downloads.
- **Supported Video Extractor**: Dedicated video URL extraction powered by `yt-dlp` with quality selection.
- **Lossless Stream Merging**: Uses `FFmpeg` (`-c copy`) for high-speed lossless video and audio stream merging.
- **Auto-Resume & State Recovery**: Recovers interrupted downloads after application restarts.
- **Queue & Speed Control**: Configure max simultaneous downloads, download priorities, and global speed limits.
- **Clipboard Monitoring & Toast Notifications**: Auto-detects copied URLs and presents clean, non-intrusive Windows toast notifications.
- **System Tray Integration**: Background minimization with tray context menu.

---

## Technical Architecture

```
Browser Extension (Chrome / Edge / Brave)
       ↓ Native Messaging Host (`com.vanya.downloader`) / WebSocket Bridge (18792)
Electron Main Process (Background / GUI)
       ↓
Local Backend Services:
 ├── DownloadManager (Streaming HTTP/HTTPS engine, Range resume, retry, smart naming)
 ├── Aria2Client (aria2c multi-connection acceleration)
 ├── MediaExtractor & FfmpegService (yt-dlp format extraction & FFmpeg lossless merging)
 ├── DatabaseService (In-memory cached, debounced atomic persistence)
 ├── BrowserServer (Local bridge on 127.0.0.1:18792)
 ├── NativeHost (Chrome/Edge Native Messaging stdio wrapper)
 ├── ClipboardMonitor & SchedulerService
 └── NotificationService & TrayService
```

---

## How to Build & Run

### Prerequisites
- Node.js v18+ (tested on Node v24.18)
- Windows 10/11 x64

### Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Fetch engine binaries (aria2c, ffmpeg, yt-dlp)
npm run fetch-engines

# 3. Start development server
npm run dev

# 4. Launch Electron app
npm run electron:dev
```

### Production Build & Installer

```bash
# Generate Windows NSIS Installer
npm run dist
```

Output installer: `dist-installer/Vanya Downloader Setup 1.0.1.exe`

---

## Testing

Run unit & integration test suite:

```bash
npm test
```

---

## License

MIT License. Free for personal and commercial use.
