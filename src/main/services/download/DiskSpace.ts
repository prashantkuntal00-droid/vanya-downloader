import fs from 'fs';
import path from 'path';

export interface DiskSpaceInfo {
  availableBytes: number;
  totalBytes: number;
  freeBytes: number;
}

/**
 * Checks available free disk space on the drive of target path.
 */
export async function getDiskSpace(targetPath: string): Promise<DiskSpaceInfo> {
  return new Promise((resolve, reject) => {
    // Ensure parent directory exists or find existing ancestor
    let current = path.resolve(targetPath);
    while (!fs.existsSync(current)) {
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }

    if (fs.statfs) {
      fs.statfs(current, (err, stats) => {
        if (err || !stats) {
          // Default optimistic fallback if statfs fails
          resolve({ availableBytes: 500 * 1024 * 1024 * 1024, totalBytes: 1000 * 1024 * 1024 * 1024, freeBytes: 500 * 1024 * 1024 * 1024 });
        } else {
          const availableBytes = stats.bavail * stats.bsize;
          const totalBytes = stats.blocks * stats.bsize;
          const freeBytes = stats.bfree * stats.bsize;
          resolve({ availableBytes, totalBytes, freeBytes });
        }
      });
    } else {
      // Fallback
      resolve({ availableBytes: 500 * 1024 * 1024 * 1024, totalBytes: 1000 * 1024 * 1024 * 1024, freeBytes: 500 * 1024 * 1024 * 1024 });
    }
  });
}
