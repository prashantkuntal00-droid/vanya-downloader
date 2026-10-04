import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { DatabaseService } from './services/database/DatabaseService';
import { Aria2Client } from './services/download/Aria2Client';
import { DownloadManager } from './services/download/DownloadManager';
import { MediaExtractorService } from './services/extractor/MediaExtractor';
import { SchedulerService } from './services/scheduler/SchedulerService';
import { NotificationService } from './services/notifications/NotificationService';
import { ClipboardMonitorService } from './services/notifications/ClipboardMonitorService';
import { BrowserServer } from './services/browser/BrowserServer';
import { TrayService } from './services/notifications/TrayService';
import { LoggerService } from './services/logger/LoggerService';
import { setupIpc } from './ipc/setupIpc';
import { UpdateService } from './services/update/UpdateService';
import { ProgressWindowManager } from './services/windows/ProgressWindowManager';

let mainWindow: BrowserWindow | null = null;
let db: DatabaseService;
let aria2: Aria2Client;
let manager: DownloadManager;
let extractor: MediaExtractorService;
let scheduler: SchedulerService;
let notification: NotificationService;
let clipboardMonitor: ClipboardMonitorService;
let browserServer: BrowserServer;
let trayService: TrayService;
let progressWindowManager: ProgressWindowManager;
const updateService = UpdateService.getInstance();

// Set application user model ID for Windows notifications & taskbar grouping
if (process.platform === 'win32') {
  app.setAppUserModelId('com.vanya.downloader');
}

// Setup global exception logging
process.on('uncaughtException', (error) => {
  LoggerService.error('MainProcess', 'Uncaught Exception', error);
});

process.on('unhandledRejection', (reason) => {
  LoggerService.error('MainProcess', 'Unhandled Rejection', reason);
});

