// Generate Video Memory AI extension icons at all required sizes
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const SIZES = [16, 32, 48, 96, 128];
const OUT_DIR = path.join(__dirname, 'extension', 'icons');

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const s = size; // shorthand
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.45; // circle radius

  // --- Background circle with purple gradient ---
  const grad = ctx.createLinearGradient(0, 0, s, s);
  grad.addColorStop(0, '#8B5CF6');   // violet-500
  grad.addColorStop(0.5, '#7C3AED'); // violet-600
  grad.addColorStop(1, '#6D28D9');   // violet-700

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // --- Subtle inner shadow ring ---
  const innerGrad = ctx.createRadialGradient(cx, cy * 0.85, r * 0.2, cx, cy, r);
  innerGrad.addColorStop(0, 'rgba(255,255,255,0.15)');
  innerGrad.addColorStop(0.6, 'rgba(255,255,255,0)');
  innerGrad.addColorStop(1, 'rgba(0,0,0,0.1)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = innerGrad;
  ctx.fill();

  // --- Play triangle (slightly right-offset for visual centering) ---
  const triSize = r * 0.55;
  const triOffsetX = triSize * 0.12; // shift right since play triangles look left-heavy
  const triCx = cx + triOffsetX;

  ctx.beginPath();
  ctx.moveTo(triCx + triSize * 0.55, cy);                           // right point
  ctx.lineTo(triCx - triSize * 0.35, cy - triSize * 0.55);          // top-left
  ctx.lineTo(triCx - triSize * 0.35, cy + triSize * 0.55);          // bottom-left
  ctx.closePath();

  // White with slight transparency for blending
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fill();

  // --- Sparkle/memory accent (small diamond) ---
  // Only render on sizes >= 32 to avoid sub-pixel noise
  if (size >= 32) {
    const sparkleSize = s * 0.06;
    const sx = cx + r * 0.55;
    const sy = cy - r * 0.55;

    ctx.fillStyle = '#FCD34D'; // amber-300
    ctx.beginPath();
    ctx.moveTo(sx, sy - sparkleSize);
    ctx.lineTo(sx + sparkleSize * 0.6, sy);
    ctx.lineTo(sx, sy + sparkleSize);
    ctx.lineTo(sx - sparkleSize * 0.6, sy);
    ctx.closePath();
    ctx.fill();

    // Second smaller sparkle
    if (size >= 48) {
      const s2 = sparkleSize * 0.5;
      const sx2 = cx + r * 0.7;
      const sy2 = cy - r * 0.3;
      ctx.beginPath();
      ctx.moveTo(sx2, sy2 - s2);
      ctx.lineTo(sx2 + s2 * 0.6, sy2);
      ctx.lineTo(sx2, sy2 + s2);
      ctx.lineTo(sx2 - s2 * 0.6, sy2);
      ctx.closePath();
      ctx.fill();
    }
  }

  return canvas.toBuffer('image/png');
}

// Ensure output directory exists
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

for (const size of SIZES) {
  const buf = drawIcon(size);
  const outPath = path.join(OUT_DIR, `icon${size}.png`);
  fs.writeFileSync(outPath, buf);
  console.log(`Generated ${outPath} (${size}x${size})`);
}

console.log('Done! All icons generated.');
