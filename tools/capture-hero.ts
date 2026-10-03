import { chromium } from 'playwright-core';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE_URL_OVERRIDE ?? 'http://localhost:5173';

async function capture(width: number, height: number, out: string): Promise<void> {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(`${BASE}/play/`);
  await page.waitForFunction(() => 'afterlife' in window);
  await page.evaluate(() => {
    const app = (window as unknown as { afterlife: { startLevel(i: number): void; controller: { level: { solution: unknown[] }; play(m: unknown): void; keepDecorating(): void; rotate(d: number): void } } }).afterlife;
    app.startLevel(4);
    for (const m of app.controller.level.solution) app.controller.play(m);
    app.controller.keepDecorating();
  });
  await page.waitForTimeout(2600);
  await page.addStyleTag({ content: '#ui { display: none !important; }' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: out });
  await browser.close();
}

async function main(): Promise<void> {
  await capture(1600, 900, 'public/hero.png');
  await capture(1200, 630, 'public/og.png');
  console.log('wrote public/hero.png and public/og.png');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
