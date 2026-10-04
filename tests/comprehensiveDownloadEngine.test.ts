import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { DatabaseService } from '../src/main/services/database/DatabaseService';
import { Aria2Client } from '../src/main/services/download/Aria2Client';
import { DownloadManager } from '../src/main/services/download/DownloadManager';

const COMPREHENSIVE_DIR = path.join(__dirname, 'comprehensive_test_dir');

describe('Comprehensive Download Engine Tests', () => {
  let db: DatabaseService;
  let aria2: Aria2Client;
  let manager: DownloadManager;
  let mockServer: http.Server;
  let serverPort = 19876;

  beforeAll(async () => {
    if (!fs.existsSync(COMPREHENSIVE_DIR)) {
      fs.mkdirSync(COMPREHENSIVE_DIR, { recursive: true });
    }

    // Spin up local mock HTTP server simulating edge-case server behaviors
    mockServer = http.createServer((req, res) => {
      const url = req.url || '';

      // 1. Unknown extension with generic octet-stream
      if (url === '/unknown-binary.xyz') {
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': '256',
        });
        res.end(Buffer.alloc(256, 0xaa));
        return;
      }

      // 2. No extension in URL, Content-Disposition gives Unicode & Hindi filename
      if (url === '/download-hindi') {
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': "attachment; filename*=UTF-8''%E0%A4%AA%E0%A4%A4%E0%A5%8D%E0%A4%B0_report.pdf",
          'Content-Length': '128',
        });
        res.end(Buffer.alloc(128, 0xbb));
        return;
      }

      // 3. Chunked transfer with missing Content-Length
      if (url === '/chunked-stream.bin') {
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Transfer-Encoding': 'chunked',
        });
        res.write('Chunk 1 data ');
        setTimeout(() => {
          res.write('Chunk 2 data ');
          res.end('Final Chunk');
        }, 100);
        return;
      }

      // 4. Relative Redirect test
      if (url === '/redirect-source') {
        res.writeHead(302, { Location: '/redirect-target.zip' });
        res.end();
        return;
      }
      if (url === '/redirect-target.zip') {
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Length': '512',
        });
        res.end(Buffer.alloc(512, 0xcc));
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    });

    await new Promise<void>((resolve) => {
      mockServer.listen(serverPort, '127.0.0.1', () => resolve());
    });

    db = new DatabaseService();
    const settings = db.getSettings();
    settings.defaultDownloadDir = COMPREHENSIVE_DIR;
    db.saveSettings(settings);

    aria2 = new Aria2Client();
    manager = new DownloadManager(db, aria2);
    await manager.initialize();
  });

  afterAll(async () => {
    aria2.stop();
    await new Promise<void>((resolve) => mockServer.close(() => resolve()));
    try {
      if (fs.existsSync(COMPREHENSIVE_DIR)) {
        fs.rmSync(COMPREHENSIVE_DIR, { recursive: true, force: true });
      }
    } catch {}
  });

  it('downloads unknown binary extension without restriction (.xyz)', async () => {
    const item = await manager.addDownload({
      url: `http://127.0.0.1:${serverPort}/unknown-binary.xyz`,
      destinationDir: COMPREHENSIVE_DIR,
      startImmediately: true,
    });

    let completed = false;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const current = db.getDownloadById(item.id);
      if (current && current.status === 'COMPLETED') {
        completed = true;
        break;
      }
    }

    expect(completed).toBe(true);
    const downloadedPath = path.join(COMPREHENSIVE_DIR, 'unknown-binary.xyz');
    expect(fs.existsSync(downloadedPath)).toBe(true);
    expect(fs.statSync(downloadedPath).size).toBe(256);
  });

  it('correctly handles Unicode / Hindi filename from Content-Disposition', async () => {
    const item = await manager.addDownload({
      url: `http://127.0.0.1:${serverPort}/download-hindi`,
      destinationDir: COMPREHENSIVE_DIR,
      startImmediately: true,
    });

    let completed = false;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const current = db.getDownloadById(item.id);
      if (current && current.status === 'COMPLETED') {
        completed = true;
        break;
      }
    }

    expect(completed).toBe(true);
    expect(item.filename).toContain('पत्र_report.pdf');
  });

  it('downloads chunked transfer streams where Content-Length is absent', async () => {
    const item = await manager.addDownload({
      url: `http://127.0.0.1:${serverPort}/chunked-stream.bin`,
      destinationDir: COMPREHENSIVE_DIR,
      startImmediately: true,
    });

    let completed = false;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const current = db.getDownloadById(item.id);
      if (current && current.status === 'COMPLETED') {
        completed = true;
        break;
      }
    }

    expect(completed).toBe(true);
    const file = path.join(COMPREHENSIVE_DIR, 'chunked-stream.bin');
    expect(fs.existsSync(file)).toBe(true);
    const content = fs.readFileSync(file, 'utf8');
    expect(content).toContain('Chunk 1');
    expect(content).toContain('Final Chunk');
  });

  it('handles relative 302 redirects seamlessly', async () => {
    const item = await manager.addDownload({
      url: `http://127.0.0.1:${serverPort}/redirect-source`,
      destinationDir: COMPREHENSIVE_DIR,
      startImmediately: true,
    });

    let completed = false;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const current = db.getDownloadById(item.id);
      if (current && current.status === 'COMPLETED') {
        completed = true;
        break;
      }
    }

    expect(completed).toBe(true);
    const file = path.join(COMPREHENSIVE_DIR, 'redirect-target.zip');
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.statSync(file).size).toBe(512);
  });
});
