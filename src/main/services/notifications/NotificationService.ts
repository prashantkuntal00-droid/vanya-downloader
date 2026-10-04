import { Notification } from 'electron';
import { DatabaseService } from '../database/DatabaseService';

export class NotificationService {
  private db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  public showToast(title: string, body: string, onClick?: () => void): void {
    const settings = this.db.getSettings();
    if (!settings.enableNotifications) return;

    if (Notification.isSupported()) {
      const notification = new Notification({
        title,
        body,
        silent: false,
      });

      if (onClick) {
        notification.on('click', onClick);
      }

      notification.show();
    }
  }

  public notifyDownloadCompleted(filename: string, onClick?: () => void): void {
    this.showToast('Download Completed', `${filename} has finished downloading.`, onClick);
  }

  public notifyDownloadFailed(filename: string, reason?: string): void {
    const settings = this.db.getSettings();
    if (settings.notifyOnlyOnCompletion) return;
    this.showToast('Download Failed', `${filename} failed to download. ${reason || ''}`);
  }

  public notifyUrlDetected(url: string, onClick?: () => void): void {
    const settings = this.db.getSettings();
    if (settings.notifyOnlyOnCompletion) return;
    this.showToast('Downloadable URL Detected', `Click to add download: ${url.substring(0, 60)}...`, onClick);
  }
}
