import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-gpu-rasterization'] });
const seen = JSON.stringify({ version: 1, completed: [], tutorialDone: true, storySeen: true, settings: {} });
async function run(label, ctxOpts, cpu, levels) {
  const ctx = await b.newContext(ctxOpts); const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript((s) => localStorage.setItem('afterlife.save.v1', s), seen);
  await p.goto('http://localhost:5173/play/'); await p.waitForTimeout(2000);
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  const res = [];
  for (const lv of levels) {
    await p.evaluate((lv) => window.afterlife.startLevel(lv), lv); await p.waitForTimeout(1500);
    // record frame times while the level is played move by move, then the win celebration
    const stats = await p.evaluate(async () => {
      const times = []; let last = performance.now(), on = true;
      const tick = (t) => { times.push(t - last); last = t; if (on) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      const c = window.afterlife.controller;
      for (const m of c.level.solution) { c.play(m); await new Promise((r) => setTimeout(r, 220)); }
      await new Promise((r) => setTimeout(r, 3500)); // celebration + confetti
      on = false;
      const f = times.slice(1).sort((a, b) => a - b);
      const avg = f.reduce((a, b) => a + b, 0) / f.length;
      return { frames: f.length, fps: Math.round(1000 / avg), p95: Math.round(f[Math.floor(f.length * 0.95)]), slow: Math.round((100 * f.filter((x) => x > 33.4).length) / f.length), worst: Math.round(f.at(-1)) };
    });
    res.push({ level: lv + 1, ...stats });
  }
  // memory: play all 8 twice, compare heap after GC
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); return (await cdp.send('Runtime.getHeapUsage')).usedSize; };
  const cycle = () => p.evaluate(async () => { for (let lv = 0; lv < 8; lv++) { window.afterlife.startLevel(lv); await new Promise((r) => setTimeout(r, 300)); const c = window.afterlife.controller; for (const m of c.level.solution) c.play(m); await new Promise((r) => setTimeout(r, 900)); } });
  await cycle(); const h1 = await heap(); await cycle(); await cycle(); const h2 = await heap();
  const tex = await p.evaluate(() => Object.keys(window.afterlifeGame.textures.list).length);
  console.log(`\n${label} (CPU ${cpu}x)`);
  for (const r of res) console.log(`  L${r.level}: ${r.fps} fps avg, p95 frame ${r.p95} ms, slow frames ${r.slow}%, worst ${r.worst} ms`);
  console.log(`  memory after 1 vs 3 full playthroughs: ${(h1 / 1e6).toFixed(1)} MB -> ${(h2 / 1e6).toFixed(1)} MB; textures ${tex}; errors ${errs.length}`);
  await ctx.close();
}
const phone = { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true };
await run('Mid-range Android phone (Pixel 7 screen)', phone, 4, [4, 6, 7]);
await run('Low-end Android phone (360x740)', { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 6, [4, 7]);
await run('Desktop 1920x1080', { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }, 1, [4, 7]);
await b.close();
