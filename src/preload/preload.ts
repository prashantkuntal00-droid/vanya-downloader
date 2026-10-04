import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Download Management
  analyzeUrl: (url: string) => ipcRenderer.invoke('download:analyzeUrl', url),
  addDownload: (options: any) => ipcRenderer.invoke('download:add', options),
  startDownload: (id: string) => ipcRenderer.invoke('download:start', id),
  pauseDownload: (id: string) => ipcRenderer.invoke('download:pause', id),
  resumeDownload: (id: string) => ipcRenderer.invoke('download:resume', id),
  cancelDownload: (id: string) => ipcRenderer.invoke('download:cancel', id),
  retryDownload: (id: string) => ipcRenderer.invoke('download:retry', id),
  deleteDownload: (id: string, deleteFile?: boolean) => ipcRenderer.invoke('download:delete', id, deleteFile),
  getDownloads: () => ipcRenderer.invoke('download:getDownloads'),
  getDownloadById: (id: string) => ipcRenderer.invoke('download:getById', id),
  getStats: () => ipcRenderer.invoke('download:getStats'),
  openProgressWindow: (id: string) => ipcRenderer.invoke('window:openProgressWindow', id),
  openFile: (filepath: string) => ipcRenderer.invoke('download:openFile', filepath),
  openFolder: (filepath: string) => ipcRenderer.invoke('download:openFolder', filepath),
  startAll: () => ipcRenderer.invoke('download:startAll'),
  pauseAll: () => ipcRenderer.invoke('download:pauseAll'),
  resumeAll: () => ipcRenderer.invoke('download:resumeAll'),
  cancelAll: () => ipcRenderer.invoke('download:cancelAll'),
  clearHistory: () => ipcRenderer.invoke('download:clearHistory'),

  // Queue Management
  reorderQueue: (id: string, newPriority: number) => ipcRenderer.invoke('queue:reorder', id, newPriority),

  // Video Extraction
  analyzeVideoUrl: (url: string) => ipcRenderer.invoke('extractor:analyzeVideoUrl', url),
  downloadVideo: (url: string, formatId: string, audioFormatId?: string, filename?: string) =>
    ipcRenderer.invoke('download:add', { url, videoFormatId: formatId, audioFormatId, filename, sourceType: 'VIDEO' }),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: any) => ipcRenderer.invoke('settings:update', settings),
  selectDirectory: () => ipcRenderer.invoke('settings:selectDirectory'),

  // Scheduler
  getSchedulerTasks: () => ipcRenderer.invoke('scheduler:getTasks'),
  saveSchedulerTask: (task: any) => ipcRenderer.invoke('scheduler:saveTask', task),
  deleteSchedulerTask: (id: string) => ipcRenderer.invoke('scheduler:deleteTask', id),

  // Diagnostics & In-App Upgrade & Window Controls
  openLogsFolder: () => ipcRenderer.invoke('system:openLogsFolder'),
  logError: (title: string, details?: string) => ipcRenderer.invoke('system:logError', title, details),
  upgradeAndReload: () => ipcRenderer.invoke('app:upgradeAndReload'),
  restartApp: () => ipcRenderer.invoke('app:restart'),
  minimizeCurrentWindow: () => ipcRenderer.invoke('window:minimize'),
  closeCurrentWindow: () => ipcRenderer.invoke('window:close'),

  // Update & Release System
  getUpdateStatus: () => ipcRenderer.invoke('updater:getStatus'),
  checkForUpdates: () => ipcRenderer.invoke('updater:checkForUpdates'),
  downloadUpdate: () => ipcRenderer.invoke('updater:downloadUpdate'),
  quitAndInstall: () => ipcRenderer.invoke('updater:quitAndInstall'),

  // Events
  onDownloadProgress: (callback: (item: any) => void) => {
    const handler = (_: any, item: any) => callback(item);
    ipcRenderer.on('downloadProgress', handler);
    return () => ipcRenderer.removeListener('downloadProgress', handler);
  },
  onDownloadStateChange: (callback: (item: any) => void) => {
    const handler = (_: any, item: any) => callback(item);
    ipcRenderer.on('downloadStateChange', handler);
    return () => ipcRenderer.removeListener('downloadStateChange', handler);
  },
  onStatsUpdate: (callback: (stats: any) => void) => {
    const handler = (_: any, stats: any) => callback(stats);
    ipcRenderer.on('statsUpdate', handler);
    return () => ipcRenderer.removeListener('statsUpdate', handler);
  },
  onClipboardUrlDetected: (callback: (url: string) => void) => {
    const handler = (_: any, url: string) => callback(url);
    ipcRenderer.on('clipboardUrlDetected', handler);
    return () => ipcRenderer.removeListener('clipboardUrlDetected', handler);
  },
  onOpenVideoPrompt: (callback: (url: string) => void) => {
    const handler = (_: any, url: string) => callback(url);
    ipcRenderer.on('openVideoPrompt', handler);
    return () => ipcRenderer.removeListener('openVideoPrompt', handler);
  },
  onOpenDownloadPrompt: (callback: (data: { url: string; filename?: string; startImmediately?: boolean }) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('openDownloadPrompt', handler);
    return () => ipcRenderer.removeListener('openDownloadPrompt', handler);
  },
  onUpdateStatusChange: (callback: (status: any) => void) => {
    const handler = (_: any, status: any) => callback(status);
    ipcRenderer.on('updater:statusChange', handler);
    return () => ipcRenderer.removeListener('updater:statusChange', handler);
  },
});
