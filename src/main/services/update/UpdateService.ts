import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater, UpdateCheckResult, UpdateInfo, ProgressInfo } from 'electron-updater';
import { LoggerService } from '../logger/LoggerService';
import { UpdateStatus, UpdateState, UpdateProgress } from '../../../shared/types/update';

export { UpdateStatus, UpdateState, UpdateProgress };

// ============================================================
// UPDATE SERVICE
// ============================================================
export class UpdateService {
  private static instance: UpdateService | null = null;
  private status: UpdateStatus;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private isChecking = false;
  private mainWindowRef: (() => BrowserWindow | null) | null = null;

  /** Auto-check interval in milliseconds (default: 4 hours) */
  private readonly CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

  constructor() {
    this.status = {
      state: 'IDLE',
      currentVersion: app.getVersion(),
      lastChecked: undefined,
    };
  }

  static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  // ============================================================
  // INITIALIZATION
  initialize(getMainWindow: () => BrowserWindow | null): void {
    this.mainWindowRef = getMainWindow;
    this.registerIpcHandlers();

    // IMPORTANT: Only run real background update checks in production packaged builds.
    // In development, log a notice and skip to prevent polluting GitHub releases.
    if (!app.isPackaged) {
      LoggerService.info('UpdateService', 'Running in development mode — automated background update checks are disabled.');
      this.status.state = 'IDLE';
      return;
    }

    this.configureAutoUpdater();

    // Check on startup (delayed 8 seconds to not delay app launch)
    setTimeout(() => {
      this.checkForUpdates(false);
    }, 8000);

    // Periodic check every 4 hours
    this.checkInterval = setInterval(() => {
      this.checkForUpdates(false);
    }, this.CHECK_INTERVAL_MS);

    LoggerService.info('UpdateService', `UpdateService initialized. Current version: ${app.getVersion()}`);
  }

