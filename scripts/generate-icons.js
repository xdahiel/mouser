const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const outDir = path.join(__dirname, '..', 'build', 'icons');
const ppmPath = path.join(outDir, 'icon.ppm');
const pngPath = path.join(outDir, 'icon.png');
const icoPath = path.join(outDir, 'icon.ico');

function clamp(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function colorAt(x, y, w, h) {
  const t = y / (h - 1);
  const u = x / (w - 1);

  let r = 232 + 18 * (1 - t);
  let g = 244 - 18 * t + 8 * u;
  let b = 255 - 12 * t;

  const cx = 128;
  const cy = 128;
  const dx = x - cx;
  const dy = y - cy;
  const d = Math.sqrt(dx * dx + dy * dy);

  if (d < 98) {
    r = 86;
    g = 197;
    b = 227;
  }

  if (d < 80) {
    r = 47;
    g = 165;
    b = 204;
  }

  const barLeft = 78;
  const barRight = 190;
  const bars = [96, 128, 160];

  for (const by of bars) {
    if (x >= barLeft && x <= barRight && y >= by - 7 && y <= by + 7) {
      r = 245;
      g = 250;
      b = 255;
    }

    const dotX = 67;
    if ((x - dotX) * (x - dotX) + (y - by) * (y - by) <= 6 * 6) {
      r = 255;
      g = 207;
      b = 116;
    }
  }

  return [clamp(r), clamp(g), clamp(b), 255];
}

function generatePngSource() {
  const w = 1024;
  const h = 1024;
  let out = `P3\n${w} ${h}\n255\n`;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = y / (h - 1);
      const u = x / (w - 1);
      const r = clamp(232 + 18 * (1 - t));
      const g = clamp(244 - 18 * t + 8 * u);
      const b = clamp(255 - 12 * t);
      out += `${r} ${g} ${b} `;
    }
    out += '\n';
  }

  fs.writeFileSync(ppmPath, out);
  execSync(`sips -s format png "${ppmPath}" --out "${pngPath}" >/dev/null`);
  fs.unlinkSync(ppmPath);
}

function generateIco() {
  const size = 256;
  const pixelBytes = size * size * 4;
  const headerSize = 6;
  const dirEntrySize = 16;
  const bitmapInfoHeaderSize = 40;
  const andMaskSize = (size * size) / 8;

  const totalSize =
    headerSize +
    dirEntrySize +
    bitmapInfoHeaderSize +
    pixelBytes +
    andMaskSize;

  const buf = Buffer.alloc(totalSize);

  let offset = 0;
  buf.writeUInt16LE(0, offset);
  offset += 2;
  buf.writeUInt16LE(1, offset);
  offset += 2;
  buf.writeUInt16LE(1, offset);
  offset += 2;

  buf.writeUInt8(0, offset);
  offset += 1;
  buf.writeUInt8(0, offset);
  offset += 1;
  buf.writeUInt8(0, offset);
  offset += 1;
  buf.writeUInt8(0, offset);
  offset += 1;
  buf.writeUInt16LE(1, offset);
  offset += 2;
  buf.writeUInt16LE(32, offset);
  offset += 2;

  const imageSize = bitmapInfoHeaderSize + pixelBytes + andMaskSize;
  buf.writeUInt32LE(imageSize, offset);
  offset += 4;
  const imageOffset = headerSize + dirEntrySize;
  buf.writeUInt32LE(imageOffset, offset);
  offset += 4;

  buf.writeUInt32LE(bitmapInfoHeaderSize, offset);
  offset += 4;
  buf.writeInt32LE(size, offset);
  offset += 4;
  buf.writeInt32LE(size * 2, offset);
  offset += 4;
  buf.writeUInt16LE(1, offset);
  offset += 2;
  buf.writeUInt16LE(32, offset);
  offset += 2;
  buf.writeUInt32LE(0, offset);
  offset += 4;
  buf.writeUInt32LE(pixelBytes, offset);
  offset += 4;
  buf.writeInt32LE(0, offset);
  offset += 4;
  buf.writeInt32LE(0, offset);
  offset += 4;
  buf.writeUInt32LE(0, offset);
  offset += 4;
  buf.writeUInt32LE(0, offset);
  offset += 4;

  for (let y = size - 1; y >= 0; y--) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = colorAt(x, y, size, size);
      buf.writeUInt8(b, offset++);
      buf.writeUInt8(g, offset++);
      buf.writeUInt8(r, offset++);
      buf.writeUInt8(a, offset++);
    }
  }

  fs.writeFileSync(icoPath, buf);
}

fs.mkdirSync(outDir, { recursive: true });
generatePngSource();
generateIco();
console.log('Generated icons:', pngPath, icoPath);
