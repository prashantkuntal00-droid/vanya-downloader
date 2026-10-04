import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { DownloadItem, DownloadOptions, DownloadStatus, DownloadStats } from '../../../shared/types/download';
import { DatabaseService } from '../database/DatabaseService';
import { Aria2Client } from './Aria2Client';
import {
  getUniqueFilename,
  extractFilenameFromHeader,
  extractFilenameFromUrl,
  releaseReservedFilename,
} from './SmartNaming';
import { getDiskSpace } from './DiskSpace';
import { detectCategory } from '../../../shared/constants/categories';
import { getEnginePath } from '../../utils/enginePath';
import { LoggerService } from '../logger/LoggerService';
import { analyzeHttpUrl, AnalyzedUrlInfo } from './UrlAnalyzer';

function parseYtDlpProgress(line: string): {
  percent: number | null;
  downloadedBytes: number;
  totalBytes: number;
  speedBytes: number;
  etaSeconds: number;
} {
  const percentMatch = line.match(/(\d+(?:\.\d+)?)%/);
  const directMatch = line.match(/(\d+(?:\.\d+)?)\s*([KMGTP]?i?B)\s+of\s+~?\s*(\d+(?:\.\d+)?)\s*([KMGTP]?i?B)/i);
  const sizeMatch = line.match(/of\s+~?\s*(\d+(?:\.\d+)?)\s*([KMGTP]?i?B)/i);
  const speedMatch = line.match(/at\s+~?\s*(\d+(?:\.\d+)?)\s*([KMGTP]?i?B\/s)/i);
  const etaMatch = line.match(/ETA\s+(\d+):(\d+)(?::(\d+))?/i);

  const percent = percentMatch ? parseFloat(percentMatch[1]) : null;

  const toBytes = (val: number, unit: string): number => {
    const u = unit.toUpperCase();
    if (u.startsWith('K')) return Math.floor(val * 1024);
    if (u.startsWith('M')) return Math.floor(val * 1024 * 1024);
    if (u.startsWith('G')) return Math.floor(val * 1024 * 1024 * 1024);
    if (u.startsWith('T')) return Math.floor(val * 1024 * 1024 * 1024 * 1024);
    return Math.floor(val);
  };

  let downloadedBytes = 0;
  let totalBytes = 0;

  if (directMatch) {
    downloadedBytes = toBytes(parseFloat(directMatch[1]), directMatch[2]);
    totalBytes = toBytes(parseFloat(directMatch[3]), directMatch[4]);
  } else if (sizeMatch) {
    totalBytes = toBytes(parseFloat(sizeMatch[1]), sizeMatch[2]);
    if (percent !== null && totalBytes > 0) {
      downloadedBytes = Math.floor((totalBytes * percent) / 100);
    }
  }

  let speedBytes = 0;
  if (speedMatch) {
    speedBytes = toBytes(parseFloat(speedMatch[1]), speedMatch[2]);
  }

  let etaSeconds = 0;
  if (etaMatch) {
    if (etaMatch[3]) {
      etaSeconds = parseInt(etaMatch[1], 10) * 3600 + parseInt(etaMatch[2], 10) * 60 + parseInt(etaMatch[3], 10);
    } else {
      etaSeconds = parseInt(etaMatch[1], 10) * 60 + parseInt(etaMatch[2], 10);
    }
  }

  return { percent, downloadedBytes, totalBytes, speedBytes, etaSeconds };
}

export class DownloadManager extends EventEmitter {
  private db: DatabaseService;
  private aria2: Aria2Client;
  private activeDownloads: Map<string, DownloadItem> = new Map();
  private activeYtProcesses: Map<string, ChildProcess> = new Map();
  private activeHttpRequests: Map<string, http.ClientRequest> = new Map();
  private retryAttempts: Map<string, number> = new Map();
  private retryTimers: Map<string, NodeJS.Timeout> = new Map();
  private pollTimer: NodeJS.Timeout | null = null;
  private todayBytesDownloaded: number = 0;

  constructor(db: DatabaseService, aria2: Aria2Client) {
    super();
    this.db = db;
    this.aria2 = aria2;
  }

  public async initialize(): Promise<void> {
    // Start aria2 process if binary exists
    await this.aria2.start();

    // Start background progress polling loop (runs every 500ms)
    this.startPollingLoop();

    // Recover incomplete downloads on startup
    const settings = this.db.getSettings();
    if (settings.autoResumeOnStartup) {
      await this.recoverInterruptedDownloads();
    }
  }

