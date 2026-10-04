// Vanya Downloader Native Messaging Host for Chrome, Edge, and Brave
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn, exec } = require('child_process');

function readMessage(callback) {
  let lengthBuffer = Buffer.alloc(4);
  let lengthBytesRead = 0;
  let messageLength = null;
  let messageBuffer = null;
  let messageBytesRead = 0;

  process.stdin.on('readable', () => {
    let chunk;
    while ((chunk = process.stdin.read()) !== null) {
      let offset = 0;
      while (offset < chunk.length) {
        if (messageLength === null) {
          const needed = 4 - lengthBytesRead;
          const available = chunk.length - offset;
          const toCopy = Math.min(needed, available);
          chunk.copy(lengthBuffer, lengthBytesRead, offset, offset + toCopy);
          lengthBytesRead += toCopy;
          offset += toCopy;
          if (lengthBytesRead === 4) {
            messageLength = lengthBuffer.readUInt32LE(0);
            messageBuffer = Buffer.alloc(messageLength);
            messageBytesRead = 0;
          }
        } else {
          const needed = messageLength - messageBytesRead;
          const available = chunk.length - offset;
          const toCopy = Math.min(needed, available);
          chunk.copy(messageBuffer, messageBytesRead, offset, offset + toCopy);
          messageBytesRead += toCopy;
          offset += toCopy;
          if (messageBytesRead === messageLength) {
            const jsonStr = messageBuffer.toString('utf8');
            try {
              const msg = JSON.parse(jsonStr);
              callback(msg);
            } catch (e) {
              console.error('Failed to parse input json:', e);
            }
            lengthBytesRead = 0;
            messageLength = null;
            messageBuffer = null;
            messageBytesRead = 0;
          }
        }
      }
    }
  });
}

function sendMessage(msg) {
  const jsonBuffer = Buffer.from(JSON.stringify(msg), 'utf8');
  const lenBuffer = Buffer.alloc(4);
  lenBuffer.writeUInt32LE(jsonBuffer.length, 0);
  process.stdout.write(Buffer.concat([lenBuffer, jsonBuffer]));
}

function isAppRunning() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:18792/ping', { timeout: 800 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

function launchVanyaBackground() {
  const rootDir = path.resolve(__dirname, '../../..');
  // Check for production executable
  const prodExe = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Vanya Downloader', 'Vanya Downloader.exe');
  
  if (fs.existsSync(prodExe)) {
    const child = spawn(prodExe, ['--hidden', '--background'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
    return;
  }

  // Development launch fallback
  const cmd = `cmd.exe /c npx electron . --hidden --background`;
  const child = exec(cmd, { cwd: rootDir, windowsHide: true });
  child.unref();
}

function forwardDownload(data) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      url: data.url,
      filename: data.filename,
      type: data.type || 'auto',
      quality: data.quality || '',
      startImmediately: data.startImmediately !== false,
    });

    const req = http.request(
      'http://127.0.0.1:18792/add-download',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 3000,
      },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve({ success: res.statusCode === 200 });
          }
        });
      }
    );

    req.on('error', () => resolve({ success: false }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false });
    });
    req.write(payload);
    req.end();
  });
}

readMessage(async (msg) => {
  const running = await isAppRunning();
  if (!running) {
    launchVanyaBackground();
  }

  // If download payload provided, wait up to 4 seconds for background server to respond and forward
  if (msg && msg.url) {
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const isUp = await isAppRunning();
      if (isUp) {
        const res = await forwardDownload(msg);
        sendMessage({ success: true, status: 'launched_and_forwarded', result: res });
        setTimeout(() => process.exit(0), 100);
        return;
      }
    }
  }

  sendMessage({ success: true, status: running ? 'already_running' : 'launched' });
  setTimeout(() => process.exit(0), 100);
});
