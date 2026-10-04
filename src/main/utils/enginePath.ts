import path from 'path';
import fs from 'fs';
import { app } from 'electron';

/**
 * Robustly resolves external engine executable paths in both dev and packaged production environments.
 */
export function getEnginePath(relativeSubPath: string): string {
  // Candidate 1: process.resourcesPath (electron-builder extraResources in production)
  if (process.resourcesPath) {
    const candidate1 = path.join(process.resourcesPath, relativeSubPath);
    if (fs.existsSync(candidate1)) {
      return candidate1;
    }
  }

  // Candidate 2: Relative to app path (dist-electron / app root)
  if (app && app.getAppPath) {
    try {
      const candidate2 = path.join(app.getAppPath(), relativeSubPath);
      if (fs.existsSync(candidate2)) {
        return candidate2;
      }
    } catch {}
  }

  // Candidate 3: Relative to process.cwd()
  const candidate3 = path.join(process.cwd(), relativeSubPath);
  if (fs.existsSync(candidate3)) {
    return candidate3;
  }

  // Candidate 4: Relative to __dirname
  const candidate4 = path.join(__dirname, '../../', relativeSubPath);
  if (fs.existsSync(candidate4)) {
    return candidate4;
  }

  // Default fallback path
  return process.resourcesPath
    ? path.join(process.resourcesPath, relativeSubPath)
    : path.join(process.cwd(), relativeSubPath);
}
