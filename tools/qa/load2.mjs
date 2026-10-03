import { writeFileSync } from 'node:fs';
const BASE = 'https://afterlifeme.vercel.app';
const html = await (await fetch(BASE + '/play/')).text();
const js = html.match(/assets\/play-[^"]+\.js/)[0], css = html.match(/assets\/play-[^"]+\.css/)?.[0];
const files = ['/', '/play/', '/' + js, css ? '/' + css : null, '/sprites/tyre-r0.png', '/og.png'].filter(Boolean);
const head = {};
for (const f of files) { const r = await fetch(BASE + f, { method: 'HEAD' }); head[f] = { status: r.status, cache: r.headers.get('cache-control'), xcache: r.headers.get('x-vercel-cache') }; }
async function wave(concurrency, rounds) {
  const lat = []; let fail = 0, bytes = 0; const t0 = Date.now();
  await Promise.all(Array.from({ length: concurrency }, async (_, w) => {
    for (let r = 0; r < rounds; r++) for (const f of files) {
      const s = performance.now();
      try { const res = await fetch(BASE + f, { headers: { 'cache-control': 'no-cache' } }); const buf = await res.arrayBuffer(); bytes += buf.byteLength; if (!res.ok) fail++; } catch { fail++; }
      lat.push(performance.now() - s);
    }
  }));
  lat.sort((a, b) => a - b);
  const q = (x) => Math.round(lat[Math.floor(lat.length * x)]);
  return { concurrency, requests: lat.length, failed: fail, p50: q(0.5), p95: q(0.95), p99: q(0.99), secs: ((Date.now() - t0) / 1000).toFixed(1), mb: (bytes / 1e6).toFixed(1), rps: Math.round(lat.length / ((Date.now() - t0) / 1000)) };
}
const waves = [];
for (const [c, r] of [[10, 5], [25, 5], [50, 5]]) { const w = await wave(c, r); waves.push(w); console.log(JSON.stringify(w)); }
writeFileSync(process.argv[2], JSON.stringify({ files, head, waves }, null, 1));
console.log(JSON.stringify(head));
