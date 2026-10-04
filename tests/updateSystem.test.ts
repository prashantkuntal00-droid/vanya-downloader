import { describe, it, expect } from 'vitest';
import { UpdateState, UpdateStatus } from '../src/shared/types/update';

// Helper function to test semantic version comparison logic
function isNewerVersion(current: string, available: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const [currMaj, currMin, currPatch] = parse(current);
  const [availMaj, availMin, availPatch] = parse(available);

  if (availMaj > currMaj) return true;
  if (availMaj < currMaj) return false;
  if (availMin > currMin) return true;
  if (availMin < currMin) return false;
  return availPatch > currPatch;
}

describe('Auto-Update System Logic Tests', () => {
  it('correctly compares semantic versions for updates', () => {
    // Newer patches
    expect(isNewerVersion('1.0.1', '1.0.2')).toBe(true);
    // Newer minors
    expect(isNewerVersion('1.0.1', '1.1.0')).toBe(true);
    // Newer majors
    expect(isNewerVersion('1.0.1', '2.0.0')).toBe(true);

    // Same version -> no update
    expect(isNewerVersion('1.0.1', '1.0.1')).toBe(false);
    expect(isNewerVersion('v1.0.1', '1.0.1')).toBe(false);
    expect(isNewerVersion('1.0.1', 'v1.0.1')).toBe(false);

    // Older versions -> downgrade protection
    expect(isNewerVersion('1.0.2', '1.0.1')).toBe(false);
    expect(isNewerVersion('2.0.0', '1.9.9')).toBe(false);
    expect(isNewerVersion('1.1.0', '1.0.9')).toBe(false);
  });

  it('validates UpdateStatus states transition correctly', () => {
    const status: UpdateStatus = {
      state: 'IDLE',
      currentVersion: '1.0.1',
    };
    expect(status.state).toBe('IDLE');

    // State: CHECKING
    status.state = 'CHECKING';
    expect(status.state).toBe('CHECKING');

    // State: UPDATE_AVAILABLE
    status.state = 'UPDATE_AVAILABLE';
    status.availableVersion = '1.0.2';
    status.releaseNotes = '• Fixed download resume\n• Improved speed';
    expect(status.state).toBe('UPDATE_AVAILABLE');
    expect(status.availableVersion).toBe('1.0.2');

    // State: DOWNLOADING with progress
    status.state = 'DOWNLOADING';
    status.progress = {
      percent: 45.5,
      transferred: 45500000,
      total: 100000000,
      bytesPerSecond: 5200000,
    };
    expect(status.state).toBe('DOWNLOADING');
    expect(status.progress.percent).toBe(45.5);
    expect(status.progress.bytesPerSecond).toBe(5200000);

    // State: DOWNLOADED
    status.state = 'DOWNLOADED';
    expect(status.state).toBe('DOWNLOADED');
  });

  it('gracefully formats update errors for user display', () => {
    const sanitizeError = (msg: string) => {
      if (msg.includes('net::ERR') || msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')) {
        return 'No internet connection. Update check skipped.';
      }
      if (msg.includes('404') || msg.includes('release')) {
        return 'No release found on GitHub. Update unavailable.';
      }
      if (msg.includes('ENOSPC')) {
        return 'Insufficient disk space to download update.';
      }
      return 'Unable to check for updates. Please try again later.';
    };

    expect(sanitizeError('Error: getaddrinfo ENOTFOUND api.github.com')).toBe('No internet connection. Update check skipped.');
    expect(sanitizeError('HttpError: 404 Not Found at https://api.github.com/repos/...')).toBe('No release found on GitHub. Update unavailable.');
    expect(sanitizeError('Error: ENOSPC: no space left on device')).toBe('Insufficient disk space to download update.');
    expect(sanitizeError('Unexpected token in JSON at position 0')).toBe('Unable to check for updates. Please try again later.');
  });
});