  /**
   * Application restart recovery logic.
   */
  public async recoverInterruptedDownloads(): Promise<void> {
    const list = this.db.getDownloads();
    const settings = this.db.getSettings();

    for (const item of list) {
      if (item.status === 'DOWNLOADING') {
        const partFile = item.filepath + '.part';
        if (fs.existsSync(partFile)) {
          const stats = fs.statSync(partFile);
          item.downloadedSize = stats.size;
          if (item.totalSize > 0) {
            item.progress = Math.min(99, Math.floor((stats.size / item.totalSize) * 100));
          }
        }
        item.status = settings.autoResumeOnStartup ? 'QUEUED' : 'PAUSED';
        item.speed = 0;
        item.eta = 0;
        this.db.saveDownloadItem(item, true);
      }
    }
    if (settings.autoResumeOnStartup) {
      this.processQueue();
    }
  }

  /**
   * Analyzes a URL before download starts using advanced range probing and redirect resolution.
   */
  public async analyzeUrl(urlStr: string): Promise<{
    url: string;
    finalUrl: string;
    filename: string;
    totalSize?: number;
    mimeType?: string;
    supportsResume: boolean;
  }> {
    try {
      const info: AnalyzedUrlInfo = await analyzeHttpUrl(urlStr);
      return {
        url: info.url,
        finalUrl: info.finalUrl || info.url,
        filename: info.filename,
        totalSize: info.totalSize,
        mimeType: info.mimeType,
        supportsResume: info.supportsResume,
      };
    } catch (err: any) {
      LoggerService.warn('DownloadManager', `Error during analyzeUrl for ${urlStr}: ${err?.message || err}`);
      return {
        url: urlStr,
        finalUrl: urlStr,
        filename: extractFilenameFromUrl(urlStr),
        supportsResume: true,
      };
    }
  }

  /**
   * Creates and registers a new download task.
   */
  public async addDownload(options: DownloadOptions): Promise<DownloadItem> {
    const rawUrl = (options.url || '').trim();
    if (rawUrl.startsWith('blob:') || rawUrl.startsWith('data:') || rawUrl.startsWith('filesystem:')) {
      throw new Error('Blob and Data URLs are generated within your web browser and must be saved directly from the browser.');
    }

    const settings = this.db.getSettings();
    const destDir = options.destinationDir || settings.defaultDownloadDir;

    let desiredFilename = options.filename;
    let mimeType = 'application/octet-stream';
    let totalSize = 0;
    let resolvedUrl = options.url;

    if (options.sourceType === 'VIDEO') {
      desiredFilename = desiredFilename || 'video.mp4';
      mimeType = options.category === 'Music' ? 'audio/mp3' : 'video/mp4';
    } else if (desiredFilename && desiredFilename !== 'Media_Download' && desiredFilename !== 'download') {
      mimeType = 'application/octet-stream';
      try {
        const analyzed = await this.analyzeUrl(options.url);
        if (analyzed.finalUrl) resolvedUrl = analyzed.finalUrl;
        totalSize = analyzed.totalSize || 0;
        mimeType = analyzed.mimeType || mimeType;
      } catch {}
    } else {
      try {
        const analyzed = await this.analyzeUrl(options.url);
        desiredFilename = analyzed.filename;
        mimeType = analyzed.mimeType || mimeType;
        totalSize = analyzed.totalSize || 0;
        if (analyzed.finalUrl) resolvedUrl = analyzed.finalUrl;
      } catch {
        desiredFilename = extractFilenameFromUrl(options.url);
      }
    }

    const finalFilename = getUniqueFilename(destDir, desiredFilename || 'download.bin', mimeType);
    const category =
      options.category ||
      (options.sourceType === 'VIDEO'
        ? (finalFilename.toLowerCase().endsWith('.mp3') ? 'Music' : 'Videos')
        : settings.autoCategorize
        ? detectCategory(finalFilename, mimeType)
        : 'Other');

    const downloadItem: DownloadItem = {
      id: 'dl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      url: resolvedUrl,
      originalUrl: options.url,
      filename: finalFilename,
      filepath: path.join(destDir, finalFilename),
      mimeType: mimeType,
      totalSize: totalSize,
      downloadedSize: 0,
      progress: 0,
      status: 'QUEUED',
      speed: 0,
      avgSpeed: 0,
      eta: 0,
      createdTime: Date.now(),
      priority: options.priority || 5,
      connections: options.connections || settings.defaultConnectionsPerDownload,
      sourceType: options.sourceType || 'HTTP',
      videoFormatId: options.videoFormatId,
      audioFormatId: options.audioFormatId,
      category,
    };

    this.db.saveDownloadItem(downloadItem, true);
    this.emit('downloadStateChange', downloadItem);

    if (options.startImmediately !== false) {
      this.processQueue();
    }

    return downloadItem;
  }

