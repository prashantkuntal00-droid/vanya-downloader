const fs = require('fs');
const path = require('path');

function createMultiResIco(pngFiles, outputIcoPath) {
  const images = pngFiles.map(({ size, filePath }) => {
    const data = fs.readFileSync(filePath);
    return {
      size: size === 256 ? 0 : size, // 0 indicates 256
      actualSize: size,
      data,
      dataSize: data.length
    };
  });

  const count = images.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let currentOffset = headerSize + (count * dirEntrySize);

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Image type (1 = icon)
  header.writeUInt16LE(count, 4); // Number of images

  const dirEntries = [];
  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.size, 0); // Width
    entry.writeUInt8(img.size, 1); // Height
    entry.writeUInt8(0, 2); // Color palette count
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(img.dataSize, 8); // Image size in bytes
    entry.writeUInt32LE(currentOffset, 12); // Image offset
    dirEntries.push(entry);
    currentOffset += img.dataSize;
  }

  const icoBuffer = Buffer.concat([
    header,
    ...dirEntries,
    ...images.map(img => img.data)
  ]);

  fs.writeFileSync(outputIcoPath, icoBuffer);
  console.log(`Generated multi-resolution ICO: ${outputIcoPath} (${icoBuffer.length} bytes, ${count} frames)`);
}

const buildDir = path.join(__dirname, '../build');
const publicDir = path.join(__dirname, '../public');

// Ensure real PNGs
if (fs.existsSync(path.join(buildDir, 'icon_1024.png'))) {
  fs.copyFileSync(path.join(buildDir, 'icon_1024.png'), path.join(buildDir, 'icon.png'));
  fs.copyFileSync(path.join(buildDir, 'icon_1024.png'), path.join(publicDir, 'logo.png'));
}

const frames = [
  { size: 16, filePath: path.join(buildDir, 'icon_16.png') },
  { size: 32, filePath: path.join(buildDir, 'icon_32.png') },
  { size: 48, filePath: path.join(buildDir, 'icon_48.png') },
  { size: 64, filePath: path.join(buildDir, 'icon_64.png') },
  { size: 128, filePath: path.join(buildDir, 'icon_128.png') },
  { size: 256, filePath: path.join(buildDir, 'icon_256.png') }
];

createMultiResIco(frames, path.join(buildDir, 'icon.ico'));
createMultiResIco(frames, path.join(publicDir, 'icon.ico'));
