# FreeFlow Downloader — Architecture Specification

## Overview

FreeFlow Downloader is a Windows desktop application engineered for high-throughput, multi-segmented downloading.

## Core Design Principles

1. **Local-First & Completely Free**: All operations, engine RPCs, databases, and media extraction run locally on the user's desktop machine. No external servers or telemetry are involved.
2. **IPC Security & Context Isolation**: Electron renderer process runs with `contextIsolation: true`, `nodeIntegration: false`, and communicates with main process solely through typed `contextBridge` methods (`window.electronAPI`).
3. **Resilience & State Recovery**: Interrupted downloads survive application crashes or restarts. Download metadata is saved to persistent storage, and files are downloaded using `.part` temporary extensions until verified.
4. **Zero Nagware**: No popups, trial expiry, subscription prompts, or ads.

## Component Breakdown

### Main Process (`src/main/`)
- `DownloadManager`: Core state machine (`QUEUED`, `DOWNLOADING`, `PAUSED`, `COMPLETED`, `FAILED`, `CANCELLED`, `VERIFYING`, `MERGING`, `EXTRACTING`), queue priority, maximum simultaneous downloads.
- `Aria2Client`: Spawns and manages `aria2c.exe` process, executing JSON-RPC calls over local HTTP port 6800.
- `MediaExtractor`: Spawns `yt-dlp.exe` to analyze supported public video URLs and extract available formats, thumbnails, and stream metadata.
- `FfmpegService`: Spawns `ffmpeg.exe` for stream copying and lossless video/audio merging.
- `DatabaseService`: Manages SQLite state persistence for downloads, queue, scheduler jobs, and settings.
- `BrowserServer`: Listens on `http://127.0.0.1:18792` for incoming download requests from the Manifest V3 browser extension.
- `ClipboardMonitor`: Listens to system clipboard changes for valid HTTP/HTTPS/FTP/magnet download URLs.
- `NotificationService` & `TrayService`: System integration for Windows Toast Notifications and System Tray menu.

### Renderer Process (`src/renderer/`)
- React 18 + Tailwind CSS modern UI with Fluent dark mode styling.
- Zustand global state management (`useDownloadStore.ts`).
- Real-time progress updates throttled to 500ms intervals to optimize UI performance.