  /**
   * Processes the download queue according to max simultaneous downloads limit.
   */
  public async processQueue(): Promise<void> {
    const settings = this.db.getSettings();
    const maxSimultaneous = settings.maxSimultaneousDownloads;

    const allDownloads = this.db.getDownloads();
    const downloadingCount = allDownloads.filter((d) => d.status === 'DOWNLOADING').length;

    if (downloadingCount >= maxSimultaneous) return;

    const queuedDownloads = allDownloads
      .filter((d) => d.status === 'QUEUED')
      .sort((a, b) => (b.priority || 5) - (a.priority || 5) || a.createdTime - b.createdTime);

    const availableSlots = maxSimultaneous - downloadingCount;
    const toStart = queuedDownloads.slice(0, availableSlots);

    for (const item of toStart) {
      await this.startDownloadItem(item.id);
    }
  }

  public async startDownloadItem(id: string): Promise<boolean> {
    const item = this.db.getDownloadById(id);
    if (!item) return false;

    // Verify disk space before starting
    const destDir = path.dirname(item.filepath);
    try {
      const diskInfo = await getDiskSpace(destDir);
      if (item.totalSize > 0 && diskInfo.availableBytes < item.totalSize + 50 * 1024 * 1024) {
        item.status = 'FAILED';
        item.errorMessage = 'Insufficient disk space on target drive.';
        this.db.saveDownloadItem(item, true);
        releaseReservedFilename(destDir, item.filename);
        this.emit('downloadStateChange', item);
        return false;
      }
    } catch {}

    item.status = 'DOWNLOADING';
    item.startedTime = item.startedTime || Date.now();
    this.db.saveDownloadItem(item, true);
    this.activeDownloads.set(item.id, item);
    this.emit('downloadStateChange', item);

    // Dedicated yt-dlp Video / Audio Stream Downloader
    if (item.sourceType === 'VIDEO') {
      this.runYtDlpVideoDownload(item);
      return true;
    }

    const partFilename = `${item.filename}.part`;

    // Multi-segmented Aria2 Engine
    if (this.aria2.isEngineActive()) {
      try {
        const gid = await this.aria2.addUri(
          item.url,
          destDir,
          partFilename,
          item.connections,
          0
        );
        item.gid = gid;
        this.db.saveDownloadItem(item, true);
        return true;
      } catch (err) {
        console.warn('aria2 addUri failed, using native HTTP streaming fallback:', err);
      }
    }

    // Native Streaming HTTP/HTTPS Engine
    this.runNativeHttpDownload(item);
    return true;
  }

