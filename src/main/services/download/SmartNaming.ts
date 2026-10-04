import fs from 'fs';
import path from 'path';
import { sanitizeFilename } from '../../../shared/validators/security';

// In-memory set of actively reserved filepaths to prevent race conditions during concurrent downloads
const activeReservedPaths = new Set<string>();

/**
 * Common MIME type to file extension mapping for downloads where extension is not present in URL.
 */
const MIME_EXTENSION_MAP: Record<string, string> = {
  // Documents
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'text/html': '.html',
  'application/rtf': '.rtf',
  'application/epub+zip': '.epub',

  // Archives
  'application/zip': '.zip',
  'application/x-zip-compressed': '.zip',
  'application/x-7z-compressed': '.7z',
  'application/x-rar-compressed': '.rar',
  'application/vnd.rar': '.rar',
  'application/x-tar': '.tar',
  'application/gzip': '.gz',
  'application/x-bzip2': '.bz2',
  'application/x-xz': '.xz',
  'application/x-iso9660-image': '.iso',

  // Programs & Packages
  'application/x-msdownload': '.exe',
  'application/vnd.microsoft.portable-executable': '.exe',
  'application/x-msi': '.msi',
  'application/vnd.android.package-archive': '.apk',
  'application/java-archive': '.jar',
  'application/x-apple-diskimage': '.dmg',
  'application/x-debian-package': '.deb',
  'application/x-redhat-package-manager': '.rpm',

  // Media
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/wav': '.wav',
  'audio/flac': '.flac',
  'audio/aac': '.aac',
  'audio/mp4': '.m4a',
  'audio/ogg': '.ogg',
  'audio/webm': '.weba',
  'video/mp4': '.mp4',
  'video/x-matroska': '.mkv',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi',

  // Images
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/x-icon': '.ico',
  'image/bmp': '.bmp',

  // Data
  'application/json': '.json',
  'application/xml': '.xml',
  'text/xml': '.xml',
};

/**
 * Returns a non-conflicting filename if a file with the given name already exists in target directory
 * or is currently being downloaded as a .part file, or is reserved by an active task.
 * Concurrency-safe!
 */
export function getUniqueFilename(targetDir: string, desiredFilename: string, mimeType?: string): string {
  let safeName = sanitizeFilename(desiredFilename);

  // If filename has no extension and a known mimeType is provided, append appropriate extension
  const currentExt = path.extname(safeName);
  if (!currentExt && mimeType) {
    const cleanMime = mimeType.split(';')[0].trim().toLowerCase();
    const suggestedExt = MIME_EXTENSION_MAP[cleanMime];
    if (suggestedExt) {
      safeName = `${safeName}${suggestedExt}`;
    }
  }

  const ext = path.extname(safeName);
  const baseName = path.basename(safeName, ext);

  let candidateName = safeName;
  let counter = 1;

  const isCollision = (filename: string): boolean => {
    const fullPath = path.join(targetDir, filename);
    const partPath = `${fullPath}.part`;
    return (
      fs.existsSync(fullPath) ||
      fs.existsSync(partPath) ||
      activeReservedPaths.has(fullPath) ||
      activeReservedPaths.has(partPath)
    );
  };

  while (isCollision(candidateName)) {
    candidateName = `${baseName} (${counter})${ext}`;
    counter++;
  }

  // Reserve the selected filepath
  const finalPath = path.join(targetDir, candidateName);
  activeReservedPaths.add(finalPath);
  activeReservedPaths.add(`${finalPath}.part`);

  return candidateName;
}

/**
 * Releases a reserved filepath once the download completes, is cancelled, or fails.
 */
export function releaseReservedFilename(targetDir: string, filename: string): void {
  const fullPath = path.join(targetDir, filename);
  activeReservedPaths.delete(fullPath);
  activeReservedPaths.delete(`${fullPath}.part`);
}

/**
 * Extracts filename from HTTP Content-Disposition header with full RFC 5987 / 6266 compliance.
 */
export function extractFilenameFromHeader(header: string | undefined): string | null {
  if (!header) return null;

  // 1. Handles filename*=UTF-8''encoded_name.ext (RFC 5987 / RFC 6266)
  const utf8Match = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/i.exec(header);
  if (utf8Match && utf8Match[1]) {
    try {
      const decoded = decodeURIComponent(utf8Match[1].trim());
      if (decoded) return sanitizeFilename(decoded);
    } catch {}
  }

  // 2. Handles standard quoted filename="name.ext"
  const quotedMatch = /filename\s*=\s*"([^"]+)"/i.exec(header);
  if (quotedMatch && quotedMatch[1]) {
    const clean = quotedMatch[1].trim();
    if (clean) return sanitizeFilename(clean);
  }

  // 3. Handles unquoted filename=name.ext
  const unquotedMatch = /filename\s*=\s*([^;]+)/i.exec(header);
  if (unquotedMatch && unquotedMatch[1]) {
    const clean = unquotedMatch[1].trim().replace(/^['"]+|['"]+$/g, '');
    if (clean) return sanitizeFilename(clean);
  }

  return null;
}

/**
 * Extracts filename from a URL path, stripping query parameters and URL fragments.
 */
export function extractFilenameFromUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    const pathname = parsed.pathname;
    let filename = path.basename(pathname);

    if (!filename || filename.length === 0 || filename === '/' || filename === '.') {
      filename = 'download';
    }

    return sanitizeFilename(decodeURIComponent(filename));
  } catch {
    return 'download';
  }
}
