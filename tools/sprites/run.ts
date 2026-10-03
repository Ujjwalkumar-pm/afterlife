import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.RENDER_URL ?? 'http://localhost:5173/tools/sprites/render.html';

interface Rendered {
  name: string;
  rotation: number;
  dataUrl: string;
  originY: number;
  topHeight: number;
  scale: number;
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[render page]', e.message));
  await page.goto(URL);
  await page.waitForFunction(() => 'renderAll' in window);
  const sprites = (await page.evaluate(() => (window as unknown as { renderAll: () => Promise<unknown> }).renderAll())) as Rendered[];
  mkdirSync('public/sprites', { recursive: true });
  const manifest: Record<string, { originY: number; topHeight: number; scale: number }> = {};
  for (const s of sprites) {
    writeFileSync(`public/sprites/${s.name}-r${s.rotation}.png`, Buffer.from(s.dataUrl.split(',')[1]!, 'base64'));
    manifest[s.name] = { originY: s.originY, topHeight: s.topHeight, scale: s.scale };
  }
  writeFileSync('src/render/objects/sprites.json', `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`rendered ${sprites.length} images for ${Object.keys(manifest).length} objects`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