  // ============================================================
  // CONFIGURE ELECTRON-UPDATER
  // ============================================================
  private configureAutoUpdater(): void {
    // Use GitHub Releases as the update provider (configured in package.json build.publish)
    autoUpdater.logger = {
      info: (msg: any) => LoggerService.info('AutoUpdater', String(msg)),
      warn: (msg: any) => LoggerService.warn('AutoUpdater', String(msg)),
      error: (msg: any) => LoggerService.error('AutoUpdater', String(msg)),
      debug: (_msg: any) => {}, // suppress debug noise
    };

    // Do NOT auto-download; let user initiate after seeing notification
    autoUpdater.autoDownload = false;

    // Do NOT auto-install on quit by default; user must click "Restart & Install"
    autoUpdater.autoInstallOnAppQuit = false;

    // Never allow downgrading
    autoUpdater.allowDowngrade = false;

    // Stable channel only (no alpha/beta/rc unless user opts-in)
    autoUpdater.channel = 'latest';

    // ---- Event Handlers ----

    autoUpdater.on('checking-for-update', () => {
      LoggerService.info('AutoUpdater', 'Checking for update...');
      this.updateStatus({ state: 'CHECKING' });
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      LoggerService.info('AutoUpdater', `Update available: ${info.version}`);
      let notes = '';
      if (info.releaseNotes) {
        if (typeof info.releaseNotes === 'string') {
          notes = info.releaseNotes;
        } else if (Array.isArray(info.releaseNotes)) {
          notes = info.releaseNotes.map((n: any) => (typeof n === 'string' ? n : n?.note || '')).join('\n');
        }
        // Strip HTML tags for clean display
        notes = notes.replace(/<[^>]*>/g, '').trim();
      }

      this.updateStatus({
        state: 'UPDATE_AVAILABLE',
        availableVersion: info.version,
        releaseNotes: notes,
        lastChecked: Date.now(),
      });
    });

    autoUpdater.on('update-not-available', () => {
      LoggerService.info('AutoUpdater', 'No update available. Already up to date.');
      this.updateStatus({
        state: 'UP_TO_DATE',
        lastChecked: Date.now(),
      });
    });

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      this.updateStatus({
        state: 'DOWNLOADING',
        progress: {
          percent: Math.round(progress.percent * 10) / 10,
          transferred: progress.transferred,
          total: progress.total,
          bytesPerSecond: progress.bytesPerSecond,
        },
      });
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      LoggerService.info('AutoUpdater', `Update downloaded: ${info.version}`);
      this.updateStatus({
        state: 'DOWNLOADED',
        availableVersion: info.version,
      });
    });

    autoUpdater.on('error', (err: Error) => {
      const msg = err?.message || String(err);
      LoggerService.error('AutoUpdater', `Update error: ${msg}`);

      // Sanitize error message for user display (no stack traces)
      let userMsg = 'Unable to check for updates. Please try again later.';
      if (msg.includes('net::ERR') || msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')) {
        userMsg = 'No internet connection. Update check skipped.';
      } else if (msg.includes('404') || msg.includes('release')) {
        userMsg = 'No release found on GitHub. Update unavailable.';
      } else if (msg.includes('ENOSPC')) {
        userMsg = 'Insufficient disk space to download update.';
      }

      this.updateStatus({
        state: 'ERROR',
        error: userMsg,
        lastChecked: Date.now(),
      });
    });
  }

  // ============================================================
  // IPC HANDLERS
  // ============================================================
  private registerIpcHandlers(): void {
    // Renderer → Main: Get current update status
    ipcMain.handle('updater:getStatus', async () => {
      return this.status;
    });

    // Renderer → Main: Manual "Check for Updates" button
    ipcMain.handle('updater:checkForUpdates', async () => {
      return await this.checkForUpdates(true);
    });

    // Renderer → Main: "Download Update" button
    ipcMain.handle('updater:downloadUpdate', async () => {
      return await this.downloadUpdate();
    });

    // Renderer → Main: "Restart & Install" button
    ipcMain.handle('updater:quitAndInstall', async () => {
      return this.quitAndInstall();
    });
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  /** Check for updates. silently=true suppresses error notifications for periodic checks. */
  async checkForUpdates(manual: boolean = false): Promise<UpdateCheckResult | null> {
    if (!app.isPackaged) {
      LoggerService.info('UpdateService', 'Dev mode: skipping live network update check.');
      if (manual) {
        this.updateStatus({
          state: 'UP_TO_DATE',
          lastChecked: Date.now(),
        });
      }
      return null;
    }
    if (this.isChecking) {
      LoggerService.info('UpdateService', 'Update check already in progress, skipping.');
      return null;
    }
    this.isChecking = true;
    try {
      LoggerService.info('UpdateService', `${manual ? 'Manual' : 'Periodic'} update check triggered.`);
      const result = await autoUpdater.checkForUpdates();
      return result;
    } catch (err: any) {
      // Error event already fired by autoUpdater, just log here
      LoggerService.warn('UpdateService', `checkForUpdates threw: ${err?.message || err}`);
      if (manual) {
        // For manual checks, make sure the UI sees the error even if event didn't fire
        this.updateStatus({
          state: 'ERROR',
          error: 'Unable to check for updates. Please try again later.',
          lastChecked: Date.now(),
        });
      }
      return null;
    } finally {
      this.isChecking = false;
    }
  }

  /** Start downloading the available update */
  async downloadUpdate(): Promise<boolean> {
    if (!app.isPackaged) return false;
    if (this.status.state !== 'UPDATE_AVAILABLE') {
      LoggerService.warn('UpdateService', 'downloadUpdate called but no update is available.');
      return false;
    }
    try {
      LoggerService.info('UpdateService', 'Starting update download...');
      this.updateStatus({ state: 'DOWNLOADING' });
      await autoUpdater.downloadUpdate();
      return true;
    } catch (err: any) {
      LoggerService.error('UpdateService', `Download failed: ${err?.message || err}`);
      this.updateStatus({
        state: 'ERROR',
        error: 'Download failed. Please try again.',
      });
      return false;
    }
  }

  /** Install the downloaded update and restart the application */
  quitAndInstall(): boolean {
    if (!app.isPackaged) return false;
    if (this.status.state !== 'DOWNLOADED') {
      LoggerService.warn('UpdateService', 'quitAndInstall called but update is not downloaded yet.');
      return false;
    }
    try {
      LoggerService.info('UpdateService', 'Installing update and restarting...');
      this.updateStatus({ state: 'INSTALLING' });
      // isSilent=true enables seamless background installation without showing the interactive NSIS wizard.
      // isForceRunAfter=true ensures the new version launches automatically once the update completes.
      autoUpdater.quitAndInstall(true, true);
      return true;
    } catch (err: any) {
      LoggerService.error('UpdateService', `quitAndInstall error: ${err?.message || err}`);
      return false;
    }
  }

  getStatus(): UpdateStatus {
    return { ...this.status };
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  // ============================================================
  // INTERNAL: Update status and broadcast to renderer
  // ============================================================
  private updateStatus(patch: Partial<UpdateStatus>): void {
    this.status = { ...this.status, ...patch };
    this.broadcastToRenderer('updater:statusChange', this.status);
  }

  private broadcastToRenderer(channel: string, data: any): void {
    if (!this.mainWindowRef) return;
    const win = this.mainWindowRef();
    if (win && !win.isDestroyed()) {
      try {
        win.webContents.send(channel, data);
      } catch {
        // Window may be closing
      }
    }
  }
}
