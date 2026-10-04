import http from 'http';
import https from 'https';
import { URL } from 'url';
import { extractFilenameFromHeader, extractFilenameFromUrl } from './SmartNaming';
import { LoggerService } from '../logger/LoggerService';

export interface AnalyzedUrlInfo {
  url: string;
  finalUrl: string;
  filename: string;
  totalSize?: number;
  mimeType?: string;
  supportsResume: boolean;
}

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/**
 * Robustly inspects any HTTP/HTTPS URL to detect exact file size, filename, and resume capabilities.
 * Employs IDM-style byte-range probing (Range: bytes=0-1) to bypass script-based download wrappers.
 */
export async function analyzeHttpUrl(
  urlStr: string,
  maxRedirects: number = 6
): Promise<AnalyzedUrlInfo> {
  let currentUrl = urlStr;
  let redirectsRemaining = maxRedirects;

  const fallbackName = extractFilenameFromUrl(urlStr);

  if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
    return {
      url: urlStr,
      finalUrl: urlStr,
      filename: fallbackName,
      supportsResume: true,
    };
  }

  while (redirectsRemaining >= 0) {
    try {
      const result = await probeUrlOnce(currentUrl);

      if (result.redirectUrl) {
        // Resolve relative or absolute redirect URL
        try {
          currentUrl = new URL(result.redirectUrl, currentUrl).toString();
          redirectsRemaining--;
          continue;
        } catch {
          break;
        }
      }

      return {
        url: urlStr,
        finalUrl: currentUrl,
        filename: result.filename || extractFilenameFromUrl(currentUrl) || fallbackName,
        totalSize: result.totalSize,
        mimeType: result.mimeType,
        supportsResume: result.supportsResume,
      };
    } catch (err: any) {
      LoggerService.warn('UrlAnalyzer', `Probing attempt failed for ${currentUrl}: ${err?.message || err}`);
      break;
    }
  }

  return {
    url: urlStr,
    finalUrl: currentUrl,
    filename: extractFilenameFromUrl(currentUrl) || fallbackName,
    supportsResume: true,
  };
}

interface SingleProbeResult {
  redirectUrl?: string;
  filename?: string;
  totalSize?: number;
  mimeType?: string;
  supportsResume: boolean;
}

function probeUrlOnce(targetUrl: string): Promise<SingleProbeResult> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch (e) {
      return reject(e);
    }

    const isHttps = parsed.protocol === 'https:';
    const client = isHttps ? https : http;

    const reqOptions: https.RequestOptions = {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      timeout: 8000,
      headers: {
        'User-Agent': CHROME_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,audio/*,video/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        Range: 'bytes=0-1', // IDM signature: requests 2 bytes to force server to return Content-Range with exact total size
        Referer: parsed.origin + '/',
        Connection: 'close',
      },
    };

    const req = client.request(reqOptions, (res) => {
      const statusCode = res.statusCode || 0;

      // Handle 3xx Redirects
      if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
        req.destroy();
        return resolve({
          redirectUrl: res.headers.location,
          supportsResume: true,
        });
      }

      const contentDisposition = res.headers['content-disposition'];
      const mimeType = res.headers['content-type'];
      const acceptRanges = res.headers['accept-ranges'];
      const contentRange = res.headers['content-range'];
      const contentLength = res.headers['content-length'];

      let totalSize: number | undefined;
      let supportsResume = acceptRanges === 'bytes';

      // 1. Check Content-Range (e.g. "bytes 0-1/12450000")
      if (contentRange) {
        const match = /\/(\d+)/.exec(contentRange);
        if (match && match[1]) {
          totalSize = parseInt(match[1], 10);
          supportsResume = true;
        }
      }

      // 2. If 200 OK (server ignored Range header), Content-Length is the full file size
      if (!totalSize && contentLength && statusCode === 200) {
        totalSize = parseInt(contentLength, 10);
      }

      const headerFilename = extractFilenameFromHeader(contentDisposition);

      // Close stream immediately so no data payload is downloaded
      req.destroy();

      resolve({
        filename: headerFilename || undefined,
        totalSize,
        mimeType,
        supportsResume,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Connection timed out while probing URL'));
    });

    req.on('error', (err) => {
      // If Range GET failed, try a simple HEAD request as fallback
      probeHeadFallback(targetUrl).then(resolve).catch(() => reject(err));
    });

    req.end();
  });
}

function probeHeadFallback(targetUrl: string): Promise<SingleProbeResult> {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(targetUrl);
      const isHttps = parsed.protocol === 'https:';
      const client = isHttps ? https : http;

      const req = client.request(
        targetUrl,
        {
          method: 'HEAD',
          timeout: 6000,
          headers: {
            'User-Agent': CHROME_UA,
            Accept: '*/*',
            'Accept-Encoding': 'identity',
          },
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            req.destroy();
            return resolve({ redirectUrl: res.headers.location, supportsResume: true });
          }

          const contentLength = res.headers['content-length'];
          const totalSize = contentLength ? parseInt(contentLength, 10) : undefined;
          const mimeType = res.headers['content-type'];
          const contentDisposition = res.headers['content-disposition'];
          const acceptRanges = res.headers['accept-ranges'];

          const headerFilename = extractFilenameFromHeader(contentDisposition);
          const supportsResume = acceptRanges === 'bytes' || !!contentLength;

          req.destroy();

          resolve({
            filename: headerFilename || undefined,
            totalSize,
            mimeType,
            supportsResume,
          });
        }
      );

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('HEAD timeout'));
      });
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}
