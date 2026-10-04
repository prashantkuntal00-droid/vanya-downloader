import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { DownloadItem } from '../../../shared/types/download';
import { AppSettings, DEFAULT_SETTINGS } from '../../../shared/types/settings';
import { SchedulerTask } from '../../../shared/types/ipc';

export class DatabaseService {
  private dataDir: string;
  private downloadsFile: string;
  private settingsFile: string;
  private schedulerFile: string;

  // In-memory cache for instant 0ms queries & low CPU
  private cachedDownloads: DownloadItem[] = [];
  private cachedSettings: AppSettings | null = null;
  private cachedScheduler: SchedulerTask[] = [];

  private saveDownloadsTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.dataDir = app ? app.getPath('userData') : path.join(process.cwd(), 'data');
    if (!fs.existsSync(this.dataDir)) {
      try {
        fs.mkdirSync(this.dataDir, { recursive: true });
      } catch (err) {
        console.error('Failed to create data directory:', err);
      }
    }

    this.downloadsFile = path.join(this.dataDir, 'vanya_downloads.json');
    this.settingsFile = path.join(this.dataDir, 'vanya_settings.json');
    this.schedulerFile = path.join(this.dataDir, 'vanya_scheduler.json');

    this.migrateLegacyFiles();
    this.initializeDefaults();
  }

  /**
   * Migrate legacy freeflow_*.json files to vanya_*.json seamlessly
   */
  private migrateLegacyFiles(): void {
    const legacyDownloads = path.join(this.dataDir, 'freeflow_downloads.json');
    const legacySettings = path.join(this.dataDir, 'freeflow_settings.json');
    const legacyScheduler = path.join(this.dataDir, 'freeflow_scheduler.json');

    try {
      if (!fs.existsSync(this.downloadsFile) && fs.existsSync(legacyDownloads)) {
        fs.copyFileSync(legacyDownloads, this.downloadsFile);
      }
      if (!fs.existsSync(this.settingsFile) && fs.existsSync(legacySettings)) {
        fs.copyFileSync(legacySettings, this.settingsFile);
      }
      if (!fs.existsSync(this.schedulerFile) && fs.existsSync(legacyScheduler)) {
        fs.copyFileSync(legacyScheduler, this.schedulerFile);
      }
    } catch (err) {
      console.warn('Legacy data migration notice:', err);
    }
  }

  /**
   * Safe atomic write using temporary file + atomic rename
   */
  private atomicWriteJson(targetFile: string, data: any): void {
    const tempFile = `${targetFile}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
    try {
      const content = JSON.stringify(data, null, 2);
      fs.writeFileSync(tempFile, content, 'utf-8');
      fs.renameSync(tempFile, targetFile);
    } catch (err) {
      console.error(`Error atomically writing to ${targetFile}:`, err);
      try {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      } catch {}
    }
  }

  private initializeDefaults() {
    // 1. Load Downloads into memory
    try {
      if (fs.existsSync(this.downloadsFile)) {
        const content = fs.readFileSync(this.downloadsFile, 'utf-8');
        this.cachedDownloads = JSON.parse(content) as DownloadItem[];
      } else {
        this.cachedDownloads = [];
        this.atomicWriteJson(this.downloadsFile, []);
      }
    } catch (err) {
      console.error('Error loading initial downloads:', err);
      this.cachedDownloads = [];
    }

    // 2. Load Settings into memory
    try {
      const defaultDir = app ? app.getPath('downloads') : path.join(process.cwd(), 'Downloads');
      if (fs.existsSync(this.settingsFile)) {
        const content = fs.readFileSync(this.settingsFile, 'utf-8');
        const loaded = JSON.parse(content);
        this.cachedSettings = {
          ...DEFAULT_SETTINGS,
          defaultDownloadDir: defaultDir,
          ...loaded,
        };
      } else {
        this.cachedSettings = {
          ...DEFAULT_SETTINGS,
          defaultDownloadDir: defaultDir,
        };
        this.atomicWriteJson(this.settingsFile, this.cachedSettings);
      }
    } catch {
      this.cachedSettings = DEFAULT_SETTINGS;
    }

    // 3. Load Scheduler tasks into memory
    try {
      if (fs.existsSync(this.schedulerFile)) {
        const content = fs.readFileSync(this.schedulerFile, 'utf-8');
        this.cachedScheduler = JSON.parse(content) as SchedulerTask[];
      } else {
        this.cachedScheduler = [];
        this.atomicWriteJson(this.schedulerFile, []);
      }
    } catch {
      this.cachedScheduler = [];
    }
  }

  // --- Downloads DB ---
  public getDownloads(): DownloadItem[] {
    return [...this.cachedDownloads];
  }

  public getDownloadById(id: string): DownloadItem | undefined {
    return this.cachedDownloads.find((d) => d.id === id);
  }

  public saveDownloads(downloads: DownloadItem[], immediate: boolean = true): void {
    this.cachedDownloads = [...downloads];
    if (immediate) {
      if (this.saveDownloadsTimer) {
        clearTimeout(this.saveDownloadsTimer);
        this.saveDownloadsTimer = null;
      }
      this.atomicWriteJson(this.downloadsFile, this.cachedDownloads);
    } else {
      this.scheduleDebouncedDownloadsSave();
    }
  }

  public saveDownloadItem(item: DownloadItem, immediate: boolean = false): void {
    const index = this.cachedDownloads.findIndex((d) => d.id === item.id);
    if (index >= 0) {
      this.cachedDownloads[index] = { ...item };
    } else {
      this.cachedDownloads.push({ ...item });
    }

    // Critical state changes (completion, failure, pause, queue) are written immediately.
    // Periodic progress updates (every 200ms) are debounced to avoid disk thrashing.
    const isCriticalState =
      item.status === 'COMPLETED' ||
      item.status === 'FAILED' ||
      item.status === 'CANCELLED' ||
      item.status === 'PAUSED' ||
      item.status === 'QUEUED';

    if (immediate || isCriticalState) {
      if (this.saveDownloadsTimer) {
        clearTimeout(this.saveDownloadsTimer);
        this.saveDownloadsTimer = null;
      }
      this.atomicWriteJson(this.downloadsFile, this.cachedDownloads);
    } else {
      this.scheduleDebouncedDownloadsSave();
    }
  }

  private scheduleDebouncedDownloadsSave(): void {
    if (this.saveDownloadsTimer) return;
    this.saveDownloadsTimer = setTimeout(() => {
      this.saveDownloadsTimer = null;
      this.atomicWriteJson(this.downloadsFile, this.cachedDownloads);
    }, 1000);
  }

  public deleteDownloadItem(id: string): void {
    this.cachedDownloads = this.cachedDownloads.filter((d) => d.id !== id);
    this.saveDownloads(this.cachedDownloads, true);
  }

  public clearHistory(): void {
    this.cachedDownloads = this.cachedDownloads.filter(
      (d) => d.status === 'DOWNLOADING' || d.status === 'QUEUED' || d.status === 'PAUSED'
    );
    this.saveDownloads(this.cachedDownloads, true);
  }

  // --- Settings DB ---
  public getSettings(): AppSettings {
    if (!this.cachedSettings) {
      const defaultDir = app ? app.getPath('downloads') : path.join(process.cwd(), 'Downloads');
      this.cachedSettings = { ...DEFAULT_SETTINGS, defaultDownloadDir: defaultDir };
    }
    return { ...this.cachedSettings };
  }

  public saveSettings(settings: AppSettings): void {
    this.cachedSettings = { ...settings };
    this.atomicWriteJson(this.settingsFile, this.cachedSettings);
  }

  // --- Scheduler Tasks DB ---
  public getSchedulerTasks(): SchedulerTask[] {
    return [...this.cachedScheduler];
  }

  public saveSchedulerTasks(tasks: SchedulerTask[]): void {
    this.cachedScheduler = [...tasks];
    this.atomicWriteJson(this.schedulerFile, this.cachedScheduler);
  }

  /**
   * Flush pending writes on application shutdown
   */
  public flush(): void {
    if (this.saveDownloadsTimer) {
      clearTimeout(this.saveDownloadsTimer);
      this.saveDownloadsTimer = null;
      this.atomicWriteJson(this.downloadsFile, this.cachedDownloads);
    }
  }
}
