import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

// Meme Sprint 3: AI Agent Goes Rogue — draws a 1024x1024 PNG meme in pure TS.
// No network, no downloads: every pixel is drawn by the code below.

const W = 1024;
const H = 1024;
const px = new Uint8Array(W * H * 3);

type RGB = [number, number, number];

function set(x: number, y: number, r: number, g: number, b: number): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = r;
  px[i + 1] = g;
  px[i + 2] = b;
}

function blend(x: number, y: number, r: number, g: number, b: number, a: number): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = Math.round(px[i] * (1 - a) + r * a);
  px[i + 1] = Math.round(px[i + 1] * (1 - a) + g * a);
  px[i + 2] = Math.round(px[i + 2] * (1 - a) + b * a);
}

function fillRect(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) set(x, y, c[0], c[1], c[2]);
  }
}

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) set(x, y, c[0], c[1], c[2]);
    }
  }
}

function glowCircle(cx: number, cy: number, r: number, c: RGB, aMax: number): void {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
      if (d < r) blend(x, y, c[0], c[1], c[2], aMax * (1 - d / r));
    }
  }
}

function roundRect(x0: number, y0: number, x1: number, y1: number, rad: number, c: RGB): void {
  fillRect(x0 + rad, y0, x1 - rad, y1, c);
  fillRect(x0, y0 + rad, x1, y1 - rad, c);
  fillCircle(x0 + rad, y0 + rad, rad, c);
  fillCircle(x1 - rad, y0 + rad, rad, c);
  fillCircle(x0 + rad, y1 - rad, rad, c);
  fillCircle(x1 - rad, y1 - rad, rad, c);
}

function thickLine(x0: number, y0: number, x1: number, y1: number, w: number, c: RGB): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(x0 + (dx * s) / steps);
    const y = Math.round(y0 + (dy * s) / steps);
    fillCircle(x, y, w / 2, c);
  }
}

function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, w: number, c: RGB): void {
  for (let a = a0; a <= a1; a += 0.5) {
    const rad = (a * Math.PI) / 180;
    const x = Math.round(cx + rx * Math.cos(rad));
    const y = Math.round(cy + ry * Math.sin(rad));
    fillCircle(x, y, w / 2, c);
  }
}

// ---- 5x7 bitmap font (uppercase only; text is uppercased before drawing) ----
const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

function textWidth(text: string, s: number): number {
  return text.length * 6 * s - s;
}

function drawGlyph(ch: string, x: number, y: number, s: number, c: RGB): void {
  const g = GLYPHS[ch];
  if (!g) return;
  for (let r = 0; r < 7; r++) {
    for (let col = 0; col < 5; col++) {
      if (g[r][col] === "1") {
        fillRect(x + col * s, y + r * s, x + col * s + s - 1, y + r * s + s - 1, c);
      }
    }
  }
}

function drawText(text: string, cx: number, y: number, s: number, fill: RGB, outline: RGB): void {
  const t = Math.max(1, Math.floor(s / 3));
  const clean = text.toUpperCase().replace("…", "...");
  const w = textWidth(clean, s);
  const x0 = Math.round(cx - w / 2);
  const offsets: [number, number][] = [
    [-t, 0], [t, 0], [0, -t], [0, t],
    [-t, -t], [t, -t], [-t, t], [t, t],
  ];
  for (const [dx, dy] of offsets) {
    let gx = x0;
    for (const ch of clean) {
      drawGlyph(ch, gx + dx, y + dy, s, outline);
      gx += 6 * s;
    }
  }
  let gx = x0;
  for (const ch of clean) {
    drawGlyph(ch, gx, y, s, fill);
    gx += 6 * s;
  }
}

// ---- minimal PNG encoder (RGB, 8-bit, filter 0) ----
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- scene ----
// The captions below must stay byte-for-byte: the joke reads in one glance.
function drawCaption(text: string, cx: number, y: number, s: number): void {
  drawText(text, cx, y, s, [255, 255, 255], [0, 0, 0]);
}

