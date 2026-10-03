import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('content-hashed build files are cached for a year; sprites for a day; pages always revalidate', () => {
  const cfg = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')) as { headers?: { source: string; headers: { key: string; value: string }[] }[] };
  const rule = (src: string) => cfg.headers?.find((h) => h.source === src)?.headers.find((x) => x.key.toLowerCase() === 'cache-control')?.value;
  expect(rule('/assets/(.*)')).toBe('public, max-age=31536000, immutable');
  expect(rule('/sprites/(.*)')).toBe('public, max-age=86400, stale-while-revalidate=604800');
  expect(cfg.headers?.some((h) => h.source === '/' || h.source === '/play/')).toBe(false);
});
