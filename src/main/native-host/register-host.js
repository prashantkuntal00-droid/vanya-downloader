// Script to register Vanya Native Messaging Host in Windows Registry for Chrome, Edge, and Brave
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function registerNativeHost() {
  if (process.platform !== 'win32') return;

  const manifestPath = path.resolve(__dirname, 'com.vanya.downloader.json');
  const batPath = path.resolve(__dirname, 'vanya-native-host.bat');

  // Update manifest with absolute path to .bat wrapper
  const manifest = {
    name: 'com.vanya.downloader',
    description: 'Vanya Downloader Native Messaging Host',
    path: batPath,
    type: 'stdio',
    allowed_origins: [
      'chrome-extension://*/',
      'edge-extension://*/'
    ],
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  const regTargets = [
    'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.vanya.downloader',
    'HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\com.vanya.downloader',
    'HKCU\\Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts\\com.vanya.downloader',
  ];

  for (const target of regTargets) {
    try {
      const escapedPath = manifestPath.replace(/\\/g, '\\\\');
      execSync(`reg add "${target}" /ve /t REG_SZ /d "${manifestPath}" /f`, { stdio: 'ignore' });
      console.log(`Registered Native Host in: ${target}`);
    } catch (e) {
      console.warn(`Could not register key ${target}:`, e.message);
    }
  }
}

if (require.main === module) {
  registerNativeHost();
}

module.exports = { registerNativeHost };
