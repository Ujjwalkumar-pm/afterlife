import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('the game page paints a loading screen before any script loads (inline, inside #ui so the app replaces it)', () => {
  const html = readFileSync(new URL('../../play/index.html', import.meta.url), 'utf8');
  expect(html).toMatch(/<div id="ui"><div class="boot"[^>]*role="status"[^>]*>[\s\S]*Afterlife[\s\S]*<\/div><\/div>/);
  expect(html).toMatch(/<style>[\s\S]*\.boot[\s\S]*<\/style>/);
  expect(html).toMatch(/prefers-reduced-motion/);
});
