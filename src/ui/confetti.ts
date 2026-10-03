/** Full-screen confetti for a restored place: a canvas above everything that never takes taps. */
export const CONFETTI_COLORS = ['#9cc25a', '#b5d86a', '#e89ab0', '#f2c14e', '#f3e6a0', '#d2a85e', '#c7a6e8'];
const LIFE_MS = 3000;

export interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  spin: number;
  angle: number;
}

/** Pieces burst alternately from the left and right edges, up and inward. */
export function makeConfetti(n: number, w: number, h: number, rng: () => number = Math.random): Piece[] {
  return Array.from({ length: n }, (_, i) => {
    const left = i % 2 === 0;
    const speed = 9 + rng() * 9;
    const up = 0.55 + rng() * 0.35; // share of the speed that goes upward
    return {
      x: left ? 0 : w,
      y: h * (0.55 + rng() * 0.35),
      vx: (left ? 1 : -1) * speed * (1 - up) * 1.6,
      vy: -speed * up * 1.5,
      size: 6 + rng() * 7,
      color: CONFETTI_COLORS[Math.floor(rng() * CONFETTI_COLORS.length) % CONFETTI_COLORS.length]!,
      spin: (rng() - 0.5) * 0.4,
      angle: rng() * Math.PI,
    };
  });
}

/** Starts the burst; returns the canvas (removed by itself after 3 s), or null with reduced motion or no canvas. */
export function launchConfetti(root: HTMLElement, opts: { reducedMotion: boolean }): HTMLCanvasElement | null {
  if (opts.reducedMotion) return null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.className = 'confetti';
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.setAttribute('aria-hidden', 'true');
  root.appendChild(canvas);
  ctx.scale(dpr, dpr);
  const pieces = makeConfetti(140, w, h);
  const start = performance.now();
  let last = start;
  const frame = (now: number) => {
    const t = now - start;
    const k = Math.min(3, (now - last) / 16.7);
    last = now;
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = t > LIFE_MS - 600 ? Math.max(0, (LIFE_MS - t) / 600) : 1;
    for (const p of pieces) {
      p.vy += 0.32 * k;
      p.vx *= 0.99;
      p.vy *= 0.99;
      p.x += p.vx * k + Math.sin((t + p.size * 40) / 260) * 0.6;
      p.y += p.vy * k;
      p.angle += p.spin * k;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 + Math.abs(Math.sin(p.angle)) * p.size * 0.5);
      ctx.restore();
    }
    if (t < LIFE_MS && canvas.isConnected) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
  return canvas;
}