async function createWindow() {
  LoggerService.initialize();
  LoggerService.info('MainProcess', 'Starting Vanya Downloader...');
  LoggerService.info('MainProcess', `App path: ${app.getAppPath()}, isPackaged: ${app.isPackaged}`);

  // Auto-register Native Messaging Host for Chrome/Edge/Brave
  try {
    const { registerNativeHost } = require('./native-host/register-host');
    registerNativeHost();
  } catch (err: any) {
    LoggerService.warn('MainProcess', `Native host registration notice: ${err?.message || err}`);
  }

  // 1. Initialize core DB and services safely
  try {
    db = new DatabaseService();
    aria2 = new Aria2Client();
    manager = new DownloadManager(db, aria2);
    extractor = new MediaExtractorService();
  } catch (err) {
    LoggerService.error('MainProcess', 'Failed to instantiate core services:', err);
  }

  // 2. Resolve preload & renderer paths safely
  let preloadPath = path.join(__dirname, '../preload/preload.js');
  if (!fs.existsSync(preloadPath)) {
    preloadPath = path.join(app.getAppPath(), 'dist-electron/preload/preload.js');
  }

  LoggerService.info('MainProcess', `Using preloadPath: ${preloadPath}`);

  // Instantiate progress window manager
  progressWindowManager = new ProgressWindowManager(preloadPath);

  // 3. Setup IPC BEFORE creating BrowserWindow and loading renderer
  try {
    setupIpc(manager, db, extractor);

    ipcMain.handle('window:openProgressWindow', async (_, id: string) => {
      const item = db.getDownloads().find((d) => d.id === id);
      if (item && progressWindowManager) {
        progressWindowManager.openProgressWindow(id, item);
      }
      return true;
    });
  } catch (err) {
    LoggerService.error('MainProcess', 'Failed to set up IPC:', err);
  }

  // Resolve native window icon path
  const possibleIconPaths = [
    path.join(__dirname, '../../build/icon.png'),
    path.join(__dirname, '../build/icon.png'),
    path.join(app.getAppPath(), 'build/icon.png'),
    path.join(app.getAppPath(), 'public/logo.png'),
    path.join(process.resourcesPath, 'build/icon.png'),
    path.join(__dirname, '../../public/logo.png'),
  ];
  let windowIconPath = possibleIconPaths.find((p) => fs.existsSync(p)) || '';

  // Determine if this launch was triggered in background / hidden mode (e.g. from Native Messaging or Windows startup)
  const isBackgroundLaunch = process.argv.includes('--hidden') || process.argv.includes('--background') || process.argv.includes('--minimized');

  // 4. Create BrowserWindow (Main consolidated dashboard)
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: !isBackgroundLaunch,
    title: 'Vanya Downloader',
    icon: windowIconPath,
    autoHideMenuBar: true,
    backgroundColor: '#020617',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Attach webContents diagnostic logging listeners
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    LoggerService.error(
      'Renderer',
      `Failed to load page: ${validatedURL} (Code: ${errorCode}, Description: ${errorDescription})`
    );
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    LoggerService.error('Renderer', `Render process crashed/gone: ${details.reason} (exitCode: ${details.exitCode})`);
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levelStr = level === 3 ? 'ERROR' : level === 2 ? 'WARN' : 'INFO';
    LoggerService.logRenderer(levelStr, `${message} (${sourceId}:${line})`);
  });

  // 5. Load Renderer HTML
  const isDev = process.env.NODE_ENV === 'development' && !app.isPackaged;
  if (isDev) {
    LoggerService.info('MainProcess', 'Loading development URL: http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173').catch((err) => {
      LoggerService.error('MainProcess', 'Error loading dev URL:', err);
    });
  } else {
    let indexPath = path.join(__dirname, '../../dist/index.html');
    if (!fs.existsSync(indexPath)) {
      indexPath = path.join(app.getAppPath(), 'dist/index.html');
    }
    LoggerService.info('MainProcess', `Loading production file: ${indexPath}`);
    mainWindow.loadFile(indexPath).catch((err) => {
      LoggerService.error('MainProcess', 'Error loading production index.html:', err);
    });
  }

  mainWindow.on('close', (event) => {
    const settings = db?.getSettings();
    if (settings?.closeToTray !== false && !(app as any).isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Initialize System Tray immediately so Vanya stays accessible 24/7 in background
  try {
    trayService = new TrayService(mainWindow, manager, db);
    trayService.initialize();
  } catch (err) {
    LoggerService.error('MainProcess', 'Error initializing TrayService:', err);
  }

  // Initialize UpdateService — checks for updates in background, does NOT block startup
  try {
    updateService.initialize(() => mainWindow);
    LoggerService.info('MainProcess', 'UpdateService initialized.');
  } catch (err) {
    LoggerService.warn('MainProcess', `UpdateService init notice: ${err}`);
  }

  if (isBackgroundLaunch && mainWindow) {
    mainWindow.hide();
  }

  // 4. Start Browser Integration Server IMMEDIATELY so browser extension connects in 0ms
  try {
    browserServer = new BrowserServer(manager, db, extractor, async (req) => {
      if (req.startImmediately) {
        // Direct download triggered from in-page dropdown without opening full app
        try {
          let formatId = req.formatId;
          const isAudio = req.type === 'audio';
          const ext = isAudio ? 'mp3' : 'mp4';

          // Fast non-blocking format assignment for instant popup launch
          if (!formatId && (req.type === 'video' || req.type === 'audio')) {
            if (isAudio) {
              const q = (req.quality || '320').replace(/[^0-9]/g, '') || '320';
              formatId = `bestaudio[abr<=${q}]/bestaudio/best`;
            } else {
              const q = (req.quality || '1080').replace(/[^0-9]/g, '') || '1080';
              formatId = `bestvideo[height<=${q}]+bestaudio/best[height<=${q}]/best`;
            }
          }

          let cleanFilename: string | undefined = undefined;
          if (req.filename || (req as any).title) {
            cleanFilename = (req.filename || (req as any).title)
              .replace(/[\/\\:*?"<>|]/g, '_')
              .replace(/\s+/g, ' ')
              .trim();
          } else if (req.type === 'video' || req.type === 'audio') {
            cleanFilename = isAudio ? 'Audio_Download.mp3' : 'Video_Download.mp4';
          }

          if (cleanFilename && (req.type === 'video' || req.type === 'audio') && !cleanFilename.endsWith(`.${ext}`)) {
            cleanFilename = `${cleanFilename}.${ext}`;
          }

          const item = await manager.addDownload({
            url: req.url,
            filename: cleanFilename,
            startImmediately: true,
            sourceType: req.type === 'video' || req.type === 'audio' ? 'VIDEO' : 'HTTP',
            videoFormatId: formatId,
            category: isAudio ? 'Music' : req.type === 'video' ? 'Videos' : 'Other',
          });

          if (item?.id && progressWindowManager) {
            const pWin = progressWindowManager.openProgressWindow(item.id, item);
            if (pWin && !pWin.isDestroyed()) {
              pWin.show();
              pWin.focus();
            }
          }
        } catch (e: any) {
          LoggerService.error('MainProcess', 'Direct download error from browser:', e);
        }
      } else {
        // User requested full selector modal inside app
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.setAlwaysOnTop(true);
          mainWindow.show();
          mainWindow.focus();
          mainWindow.setAlwaysOnTop(false);

          if (req.type === 'video' || req.type === 'audio') {
            mainWindow.webContents.send('openVideoPrompt', {
              url: req.url,
              type: req.type,
              quality: req.quality,
              formatId: req.formatId,
              startImmediately: false,
            });
          } else {
            mainWindow.webContents.send('openDownloadPrompt', {
              url: req.url,
              filename: req.filename,
              startImmediately: false,
            });
          }
        }
      }

      if (notification && req.url) {
        notification.notifyUrlDetected(req.url);
      }
    });
    browserServer.start();
  } catch (err) {
    LoggerService.error('MainProcess', 'Error starting BrowserServer:', err);
  }

  // 5. Initialize background engines and services non-blocking in background
  Promise.resolve().then(async () => {
    try {
      await manager.initialize();
    } catch (err) {
      LoggerService.error('MainProcess', 'Error initializing DownloadManager:', err);
    }

    try {
      scheduler = new SchedulerService(db, manager);
      scheduler.start();
    } catch (err) {
      LoggerService.error('MainProcess', 'Error starting SchedulerService:', err);
    }

    try {
      notification = new NotificationService(db);
      clipboardMonitor = new ClipboardMonitorService(db);
      clipboardMonitor.start();
    } catch (err) {
      LoggerService.error('MainProcess', 'Error starting Clipboard/Notification services:', err);
    }
  });

  // Forward DownloadManager events to Renderer and Floating Windows
  if (manager) {
    manager.on('downloadProgress', (item) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('downloadProgress', item);
      }
      if (progressWindowManager) {
        progressWindowManager.broadcastProgress(item);
      }
    });

    manager.on('downloadStateChange', (item) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('downloadStateChange', item);
      }
      if (progressWindowManager) {
        progressWindowManager.broadcastStateChange(item);
      }
      if (item.status === 'COMPLETED') {
        if (notification) {
          notification.notifyDownloadCompleted(item.filename, () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
            }
          });
        }
      } else if (item.status === 'FAILED') {
        if (notification) {
          notification.notifyDownloadFailed(item.filename, item.errorMessage);
        }
      }
    });

    manager.on('statsUpdate', (stats) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('statsUpdate', stats);
      }
    });
  }

  if (clipboardMonitor) {
    clipboardMonitor.on('urlDetected', (url) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('clipboardUrlDetected', url);
      }
      if (notification) {
        notification.notifyUrlDetected(url, () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        });
      }
    });
  }
}

// Register custom URL protocol client 'vanya://'
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('vanya', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('vanya');
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    await createWindow();

    try {
      if (db) {
        const settings = db.getSettings();
        app.setLoginItemSettings({
          openAtLogin: settings.startWithWindows !== false,
          openAsHidden: true,
        });
      }
    } catch (err: any) {
      LoggerService.warn('MainProcess', `Failed to configure login item settings: ${err?.message || err}`);
    }
  });
}

app.on('window-all-closed', () => {
  const settings = db ? db.getSettings() : null;
  if (settings?.closeToTray !== false) {
    // Keep app running in Windows system tray (IDM behavior)
    return;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  (app as any).isQuitting = true;
  if (trayService) {
    try { trayService.destroy(); } catch {}
  }
  if (db) {
    try { db.flush(); } catch {}
  }
  if (aria2) aria2.stop();
  if (scheduler) scheduler.stop();
  if (clipboardMonitor) clipboardMonitor.stop();
  if (browserServer) browserServer.stop();
  if (updateService) updateService.stop();
});
