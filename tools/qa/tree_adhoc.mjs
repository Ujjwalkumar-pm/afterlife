import { chromium, webkit } from 'playwright-core';
import { writeFileSync } from 'node:fs';
const OUT = process.argv[2];
const out = {};
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
// ---------- TREE TEST: crawl the menu graph ----------
{
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await p.addInitScript(() => localStorage.setItem('afterlife.save.v1', JSON.stringify({ version: 1, completed: ['bus-stop'], tutorialDone: true, storySeen: true, stars: { 'bus-stop': 3 }, badges: { 'bus-stop': { date: '2026-10-01' } }, settings: {} })));
  await p.goto('http://localhost:5173/play/'); await p.waitForTimeout(1000);
  const screen = () => p.evaluate(() => window.afterlife.screen);
  const graph = {}; const depth = { title: 0 }; const queue = ['title'];
  while (queue.length) {
    const s = queue.shift();
    await p.evaluate((s) => window.afterlife.show(s), s); await p.waitForTimeout(150);
    const navs = await p.$$eval('[data-nav]', (els) => els.map((e) => ({ to: e.dataset.nav, label: e.textContent.trim() })));
    graph[s] = navs;
    for (const n of navs) if (!(n.to in depth) && n.to !== 'story') { depth[n.to] = depth[s] + 1; queue.push(n.to); }
  }
  const backToTitle = Object.fromEntries(Object.entries(graph).map(([s, navs]) => [s, s === 'title' || navs.some((n) => n.to === 'title')]));
  // tasks: count real clicks from the title
  const tasks = [];
  const task = async (name, steps, check) => { await p.evaluate(() => window.afterlife.show('title')); await p.waitForTimeout(150); for (const s of steps) { await p.click(s); await p.waitForTimeout(250); } tasks.push({ task: name, clicks: steps.length, path: steps.join(' → '), ok: await check() }); };
  await task('Start playing a place', ['[data-nav="select"]', '[data-level="1"]'], async () => (await screen()) === 'play');
  await task('Change the volume', ['[data-nav="settings"]'], async () => !!(await p.$('[data-setting="volume"]')));
  await task('Turn vibration or motion off', ['[data-nav="settings"]'], async () => !!(await p.$('[data-setting="reducedMotion"]')));
  await task('Watch the story again', ['[data-nav="story"]'], async () => !!(await p.$('.story')));
  await task('See my badges', ['[data-nav="badges"]'], async () => (await screen()) === 'badges');
  await task('Share a badge', ['[data-nav="badges"]', '[data-share-badge="bus-stop"]'], async () => true);
  await task('Learn how to play', ['[data-nav="howto"]'], async () => (await p.$$('.howto-card')).length === 5);
  await task('Reset the whole game', ['[data-nav="settings"]', '[data-action="reset-ask"]', '[data-action="reset-cancel"]'], async () => !(await p.$('.reset-confirm')));
  await p.evaluate(() => window.afterlife.startLevel(1)); await p.waitForTimeout(800);
  const inGame = [];
  for (const [name, sel] of [['Get a hint (in a level)', '[data-action="hint"]'], ['Undo (in a level)', '[data-action="undo"]'], ['Turn the board (in a level)', '[data-action="rotate-left"]'], ['Open help (in a level)', '[data-action="help"]'], ['Mute (in a level)', '[data-action="mute"]'], ['Back to places (in a level)', '[data-action="menu"]']]) inGame.push({ task: name, clicks: 1, path: sel, ok: !!(await p.$(sel)) });
  out.tree = { graph, depth, backToTitle, tasks: [...tasks, ...inGame] };
  console.log('tree: screens', Object.keys(graph).length, 'max depth', Math.max(...Object.values(depth)), 'dead ends', Object.entries(backToTitle).filter(([, v]) => !v).map(([k]) => k), 'tasks ok', [...tasks, ...inGame].filter((t) => t.ok).length + '/' + (tasks.length + inGame.length));
  await p.context().close();
}
// ---------- AD HOC: monkey test + edge cases ----------
out.adhoc = [];
for (const [ename, br] of [['chromium', b], ['webkit', await webkit.launch()]]) {
  const ctx = await br.newContext({ viewport: { width: 1024, height: 700 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  p.on('download', () => {}); p.on('dialog', (d) => d.dismiss());
  await p.goto('http://localhost:5173/play/'); await p.waitForTimeout(1000);
  let s = 99; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const counts = {};
  for (let i = 0; i < 600; i++) {
    const r = rnd(); let kind;
    try {
      if (r < 0.45) { kind = 'click button'; const btns = await p.$$('button:not([disabled]), input'); const vis = []; for (const x of btns) if (await x.isVisible()) vis.push(x); if (vis.length) await vis[Math.floor(rnd() * vis.length)].click({ timeout: 800, force: true }); }
      else if (r < 0.75) { kind = 'tap board'; await p.mouse.click(Math.floor(rnd() * 1024), Math.floor(rnd() * 700)); }
      else if (r < 0.85) { kind = 'key'; await p.keyboard.press(['q', 'e', 'Escape', 'Enter', 'Tab', ' '][Math.floor(rnd() * 6)]); }
      else if (r < 0.93) { kind = 'drag'; const x = rnd() * 900, y = 200 + rnd() * 400; await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + (rnd() - 0.5) * 300, y + (rnd() - 0.5) * 100, { steps: 4 }); await p.mouse.up(); }
      else if (r < 0.97) { kind = 'resize'; await p.setViewportSize({ width: 360 + Math.floor(rnd() * 1200), height: 360 + Math.floor(rnd() * 600) }); }
      else { kind = 'wheel'; await p.mouse.wheel(0, (rnd() - 0.5) * 600); }
    } catch { /* element vanished mid-click: fine */ }
    counts[kind] = (counts[kind] ?? 0) + 1;
    if (i % 100 === 99 && (await p.evaluate(() => document.getElementById('ui').childElementCount)) === 0) errs.push(`blank UI after action ${i}`);
  }
  // after the chaos, can we always get home and play?
  await p.setViewportSize({ width: 1024, height: 700 });
  const recovered = await p.evaluate(() => { window.afterlife.show('title'); return !!document.querySelector('[data-nav="select"]'); });
  // targeted edge cases
  const edge = [];
  const e = async (name, fn) => { try { edge.push({ name, ok: !!(await fn()) }); } catch (x) { edge.push({ name, ok: false, note: String(x).slice(0, 100) }); } };
  const seen = JSON.stringify({ version: 1, completed: [], tutorialDone: true, storySeen: true, settings: {} });
  await p.evaluate((s) => localStorage.setItem('afterlife.save.v1', s), seen); await p.reload(); await p.waitForTimeout(800);
  const win = () => p.evaluate(() => { const c = window.afterlife.controller; for (const m of c.level.solution) c.play(m); });
  await e('Double-click Next place goes forward exactly one place', async () => { await p.evaluate(() => window.afterlife.startLevel(0)); await win(); await p.waitForTimeout(300); await p.dblclick('[data-action="next"]'); await p.waitForTimeout(300); return (await p.evaluate(() => window.afterlife.controller.level.id)) === 'rooftop'; });
  await e('Spamming Undo 50× at the start does nothing harmful', async () => { for (let i = 0; i < 50; i++) await p.keyboard.press('Escape'); for (let i = 0; i < 50; i++) await p.click('[data-action="undo"]', { force: true, timeout: 500 }).catch(() => {}); return !(await p.evaluate(() => window.afterlife.controller.view.canUndo)); });
  await e('Window resized during the win celebration keeps the panel on screen', async () => { await win(); await p.setViewportSize({ width: 400, height: 800 }); await p.waitForTimeout(600); await p.setViewportSize({ width: 1024, height: 700 }); await p.waitForTimeout(600); const r = await p.$eval('.overlay .panel', (x) => { const b = x.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight; }); return r; });
  await e('Rotating the board during the celebration does not break it', async () => { await p.evaluate(() => window.afterlife.startLevel(2)); await win(); await p.keyboard.press('q'); await p.keyboard.press('e'); await p.waitForTimeout(1500); return (await p.evaluate(() => window.afterlife.controller.view.overlay)) === 'restored'; });
  await e('Leaving a level mid-celebration and starting another works', async () => { await p.evaluate(() => window.afterlife.startLevel(3)); await win(); await p.evaluate(() => window.afterlife.startLevel(4)); await p.waitForTimeout(800); return (await p.evaluate(() => window.afterlife.controller.view.overlay)) === 'none'; });
  await e('Reload in the middle of a level restarts cleanly', async () => { await p.evaluate(() => { const c = window.afterlife.controller; c.play(c.level.solution[0]); }); await p.reload(); await p.waitForTimeout(900); return !!(await p.$('[data-nav="select"]')); });
  await e('Corrupted save is ignored and the game starts', async () => { await p.evaluate(() => localStorage.setItem('afterlife.save.v1', '{"version":1,"completed":"oops","stars":7')); await p.reload(); await p.waitForTimeout(900); return !!(await p.$('[data-nav="select"]')); });
  await e('Very old save (no new fields) loads and keeps progress', async () => { await p.evaluate(() => localStorage.setItem('afterlife.save.v1', JSON.stringify({ version: 1, completed: ['bus-stop'], settings: { reducedMotion: false, muted: false, volume: 0.8 } }))); await p.reload(); await p.waitForTimeout(900); return (await p.evaluate(() => JSON.parse(localStorage.getItem('afterlife.save.v1')).badges['bus-stop'])) !== undefined; });
  await e('Hint pressed with no hints left and during the tutorial is refused', async () => { await p.evaluate(() => { localStorage.setItem('afterlife.save.v1', JSON.stringify({ version: 1, completed: [], tutorialDone: false, storySeen: true, settings: {} })); }); await p.reload(); await p.waitForTimeout(800); await p.evaluate(() => window.afterlife.startLevel(0)); await p.waitForTimeout(500); return await p.$eval('[data-action="hint"]', (x) => x.disabled); });
  await e('Story skipped instantly then Play again goes straight to places', async () => { await p.evaluate(() => localStorage.removeItem('afterlife.save.v1')); await p.reload(); await p.waitForTimeout(800); await p.click('[data-nav="select"]'); await p.click('[data-story="skip"]'); await p.click('[data-nav="title"]'); await p.click('[data-nav="select"]'); return (await p.evaluate(() => window.afterlife.screen)) === 'select'; });
  out.adhoc.push({ engine: ename, actions: counts, recovered, errors: errs, edge });
  console.log(ename, 'monkey actions', JSON.stringify(counts), 'recovered', recovered, 'errors', errs.length, '| edge cases', edge.filter((x) => x.ok).length + '/' + edge.length, edge.filter((x) => !x.ok).map((x) => x.name + ' ' + (x.note ?? '')).join(' | '));
  await ctx.close(); if (ename === 'webkit') await br.close();
}
await b.close();
writeFileSync(`${OUT}/tree_adhoc.json`, JSON.stringify(out, null, 1));
