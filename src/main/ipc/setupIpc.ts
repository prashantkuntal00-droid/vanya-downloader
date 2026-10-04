import { ipcMain, shell, dialog, app, BrowserWindow } from 'electron';
import path from 'path';
import { DownloadManager } from '../services/download/DownloadManager';
import { DatabaseService } from '../services/database/DatabaseService';
import { MediaExtractorService } from '../services/extractor/MediaExtractor';
import { LoggerService } from '../services/logger/LoggerService';
import { SchedulerTask } from '../../shared/types/ipc';

export function setupIpc(
  manager: DownloadManager,
  db: DatabaseService,
  extractor: MediaExtractorService
): void {
  LoggerService.info('IPC', 'Registering IPC handlers...');

  // Download Management
  ipcMain.handle('download:analyzeUrl', async (_, url: string) => {
    return await manager.analyzeUrl(url);
  });

  ipcMain.handle('download:add', async (_, options) => {
    return await manager.addDownload(options);
  });

  ipcMain.handle('download:start', async (_, id: string) => {
    return await manager.startDownloadItem(id);
  });

  ipcMain.handle('download:pause', async (_, id: string) => {
    return await manager.pauseDownload(id);
  });

  ipcMain.handle('download:resume', async (_, id: string) => {
    return await manager.resumeDownload(id);
  });

  ipcMain.handle('download:cancel', async (_, id: string) => {
    return await manager.cancelDownload(id);
  });

  ipcMain.handle('download:retry', async (_, id: string) => {
    return await manager.retryDownload(id);
  });

  ipcMain.handle('download:delete', async (_, id: string, deleteFile?: boolean) => {
    return await manager.deleteDownload(id, deleteFile);
  });

  ipcMain.handle('download:getDownloads', async () => {
    return db.getDownloads();
  });

  ipcMain.handle('download:getById', async (_, id: string) => {
    const list = db.getDownloads();
    return list.find((d) => d.id === id) || null;
  });

  ipcMain.handle('download:getStats', async () => {
    return manager.getStats();
  });

  ipcMain.handle('download:openFile', async (_, filepath: string) => {
    const res = await shell.openPath(filepath);
    return res === '';
  });

  ipcMain.handle('download:openFolder', async (_, filepath: string) => {
    shell.showItemInFolder(filepath);
    return true;
  });

  ipcMain.handle('download:startAll', async () => {
    return await manager.startAll();
  });

  ipcMain.handle('download:pauseAll', async () => {
    return await manager.pauseAll();
  });

  ipcMain.handle('download:resumeAll', async () => {
    return await manager.resumeAll();
  });

  ipcMain.handle('download:cancelAll', async () => {
    return await manager.cancelAll();
  });

  ipcMain.handle('download:clearHistory', async () => {
    db.clearHistory();
    return true;
  });

  // Queue Management
  ipcMain.handle('queue:reorder', async (_, id: string, newPriority: number) => {
    const downloads = db.getDownloads();
    const item = downloads.find((d) => d.id === id);
    if (item) {
      item.priority = newPriority;
      db.saveDownloadItem(item);
    }
    return true;
  });

  // Video Extraction
  ipcMain.handle('extractor:analyzeVideoUrl', async (_, url: string) => {
    return await extractor.analyzeVideoUrl(url);
  });

  // Settings
  ipcMain.handle('settings:get', async () => {
    return db.getSettings();
  });

  ipcMain.handle('settings:update', async (_, newSettings) => {
    const current = db.getSettings();
    const updated = { ...current, ...newSettings };
    db.saveSettings(updated);

    try {
      if (updated.startWithWindows !== undefined) {
        app.setLoginItemSettings({
          openAtLogin: !!updated.startWithWindows,
          openAsHidden: true,
        });
      }
    } catch (err: any) {
      LoggerService.warn('IPC', `Could not update login item settings: ${err?.message || err}`);
    }

    return updated;
  });

  ipcMain.handle('settings:selectDirectory', async () => {
    const res = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    if (!res.canceled && res.filePaths.length > 0) {
      return res.filePaths[0];
    }
    return null;
  });

  // Scheduler
  ipcMain.handle('scheduler:getTasks', async () => {
    return db.getSchedulerTasks();
  });

  ipcMain.handle('scheduler:saveTask', async (_, task: SchedulerTask) => {
    const tasks = db.getSchedulerTasks();
    const index = tasks.findIndex((t) => t.id === task.id);
    if (index >= 0) tasks[index] = task;
    else tasks.push(task);
    db.saveSchedulerTasks(tasks);
    return true;
  });

  ipcMain.handle('scheduler:deleteTask', async (_, id: string) => {
    const tasks = db.getSchedulerTasks().filter((t) => t.id !== id);
    db.saveSchedulerTasks(tasks);
    return true;
  });

  // Diagnostics & Logging
  ipcMain.handle('system:openLogsFolder', async () => {
    const logsDir = LoggerService.getLogsDir();
    shell.openPath(logsDir);
    return true;
  });

  ipcMain.handle('system:logError', async (_, title: string, details?: string) => {
    LoggerService.logRenderer('ERROR', title, details);
    return true;
  });

  // In-App Upgrade & Instant Reload
  ipcMain.handle('app:upgradeAndReload', async () => {
    LoggerService.info('AppUpgrade', 'In-App Instant Upgrade & Reload triggered.');
    const allWindows = BrowserWindow.getAllWindows();
    for (const win of allWindows) {
      try {
        win.webContents.reloadIgnoringCache();
      } catch (err: any) {
        LoggerService.warn('AppUpgrade', `Error reloading window: ${err?.message || err}`);
      }
    }
    return { success: true, message: 'Application successfully updated and reloaded!' };
  });

  ipcMain.handle('app:restart', async () => {
    LoggerService.info('AppUpgrade', 'Relaunching app on user request.');
    app.relaunch();
    app.exit(0);
    return true;
  });

  // Window Controls (for Floating Progress Windows and Dialogs)
  ipcMain.handle('window:minimize', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      win.minimize();
      return true;
    }
    return false;
  });

  ipcMain.handle('window:close', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      win.close();
      return true;
    }
    return false;
  });

  LoggerService.info('IPC', 'All IPC handlers registered successfully.');
}

