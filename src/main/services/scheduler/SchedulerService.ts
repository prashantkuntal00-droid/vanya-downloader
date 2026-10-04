import { DatabaseService } from '../database/DatabaseService';
import { DownloadManager } from '../download/DownloadManager';
import { SchedulerTask } from '../../../shared/types/ipc';

export class SchedulerService {
  private db: DatabaseService;
  private manager: DownloadManager;
  private timer: NodeJS.Timeout | null = null;

  constructor(db: DatabaseService, manager: DownloadManager) {
    this.db = db;
    this.manager = manager;
  }

  public start(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.checkSchedule(), 30000); // Check every 30s
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private checkSchedule(): void {
    const tasks = this.db.getSchedulerTasks();
    const now = new Date();
    const currentHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    for (const task of tasks) {
      if (!task.enabled) continue;

      if (task.startTime === currentHM) {
        if (task.action === 'START_ALL') {
          this.manager.startAll();
        } else if (task.action === 'PAUSE_ALL') {
          this.manager.pauseAll();
        }
      } else if (task.stopTime && task.stopTime === currentHM) {
        if (task.action === 'START_ALL') {
          this.manager.pauseAll();
        }
      }
    }
  }
}
