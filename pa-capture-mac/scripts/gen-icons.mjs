// Generate the app's icons with zero dependencies — a tiny pure-Node RGBA PNG encoder. Produces:
//   • assets/trayTemplate.png   (16px)  — menu-bar template image (black + alpha; macOS recolors it)
//   • assets/trayTemplate@2x.png (32px)
//   • assets/icon.png           (1024px) — app/DMG icon (dark rounded square + teal ring)
// A neutral "aperture ring + dot" mark — intentionally generic, not a wordmark.

import zlib from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = join(root, "assets");

// ── PNG encoder ──────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ── Drawing helpers ──────────────────────────────────────────────────────────
function coverage(px, py, test) {
  let hit = 0;
  for (let sx = 0; sx < 3; sx++) {
    for (let sy = 0; sy < 3; sy++) {
      if (test(px + (sx + 0.5) / 3, py + (sy + 0.5) / 3)) hit++;
    }
  }
  return hit / 9;
}

function ringOrDot(size) {
  const c = size / 2;
  const rOuter = size * 0.42;
  const rInner = rOuter - size * 0.13;
  const rDot = size * 0.12;
  return (x, y) => {
    const d = Math.hypot(x - c, y - c);
    return (d <= rOuter && d >= rInner) || d <= rDot;
  };
}

function roundedRect(size, margin, radius) {
  const lo = margin;
  const hi = size - margin;
  return (x, y) => {
    if (x < lo || x > hi || y < lo || y > hi) return false;
    const dx = Math.max(lo + radius - x, 0, x - (hi - radius));
    const dy = Math.max(lo + radius - y, 0, y - (hi - radius));
    return Math.hypot(dx, dy) <= radius;
  };
}

function setPx(buf, i, r, g, b, a) {
  buf[i] = r;
  buf[i + 1] = g;
  buf[i + 2] = b;
  buf[i + 3] = a;
}

// Black template image: alpha follows the mark's coverage; macOS tints it per menu-bar theme.
function makeTray(size) {
  const buf = Buffer.alloc(size * size * 4);
  const mark = ringOrDot(size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = Math.round(coverage(x, y, mark) * 255);
      setPx(buf, (y * size + x) * 4, 0, 0, 0, a);
    }
  }
  return encodePNG(size, size, buf);
}

// App icon: dark rounded square with a teal ring + dot.
function makeIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const bg = roundedRect(size, size * 0.06, size * 0.2);
  const mark = ringOrDot(size);
  const teal = [0x22, 0xd3, 0xee];
  const dark = [0x0e, 0x13, 0x19];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const bgCov = coverage(x, y, bg);
      const fgCov = coverage(x, y, mark) * bgCov;
      const r = Math.round(dark[0] * (1 - fgCov) + teal[0] * fgCov);
      const g = Math.round(dark[1] * (1 - fgCov) + teal[1] * fgCov);
      const b = Math.round(dark[2] * (1 - fgCov) + teal[2] * fgCov);
      setPx(buf, i, r, g, b, Math.round(bgCov * 255));
    }
  }
  return encodePNG(size, size, buf);
}

mkdirSync(assetsDir, { recursive: true });
writeFileSync(join(assetsDir, "trayTemplate.png"), makeTray(16));
writeFileSync(join(assetsDir, "trayTemplate@2x.png"), makeTray(32));
writeFileSync(join(assetsDir, "icon.png"), makeIcon(1024));
console.log("[gen-icons] wrote trayTemplate.png, trayTemplate@2x.png, icon.png");
