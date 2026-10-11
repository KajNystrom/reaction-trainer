// Generates the PWA icons (black arrow on yellow) as PNGs without dependencies.
// Run: node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [0xff, 0xd6, 0x0a];
const FG = [0x00, 0x00, 0x00];
// Same arrow as src/ui/arrow.ts, in a 100×100 box.
const ARROW = [
  [50, 4], [94, 50], [68, 50], [68, 96], [32, 96], [32, 50], [6, 50],
];

function inside(x, y, poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** `scale` < 1 shrinks the arrow to stay inside the maskable safe zone. */
function png(size, scale) {
  const SS = 4; // supersampling for smooth edges
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (((x + (sx + 0.5) / SS) / size) * 100 - 50) / scale + 50;
          const v = (((y + (sy + 0.5) / SS) / size) * 100 - 50) / scale + 50;
          if (inside(u, v, ARROW)) hits++;
        }
      }
      const a = hits / (SS * SS);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      for (let c = 0; c < 3; c++) raw[o + c] = Math.round(BG[c] * (1 - a) + FG[c] * a);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL('icon-192.png', out), png(192, 0.7));
writeFileSync(new URL('icon-512.png', out), png(512, 0.7));
writeFileSync(new URL('maskable-512.png', out), png(512, 0.5));
console.log('Icons written to public/icons/');
