import { chromium, webkit } from 'playwright-core';
import { writeFileSync } from 'node:fs';
const OUT = process.argv[2];
const F = {
  engine: ['chromium', 'webkit'],
  device: ['phone-portrait', 'phone-landscape', 'tablet', 'desktop'],
  save: ['fresh', 'progress', 'corrupt', 'blocked'],
  sound: ['on', 'off'],
  motion: ['normal', 'reduced'],
  vibration: ['on', 'off'],
  level: [0, 1, 2, 3, 4, 5, 6, 7],
};
// greedy pairwise covering array
const keys = Object.keys(F);
const uncovered = new Set();
for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) for (const a of F[keys[i]]) for (const b of F[keys[j]]) uncovered.add(`${i}=${a}|${j}=${b}`);
const pairsOf = (c) => { const out = []; for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) out.push(`${i}=${c[keys[i]]}|${j}=${c[keys[j]]}`); return out; };
const cases = [];
let rs = 7; const rnd = () => ((rs = (rs * 48271) % 2147483647) / 2147483647);
while (uncovered.size) {
  let best = null, bestN = -1;
  for (let t = 0; t < 400; t++) { const c = {}; for (const k of keys) c[k] = F[k][Math.floor(rnd() * F[k].length)]; const n = pairsOf(c).filter((p) => uncovered.has(p)).length; if (n > bestN) { bestN = n; best = c; } }
  pairsOf(best).forEach((p) => uncovered.delete(p)); cases.push(best);
}
const totalPairs = (() => { let n = 0; for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) n += F[keys[i]].length * F[keys[j]].length; return n; })();
console.log(`${cases.length} pairwise cases cover all ${totalPairs} value pairs (vs ${keys.reduce((a, k) => a * F[k].length, 1)} full combinations)`);
const DEV = { 'phone-portrait': { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, 'phone-landscape': { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, tablet: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 } };
const browsers = { chromium: await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }), webkit: await webkit.launch() };
const results = [];
for (const [n, c] of cases.entries()) {
  const ctx = await browsers[c.engine].newContext(DEV[c.device]); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  const settings = { muted: c.sound === 'off', reducedMotion: c.motion === 'reduced', volume: 0.8, vibration: c.vibration === 'on' };
  const progress = { version: 1, completed: ['bus-stop', 'rooftop'], tutorialDone: true, storySeen: true, stars: { 'bus-stop': 3, rooftop: 2 }, badges: { 'bus-stop': { date: '2026-10-01' } }, settings };
  await p.addInitScript(({ save, settings, blocked }) => {
    window.__buzz = 0; navigator.vibrate = () => { window.__buzz++; return true; };
    if (blocked) { Storage.prototype.setItem = () => { throw new DOMException('blocked', 'SecurityError'); }; Storage.prototype.getItem = () => { throw new DOMException('blocked', 'SecurityError'); }; return; }
    if (!sessionStorage.getItem('__seeded')) { sessionStorage.setItem('__seeded', '1'); if (save === 'fresh') localStorage.clear(); else if (save === 'corrupt') localStorage.setItem('afterlife.save.v1', '{oops'); else localStorage.setItem('afterlife.save.v1', JSON.stringify({ ...save, settings })); }
  }, { save: c.save === 'progress' ? progress : c.save, settings, blocked: c.save === 'blocked' });
  const fails = [];
  try {
    await p.goto('http://localhost:5173/play/'); await p.waitForTimeout(1200);
    if (!(await p.$('[data-nav="select"]'))) fails.push('title did not load');
    // apply settings through the real Settings screen when they could not be pre-saved
    if (c.save !== 'progress') {
      await p.click('[data-nav="settings"]');
      const set = async (sel, want) => { const box = await p.$(sel); if (!box) return; if ((await box.isChecked()) !== want) await box.click(); };
      await set('[data-setting="sound"]', !settings.muted); await set('[data-setting="reducedMotion"]', settings.reducedMotion); await set('[data-setting="vibration"]', settings.vibration);
      await p.click('[data-nav="title"]');
    }
    await p.evaluate((lv) => window.afterlife.startLevel(lv), c.level); await p.waitForTimeout(900);
    await p.evaluate(() => { const ctl = window.afterlife.controller; for (const m of ctl.level.solution) ctl.play(m); });
    await p.waitForTimeout(500);
    const st = await p.evaluate(() => ({ overlay: window.afterlife.controller.view.overlay, confetti: !!document.querySelector('.confetti'), buzz: window.__buzz, mutePressed: document.querySelector('[data-action="mute"]')?.getAttribute('aria-pressed'), panel: (() => { const r = document.querySelector('.overlay .panel')?.getBoundingClientRect(); return r ? [r.top, r.bottom, innerHeight] : null; })(), badge: !!document.querySelector('.overlay .badge-earned svg'), saved: (() => { try { return localStorage.getItem('afterlife.save.v1'); } catch { return 'blocked'; } })() }));
    if (st.overlay !== 'restored') fails.push('no win panel');
    if (st.confetti !== (c.motion === 'normal')) fails.push(`confetti ${st.confetti} with motion ${c.motion}`);
    if ((st.buzz > 0) !== (c.vibration === 'on')) fails.push(`vibrate x${st.buzz} with vibration ${c.vibration}`);
    if (st.mutePressed !== String(c.sound === 'off')) fails.push(`mute button ${st.mutePressed} with sound ${c.sound}`);
    if (!st.panel || st.panel[0] < -1 || st.panel[1] > st.panel[2] + 1) fails.push(`win panel off-screen ${JSON.stringify(st.panel)}`);
    if (!st.badge) fails.push('no badge on win panel');
    if (c.save !== 'blocked') { const s = JSON.parse(st.saved); const id = ['bus-stop', 'rooftop', 'petrol-station', 'railway-platform', 'playground', 'laundromat', 'bus-depot', 'rooftop-garden'][c.level]; if (!s.completed.includes(id) || !s.badges[id]) fails.push('win not saved'); }
    // reload keeps progress (except when storage is blocked)
    await p.reload(); await p.waitForTimeout(900);
    if (!(await p.$('[data-nav="select"]'))) fails.push('reload failed');
  } catch (e) { fails.push('SCRIPT ' + String(e).split('\n')[0]); }
  if (errs.length) fails.push(...errs.map((e) => 'ERROR ' + e.slice(0, 120)));
  results.push({ n: n + 1, ...c, level: c.level + 1, pass: fails.length === 0, fails });
  process.stdout.write(fails.length ? `\n#${n + 1} FAIL ${JSON.stringify(c)} ${fails.join('; ')}` : '.');
  await ctx.close();
}
for (const b of Object.values(browsers)) await b.close();
writeFileSync(`${OUT}/pairwise.json`, JSON.stringify({ totalPairs, cases: results }, null, 1));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} pairwise cases passed`);