  /**
   * yt-dlp + FFmpeg Video Downloader Engine with real-time stream merging.
   */
  private runYtDlpVideoDownload(item: DownloadItem): void {
    const ytDlpPath = getEnginePath('engines/extractor/yt-dlp.exe');
    const ffmpegPath = getEnginePath('engines/ffmpeg/ffmpeg.exe');

    if (!fs.existsSync(ytDlpPath)) {
      item.status = 'FAILED';
      item.errorMessage = 'yt-dlp engine not found. Run npm run fetch-engines.';
      this.db.saveDownloadItem(item, true);
      this.activeDownloads.delete(item.id);
      releaseReservedFilename(path.dirname(item.filepath), item.filename);
      this.emit('downloadStateChange', item);
      this.processQueue();
      return;
    }

    const isAudioOnly =
      item.category === 'Music' ||
      item.filepath.toLowerCase().endsWith('.mp3') ||
      item.filepath.toLowerCase().endsWith('.m4a') ||
      (item.videoFormatId && (item.videoFormatId.startsWith('audio_') || item.videoFormatId.startsWith('bestaudio')));

    const destDir = path.dirname(item.filepath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    let args: string[] = [
      '--newline',
      '--no-playlist',
      '--no-warnings',
      '--windows-filenames',
      '--concurrent-fragments',
      '4',
      '--ffmpeg-location',
      ffmpegPath,
      '--no-check-certificates',
      '--extractor-retries',
      '3',
      '--user-agent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    ];

    if (isAudioOnly) {
      const is320 = item.videoFormatId === 'audio_mp3_320' || item.videoFormatId?.includes('320');
      const is256 = item.videoFormatId === 'audio_mp3_256' || item.videoFormatId?.includes('256');
      const isM4A = item.videoFormatId === 'audio_m4a_best' || item.filepath.toLowerCase().endsWith('.m4a');

      args.push(
        '-x',
        '--audio-format',
        isM4A ? 'm4a' : 'mp3',
        '--audio-quality',
        is320 ? '0' : is256 ? '2' : '4',
        '-o',
        item.filepath,
        item.url
      );
    } else {
      let formatSpec = item.videoFormatId || 'bestvideo+bestaudio/best';
      if (!formatSpec.includes('+') && !formatSpec.includes('/')) {
        formatSpec = `${formatSpec}+bestaudio/best`;
      }
      if (!formatSpec.includes('/')) {
        formatSpec = `${formatSpec}/bestvideo+bestaudio/best`;
      }

      args.push(
        '-f',
        formatSpec,
        '--merge-output-format',
        'mp4',
        '-o',
        item.filepath,
        item.url
      );
    }

    try {
      const proc = spawn(ytDlpPath, args, { windowsHide: true });
      this.activeYtProcesses.set(item.id, proc);

      let lastEmitTime = Date.now();

      proc.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        const lines = text.split(/[\r\n]+/);

        for (const line of lines) {
          if (line.includes('[download]') || line.includes('%')) {
            const parsed = parseYtDlpProgress(line);
            if (parsed.percent !== null && !isNaN(parsed.percent)) {
              item.progress = Math.min(99, Math.floor(parsed.percent));
            }
            if (parsed.totalBytes > 0) {
              item.totalSize = parsed.totalBytes;
            }
            if (parsed.downloadedBytes > 0) {
              item.downloadedSize = parsed.downloadedBytes;
            } else if (item.totalSize > 0 && item.progress > 0) {
              item.downloadedSize = Math.floor((item.totalSize * item.progress) / 100);
            }
            if (parsed.speedBytes > 0) {
              item.speed = parsed.speedBytes;
            }
            if (parsed.etaSeconds > 0) {
              item.eta = parsed.etaSeconds;
            }

            const now = Date.now();
            if (now - lastEmitTime >= 300) {
              lastEmitTime = now;
              this.db.saveDownloadItem(item, false);
              this.emit('downloadProgress', item);
            }
          }
        }
      });

      proc.stderr.on('data', (data: Buffer) => {
        LoggerService.warn('yt-dlp', data.toString());
      });

      proc.on('close', (code: number) => {
        this.activeYtProcesses.delete(item.id);

        let targetPath = item.filepath;
        if (!fs.existsSync(targetPath)) {
          const baseWithoutExt = item.filepath.replace(/\.[^/.]+$/, '');
          const candidates = [
            `${baseWithoutExt}.mp4`,
            `${baseWithoutExt}.mkv`,
            `${baseWithoutExt}.webm`,
            `${baseWithoutExt}.mp3`,
            `${baseWithoutExt}.m4a`,
          ];
          for (const cand of candidates) {
            if (fs.existsSync(cand)) {
              targetPath = cand;
              item.filepath = cand;
              item.filename = path.basename(cand);
              break;
            }
          }
        }

        if (code === 0 && fs.existsSync(targetPath)) {
          item.status = 'COMPLETED';
          item.progress = 100;
          item.speed = 0;
          item.eta = 0;
          item.completedTime = Date.now();
          item.downloadedSize = fs.statSync(targetPath).size;
          item.totalSize = item.downloadedSize;

          this.todayBytesDownloaded += item.downloadedSize;
          this.db.saveDownloadItem(item, true);
          this.activeDownloads.delete(item.id);
          releaseReservedFilename(path.dirname(item.filepath), item.filename);
          this.emit('downloadStateChange', item);
          this.processQueue();
        } else {
          item.status = 'FAILED';
          item.errorMessage = `Media extraction exited with code ${code}. Check if video is private or region-locked.`;
          this.db.saveDownloadItem(item, true);
          this.activeDownloads.delete(item.id);
          releaseReservedFilename(path.dirname(item.filepath), item.filename);
          this.emit('downloadStateChange', item);
          this.processQueue();
        }
      });

      proc.on('error', (err: Error) => {
        this.activeYtProcesses.delete(item.id);
        item.status = 'FAILED';
        item.errorMessage = err.message || 'Failed to spawn yt-dlp process';
        this.db.saveDownloadItem(item, true);
        this.activeDownloads.delete(item.id);
        releaseReservedFilename(path.dirname(item.filepath), item.filename);
        this.emit('downloadStateChange', item);
        this.processQueue();
      });
    } catch (err: any) {
      item.status = 'FAILED';
      item.errorMessage = err.message || 'Error launching video downloader';
      this.db.saveDownloadItem(item, true);
      this.activeDownloads.delete(item.id);
      releaseReservedFilename(path.dirname(item.filepath), item.filename);
      this.emit('downloadStateChange', item);
      this.processQueue();
    }
  }

