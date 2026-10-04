import { Category } from '../types/download';

export const VIDEO_EXTENSIONS = new Set(['mp4', 'mkv', 'webm', 'avi', 'mov', 'flv', 'wmv', 'm4v', '3gp', 'ts']);
export const MUSIC_EXTENSIONS = new Set(['mp3', 'm4a', 'wav', 'flac', 'aac', 'ogg', 'wma', 'opus', 'alac']);
export const DOCUMENT_EXTENSIONS = new Set(['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'txt', 'csv', 'epub', 'rtf']);
export const PROGRAM_EXTENSIONS = new Set(['exe', 'msi', 'bat', 'cmd', 'ps1', 'apk', 'jar', 'appx', 'msix', 'deb', 'rpm']);
export const ARCHIVE_EXTENSIONS = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'img', 'tgz', 'vhd']);

/**
 * Detects the category of a file based on filename/extension and mimeType.
 */
export function detectCategory(filename: string, mimeType?: string): Category {
  const ext = (filename.split('.').pop() || '').toLowerCase();

  if (mimeType) {
    if (mimeType.startsWith('video/')) return 'Videos';
    if (mimeType.startsWith('audio/')) return 'Music';
    if (mimeType.startsWith('image/')) return 'Videos';
    if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text/')) return 'Documents';
    if (mimeType.includes('zip') || mimeType.includes('compressed') || mimeType.includes('tar') || mimeType.includes('rar')) return 'Archives';
  }

  if (VIDEO_EXTENSIONS.has(ext)) return 'Videos';
  if (MUSIC_EXTENSIONS.has(ext)) return 'Music';
  if (DOCUMENT_EXTENSIONS.has(ext)) return 'Documents';
  if (PROGRAM_EXTENSIONS.has(ext)) return 'Programs';
  if (ARCHIVE_EXTENSIONS.has(ext)) return 'Archives';

  return 'Other';
}

/**
 * Format bytes into human readable format (e.g., 12.4 MB, 1.2 GB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format speed in bytes per second to human readable (e.g., 12.4 MB/s)
 */
export function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 B/s';
  return `${formatBytes(bytesPerSec)}/s`;
}

/**
 * Format ETA seconds to human readable string (e.g. 2m 31s)
 */
export function formatEta(seconds: number): string {
  if (seconds === Infinity || isNaN(seconds) || seconds < 0) return 'Unknown';
  if (seconds === 0) return '0s';

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}
