import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
await p.addInitScript(() => localStorage.setItem('afterlife.save.v1', JSON.stringify({ version: 1, completed: [], tutorialDone: true, storySeen: true, settings: {} })));
await p.goto('http://localhost:5173/play/'); await p.waitForTimeout(2000);
const busy = () => p.evaluate(() => { const t = performance.now(); let x = 0; for (let i = 0; i < 2e7; i++) x += i % 7; return Math.round(performance.now() - t); });
const base = await busy();
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
const slow = await busy();
await p.evaluate(() => window.afterlife.startLevel(7)); await p.waitForTimeout(1500);
const r = await p.evaluate(async () => {
  const g = window.afterlifeGame; const c = window.afterlife.controller; const samples = [];
  const iv = setInterval(() => samples.push(g.loop.actualFps), 250);
  const t0 = performance.now();
  for (const m of c.level.solution) { c.play(m); await new Promise((r) => setTimeout(r, 220)); }
  await new Promise((r) => setTimeout(r, 3500));
  clearInterval(iv);
  return { min: Math.round(Math.min(...samples)), avg: Math.round(samples.reduce((a, b) => a + b, 0) / samples.length), secs: Math.round((performance.now() - t0) / 1000) };
});
console.log(`busy loop: ${base} ms normal vs ${slow} ms throttled (${(slow / base).toFixed(1)}x slower) | Phaser fps during Rooftop Garden + celebration at 6x: avg ${r.avg}, min ${r.min} over ${r.secs}s`);
await b.close();