  /**
   * Robust Native Node HTTP/HTTPS Downloader engine with streaming, pause/resume, chunked transfer, and auto-retry.
   */
  private runNativeHttpDownload(item: DownloadItem, redirectCount: number = 0): void {
    if (redirectCount > 8) {
      item.status = 'FAILED';
      item.errorMessage = 'Too many HTTP redirects encountered';
      this.db.saveDownloadItem(item, true);
      this.activeDownloads.delete(item.id);
      releaseReservedFilename(path.dirname(item.filepath), item.filename);
      this.emit('downloadStateChange', item);
      this.processQueue();
      return;
    }

    const partFilepath = item.filepath + '.part';
    const isHttps = item.url.startsWith('https://');
    const client = isHttps ? https : http;

    let existingSize = 0;
    if (fs.existsSync(partFilepath)) {
      try {
        existingSize = fs.statSync(partFilepath).size;
      } catch {
        existingSize = 0;
      }
    }

    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      Connection: 'keep-alive',
    };

    if (existingSize > 0) {
      headers['Range'] = `bytes=${existingSize}-`;
    }

    try {
      const options: any = {
        headers,
        rejectUnauthorized: false,
        timeout: 20000,
      };

      const req = client.get(item.url, options, (res) => {
        const statusCode = res.statusCode || 0;

        // Handle 3xx Redirects
        if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
          req.destroy();
          this.activeHttpRequests.delete(item.id);
          try {
            const nextUrl = new URL(res.headers.location, item.url).toString();
            item.url = nextUrl;
            this.runNativeHttpDownload(item, redirectCount + 1);
            return;
          } catch (e: any) {
            item.status = 'FAILED';
            item.errorMessage = `Invalid redirect URL: ${res.headers.location}`;
            this.db.saveDownloadItem(item, true);
            this.activeDownloads.delete(item.id);
            releaseReservedFilename(path.dirname(item.filepath), item.filename);
            this.emit('downloadStateChange', item);
            this.processQueue();
            return;
          }
        }

        // Handle HTTP Errors
        if (statusCode >= 400) {
          req.destroy();
          this.activeHttpRequests.delete(item.id);

          // Check if transient error eligible for retry (408, 429, 500, 502, 503, 504)
          const isTransient = [408, 429, 500, 502, 503, 504].includes(statusCode);
          if (isTransient && this.scheduleAutoRetry(item, `Server returned HTTP ${statusCode}`)) {
            return;
          }

          item.status = 'FAILED';
          item.errorMessage =
            statusCode === 404
              ? 'File not found on server (HTTP 404)'
              : statusCode === 403
              ? 'Access forbidden by server (HTTP 403)'
              : statusCode === 401
              ? 'Authentication required (HTTP 401)'
              : `HTTP Server returned error ${statusCode}`;

          this.db.saveDownloadItem(item, true);
          this.activeDownloads.delete(item.id);
          releaseReservedFilename(path.dirname(item.filepath), item.filename);
          this.emit('downloadStateChange', item);
          this.processQueue();
          return;
        }

        // Check if server accepted partial resume (206) or started full stream (200)
        const isPartial = statusCode === 206;
        if (!isPartial && existingSize > 0) {
          existingSize = 0; // Server doesn't support ranges; start cleanly from offset 0
        }

        const contentLength = res.headers['content-length'];
        if (contentLength) {
          item.totalSize = existingSize + parseInt(contentLength, 10);
        }

        // Update Content-Disposition filename if available
        const cdHeader = res.headers['content-disposition'];
        if (cdHeader) {
          const headerName = extractFilenameFromHeader(cdHeader);
          if (headerName && headerName !== item.filename && (item.filename === 'download.bin' || item.filename === 'download')) {
            const destDir = path.dirname(item.filepath);
            const updatedName = getUniqueFilename(destDir, headerName, res.headers['content-type']);
            item.filename = updatedName;
            item.filepath = path.join(destDir, updatedName);
          }
        }

        const writeStream = fs.createWriteStream(partFilepath, {
          flags: isPartial && existingSize > 0 ? 'a' : 'w',
        });

        let downloadedSinceStart = 0;
        let lastTime = Date.now();

        res.on('data', (chunk: Buffer) => {
          if (item.status !== 'DOWNLOADING') {
            req.destroy();
            writeStream.close();
            return;
          }

          downloadedSinceStart += chunk.length;
          item.downloadedSize = existingSize + downloadedSinceStart;

          if (item.totalSize > 0) {
            item.progress = Math.min(99, Math.floor((item.downloadedSize / item.totalSize) * 100));
          }

          const now = Date.now();
          const elapsedSec = (now - lastTime) / 1000;
          if (elapsedSec >= 0.5) {
            item.speed = Math.floor(downloadedSinceStart / elapsedSec);
            if (item.totalSize > item.downloadedSize && item.speed > 0) {
              item.eta = Math.ceil((item.totalSize - item.downloadedSize) / item.speed);
            }
            lastTime = now;
            downloadedSinceStart = 0;
            this.db.saveDownloadItem(item, false);
            this.emit('downloadProgress', item);
          }

          writeStream.write(chunk);
        });

        res.on('end', () => {
          this.activeHttpRequests.delete(item.id);
          this.retryAttempts.delete(item.id);

          writeStream.end(() => {
            if (item.status === 'DOWNLOADING') {
              this.finalizeDownload(item, partFilepath);
            }
          });
        });

        res.on('error', (err) => {
          this.activeHttpRequests.delete(item.id);
          writeStream.close();

          if (item.status === 'DOWNLOADING') {
            if (this.scheduleAutoRetry(item, err.message || 'Stream interrupted')) {
              return;
            }
            item.status = 'FAILED';
            item.errorMessage = err.message || 'Network stream error';
            this.db.saveDownloadItem(item, true);
            this.activeDownloads.delete(item.id);
            releaseReservedFilename(path.dirname(item.filepath), item.filename);
            this.emit('downloadStateChange', item);
            this.processQueue();
          }
        });
      });

