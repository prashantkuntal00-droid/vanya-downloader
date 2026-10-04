import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getEnginePath } from '../../utils/enginePath';
import { VideoMetadata, VideoFormat } from '../../../shared/types/video';

export class MediaExtractorService {
  private getBinaryPath(): string {
    return getEnginePath('engines/extractor/yt-dlp.exe');
  }

  public async analyzeVideoUrl(url: string): Promise<VideoMetadata> {
    const binaryPath = this.getBinaryPath();

    if (!fs.existsSync(binaryPath)) {
      throw new Error('Video extractor component (yt-dlp.exe) is not installed. Please check diagnostics.');
    }

    return new Promise((resolve, reject) => {
      const args = [
        '--dump-single-json',
        '--no-playlist',
        '--no-warnings',
        '--skip-download',
        url,
      ];

      const proc = spawn(binaryPath, args, { windowsHide: true });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => (stdout += data));
      proc.stderr.on('data', (data) => (stderr += data));

      proc.on('close', (code) => {
        if (code !== 0) {
          return reject(
            new Error(
              `Unable to analyze media streams. Check if URL is accessible: ${stderr.slice(0, 200)}`
            )
          );
        }

        try {
          const json = JSON.parse(stdout);
          const duration = json.duration || 0;

          const rawFormats: any[] = json.formats || [];

          // Map all raw formats
          const allFormats: VideoFormat[] = rawFormats.map((f: any) => {
            const hasVideo = f.vcodec && f.vcodec !== 'none';
            const hasAudio = f.acodec && f.acodec !== 'none';
            const height = f.height || 0;
            const tbr = f.tbr || (f.vbr ? f.vbr + (f.abr || 128) : 0);

            // Estimate filesize if not provided by server
            let computedSize = f.filesize || f.filesize_approx;
            if (!computedSize && duration > 0 && tbr > 0) {
              computedSize = Math.floor((duration * tbr * 1000) / 8);
            }

            return {
              formatId: f.format_id,
              extension: f.ext || (hasVideo ? 'mp4' : 'mp3'),
              resolution: height > 0 ? `${height}p` : f.resolution || (hasVideo ? 'Video' : 'Audio'),
              fps: f.fps,
              filesize: f.filesize,
              filesizeApprox: computedSize,
              vcodec: f.vcodec,
              acodec: f.acodec,
              hasVideo,
              hasAudio,
              qualityLabel: f.format_note || (height > 0 ? `${height}p` : hasAudio ? 'Audio' : 'Media'),
              bitrate: f.abr ? `${Math.round(f.abr)}kbps` : tbr ? `${Math.round(tbr)}kbps` : undefined,
              isAudioOnly: !hasVideo && hasAudio,
            };
          });

          // Extract Video qualities (Unique by resolution: 2160p, 1440p, 1080p, 720p, 480p, 360p, 240p)
          const standardHeights = [2160, 1440, 1080, 720, 480, 360, 240];
          const videoFormats: VideoFormat[] = [];
          const seenResolutions = new Set<string>();

          // First pick standard resolutions
          for (const h of standardHeights) {
            const match = allFormats.find(
              (f) => f.hasVideo && (f.resolution === `${h}p` || f.qualityLabel?.includes(`${h}p`))
            );
            if (match) {
              const resKey = `${h}p`;
              if (!seenResolutions.has(resKey)) {
                seenResolutions.add(resKey);
                videoFormats.push({
                  ...match,
                  qualityLabel: h >= 1080 ? `${h}p Full HD` : h >= 720 ? `${h}p HD` : `${h}p SD`,
                  extension: 'mp4',
                });
              }
            }
          }

          // If no standard matched, include all distinct video resolutions found
          for (const f of allFormats) {
            if (f.hasVideo && f.resolution && !seenResolutions.has(f.resolution)) {
              seenResolutions.add(f.resolution);
              videoFormats.push({
                ...f,
                extension: 'mp4',
              });
            }
          }

          // Fallback if none found
          if (videoFormats.length === 0) {
            videoFormats.push({
              formatId: 'bestvideo+bestaudio/best',
              extension: 'mp4',
              resolution: 'Best Available Video',
              hasVideo: true,
              hasAudio: true,
              qualityLabel: 'Best Video Quality (Auto)',
              filesizeApprox: duration > 0 ? Math.floor(duration * 250000) : undefined,
            });
          }

          // Audio Song qualities (MP3 320kbps, MP3 256kbps, MP3 128kbps, M4A 128kbps)
          const audioFormats: VideoFormat[] = [
            {
              formatId: 'audio_mp3_320',
              extension: 'mp3',
              resolution: 'Audio Only',
              hasVideo: false,
              hasAudio: true,
              qualityLabel: 'MP3 High Quality (320 kbps)',
              bitrate: '320kbps',
              isAudioOnly: true,
              filesizeApprox: duration > 0 ? Math.floor((duration * 320000) / 8) : undefined,
            },
            {
              formatId: 'audio_mp3_256',
              extension: 'mp3',
              resolution: 'Audio Only',
              hasVideo: false,
              hasAudio: true,
              qualityLabel: 'MP3 Standard Quality (256 kbps)',
              bitrate: '256kbps',
              isAudioOnly: true,
              filesizeApprox: duration > 0 ? Math.floor((duration * 256000) / 8) : undefined,
            },
            {
              formatId: 'audio_mp3_128',
              extension: 'mp3',
              resolution: 'Audio Only',
              hasVideo: false,
              hasAudio: true,
              qualityLabel: 'MP3 Compact (128 kbps)',
              bitrate: '128kbps',
              isAudioOnly: true,
              filesizeApprox: duration > 0 ? Math.floor((duration * 128000) / 8) : undefined,
            },
            {
              formatId: 'audio_m4a_best',
              extension: 'm4a',
              resolution: 'Audio Only',
              hasVideo: false,
              hasAudio: true,
              qualityLabel: 'AAC / M4A (Original Stream)',
              bitrate: 'Original',
              isAudioOnly: true,
              filesizeApprox: duration > 0 ? Math.floor((duration * 160000) / 8) : undefined,
            },
          ];

          resolve({
            url: json.webpage_url || url,
            title: json.title || 'Untitled Media',
            thumbnail: json.thumbnail,
            duration: json.duration,
            uploader: json.uploader || json.channel || json.artist,
            site: json.extractor_key || json.extractor,
            videoFormats,
            audioFormats,
            formats: [...videoFormats, ...audioFormats],
          });
        } catch (err: any) {
          reject(new Error(`Failed to parse media metadata: ${err.message}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Extractor execution error: ${err.message}`));
      });
    });
  }
}