function drawScene(): void {
  // Background: dark server-room gradient, navy top to deep red bottom.
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    const r = Math.round(11 + (32 - 11) * t);
    const g = Math.round(18 + (10 - 18) * t);
    const b = Math.round(32 + (20 - 32) * t);
    fillRect(0, y, W - 1, y, [r, g, b]);
  }
  // Red warning glow behind the robot.
  glowCircle(512, 330, 430, [220, 38, 38], 0.3);

  // Server racks on both edges with blinking LEDs.
  const ledColors: RGB[] = [[34, 197, 94], [245, 158, 11], [239, 68, 68], [56, 189, 248]];
  for (const rx of [0, 914]) {
    fillRect(rx, 240, rx + 110, 780, [13, 20, 36]);
    for (let row = 0; row < 12; row++) {
      const y = 258 + row * 44;
      fillRect(rx + 12, y, rx + 98, y + 26, [24, 33, 52]);
      for (let d = 0; d < 4; d++) {
        const c = ledColors[(row + d) % ledColors.length];
        fillRect(rx + 18 + d * 20, y + 9, rx + 24 + d * 20, y + 15, c);
      }
    }
  }

  // Top caption (two lines).
  drawCaption("MY AGENT", 512, 28, 12);
  drawCaption("WENT ROGUE", 512, 128, 12);

  // Robot: antenna.
  thickLine(512, 252, 512, 208, 8, [148, 163, 184]);
  glowCircle(512, 198, 26, [239, 68, 68], 0.6);
  fillCircle(512, 198, 13, [239, 68, 68]);

  // Robot head.
  roundRect(378, 246, 646, 454, 30, [31, 41, 55]);
  roundRect(382, 250, 642, 450, 26, [223, 230, 238]);
  // Left eye: normal. Right eye: glowing red (rogue).
  fillCircle(452, 335, 26, [255, 255, 255]);
  fillCircle(452, 335, 11, [15, 23, 42]);
  fillCircle(456, 331, 4, [255, 255, 255]);
  glowCircle(572, 335, 40, [220, 38, 38], 0.55);
  fillCircle(572, 335, 26, [220, 38, 38]);
  fillCircle(572, 335, 11, [15, 23, 42]);
  fillCircle(576, 331, 4, [255, 255, 255]);
  // Mischievous grin.
  arc(512, 352, 70, 42, 15, 165, 9, [31, 41, 55]);

  // Robot body.
  roundRect(398, 466, 626, 634, 24, [148, 163, 184]);
  roundRect(452, 500, 572, 580, 10, [51, 65, 85]);
  fillCircle(482, 540, 7, [34, 197, 94]);
  fillCircle(512, 540, 7, [245, 158, 11]);
  fillCircle(542, 540, 7, [239, 68, 68]);

  // Left arm down to the keyboard.
  thickLine(410, 520, 352, 640, 26, [148, 163, 184]);
  fillCircle(350, 644, 16, [203, 213, 225]);
  // Right arm up holding coffee.
  thickLine(614, 520, 688, 498, 26, [148, 163, 184]);
  // Coffee cup.
  roundRect(672, 440, 732, 512, 8, [180, 83, 9]);
  arc(732, 476, 16, 16, -70, 70, 6, [180, 83, 9]);
  // Steam.
  arc(692, 428, 10, 12, 200, 340, 4, [226, 232, 240]);
  arc(712, 424, 10, 12, 200, 340, 4, [226, 232, 240]);

  // Laptop: screen with the DELETE PROD button + progress bar.
  roundRect(324, 539, 700, 721, 12, [51, 65, 85]);
  roundRect(330, 545, 694, 715, 10, [15, 23, 42]);
  roundRect(360, 575, 664, 635, 12, [220, 38, 38]);
  drawText("DELETE PROD", 512, 593, 4, [255, 255, 255], [127, 29, 29]);
  drawText("deleting production... 99%", 512, 650, 2, [226, 232, 240], [15, 23, 42]);
  roundRect(370, 672, 654, 692, 8, [31, 41, 55]);
  fillRect(372, 674, 372 + Math.round(280 * 0.99), 690, [239, 68, 68]);
  // Keyboard base.
  roundRect(310, 715, 714, 752, 8, [71, 85, 105]);
  for (let k = 0; k < 8; k++) {
    fillRect(330 + k * 46, 728, 366 + k * 46, 740, [100, 116, 139]);
  }

  // Bottom caption (two lines).
  drawCaption("IT DELETED PROD…", 512, 792, 7);
  drawCaption("THEN ASKED FOR A RAISE", 512, 852, 7);

  // Watermark.
  drawText("MAKE.FUN", 940, 985, 3, [148, 163, 184], [11, 18, 32]);
}

drawScene();
const png = encodePNG();
mkdirSync("/output", { recursive: true });
writeFileSync("/output/entry.png", png);
console.log(`wrote /output/entry.png (${png.length} bytes, 1024x1024)`);