      this.activeHttpRequests.set(item.id, req);

      req.on('timeout', () => {
        req.destroy();
        this.activeHttpRequests.delete(item.id);
        if (item.status === 'DOWNLOADING') {
          if (this.scheduleAutoRetry(item, 'Connection timed out')) {
            return;
          }
          item.status = 'FAILED';
          item.errorMessage = 'Connection timed out';
          this.db.saveDownloadItem(item, true);
          this.activeDownloads.delete(item.id);
          releaseReservedFilename(path.dirname(item.filepath), item.filename);
          this.emit('downloadStateChange', item);
          this.processQueue();
        }
      });

      req.on('error', (err) => {
        this.activeHttpRequests.delete(item.id);
        if (item.status === 'DOWNLOADING') {
          if (this.scheduleAutoRetry(item, err.message || 'Connection failed')) {
            return;
          }
          item.status = 'FAILED';
          item.errorMessage = err.message || 'Connection failed';
          this.db.saveDownloadItem(item, true);
          this.activeDownloads.delete(item.id);
          releaseReservedFilename(path.dirname(item.filepath), item.filename);
          this.emit('downloadStateChange', item);
          this.processQueue();
        }
      });
    } catch (err: any) {
      this.activeHttpRequests.delete(item.id);
      if (item.status === 'DOWNLOADING') {
        if (this.scheduleAutoRetry(item, err.message || 'Failed to initiate HTTP request')) {
          return;
        }
        item.status = 'FAILED';
        item.errorMessage = err.message || 'Failed to initiate HTTP request';
        this.db.saveDownloadItem(item, true);
        this.activeDownloads.delete(item.id);
        releaseReservedFilename(path.dirname(item.filepath), item.filename);
        this.emit('downloadStateChange', item);
        this.processQueue();
      }
    }
  }

  /**
   * Schedules an intelligent retry with exponential backoff on transient errors.
   */
  private scheduleAutoRetry(item: DownloadItem, reason: string): boolean {
    const settings = this.db.getSettings();
    const maxRetries = settings.retryCount || 3;
    const baseDelaySec = settings.retryDelaySeconds || 5;

    const currentAttempt = (this.retryAttempts.get(item.id) || 0) + 1;
    if (currentAttempt > maxRetries) {
      this.retryAttempts.delete(item.id);
      return false;
    }

    this.retryAttempts.set(item.id, currentAttempt);
    const delayMs = currentAttempt * baseDelaySec * 1000;

    item.status = 'QUEUED';
    item.errorMessage = `${reason}. Retrying (attempt ${currentAttempt}/${maxRetries} in ${Math.round(delayMs / 1000)}s)...`;
    this.db.saveDownloadItem(item, true);
    this.emit('downloadStateChange', item);

    const timer = setTimeout(() => {
      this.retryTimers.delete(item.id);
      const freshItem = this.db.getDownloadById(item.id);
      if (freshItem && freshItem.status === 'QUEUED') {
        this.startDownloadItem(item.id);
      }
    }, delayMs);

    this.retryTimers.set(item.id, timer);
    return true;
  }

  private finalizeDownload(item: DownloadItem, partFilepath: string): void {
    try {
      if (fs.existsSync(partFilepath)) {
        fs.renameSync(partFilepath, item.filepath);
      }
      item.status = 'COMPLETED';
      item.progress = 100;
      item.speed = 0;
      item.eta = 0;
      item.completedTime = Date.now();
      item.downloadedSize = item.totalSize || (fs.existsSync(item.filepath) ? fs.statSync(item.filepath).size : item.downloadedSize);

      this.todayBytesDownloaded += item.downloadedSize;
      this.db.saveDownloadItem(item, true);
      releaseReservedFilename(path.dirname(item.filepath), item.filename);
      this.activeDownloads.delete(item.id);
      this.emit('downloadStateChange', item);
      this.processQueue();
    } catch (err: any) {
      item.status = 'FAILED';
      item.errorMessage = `Error finalizing file: ${err.message}`;
      this.db.saveDownloadItem(item, true);
      releaseReservedFilename(path.dirname(item.filepath), item.filename);
      this.activeDownloads.delete(item.id);
      this.emit('downloadStateChange', item);
      this.processQueue();
    }
  }

  public async pauseDownload(id: string): Promise<boolean> {
    const item = this.db.getDownloadById(id);
    if (!item) return false;

    // Clear any active retry timers
    const retryTimer = this.retryTimers.get(id);
    if (retryTimer) {
      clearTimeout(retryTimer);
      this.retryTimers.delete(id);
    }
    this.retryAttempts.delete(id);

    // Stop active HTTP socket
    const httpReq = this.activeHttpRequests.get(id);
    if (httpReq) {
      try { httpReq.destroy(); } catch {}
      this.activeHttpRequests.delete(id);
    }

    const ytProc = this.activeYtProcesses.get(id);
    if (ytProc) {
      try { ytProc.kill(); } catch {}
      this.activeYtProcesses.delete(id);
    }

    item.status = 'PAUSED';
    item.speed = 0;
    item.eta = 0;
    this.db.saveDownloadItem(item, true);
    this.activeDownloads.delete(id);

    if (item.gid && this.aria2.isEngineActive()) {
      await this.aria2.pause(item.gid);
    }

    this.emit('downloadStateChange', item);
    this.processQueue();
    return true;
  }

  public async resumeDownload(id: string): Promise<boolean> {
    const item = this.db.getDownloadById(id);
    if (!item) return false;

    item.status = 'QUEUED';
    item.errorMessage = undefined;
    this.db.saveDownloadItem(item, true);
    this.emit('downloadStateChange', item);
    this.processQueue();
    return true;
  }

  public async cancelDownload(id: string): Promise<boolean> {
    const item = this.db.getDownloadById(id);
    if (!item) return false;

    // Clear any active retry timers
    const retryTimer = this.retryTimers.get(id);
    if (retryTimer) {
      clearTimeout(retryTimer);
      this.retryTimers.delete(id);
    }
    this.retryAttempts.delete(id);

    // Stop active HTTP socket
    const httpReq = this.activeHttpRequests.get(id);
    if (httpReq) {
      try { httpReq.destroy(); } catch {}
      this.activeHttpRequests.delete(id);
    }

    const ytProc = this.activeYtProcesses.get(id);
    if (ytProc) {
      try { ytProc.kill(); } catch {}
      this.activeYtProcesses.delete(id);
    }

    if (item.gid && this.aria2.isEngineActive()) {
      await this.aria2.remove(item.gid);
    }

    item.status = 'CANCELLED';
    item.speed = 0;
    item.eta = 0;
    this.db.saveDownloadItem(item, true);
    this.activeDownloads.delete(id);
    releaseReservedFilename(path.dirname(item.filepath), item.filename);

    // Remove temp file if exists
    const partFile = item.filepath + '.part';
    if (fs.existsSync(partFile)) {
      try { fs.unlinkSync(partFile); } catch {}
    }

    this.emit('downloadStateChange', item);
    this.processQueue();
    return true;
  }

  public async retryDownload(id: string): Promise<boolean> {
    this.retryAttempts.delete(id);
    return this.resumeDownload(id);
  }

  public async deleteDownload(id: string, deleteFile: boolean = false): Promise<boolean> {
    const item = this.db.getDownloadById(id);
    if (!item) return false;

    await this.cancelDownload(id);
    this.db.deleteDownloadItem(id);
    releaseReservedFilename(path.dirname(item.filepath), item.filename);

    if (deleteFile) {
      if (fs.existsSync(item.filepath)) {
        try { fs.unlinkSync(item.filepath); } catch {}
      }
    }

    this.emit('downloadStateChange', item);
    return true;
  }

  public async startAll(): Promise<boolean> {
    const list = this.db.getDownloads();
    for (const d of list) {
      if (d.status === 'PAUSED' || d.status === 'QUEUED') {
        d.status = 'QUEUED';
        this.db.saveDownloadItem(d, false);
      }
    }
    this.db.saveDownloads(this.db.getDownloads(), true);
    this.processQueue();
    return true;
  }

  public async pauseAll(): Promise<boolean> {
    const list = this.db.getDownloads();
    for (const d of list) {
      if (d.status === 'DOWNLOADING' || d.status === 'QUEUED') {
        await this.pauseDownload(d.id);
      }
    }
    return true;
  }

  public async resumeAll(): Promise<boolean> {
    return this.startAll();
  }

  public async cancelAll(): Promise<boolean> {
    const list = this.db.getDownloads();
    for (const d of list) {
      if (d.status === 'DOWNLOADING' || d.status === 'QUEUED') {
        await this.cancelDownload(d.id);
      }
    }
    return true;
  }

  public getStats(): DownloadStats {
    const list = this.db.getDownloads();
    let currentGlobalSpeed = 0;

    for (const item of list) {
      if (item.status === 'DOWNLOADING') {
        currentGlobalSpeed += item.speed || 0;
      }
    }

    const totalDownloadedBytes = list.reduce(
      (sum, item) => sum + (item.status === 'COMPLETED' ? item.totalSize || item.downloadedSize : item.downloadedSize),
      0
    );

    return {
      activeCount: list.filter((d) => d.status === 'DOWNLOADING').length,
      queuedCount: list.filter((d) => d.status === 'QUEUED').length,
      pausedCount: list.filter((d) => d.status === 'PAUSED').length,
      completedCount: list.filter((d) => d.status === 'COMPLETED').length,
      failedCount: list.filter((d) => d.status === 'FAILED').length,
      totalDownloadedBytes,
      todayDownloadedBytes: this.todayBytesDownloaded,
      currentGlobalSpeed,
    };
  }

  private startPollingLoop(): void {
    this.pollTimer = setInterval(async () => {
      if (this.aria2.isEngineActive()) {
        const downloading = this.db.getDownloads().filter((d) => d.status === 'DOWNLOADING' && d.gid);
        for (const item of downloading) {
          if (!item.gid) continue;
          try {
            const status = await this.aria2.tellStatus(item.gid);
            if (status) {
              item.downloadedSize = parseInt(status.completedLength, 10);
              item.totalSize = parseInt(status.totalLength, 10);
              item.speed = parseInt(status.downloadSpeed, 10);

              if (item.totalSize > 0) {
                item.progress = Math.min(99, Math.floor((item.downloadedSize / item.totalSize) * 100));
                if (item.speed > 0) {
                  item.eta = Math.ceil((item.totalSize - item.downloadedSize) / item.speed);
                }
              }

              if (status.status === 'complete') {
                const partFile = item.filepath + '.part';
                this.finalizeDownload(item, partFile);
              } else if (status.status === 'error') {
                item.status = 'FAILED';
                item.errorMessage = status.errorMessage || 'aria2 engine reported error';
                this.db.saveDownloadItem(item, true);
                this.activeDownloads.delete(item.id);
                releaseReservedFilename(path.dirname(item.filepath), item.filename);
                this.emit('downloadStateChange', item);
                this.processQueue();
              } else {
                this.db.saveDownloadItem(item, false);
                this.emit('downloadProgress', item);
              }
            }
          } catch {}
        }
      }

      this.emit('statsUpdate', this.getStats());
    }, 500);
  }
}
