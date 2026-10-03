import { chromium, webkit, devices } from 'playwright-core';
const OUT = process.argv[2];
const ENGINES = { chromium: () => chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }), webkit: () => webkit.launch() };
const custom = (w, h, dpr, mobile) => ({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
const ONLY = process.env.ONLY; const CONFIGS0 = [
  ['iPhone SE (320x568)', custom(320, 568, 2, true)],
  ['iPhone SE 3 (375x667)', devices['iPhone SE (3rd gen)'] ?? custom(375, 667, 2, true)],
  ['iPhone 15 (393x852)', devices['iPhone 15'] ?? custom(393, 852, 3, true)],
  ['iPhone 15 Pro Max (430x932)', devices['iPhone 15 Pro Max'] ?? custom(430, 932, 3, true)],
  ['iPhone landscape (852x393)', devices['iPhone 15 landscape'] ?? custom(852, 393, 3, true)],
  ['Galaxy S8 (360x740)', devices['Galaxy S8'] ?? custom(360, 740, 3, true)],
  ['Pixel 7 (412x915)', devices['Pixel 7'] ?? custom(412, 915, 2.6, true)],
  ['iPad Mini (768x1024)', devices['iPad Mini'] ?? custom(768, 1024, 2, true)],
  ['iPad Pro 11 landscape (1194x834)', devices['iPad Pro 11 landscape'] ?? custom(1194, 834, 2, true)],
  ['Laptop 1280x800', custom(1280, 800, 2, false)],
  ['Laptop 1366x768', custom(1366, 768, 1, false)],
  ['Desktop 1920x1080', custom(1920, 1080, 1, false)],
  ['Desktop 2560x1440', custom(2560, 1440, 1, false)],
  ['Small window 800x600', custom(800, 600, 1, false)],
]; const CONFIGS = ONLY ? CONFIGS0.filter(([n]) => n.includes(ONLY)) : CONFIGS0;
const seen = JSON.stringify({ version: 1, completed: [], tutorialDone: true, storySeen: true, settings: {} });
const rows = [];
for (const [ename, launch] of Object.entries(ENGINES)) {
  const b = await launch();
  for (const [name, dev] of CONFIGS) {
    const { defaultBrowserType, ...opts } = dev;
    if (ename === 'chromium' && defaultBrowserType === 'webkit') {} // fine: descriptors work on both
    const ctx = await b.newContext(opts);
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    const issues = [];
    const W = opts.viewport.width, H = opts.viewport.height;
    const press = async (sel) => { if (opts.hasTouch) await p.tap(sel); else await p.click(sel); await p.waitForTimeout(250); };
    const layout = (screen) => p.evaluate(({ screen, W, H }) => {
      const out = [];
      const se = document.scrollingElement;
      if (se.scrollWidth > innerWidth + 1) out.push(`${screen}: page scrolls sideways (${se.scrollWidth}px)`);
      const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.closest('[hidden]'); };
      // buttons inside a horizontally scrolling tray or a scrolling screen may sit off-screen by design
      const scrolls = (e) => { for (let a = e.parentElement; a; a = a.parentElement) { const cs = getComputedStyle(a); if (/(auto|scroll)/.test(cs.overflowX + cs.overflowY) && (a.scrollWidth > a.clientWidth + 1 || a.scrollHeight > a.clientHeight + 1)) return true; } return false; };
      const btns = [...document.querySelectorAll('button, input, a')].filter(vis);
      for (const e of btns) {
        const r = e.getBoundingClientRect(); const label = (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 24);
        if (!scrolls(e) && (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1)) out.push(`${screen}: "${label}" off-screen`);
        if (e.tagName === 'BUTTON' && (r.width < 40 || r.height < 40)) out.push(`${screen}: "${label}" small ${Math.round(r.width)}x${Math.round(r.height)}`);
        // is it actually tappable at its centre (not covered)?
        const cx = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), cy = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
        const top = document.elementFromPoint(cx, cy);
        if (!scrolls(e) && top && top !== e && !e.contains(top) && !top.closest('.confetti')) out.push(`${screen}: "${label}" covered by ${top.className || top.tagName}`);
      }
      return out;
    }, { screen, W, H });
    try {
      await p.goto('http://localhost:5173/play/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1500);
      issues.push(...await layout('title'));
      await press('[data-nav="select"]'); await p.waitForTimeout(400);
      if (!(await p.$('.story'))) issues.push('story did not open on first Play');
      issues.push(...await layout('story'));
      await press('[data-story="skip"]'); await p.waitForTimeout(400);
      issues.push(...await layout('places'));
      await press('[data-nav="title"]'); await press('[data-nav="settings"]'); issues.push(...await layout('settings'));
      await press('[data-nav="title"]'); await press('[data-nav="badges"]'); issues.push(...await layout('badges'));
      await press('[data-nav="title"]'); await press('[data-nav="howto"]'); issues.push(...await layout('how to play'));
      await p.evaluate((s) => localStorage.setItem('afterlife.save.v1', s), seen); await p.reload(); await p.waitForTimeout(1200);
      let tapsOk = 0, tapsTotal = 0, wins = 0;
      for (const lv of [0, 4, 7]) {
        await p.evaluate((lv) => window.afterlife.startLevel(lv), lv); await p.waitForTimeout(1300);
        issues.push(...(await layout(`play L${lv + 1}`)).filter((x) => !/covered by pip/.test(x)));
        const sol = await p.evaluate(() => window.afterlife.controller.level.solution);
        // first 3 moves by real taps on the canvas
        for (const m of sol.slice(0, 3)) {
          await p.evaluate((m) => window.afterlife.controller.select(m.type === 'seed' ? { kind: 'seed', plant: m.plant } : m.type === 'scrap' ? { kind: 'scrap', slot: m.slot } : null), m);
          const pt = await p.evaluate((t) => { const g = window.afterlifeGame, c = window.afterlife.controller, cam = g.scene.getScene('diorama').cameras.main, v = c.view, k = 1 / g.scale.zoom; let q = { x: t.x, y: t.y }, Wd = v.state.width, Hd = v.state.height; for (let i = 0; i < v.rotation; i++) { q = { x: Hd - 1 - q.y, y: q.x }; [Wd, Hd] = [Hd, Wd]; } return { x: ((q.x - q.y) * 32 - cam.worldView.x) * cam.zoom / k, y: ((q.x + q.y) * 16 - cam.worldView.y) * cam.zoom / k }; }, m);
          const before = await p.evaluate(() => window.afterlife.controller.view.canUndo + ':' + JSON.stringify(window.afterlife.controller.view.state.tiles.map(t => (t.plant ? 'p' : '') + (t.object ? 'o' : ''))));
          if (opts.hasTouch) await p.touchscreen.tap(pt.x, pt.y); else await p.mouse.click(pt.x, pt.y);
          await p.waitForTimeout(350);
          const t = await p.evaluate((m) => { const s = window.afterlife.controller.view.state; return s.tiles[m.y * s.width + m.x]; }, m);
          tapsTotal++; if (m.type === 'seed' ? t.plant : m.type === 'scrap' ? t.object : true) tapsOk++;
          else issues.push(`L${lv + 1}: tap on tile ${m.x},${m.y} missed`);
        }
        await p.evaluate(() => { const c = window.afterlife.controller; const done = c.view.state.tiles.length; for (const m of c.level.solution.slice(3)) c.play(m); });
        await p.waitForTimeout(1600);
        if (await p.evaluate(() => window.afterlife.controller.view.overlay) === 'restored') wins++; else issues.push(`L${lv + 1}: did not reach the win panel`);
        issues.push(...(await layout(`win L${lv + 1}`)).filter((x) => !/covered by (pip|confetti)/.test(x)));
        if (lv === 7) await p.screenshot({ path: `${OUT}/${ename}-${name.replace(/[^a-z0-9]+/gi, '_')}-win.png` });
      }
      rows.push({ engine: ename, device: name, taps: `${tapsOk}/${tapsTotal}`, wins: `${wins}/3`, issues: [...new Set(issues)], errors: errs.filter(e => !/AudioContext|Tone/.test(e)) });
    } catch (e) {
      rows.push({ engine: ename, device: name, taps: '-', wins: '-', issues: ['SCRIPT: ' + String(e).split('\n')[0]], errors: errs });
    }
    await ctx.close();
  }
  await b.close();
}
const fs = await import('node:fs'); fs.writeFileSync(`${OUT}/matrix.json`, JSON.stringify(rows, null, 1));
for (const r of rows) console.log(`${r.engine.padEnd(8)} ${r.device.padEnd(34)} taps ${r.taps} wins ${r.wins} issues ${r.issues.length} errors ${r.errors.length}`);
