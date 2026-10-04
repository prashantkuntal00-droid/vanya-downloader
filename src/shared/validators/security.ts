import path from 'path';

/**
 * Validates whether a string is a safe, allowed download URL.
 */
export function isValidDownloadUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();

  // Allow magnet links
  if (trimmed.startsWith('magnet:?')) return true;

  try {
    const parsed = new URL(trimmed);
    const validProtocols = ['http:', 'https:', 'ftp:', 'sftp:'];
    return validProtocols.includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Sanitizes unsafe characters from filenames for Windows filesystem compatibility.
 */
export function sanitizeFilename(filename: string, fallback: string = 'download'): string {
  if (!filename || typeof filename !== 'string') return fallback;

  // Remove trailing dots, spaces, control characters and invalid Windows characters \ / : * ? " < > |
  let sanitized = filename
    .replace(/[\x00-\x1f\x7f-\x9f]/g, '') // remove control chars
    .replace(/[\\/:*?"<>|]/g, '_')        // replace illegal chars with _
    .trim();

  // Remove leading/trailing dots/spaces that Windows disallows
  sanitized = sanitized.replace(/^[. ]+/, '').replace(/[. ]+$/, '');

  if (!sanitized) return fallback;

  // Check for Windows reserved names (CON, PRN, AUX, NUL, COM1..COM9, LPT1..LPT9)
  const baseOnly = sanitized.split('.')[0].trim().toUpperCase();
  const reservedNames = new Set([
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
  ]);
  if (reservedNames.has(baseOnly)) {
    sanitized = `_${sanitized}`;
  }

  // Truncate to maximum 240 chars for safety
  if (sanitized.length > 240) {
    const ext = path.extname(sanitized);
    const name = path.basename(sanitized, ext);
    sanitized = name.substring(0, 230) + ext;
  }

  return sanitized;
}

/**
 * Prevents path traversal attacks by resolving target file path and verifying it stays inside allowed target dir.
 */
export function validateSafeFilePath(targetDir: string, filename: string): string {
  const safeName = sanitizeFilename(filename);
  const resolvedDir = path.resolve(targetDir);
  const fullPath = path.resolve(resolvedDir, safeName);

  // Check if fullPath is inside resolvedDir
  if (!fullPath.startsWith(resolvedDir)) {
    throw new Error('Security Error: Path traversal detected.');
  }

  return fullPath;
}
