import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';
import net from 'net';
import { EventEmitter } from 'events';

import { getEnginePath } from '../../utils/enginePath';
import { LoggerService } from '../logger/LoggerService';

export interface Aria2Status {
  gid: string;
  status: 'active' | 'waiting' | 'paused' | 'error' | 'complete' | 'removed';
  totalLength: string; // in bytes
  completedLength: string; // in bytes
  downloadSpeed: string; // bytes/sec
  errorCode?: string;
  errorMessage?: string;
  dir?: string;
  files?: Array<{ path: string; length: string; completedLength: string }>;
}

async function findAvailablePort(startPort: number = 6800): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => {
      resolve(findAvailablePort(startPort + 1));
    });
    server.listen(startPort, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => {
        resolve(port);
      });
    });
  });
}

export class Aria2Client extends EventEmitter {
  private process: ChildProcess | null = null;
  private rpcPort: number = 6800;
  private secretToken: string = 'vanya_secret_' + Math.random().toString(36).substring(2);
  private isRunning: boolean = false;

  constructor() {
    super();
  }

  /**
   * Spawns aria2c.exe process on local machine.
   */
  public async start(): Promise<boolean> {
    const enginePath = getEnginePath('engines/aria2/aria2c.exe');

    if (!fs.existsSync(enginePath)) {
      LoggerService.warn('Aria2Client', `aria2c.exe not found at: ${enginePath}. Native HTTP fallback ready.`);
      return false;
    }

    try {
      // Find a clean, available local port to avoid port conflicts with other instances
      this.rpcPort = await findAvailablePort(6800);

      const args = [
        '--enable-rpc=true',
        '--rpc-listen-all=false',
        `--rpc-listen-port=${this.rpcPort}`,
        `--rpc-secret=${this.secretToken}`,
        '--rpc-max-request-size=10M',
        '--max-connection-per-server=16',
        '--min-split-size=1M',
        '--continue=true',
        '--allow-overwrite=true',
        '--auto-file-renaming=false',
        '--file-allocation=none',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        '--check-certificate=false',
        '--conditional-get=true',
        '--max-tries=5',
        '--retry-wait=2',
        '--timeout=30',
        '--connect-timeout=15',
      ];

      this.process = spawn(enginePath, args, { windowsHide: true });

      this.process.on('error', (err) => {
        LoggerService.error('Aria2Client', 'aria2 process error', err);
        this.isRunning = false;
      });

      this.process.on('exit', (code) => {
        this.isRunning = false;
        this.process = null;
      });

      // Poll until RPC server is verified responsive (up to 3 seconds)
      for (let attempt = 0; attempt < 15; attempt++) {
        await new Promise((r) => setTimeout(r, 200));
        if (!this.process || this.process.exitCode !== null) {
          this.isRunning = false;
          return false;
        }
        try {
          await this.callRpc('aria2.getVersion');
          this.isRunning = true;
          return true;
        } catch {
          // Keep polling until ready
        }
      }

      this.isRunning = false;
      return false;
    } catch (err) {
      LoggerService.error('Aria2Client', 'Failed to spawn aria2:', err);
      this.isRunning = false;
      return false;
    }
  }

  public stop(): void {
    this.isRunning = false;
    if (this.process) {
      try {
        this.process.kill();
      } catch {}
      this.process = null;
    }
  }

  public isEngineActive(): boolean {
    return this.isRunning && this.process !== null && !this.process.killed && this.process.exitCode === null;
  }

  private async callRpc(method: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        jsonrpc: '2.0',
        id: 'vanya_' + Date.now(),
        method,
        params: [`token:${this.secretToken}`, ...params],
      });

      const options: http.RequestOptions = {
        hostname: '127.0.0.1',
        port: this.rpcPort,
        path: '/jsonrpc',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const json = JSON.parse(body);
              if (json.error) reject(new Error(json.error.message || 'RPC Error'));
              else resolve(json.result);
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        });
      });

      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  public async addUri(
    url: string,
    dir: string,
    filename: string,
    connections: number = 8,
    speedLimit: number = 0
  ): Promise<string> {
    const safeConn = Math.max(1, Math.min(connections || 8, 16));
    const options: any = {
      dir,
      out: filename,
      'max-connection-per-server': String(safeConn),
      split: String(safeConn),
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      header: [
        'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,audio/*,video/*,*/*;q=0.8',
        'Accept-Language: en-US,en;q=0.9',
      ],
      'check-certificate': 'false',
      'conditional-get': 'true',
      'allow-overwrite': 'true',
      'auto-file-renaming': 'false',
    };

    if (speedLimit > 0) {
      options['max-download-limit'] = `${speedLimit}`;
    }

    const gid = await this.callRpc('aria2.addUri', [[url], options]);
    return gid;
  }

  public async tellStatus(gid: string): Promise<Aria2Status> {
    return await this.callRpc('aria2.tellStatus', [gid]);
  }

  public async pause(gid: string): Promise<boolean> {
    try {
      await this.callRpc('aria2.pause', [gid]);
      return true;
    } catch {
      return false;
    }
  }

  public async unpause(gid: string): Promise<boolean> {
    try {
      await this.callRpc('aria2.unpause', [gid]);
      return true;
    } catch {
      return false;
    }
  }

  public async remove(gid: string): Promise<boolean> {
    try {
      await this.callRpc('aria2.removeDownloadResult', [gid]);
    } catch {}
    try {
      await this.callRpc('aria2.remove', [gid]);
      return true;
    } catch {
      return false;
    }
  }

  public async setGlobalSpeedLimit(bytesPerSec: number): Promise<boolean> {
    try {
      await this.callRpc('aria2.changeGlobalOption', [
        { 'max-overall-download-limit': String(bytesPerSec) },
      ]);
      return true;
    } catch {
      return false;
    }
  }
}
