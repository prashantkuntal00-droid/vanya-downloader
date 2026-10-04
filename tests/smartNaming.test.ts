import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { sanitizeFilename, isValidDownloadUrl } from '../src/shared/validators/security';
import { detectCategory } from '../src/shared/constants/categories';
import {
  extractFilenameFromUrl,
  extractFilenameFromHeader,
  getUniqueFilename,
  releaseReservedFilename,
} from '../src/main/services/download/SmartNaming';

describe('SmartNaming & Security Utilities', () => {
  const TEST_DIR = path.join(__dirname, 'smart_test_dir');

  beforeEach(() => {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    try {
      if (fs.existsSync(TEST_DIR)) {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      }
    } catch {}
  });

  it('sanitizes illegal Windows characters in filenames', () => {
    const raw = 'Ubuntu:22.04*Release?.iso';
    const clean = sanitizeFilename(raw);
    expect(clean).toBe('Ubuntu_22.04_Release_.iso');
  });

  it('protects against Windows reserved device filenames', () => {
    expect(sanitizeFilename('CON.txt')).toBe('_CON.txt');
    expect(sanitizeFilename('nul.iso')).toBe('_nul.iso');
    expect(sanitizeFilename('aux.tar.gz')).toBe('_aux.tar.gz');
    expect(sanitizeFilename('com1.bin')).toBe('_com1.bin');
  });

  it('preserves Unicode and Hindi filenames without corruption', () => {
    const hindi = 'भारत_गाना_2026.mp3';
    expect(sanitizeFilename(hindi)).toBe('भारत_गाना_2026.mp3');

    const mixed = 'Report (वार्षिक रिपोर्ट) v1.2.pdf';
    expect(sanitizeFilename(mixed)).toBe('Report (वार्षिक रिपोर्ट) v1.2.pdf');
  });

  it('extracts filename from RFC 5987 Content-Disposition header (filename*)', () => {
    const header = "attachment; filename*=UTF-8''%E2%82%AC%20rates.pdf";
    const filename = extractFilenameFromHeader(header);
    expect(filename).toBe('€ rates.pdf');
  });

  it('extracts standard quoted and unquoted Content-Disposition filenames', () => {
    expect(extractFilenameFromHeader('attachment; filename="setup_vanya_1.0.exe"')).toBe('setup_vanya_1.0.exe');
    expect(extractFilenameFromHeader('attachment; filename=document_final.docx')).toBe('document_final.docx');
  });

  it('infers missing extension from MIME type', () => {
    const filename = getUniqueFilename(TEST_DIR, 'monthly_report', 'application/pdf');
    expect(filename).toBe('monthly_report.pdf');
    releaseReservedFilename(TEST_DIR, filename);

    const archive = getUniqueFilename(TEST_DIR, 'backup_data', 'application/zip');
    expect(archive).toBe('backup_data.zip');
    releaseReservedFilename(TEST_DIR, archive);
  });

  it('handles duplicate filenames safely including active .part files', () => {
    const file1 = path.join(TEST_DIR, 'sample.txt');
    fs.writeFileSync(file1, 'data');

    // Should create sample (1).txt
    const name2 = getUniqueFilename(TEST_DIR, 'sample.txt');
    expect(name2).toBe('sample (1).txt');

    // Simulate active download with .part extension
    const filePart = path.join(TEST_DIR, 'archive.zip.part');
    fs.writeFileSync(filePart, 'part data');

    const nameArchive = getUniqueFilename(TEST_DIR, 'archive.zip');
    expect(nameArchive).toBe('archive (1).zip');

    releaseReservedFilename(TEST_DIR, name2);
    releaseReservedFilename(TEST_DIR, nameArchive);
  });

  it('validates HTTP, HTTPS, FTP, and Magnet URLs', () => {
    expect(isValidDownloadUrl('https://example.com/file.zip')).toBe(true);
    expect(isValidDownloadUrl('http://example.com/video.mp4')).toBe(true);
    expect(isValidDownloadUrl('ftp://ftp.ubuntu.com/iso/ubuntu.iso')).toBe(true);
    expect(isValidDownloadUrl('magnet:?xt=urn:btih:12345')).toBe(true);
    expect(isValidDownloadUrl('javascript:alert(1)')).toBe(false);
    expect(isValidDownloadUrl('invalid-string')).toBe(false);
  });

  it('detects file categories accurately across diverse extensions', () => {
    expect(detectCategory('movie.mp4')).toBe('Videos');
    expect(detectCategory('clip.mkv')).toBe('Videos');
    expect(detectCategory('song.mp3')).toBe('Music');
    expect(detectCategory('track.flac')).toBe('Music');
    expect(detectCategory('paper.pdf')).toBe('Documents');
    expect(detectCategory('data.xlsx')).toBe('Documents');
    expect(detectCategory('setup.exe')).toBe('Programs');
    expect(detectCategory('installer.msi')).toBe('Programs');
    expect(detectCategory('archive.zip')).toBe('Archives');
    expect(detectCategory('disk.iso')).toBe('Archives');
    expect(detectCategory('unknown_file.xyz')).toBe('Other');
  });
});
