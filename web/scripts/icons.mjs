// Renders the PWA icons from one SVG so every size stays in sync.
import sharp from 'sharp';

const mark = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 112}" fill="#1b4332"/>
  <g transform="translate(256 262) scale(${pad ? 0.72 : 0.9}) translate(-256 -262)">
    <path d="M256 96 L416 220 V400 a24 24 0 0 1 -24 24 H120 a24 24 0 0 1 -24 -24 V220 Z" fill="#faf9f5"/>
    <path d="M256 96 L416 220" stroke="#c86d51" stroke-width="36" stroke-linecap="round"/>
    <path d="M256 96 L96 220" stroke="#c86d51" stroke-width="36" stroke-linecap="round"/>
    <path d="M176 300 l40 40 l84 -88" fill="none" stroke="#40916c" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

const out = [
  ['public/pwa-192.png', 192, false],
  ['public/pwa-512.png', 512, false],
  ['public/pwa-maskable-512.png', 512, true],
  ['public/apple-touch-icon.png', 180, true],
  ['public/favicon.png', 64, false],
];
for (const [file, size, maskable] of out) {
  await sharp(Buffer.from(mark(maskable))).resize(size, size).png().toFile(file);
  console.log('wrote', file);
}
