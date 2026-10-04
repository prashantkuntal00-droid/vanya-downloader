import http from 'http';
import { DownloadManager } from '../download/DownloadManager';
import { DatabaseService } from '../database/DatabaseService';
import { MediaExtractorService } from '../extractor/MediaExtractor';
import { LoggerService } from '../logger/LoggerService';

export interface BrowserDownloadRequest {
  url: string;
  filename?: string;
  type?: 'video' | 'audio' | 'file' | 'auto';
  quality?: string;
  formatId?: string;
  startImmediately?: boolean;
}

export class BrowserServer {
  private server: http.Server | null = null;
  private manager: DownloadManager;
  private db: DatabaseService;
  private extractor: MediaExtractorService;
  private onBrowserRequest?: (request: BrowserDownloadRequest) => void;

  constructor(
    manager: DownloadManager,
    db: DatabaseService,
    extractor: MediaExtractorService,
    onBrowserRequest?: (request: BrowserDownloadRequest) => void
  ) {
    this.manager = manager;
    this.db = db;
    this.extractor = extractor;
    this.onBrowserRequest = onBrowserRequest;
  }

  public start(): void {
    const settings = this.db.getSettings();
    if (!settings.enableBrowserIntegration) return;

    const port = settings.browserIntegrationPort || 18792;

    this.server = http.createServer((req, res) => {
      // Enable CORS for browser extensions on localhost
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // Fast health check endpoint for browser extension connectivity
      if (req.method === 'GET' && (req.url === '/ping' || req.url === '/health')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', app: 'vanya-downloader', timestamp: Date.now() }));
        return;
      }

      // Handle video/audio stream metadata inspection for extension dropdown
      if (req.method === 'POST' && req.url === '/inspect-video') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            if (!data?.url) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'URL required' }));
              return;
            }

            const metadata = await this.extractor.analyzeVideoUrl(data.url);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: true,
                title: metadata.title,
                duration: metadata.duration,
                videoFormats: metadata.videoFormats,
                audioFormats: metadata.audioFormats,
              })
            );
          } catch (err: any) {
            LoggerService.error('BrowserServer', 'Error inspecting video for extension:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }

      // Handle adding new downloads from browser extension
      if (req.method === 'POST' && req.url === '/add-download') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          try {
            const data: BrowserDownloadRequest = JSON.parse(body);
            if (data && data.url) {
              const urlTrimmed = data.url.trim();
              if (urlTrimmed.startsWith('blob:') || urlTrimmed.startsWith('data:') || urlTrimmed.startsWith('filesystem:')) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Blob and Data URLs must be saved directly within your browser.' }));
                return;
              }

              const isAudio =
                data.type === 'audio' ||
                data.url.includes('soundcloud.com') ||
                data.url.includes('spotify.com') ||
                data.url.includes('gaana.com') ||
                data.url.includes('jiosaavn.com');

              const isVideo =
                !isAudio &&
                (data.type === 'video' ||
                  data.url.includes('youtube.com') ||
                  data.url.includes('youtu.be') ||
                  data.url.includes('vimeo.com') ||
                  data.url.includes('tiktok.com') ||
                  data.url.includes('instagram.com') ||
                  data.url.includes('twitter.com') ||
                  data.url.includes('x.com'));

              const requestData: BrowserDownloadRequest = {
                url: data.url,
                filename: data.filename,
                type: isAudio ? 'audio' : isVideo ? 'video' : 'file',
                quality: data.quality,
                formatId: data.formatId,
                startImmediately: data.startImmediately !== false,
              };

              if (this.onBrowserRequest) {
                this.onBrowserRequest(requestData);
              }

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, isMedia: isAudio || isVideo }));
            } else {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid URL provided' }));
            }
          } catch (e: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      res.writeHead(404);
      res.end();
    });

    this.server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`Browser integration port ${port} is already in use. Skipping duplicate server bind.`);
      } else {
        console.error('Browser integration server error:', err);
      }
    });

    this.server.listen(port, '127.0.0.1', () => {
      console.log(`Browser integration server listening on http://127.0.0.1:${port}`);
    });
  }

  public stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
