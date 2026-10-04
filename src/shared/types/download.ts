export type DownloadStatus =
  | 'QUEUED'
  | 'DOWNLOADING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'VERIFYING'
  | 'MERGING'
  | 'EXTRACTING';

export type Category =
  | 'All'
  | 'Videos'
  | 'Music'
  | 'Documents'
  | 'Programs'
  | 'Archives'
  | 'Other';

export interface DownloadItem {
  id: string;
  url: string;
  originalUrl: string;
  filename: string;
  filepath: string;
  mimeType?: string;
  totalSize: number;
  downloadedSize: number;
  progress: number; // 0 to 100
  status: DownloadStatus;
  speed: number; // bytes per second
  avgSpeed: number; // bytes per second
  eta: number; // seconds remaining
  gid?: string; // aria2 GID
  createdTime: number;
  startedTime?: number;
  completedTime?: number;
  errorMessage?: string;
  priority: number; // 1 (lowest) to 10 (highest)
  connections: number;
  sourceType: 'HTTP' | 'FTP' | 'VIDEO' | 'TORRENT';
  videoFormatId?: string;
  audioFormatId?: string;
  category: Category;
  checksum?: string;
  checksumType?: 'sha256' | 'md5';
}

export interface DownloadOptions {
  url: string;
  filename?: string;
  destinationDir?: string;
  connections?: number;
  speedLimit?: number; // bytes per second, 0 = unlimited
  priority?: number;
  category?: Category;
  sourceType?: 'HTTP' | 'FTP' | 'VIDEO' | 'TORRENT';
  videoFormatId?: string;
  audioFormatId?: string;
  startImmediately?: boolean;
}

export interface DownloadStats {
  activeCount: number;
  queuedCount: number;
  pausedCount: number;
  completedCount: number;
  failedCount: number;
  totalDownloadedBytes: number;
  todayDownloadedBytes: number;
  currentGlobalSpeed: number;
}
