import { Tray, Menu, BrowserWindow, app, nativeImage } from 'electron';
import path from 'path';
import { DownloadManager } from '../download/DownloadManager';
import { DatabaseService } from '../database/DatabaseService';

export class TrayService {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow;
  private manager: DownloadManager;
  private db: DatabaseService;

  constructor(mainWindow: BrowserWindow, manager: DownloadManager, db: DatabaseService) {
    this.mainWindow = mainWindow;
    this.manager = manager;
    this.db = db;
  }

  public initialize(): void {
    const fs = require('fs');
    const possibleIconPaths = [
      path.join(__dirname, '../../build/icon.png'),
      path.join(__dirname, '../build/icon.png'),
      path.join(app.getAppPath(), 'build/icon.png'),
      path.join(app.getAppPath(), 'public/logo.png'),
      path.join(process.resourcesPath, 'build/icon.png'),
    ];
    const foundPath = possibleIconPaths.find((p) => fs.existsSync(p));
    let icon = foundPath
      ? nativeImage.createFromPath(foundPath).resize({ width: 16, height: 16 })
      : nativeImage.createFromBitmap(Buffer.alloc(16 * 16 * 4, 255), { width: 16, height: 16 });

    this.tray = new Tray(icon);
    this.tray.setToolTip('Vanya Downloader');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open Vanya Downloader',
        click: () => {
          this.mainWindow.show();
          this.mainWindow.focus();
        },
      },
      { type: 'separator' },
      {
        label: 'Resume All',
        click: () => this.manager.resumeAll(),
      },
      {
        label: 'Pause All',
        click: () => this.manager.pauseAll(),
      },
      { type: 'separator' },
      {
        label: 'Exit',
        click: () => {
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);

    this.tray.on('double-click', () => {
      this.mainWindow.show();
      this.mainWindow.focus();
    });

    // Close to tray behavior
    this.mainWindow.on('close', (event) => {
      const settings = this.db.getSettings();
      if (settings.closeToTray && !(app as any).isQuitting) {
        event.preventDefault();
        this.mainWindow.hide();
      }
    });
  }

  public destroy(): void {
    if (this.tray) {
      try {
        this.tray.destroy();
      } catch {}
      this.tray = null;
    }
  }
}
