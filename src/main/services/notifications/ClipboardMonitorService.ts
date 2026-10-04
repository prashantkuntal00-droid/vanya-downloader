import { clipboard } from 'electron';
import { EventEmitter } from 'events';
import { isValidDownloadUrl } from '../../../shared/validators/security';
import { DatabaseService } from '../database/DatabaseService';

export class ClipboardMonitorService extends EventEmitter {
  private db: DatabaseService;
  private lastClipboardText: string = '';
  private timer: NodeJS.Timeout | null = null;

  constructor(db: DatabaseService) {
    super();
    this.db = db;
  }

  public start(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.checkClipboard(), 1000); // Check every 1s
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private checkClipboard(): void {
    const settings = this.db.getSettings();
    if (!settings.enableClipboardMonitoring) return;

    try {
      const text = clipboard.readText();
      if (!text || text === this.lastClipboardText) return;

      this.lastClipboardText = text;
      const trimmed = text.trim();

      if (isValidDownloadUrl(trimmed)) {
        this.emit('urlDetected', trimmed);
      }
    } catch {}
  }
}
