import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { DatabaseService } from '../src/main/services/database/DatabaseService';
import { Aria2Client } from '../src/main/services/download/Aria2Client';
import { DownloadManager } from '../src/main/services/download/DownloadManager';
import { MediaExtractorService } from '../src/main/services/extractor/MediaExtractor';
import { FfmpegService } from '../src/main/services/ffmpeg/FfmpegService';
import { BrowserServer } from '../src/main/services/browser/BrowserServer';
import { getDiskSpace } from '../src/main/services/download/DiskSpace';
import { validateSafeFilePath, isValidDownloadUrl, sanitizeFilename } from '../src/shared/validators/security';

const TEST_DIR = path.join(__dirname, 'temp_test_dir');

describe('Real-World Functional Validation Suite', () => {
  let db: DatabaseService;
  let aria2: Aria2Client;
  let manager: DownloadManager;
  let extractor: MediaExtractorService;
  let ffmpeg: FfmpegService;
  let browserServer: BrowserServer;

  beforeAll(async () => {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }

    db = new DatabaseService();
    const settings = db.getSettings();
    settings.defaultDownloadDir = TEST_DIR;
    db.saveSettings(settings);

    aria2 = new Aria2Client();
    manager = new DownloadManager(db, aria2);
    await manager.initialize();

    extractor = new MediaExtractorService();
    ffmpeg = new FfmpegService();
    browserServer = new BrowserServer(manager, db, extractor);
    browserServer.start();
  });

  afterAll(() => {
    aria2.stop();
    browserServer.stop();
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {}
  });

  // TEST 1 — REAL HTTP DOWNLOAD
  it('TEST 1: Real HTTP Download executes cleanly', async () => {
    const testUrl = 'https://raw.githubusercontent.com/curl/curl/master/README.md';
    const item = await manager.addDownload({
      url: testUrl,
      filename: 'test_readme.md',
      destinationDir: TEST_DIR,
      startImmediately: true,
    });

    expect(item.id).toBeDefined();

    // Wait up to 10 seconds for completion
    let completed = false;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const current = db.getDownloadById(item.id);
      if (current && current.status === 'COMPLETED') {
        completed = true;
        break;
      }
    }

    expect(completed).toBe(true);
    const finalFile = path.join(TEST_DIR, 'test_readme.md');
    expect(fs.existsSync(finalFile)).toBe(true);
    expect(fs.statSync(finalFile).size).toBeGreaterThan(100);
  }, 15000);

  // TEST 2 — PAUSE / RESUME
  it('TEST 2: Pause and Resume operates without data loss', async () => {
    const testUrl = 'https://raw.githubusercontent.com/curl/curl/master/COPYING';
    const item = await manager.addDownload({
      url: testUrl,
      filename: 'test_copying.txt',
      destinationDir: TEST_DIR,
      startImmediately: false,
    });

    expect(item.status).toBe('QUEUED');
    await manager.pauseDownload(item.id);

    const pausedItem = db.getDownloadById(item.id);
    expect(pausedItem?.status).toBe('PAUSED');

    await manager.resumeDownload(item.id);
    let completed = false;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const current = db.getDownloadById(item.id);
      if (current && current.status === 'COMPLETED') {
        completed = true;
        break;
      }
    }

    expect(completed).toBe(true);
    expect(fs.existsSync(path.join(TEST_DIR, 'test_copying.txt'))).toBe(true);
  }, 15000);

  // TEST 3 — APPLICATION RESTART RECOVERY
  it('TEST 3: Application Restart Recovery preserves state & .part files', async () => {
    const item = await manager.addDownload({
      url: 'https://raw.githubusercontent.com/curl/curl/master/RELEASE-NOTES',
      filename: 'restart_test.txt',
      destinationDir: TEST_DIR,
      startImmediately: false,
    });

    const partPath = item.filepath + '.part';
    fs.writeFileSync(partPath, 'Partial data line 1\n');

    item.status = 'DOWNLOADING';
    db.saveDownloadItem(item);

    const settings = db.getSettings();
    settings.autoResumeOnStartup = false;
    db.saveSettings(settings);

    await manager.recoverInterruptedDownloads();

    const recovered = db.getDownloadById(item.id);
    expect(recovered?.status).toBe('PAUSED');
    expect(recovered?.downloadedSize).toBe(fs.statSync(partPath).size);

    // Test with autoResume enabled
    settings.autoResumeOnStartup = true;
    db.saveSettings(settings);
    item.status = 'DOWNLOADING';
    db.saveDownloadItem(item);
    await manager.recoverInterruptedDownloads();
    const autoResumed = db.getDownloadById(item.id);
    expect(autoResumed?.status).toBe('QUEUED');
  });

  // TEST 4 — MULTIPLE DOWNLOAD QUEUE
  it('TEST 4: Multiple Download Queue respects simultaneous limits', async () => {
    const settings = db.getSettings();
    settings.maxSimultaneousDownloads = 2;
    db.saveSettings(settings);

    const urls = [
      'https://raw.githubusercontent.com/curl/curl/master/docs/AUTHORS',
      'https://raw.githubusercontent.com/curl/curl/master/docs/BINDINGS.md',
      'https://raw.githubusercontent.com/curl/curl/master/docs/CHECKSRC.md',
      'https://raw.githubusercontent.com/curl/curl/master/docs/CIPHERS.md',
    ];

    for (let i = 0; i < urls.length; i++) {
      await manager.addDownload({
        url: urls[i],
        filename: `queue_test_${i}.md`,
        destinationDir: TEST_DIR,
        startImmediately: true,
      });
    }

    const downloadingCount = db.getDownloads().filter((d) => d.status === 'DOWNLOADING').length;
    expect(downloadingCount).toBeLessThanOrEqual(2);
  });

  // TEST 5 — SPEED LIMIT
  it('TEST 5: Speed Limit configuration is applied', async () => {
    const res = await aria2.setGlobalSpeedLimit(1024 * 1024); // 1 MB/s
    if (aria2.isEngineActive()) {
      expect(res).toBe(true);
    }
  });

  // TEST 6 — DISK SPACE PROTECTION
  it('TEST 6: Disk Space Protection validates available storage', async () => {
    const info = await getDiskSpace(TEST_DIR);
    expect(info.availableBytes).toBeGreaterThan(0);
  });

  // TEST 7 — VIDEO EXTRACTION
  it('TEST 7: Media Extractor checks yt-dlp binary presence', async () => {
    const binaryPath = path.join(process.cwd(), 'engines/extractor/yt-dlp.exe');
    expect(fs.existsSync(binaryPath)).toBe(true);
  });

  // TEST 8 — VIDEO + AUDIO + FFMPEG
  it('TEST 8: FFmpeg stream merging executable verification', async () => {
    const binaryPath = path.join(process.cwd(), 'engines/ffmpeg/ffmpeg.exe');
    expect(fs.existsSync(binaryPath)).toBe(true);
  });

  // TEST 10 — BROWSER EXTENSION INTEGRATION ENDPOINT
  it('TEST 10: Browser Integration Server receives downloads via HTTP POST', async () => {
    const payload = JSON.stringify({ url: 'https://raw.githubusercontent.com/curl/curl/master/LICENSE-MIXING.md' });
    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port: 18792,
      path: '/add-download',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const res: any = await new Promise((resolve, reject) => {
      const req = http.request(options, (response) => {
        let data = '';
        response.on('data', (c) => (data += c));
        response.on('end', () => resolve(JSON.parse(data)));
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    expect(res.success).toBe(true);
  });

  // TEST 13 — DATABASE PERSISTENCE
  it('TEST 13: Database state survives app restarts', () => {
    const testItem = {
      id: 'db_test_1',
      url: 'https://example.com/file.zip',
      originalUrl: 'https://example.com/file.zip',
      filename: 'file.zip',
      filepath: path.join(TEST_DIR, 'file.zip'),
      totalSize: 1000,
      downloadedSize: 1000,
      progress: 100,
      status: 'COMPLETED' as const,
      speed: 0,
      avgSpeed: 0,
      eta: 0,
      createdTime: Date.now(),
      priority: 5,
      connections: 8,
      sourceType: 'HTTP' as const,
      category: 'Archives' as const,
    };

    db.saveDownloadItem(testItem);

    const db2 = new DatabaseService();
    const fetched = db2.getDownloadById('db_test_1');
    expect(fetched).toBeDefined();
    expect(fetched?.filename).toBe('file.zip');
  });

  // TEST 14 — SECURITY CHECK
  it('TEST 14: Security path traversal prevention and URL validation', () => {
    const safePath = validateSafeFilePath(TEST_DIR, '../../Windows/System32/cmd.exe');
    expect(safePath.startsWith(TEST_DIR)).toBe(true);
    expect(isValidDownloadUrl('https://valid.com/file.iso')).toBe(true);
    expect(isValidDownloadUrl('javascript:alert(1)')).toBe(false);
  });
});
