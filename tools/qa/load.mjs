import { chromium, webkit } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
for (const [label, net] of [['4G (9 Mbps, 85 ms)', { latency: 85, downloadThroughput: 9e6 / 8, uploadThroughput: 1.5e6 / 8 }], ['Slow 4G (1.6 Mbps, 150 ms)', { latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 0.75e6 / 8 }]]) {
  for (const path of ['/', '/play/']) {
    const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true });
    const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
    await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, ...net });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    let bytes = 0; const bad = [];
    cdp.on('Network.loadingFinished', (e) => (bytes += e.encodedDataLength));
    p.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(() => { window.__lcp = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); });
    const t0 = Date.now();
    await p.goto('https://afterlifeme.vercel.app' + path, { waitUntil: 'load', timeout: 90000 });
    let ready = null;
    if (path === '/play/') { await p.waitForSelector('[data-nav="select"]', { timeout: 60000 }); await p.waitForFunction(() => document.querySelector('#stage canvas'), null, { timeout: 60000 }); ready = Date.now() - t0; }
    await p.waitForTimeout(1500);
    const m = await p.evaluate(() => ({ fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0), lcp: Math.round(window.__lcp) }));
    console.log(`${label.padEnd(26)} ${path.padEnd(7)} first paint ${m.fcp} ms, largest paint ${m.lcp} ms${ready ? `, game ready ${ready} ms` : ''}, downloaded ${(bytes / 1024).toFixed(0)} KB, failed ${bad.length ? bad.join(',') : 'none'}, errors ${errs.length}`);
    await ctx.close();
  }
}
await b.close();
// WebKit (Safari engine) frame rate, unthrottled
const w = await webkit.launch();
const ctx = await w.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.addInitScript(() => localStorage.setItem('afterlife.save.v1', JSON.stringify({ version: 1, completed: [], tutorialDone: true, storySeen: true, settings: {} })));
await p.goto('http://localhost:5173/play/'); await p.waitForTimeout(2000);
await p.evaluate(() => window.afterlife.startLevel(7)); await p.waitForTimeout(1500);
const r = await p.evaluate(async () => { const g = window.afterlifeGame, c = window.afterlife.controller, s = []; const iv = setInterval(() => s.push(g.loop.actualFps), 250); for (const m of c.level.solution) { c.play(m); await new Promise((r) => setTimeout(r, 220)); } await new Promise((r) => setTimeout(r, 3500)); clearInterval(iv); return { avg: Math.round(s.reduce((a, b) => a + b, 0) / s.length), min: Math.round(Math.min(...s)) }; });
console.log(`WebKit (Safari engine) iPhone 15 screen, Rooftop Garden + celebration: avg ${r.avg} fps, min ${r.min}`);
await w.close();
