export interface AppSettings {
  defaultDownloadDir: string;
  maxSimultaneousDownloads: number; // 1 to 10, default 3
  defaultConnectionsPerDownload: number; // 1 to 32, default 8
  globalSpeedLimit: number; // 0 = unlimited, in bytes per sec
  autoResumeOnStartup: boolean;
  enableClipboardMonitoring: boolean;
  enableBrowserIntegration: boolean;
  browserIntegrationPort: number;
  startWithWindows: boolean;
  minimizeToTray: boolean;
  closeToTray: boolean;
  enableNotifications: boolean;
  notifyOnlyOnCompletion: boolean;
  theme: 'system' | 'dark' | 'light';
  autoCategorize: boolean;
  retryCount: number;
  retryDelaySeconds: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultDownloadDir: '', // Calculated dynamically at runtime from app.getPath('downloads')
  maxSimultaneousDownloads: 5,
  defaultConnectionsPerDownload: 8,
  globalSpeedLimit: 0,
  autoResumeOnStartup: true,
  enableClipboardMonitoring: true,
  enableBrowserIntegration: true,
  browserIntegrationPort: 18792,
  startWithWindows: true,
  minimizeToTray: false,
  closeToTray: true,
  enableNotifications: true,
  notifyOnlyOnCompletion: false,
  theme: 'system',
  autoCategorize: true,
  retryCount: 3,
  retryDelaySeconds: 5,
};
