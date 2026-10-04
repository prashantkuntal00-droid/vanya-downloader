import { DownloadItem, DownloadOptions, DownloadStats } from './download';
import { VideoMetadata } from './video';
import { AppSettings } from './settings';
import { UpdateStatus } from './update';

export interface URLAnalysisResult {
  url: string;
  filename: string;
  totalSize?: number;
  mimeType?: string;
  supportsResume: boolean;
  isVideoPage?: boolean;
}

export interface SchedulerTask {
  id: string;
  name: string;
  startTime: string; // e.g. "01:00"
  stopTime?: string; // e.g. "06:00"
  enabled: boolean;
  action: 'START_ALL' | 'PAUSE_ALL' | 'SPEED_LIMIT';
  speedLimit?: number;
  downloadIds?: string[];
}

export interface ElectronAPI {
  // Download Management
  analyzeUrl: (url: string) => Promise<URLAnalysisResult>;
  addDownload: (options: DownloadOptions) => Promise<DownloadItem>;
  startDownload: (id: string) => Promise<boolean>;
  pauseDownload: (id: string) => Promise<boolean>;
  resumeDownload: (id: string) => Promise<boolean>;
  cancelDownload: (id: string) => Promise<boolean>;
  retryDownload: (id: string) => Promise<boolean>;
  deleteDownload: (id: string, deleteFile?: boolean) => Promise<boolean>;
  getDownloads: () => Promise<DownloadItem[]>;
  getDownloadById: (id: string) => Promise<DownloadItem | null>;
  getStats: () => Promise<DownloadStats>;
  openProgressWindow: (id: string) => Promise<boolean>;
  openFile: (filepath: string) => Promise<boolean>;
  openFolder: (filepath: string) => Promise<boolean>;
  startAll: () => Promise<boolean>;
  pauseAll: () => Promise<boolean>;
  resumeAll: () => Promise<boolean>;
  cancelAll: () => Promise<boolean>;
  clearHistory: () => Promise<boolean>;

  // Queue Management
  reorderQueue: (id: string, newPriority: number) => Promise<boolean>;

  // Video Extraction
  analyzeVideoUrl: (url: string) => Promise<VideoMetadata>;
  downloadVideo: (url: string, formatId: string, audioFormatId?: string, filename?: string) => Promise<DownloadItem>;

  // Settings
  getSettings: () => Promise<AppSettings>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  selectDirectory: () => Promise<string | null>;

  // Scheduler
  getSchedulerTasks: () => Promise<SchedulerTask[]>;
  saveSchedulerTask: (task: SchedulerTask) => Promise<boolean>;
  deleteSchedulerTask: (id: string) => Promise<boolean>;

  // System & Diagnostics & Window
  openLogsFolder: () => Promise<boolean>;
  logError: (title: string, details?: string) => Promise<boolean>;
  upgradeAndReload: () => Promise<{ success: boolean; message: string }>;
  restartApp: () => Promise<boolean>;
  minimizeCurrentWindow: () => Promise<boolean>;
  closeCurrentWindow: () => Promise<boolean>;

  // Update & Release System
  getUpdateStatus: () => Promise<UpdateStatus>;
  checkForUpdates: () => Promise<any>;
  downloadUpdate: () => Promise<boolean>;
  quitAndInstall: () => Promise<boolean>;

  // Events (Listeners)
  onDownloadProgress: (callback: (item: DownloadItem) => void) => () => void;
  onDownloadStateChange: (callback: (item: DownloadItem) => void) => () => void;
  onStatsUpdate: (callback: (stats: DownloadStats) => void) => () => void;
  onClipboardUrlDetected: (callback: (url: string) => void) => () => void;
  onOpenVideoPrompt: (callback: (data: { url: string; type?: 'video' | 'audio'; quality?: string; formatId?: string; startImmediately?: boolean }) => void) => () => void;
  onOpenDownloadPrompt: (callback: (data: { url: string; filename?: string; startImmediately?: boolean }) => void) => () => void;
  onUpdateStatusChange: (callback: (status: UpdateStatus) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
