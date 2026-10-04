import { BrowserWindow, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { DownloadItem } from '../../../shared/types/download';
import { LoggerService } from '../logger/LoggerService';

export class ProgressWindowManager {
  private windows: Map<string, BrowserWindow> = new Map();
  private preloadPath: string;

  constructor(preloadPath: string) {
    this.preloadPath = preloadPath;
  }

  public openProgressWindow(downloadId: string, item?: DownloadItem): BrowserWindow {
    // If window already exists for this download, focus it
    const existing = this.windows.get(downloadId);
    if (existing && !existing.isDestroyed()) {
      if (existing.isMinimized()) existing.restore();
      existing.show();
      existing.focus();
      return existing;
    }

    // Cascade positioning so multiple windows stack cleanly like Windows copy dialogs
    const count = this.windows.size;
    const offsetX = (count % 6) * 35;
    const offsetY = (count % 6) * 35;

    const possibleIconPaths = [
      path.join(__dirname, '../../build/icon.png'),
      path.join(__dirname, '../build/icon.png'),
      path.join(app.getAppPath(), 'build/icon.png'),
      path.join(app.getAppPath(), 'public/logo.png'),
      path.join(process.resourcesPath, 'build/icon.png'),
      path.join(__dirname, '../../public/logo.png'),
    ];
    const windowIconPath = possibleIconPaths.find((p) => fs.existsSync(p)) || '';

    const win = new BrowserWindow({
      width: 500,
      height: 280,
      minWidth: 460,
      minHeight: 260,
      resizable: false,
      maximizable: false,
      minimizable: true,
      icon: windowIconPath,
      title: item ? `Downloading - ${item.filename}` : 'Vanya Downloader - Download Progress',
      autoHideMenuBar: true,
      backgroundColor: '#020617',
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    const currentPos = win.getPosition();
    win.setPosition(currentPos[0] + offsetX, currentPos[1] + offsetY);

    const isDev = process.env.NODE_ENV === 'development' && !app.isPackaged;
    if (isDev) {
      win.loadURL(`http://localhost:5173/#progress?id=${downloadId}`).catch((err) => {
        LoggerService.error('ProgressWindowManager', 'Error loading dev progress URL:', err);
      });
    } else {
      let indexPath = path.join(__dirname, '../../dist/index.html');
      if (!fs.existsSync(indexPath)) {
        indexPath = path.join(app.getAppPath(), 'dist/index.html');
      }
      win.loadFile(indexPath, { hash: `progress?id=${downloadId}` }).catch((err) => {
        LoggerService.error('ProgressWindowManager', 'Error loading prod progress file:', err);
      });
    }

    this.windows.set(downloadId, win);

    win.on('closed', () => {
      this.windows.delete(downloadId);
    });

    return win;
  }

  public broadcastProgress(item: DownloadItem): void {
    const win = this.windows.get(item.id);
    if (win && !win.isDestroyed()) {
      win.webContents.send('downloadProgress', item);
    }
  }

  public broadcastStateChange(item: DownloadItem): void {
    const win = this.windows.get(item.id);
    if (win && !win.isDestroyed()) {
      win.webContents.send('downloadStateChange', item);
    }
  }

  public closeWindow(downloadId: string): void {
    const win = this.windows.get(downloadId);
    if (win && !win.isDestroyed()) {
      win.close();
    }
    this.windows.delete(downloadId);
  }

  public closeAll(): void {
    for (const [_, win] of this.windows) {
      if (win && !win.isDestroyed()) {
        win.close();
      }
    }
    this.windows.clear();
  }
}
