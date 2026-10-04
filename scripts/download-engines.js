const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

const ENGINES_DIR = path.join(__dirname, '..', 'engines');
const ARIA2_DIR = path.join(ENGINES_DIR, 'aria2');
const FFMPEG_DIR = path.join(ENGINES_DIR, 'ffmpeg');
const EXTRACTOR_DIR = path.join(ENGINES_DIR, 'extractor');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url} -> ${dest}...`);
    const file = fs.createWriteStream(dest);

    const request = (targetUrl) => {
      const client = targetUrl.startsWith('https') ? https : http;
      client.get(targetUrl, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          console.log(`Redirecting to ${response.headers.location}...`);
          return request(response.headers.location);
        }
        if (response.statusCode !== 200) {
          return reject(new Error(`Failed to download ${targetUrl}, status code: ${response.statusCode}`));
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            console.log(`Downloaded ${dest} successfully.`);
            resolve();
          });
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    };

    request(url);
  });
}

function extractZip(zipPath, destDir) {
  const safeZip = zipPath.replace(/'/g, "''");
  const safeDest = destDir.replace(/'/g, "''");
  const psCmd = `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${safeZip}' -DestinationPath '${safeDest}' -Force"`;
  execSync(psCmd, { stdio: 'inherit' });
}

function cleanSubdirsAndZips(dir, keepExeName) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const itemPath = path.join(dir, item);
    if (item === keepExeName) continue;
    try {
      if (fs.statSync(itemPath).isDirectory()) {
        fs.rmSync(itemPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(itemPath);
      }
    } catch {}
  }
}

async function setupEngines() {
  ensureDir(ARIA2_DIR);
  ensureDir(FFMPEG_DIR);
  ensureDir(EXTRACTOR_DIR);

  const ytDlpPath = path.join(EXTRACTOR_DIR, 'yt-dlp.exe');
  if (!fs.existsSync(ytDlpPath)) {
    try {
      console.log('Fetching latest yt-dlp.exe...');
      await downloadFile('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe', ytDlpPath);
    } catch (err) {
      console.warn('Failed to auto-download yt-dlp.exe:', err.message);
    }
  } else {
    console.log('yt-dlp.exe already present.');
  }

  const aria2Path = path.join(ARIA2_DIR, 'aria2c.exe');
  if (!fs.existsSync(aria2Path)) {
    console.log('Checking aria2c.exe...');
    try {
      const zipPath = path.join(ARIA2_DIR, 'aria2.zip');
      if (!fs.existsSync(zipPath)) {
        await downloadFile('https://github.com/aria2/aria2/releases/download/release-1.37.0/aria2-1.37.0-win-64bit-build1.zip', zipPath);
      }
      console.log('Extracting aria2c.exe...');
      extractZip(zipPath, ARIA2_DIR);
      // Find extracted aria2c.exe in subfolder and move it up
      const findExe = (dir) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fp = path.join(dir, file);
          if (fs.statSync(fp).isDirectory()) {
            findExe(fp);
          } else if (file === 'aria2c.exe') {
            fs.copyFileSync(fp, aria2Path);
          }
        }
      };
      findExe(ARIA2_DIR);
      console.log('aria2c.exe ready.');
    } catch (err) {
      console.warn('Could not auto-fetch aria2 zip:', err.message);
    }
  } else {
    console.log('aria2c.exe already present.');
  }
  cleanSubdirsAndZips(ARIA2_DIR, 'aria2c.exe');

  const ffmpegPath = path.join(FFMPEG_DIR, 'ffmpeg.exe');
  if (!fs.existsSync(ffmpegPath)) {
    console.log('Checking ffmpeg.exe...');
    try {
      const zipPath = path.join(FFMPEG_DIR, 'ffmpeg.zip');
      if (!fs.existsSync(zipPath)) {
        await downloadFile('https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip', zipPath);
      }
      console.log('Extracting ffmpeg.exe...');
      extractZip(zipPath, FFMPEG_DIR);
      const findExe = (dir) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fp = path.join(dir, file);
          if (fs.statSync(fp).isDirectory()) {
            findExe(fp);
          } else if (file === 'ffmpeg.exe') {
            fs.copyFileSync(fp, ffmpegPath);
          }
        }
      };
      findExe(FFMPEG_DIR);
      console.log('ffmpeg.exe ready.');
    } catch (err) {
      console.warn('Could not auto-fetch ffmpeg zip:', err.message);
    }
  } else {
    console.log('ffmpeg.exe already present.');
  }
  cleanSubdirsAndZips(FFMPEG_DIR, 'ffmpeg.exe');

  console.log('Engine binaries check complete.');
}

setupEngines();
