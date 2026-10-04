import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getEnginePath } from '../../utils/enginePath';

export class FfmpegService {
  private getBinaryPath(): string {
    return getEnginePath('engines/ffmpeg/ffmpeg.exe');
  }

  /**
   * Merges separate video and audio files into a single container without re-encoding quality loss (-c copy).
   */
  public async mergeStreams(
    videoPath: string,
    audioPath: string,
    outputPath: string
  ): Promise<boolean> {
    const binaryPath = this.getBinaryPath();

    if (!fs.existsSync(binaryPath)) {
      throw new Error('FFmpeg binary (ffmpeg.exe) not found. Please ensure FFmpeg is present in engines directory.');
    }

    return new Promise((resolve, reject) => {
      const args = [
        '-y', // Overwrite output if exists
        '-i', videoPath,
        '-i', audioPath,
        '-c', 'copy', // Stream copy for maximum speed & quality
        outputPath,
      ];

      const proc = spawn(binaryPath, args, { windowsHide: true });

      proc.on('close', (code) => {
        if (code === 0) {
          // Clean up temp files
          try { if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath); } catch {}
          try { if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath); } catch {}
          resolve(true);
        } else {
          reject(new Error(`FFmpeg exit code ${code} during stream merge.`));
        }
      });

      proc.on('error', (err) => reject(err));
    });
  }
}
