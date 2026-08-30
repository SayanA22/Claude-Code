/**
 * Generates the PWA icon set. Pure Node (zlib + a hand-rolled PNG encoder) so
 * the build needs no image toolchain.
 *
 * The mark: a focus ring with a single filled marker — the "one thing you're
 * doing right now" idea DayOS is built around.
 *
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const OUT = new URL("../public/icons/", import.meta.url);
mkdirSync(OUT, { recursive: true });

const BG = [79, 70, 229]; // indigo
const FG = [255, 255, 255];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Coverage of the mark at a point, supersampled 3x3 for smooth edges. */
function coverage(px, py, size, inset) {
  const c = size / 2;
  const scale = size * (1 - inset * 2);
  const ringR = scale * 0.33;
  const ringW = scale * 0.085;
  const dotR = scale * 0.085;
  const dotY = c - ringR;

  let hits = 0;
  for (let sy = 0; sy < 3; sy++) {
    for (let sx = 0; sx < 3; sx++) {
      const x = px + (sx + 0.5) / 3;
      const y = py + (sy + 0.5) / 3;
      const d = Math.hypot(x - c, y - c);
      const onRing = Math.abs(d - ringR) <= ringW / 2;
      const inDot = Math.hypot(x - c, y - dotY) <= dotR * 1.55;
      // Open the ring where the marker sits, so the dot reads as separate.
      const nearDot = Math.hypot(x - c, y - dotY) <= dotR * 2.3;
      if ((onRing && !nearDot) || inDot) hits++;
    }
  }
  return hits / 9;
}

/** Squircle-ish rounded-square background coverage. */
function bgCoverage(px, py, size, radius) {
  let hits = 0;
  for (let sy = 0; sy < 3; sy++) {
    for (let sx = 0; sx < 3; sx++) {
      const x = px + (sx + 0.5) / 3;
      const y = py + (sy + 0.5) / 3;
      const dx = Math.max(radius - x, x - (size - radius), 0);
      const dy = Math.max(radius - y, y - (size - radius), 0);
      if (Math.hypot(dx, dy) <= radius) hits++;
    }
  }
  return hits / 9;
}

function render(size, { maskable = false } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const radius = maskable ? size / 2 : size * 0.225;
  const inset = maskable ? 0.14 : 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const bg = maskable ? 1 : bgCoverage(x, y, size, radius);
      const fg = coverage(x, y, size, inset) * bg;
      for (let ch = 0; ch < 3; ch++) {
        buf[i + ch] = Math.round(BG[ch] * (1 - fg) + FG[ch] * fg);
      }
      buf[i + 3] = Math.round(255 * bg);
    }
  }
  return encodePng(size, buf);
}

const targets = [
  ["icon-192.png", 192, {}],
  ["icon-512.png", 512, {}],
  ["maskable-512.png", 512, { maskable: true }],
  ["apple-touch-icon.png", 180, {}],
];

for (const [name, size, opts] of targets) {
  writeFileSync(new URL(name, OUT), render(size, opts));
  console.log(`wrote public/icons/${name}`);
}
