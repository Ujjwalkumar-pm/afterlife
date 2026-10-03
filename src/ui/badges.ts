/**
 * One badge per place. Each design has its own shape, colours and emblem, and every earned badge is
 * one of a kind: its ring of leaves is "grown" from the place and the day it was first restored.
 */
export type BadgeShape = 'circle' | 'hexagon' | 'shield' | 'rounded' | 'scallop';
export type BadgeEmblem = 'bench' | 'tank' | 'pump' | 'station' | 'swing' | 'washer' | 'bus' | 'planter';

export interface BadgeDesign {
  shape: BadgeShape;
  emblem: BadgeEmblem;
  /** Gradient top → bottom. */
  colors: [string, string];
  /** Emblem accent (sign, door, petals…). */
  accent: string;
}

export const BADGES: Record<string, BadgeDesign> = {
  'bus-stop': { shape: 'circle', emblem: 'bench', colors: ['#7fae4a', '#2f7f72'], accent: '#e2574c' },
  rooftop: { shape: 'hexagon', emblem: 'tank', colors: ['#6aa6d6', '#3c5470'], accent: '#f2c14e' },
  'petrol-station': { shape: 'shield', emblem: 'pump', colors: ['#f0a93a', '#a5452c'], accent: '#2f6f9a' },
  'railway-platform': { shape: 'rounded', emblem: 'station', colors: ['#6670c8', '#6b3e78'], accent: '#f2c14e' },
  playground: { shape: 'scallop', emblem: 'swing', colors: ['#f2876b', '#c4466e'], accent: '#ffe08a' },
  laundromat: { shape: 'hexagon', emblem: 'washer', colors: ['#5ccfc4', '#3d6c86'], accent: '#2b5d8a' },
  'bus-depot': { shape: 'shield', emblem: 'bus', colors: ['#e3c04a', '#6f7a2e'], accent: '#2f6f9a' },
  'rooftop-garden': { shape: 'scallop', emblem: 'planter', colors: ['#f6cf5a', '#3f8f4a'], accent: '#e8789a' },
};

export interface BadgeInput {
  id: string;
  name: string;
  /** null when locked. */
  stars: 1 | 2 | 3 | null;
  /** YYYY-MM-DD the badge was first earned; null when locked. */
  date: string | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatBadgeDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}
export const badgeFileName = (id: string): string => `afterlife-${id}-badge.png`;
export const shareText = (name: string, stars: 1 | 2 | 3): string =>
  `I restored the ${name} in Afterlife ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} — afterlifeme.vercel.app`;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const FONT = "Nunito, system-ui, -apple-system, 'Segoe UI', sans-serif";
const CREAM = '#f7f3e8';
const INK = '#26301f';

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n = (v: number) => Math.round(v * 10) / 10;

function bodyShape(shape: BadgeShape, attrs: string): string {
  switch (shape) {
    case 'circle':
      return `<circle cx="120" cy="120" r="100" ${attrs}/>`;
    case 'hexagon': {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        return `${n(120 + 106 * Math.cos(a))},${n(120 + 106 * Math.sin(a))}`;
      }).join(' ');
      return `<polygon points="${pts}" stroke-linejoin="round" ${attrs}/>`;
    }
    case 'shield':
      return `<path d="M120 16 L210 44 V118 C210 176 172 212 120 232 C68 212 30 176 30 118 V44 Z" stroke-linejoin="round" ${attrs}/>`;
    case 'rounded':
      return `<rect x="24" y="24" width="192" height="192" rx="40" ${attrs}/>`;
    case 'scallop': {
      // One continuous wavy edge: 18 outward arcs between points on a circle.
      const pts = Array.from({ length: 18 }, (_, i) => {
        const t = ((Math.PI * 2) / 18) * i - Math.PI / 2;
        return [n(120 + 96 * Math.cos(t)), n(120 + 96 * Math.sin(t))] as const;
      });
      const d = `M${pts[0]![0]} ${pts[0]![1]} ` + pts.map((_, i) => { const q = pts[(i + 1) % pts.length]!; return `A18 18 0 0 1 ${q[0]} ${q[1]}`; }).join(' ') + ' Z';
      return `<path d="${d}" stroke-linejoin="round" ${attrs}/>`;
    }
  }
}

/** Emblems are drawn in a 90×90 box. `fill` is the main colour, `ink` the details, `accent` the highlight. */
function emblem(kind: BadgeEmblem, fill: string, ink: string, accent: string): string {
  const s = `stroke="${ink}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"`;
  switch (kind) {
    case 'bench':
      return `<rect x="68" y="8" width="5" height="74" rx="2" fill="${fill}" ${s}/><circle cx="70.5" cy="16" r="11" fill="${accent}" ${s}/><rect x="64" y="12.5" width="13" height="7" rx="2" fill="${fill}"/><rect x="8" y="36" width="50" height="8" rx="3" fill="${fill}" ${s}/><rect x="6" y="52" width="54" height="9" rx="3" fill="${fill}" ${s}/><rect x="11" y="61" width="6" height="20" rx="2" fill="${fill}" ${s}/><rect x="49" y="61" width="6" height="20" rx="2" fill="${fill}" ${s}/>`;
    case 'tank':
      return `<path d="M26 54 L20 84 M64 54 L70 84 M23 70 L67 70" fill="none" ${s}/><rect x="16" y="14" width="58" height="42" rx="10" fill="${fill}" ${s}/><path d="M16 28 H74 M16 42 H74" ${s}/><ellipse cx="45" cy="14" rx="20" ry="6" fill="${accent}" ${s}/>`;
    case 'pump':
      return `<rect x="20" y="10" width="36" height="70" rx="6" fill="${fill}" ${s}/><rect x="26" y="18" width="24" height="16" rx="3" fill="${accent}" ${s}/><path d="M56 30 C74 30 74 46 72 58" fill="none" ${s}/><rect x="66" y="56" width="12" height="16" rx="3" fill="${fill}" ${s}/><rect x="14" y="78" width="48" height="7" rx="2" fill="${fill}" ${s}/><circle cx="38" cy="52" r="6" fill="none" ${s}/>`;
    case 'station':
      return `<rect x="18" y="26" width="5" height="34" fill="${fill}" ${s}/><rect x="67" y="26" width="5" height="34" fill="${fill}" ${s}/><rect x="8" y="8" width="74" height="24" rx="4" fill="${fill}" ${s}/><rect x="14" y="16" width="62" height="8" rx="2" fill="${accent}"/><path d="M4 70 H86 M4 82 H86" ${s}/><path d="M14 66 V86 M32 66 V86 M50 66 V86 M68 66 V86" ${s}/>`;
    case 'swing':
      return `<path d="M8 84 L26 10 M82 84 L64 10 M22 10 H68" fill="none" stroke="${fill}" stroke-width="7" stroke-linecap="round"/><path d="M8 84 L26 10 M82 84 L64 10 M22 10 H68" fill="none" stroke="${ink}" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/><path d="M36 12 V58 M54 12 V58" ${s}/><rect x="30" y="56" width="30" height="7" rx="3" fill="${accent}" ${s}/>`;
    case 'washer':
      return `<rect x="14" y="8" width="62" height="76" rx="9" fill="${fill}" ${s}/><path d="M14 24 H76" ${s}/><circle cx="26" cy="16" r="3" fill="${ink}"/><circle cx="36" cy="16" r="3" fill="${ink}"/><circle cx="45" cy="54" r="21" fill="${accent}" ${s}/><circle cx="45" cy="54" r="13" fill="${fill}" opacity="0.55"/><path d="M36 50 Q45 44 54 50" fill="none" stroke="${fill}" stroke-width="2.5" stroke-linecap="round"/>`;
    case 'bus':
      return `<rect x="4" y="18" width="82" height="50" rx="10" fill="${fill}" ${s}/><rect x="12" y="26" width="15" height="16" rx="3" fill="${accent}"/><rect x="31" y="26" width="15" height="16" rx="3" fill="${accent}"/><rect x="50" y="26" width="15" height="16" rx="3" fill="${accent}"/><rect x="69" y="26" width="11" height="30" rx="3" fill="${accent}" opacity="0.8"/><path d="M4 50 H86" ${s}/><circle cx="24" cy="70" r="8" fill="${ink}"/><circle cx="66" cy="70" r="8" fill="${ink}"/><circle cx="24" cy="70" r="3" fill="${fill}"/><circle cx="66" cy="70" r="3" fill="${fill}"/>`;
    case 'planter': {
      const petals = Array.from({ length: 6 }, (_, i) => {
        const a = ((Math.PI * 2) / 6) * i;
        return `<circle cx="${n(45 + 9 * Math.cos(a))}" cy="${n(20 + 9 * Math.sin(a))}" r="7" fill="${accent}" ${s}/>`;
      }).join('');
      return `<path d="M45 58 V26" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/><path d="M45 44 C34 34 24 40 24 46 C32 50 40 48 45 44Z M45 38 C56 28 66 34 66 40 C58 44 50 42 45 38Z" fill="#7cc06a" ${s}/>${petals}<circle cx="45" cy="20" r="6" fill="#f6d55c" ${s}/><path d="M14 58 H76 L68 86 H22 Z" fill="${fill}" ${s}/><path d="M18 66 H72" ${s}/>`;
    }
  }
}

function leaves(seedKey: string): string {
  const r = rng(hash(seedKey));
  const count = 9 + Math.floor(r() * 5);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    // Spread over the circle but skip the bottom arc (the stars live there).
    const a = Math.PI * 0.5 + 0.75 + ((Math.PI * 2 - 1.5) / count) * (i + r() * 0.6);
    const rad = 62 + r() * 8;
    const x = 120 + rad * Math.cos(a);
    const y = 120 + rad * Math.sin(a);
    const size = 0.75 + r() * 0.55;
    const rot = (a * 180) / Math.PI + 90 + (r() - 0.5) * 50;
    const fill = r() > 0.5 ? '#bfe08a' : '#8fc65e';
    if (r() > 0.82) out.push(`<circle cx="${n(x)}" cy="${n(y)}" r="${n(3.2 * size)}" fill="#ffd1dc" stroke="${INK}" stroke-width="1"/>`);
    else out.push(`<path d="M0 0 C4 -6 12 -6 16 0 C12 6 4 6 0 0Z M2 0 H14" transform="translate(${n(x)} ${n(y)}) rotate(${n(rot)}) scale(${n(size)}) translate(-8 0)" fill="${fill}" stroke="${INK}" stroke-width="1"/>`);
  }
  return out.join('');
}

function star(cx: number, cy: number, on: boolean): string {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? 11 : 4.8;
    return `${n(cx + rad * Math.cos(a))},${n(cy + rad * Math.sin(a))}`;
  }).join(' ');
  return `<polygon class="bstar${on ? ' on' : ''}" points="${pts}" fill="${on ? '#f2c14e' : 'rgba(0,0,0,0.28)'}" stroke="${on ? INK : CREAM}" stroke-width="${on ? 1.8 : 1.4}" stroke-linejoin="round"/>`;
}

/** The badge as SVG markup (240×280). Locked badges are a grey silhouette with no stars or date. */
export function badgeSvg(b: BadgeInput): string {
  const d = BADGES[b.id] ?? BADGES['bus-stop']!;
  const locked = b.stars === null || b.date === null;
  const uid = `b${hash(`${b.id}|${b.date ?? 'locked'}`).toString(36)}`;
  const label = locked
    ? `${b.name} badge, not earned yet`
    : `${b.name} badge, ${b.stars} of 3 stars, restored ${formatBadgeDate(b.date!)}`;
  const fontSize = b.name.length > 14 ? 14 : 17;
  if (locked) {
    return `<svg class="badge-svg locked" viewBox="0 0 240 280" role="img" aria-label="${esc(label)}">${bodyShape(d.shape, 'fill="#34372f" stroke="#4b4f45" stroke-width="4"')}<g class="bemblem" transform="translate(75 70)" opacity="0.55">${emblem(d.emblem, '#4b4f45', '#2a2c26', '#4b4f45')}</g><path d="M34 204 H206 L214 220 L206 236 H34 L26 220 Z" fill="#2a2c26" stroke="#4b4f45" stroke-width="2"/><text x="120" y="226" text-anchor="middle" font-family="${FONT}" font-size="${fontSize}" font-weight="800" fill="#8a8a80">${esc(b.name)}</text></svg>`;
  }
  const stars = [96, 120, 144].map((x, i) => star(x, 182, i < b.stars!)).join('');
  return `<svg class="badge-svg" viewBox="0 0 240 280" role="img" aria-label="${esc(label)}">
<defs><linearGradient id="${uid}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${d.colors[0]}"/><stop offset="1" stop-color="${d.colors[1]}"/></linearGradient>
<radialGradient id="${uid}s" cx="0.35" cy="0.25" r="0.8"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="0.6" stop-color="#fff" stop-opacity="0"/></radialGradient>
<path id="${uid}a" d="M36 120 A84 84 0 0 1 204 120"/></defs>
${bodyShape(d.shape, `fill="url(#${uid}g)" stroke="${INK}" stroke-width="5"`)}
${bodyShape(d.shape, `fill="url(#${uid}s)"`)}
<circle cx="120" cy="120" r="78" fill="rgba(255,255,255,0.10)" stroke="${CREAM}" stroke-opacity="0.7" stroke-width="2" stroke-dasharray="2 5" stroke-linecap="round"/>
<text font-family="${FONT}" font-size="13" font-weight="800" letter-spacing="5" fill="${CREAM}"><textPath href="#${uid}a" startOffset="50%" text-anchor="middle">AFTERLIFE</textPath></text>
<g class="bleaves">${leaves(`${b.id}|${b.date}`)}</g>
<g class="bemblem" transform="translate(75 70)">${emblem(d.emblem, CREAM, INK, d.accent)}</g>
${stars}
<path d="M14 214 L44 210 V240 H14 L24 227 Z" fill="${d.colors[1]}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M226 214 L196 210 V240 H226 L216 227 Z" fill="${d.colors[1]}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M34 202 H206 L214 220 L206 238 H34 L26 220 Z" fill="#2b3025" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
<text x="120" y="${fontSize > 14 ? 226 : 225}" text-anchor="middle" font-family="${FONT}" font-size="${fontSize}" font-weight="800" fill="${CREAM}">${esc(b.name)}</text>
<text x="120" y="264" text-anchor="middle" font-family="${FONT}" font-size="12.5" font-weight="700" fill="#e9e4d6">Restored ${formatBadgeDate(b.date!)}</text>
</svg>`;
}

/** Renders the badge onto a 1080×1080 share image. */
export async function badgePng(b: BadgeInput): Promise<Blob> {
  const svg = badgeSvg(b).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="840" ');
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('badge image failed to load'));
      img.src = url;
    });
    const c = document.createElement('canvas');
    c.width = 1080;
    c.height = 1080;
    const ctx = c.getContext('2d')!;
    const bg = ctx.createRadialGradient(540, 420, 60, 540, 540, 760);
    bg.addColorStop(0, '#3b4a3e');
    bg.addColorStop(1, '#1d1f1a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1080, 1080);
    ctx.drawImage(img, 180, 70, 720, 840);
    ctx.fillStyle = '#f1ede2';
    ctx.textAlign = 'center';
    ctx.font = `700 34px ${FONT}`;
    ctx.fillText('afterlifeme.vercel.app', 540, 1010);
    return await new Promise<Blob>((resolve, reject) => c.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('no image'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type ShareResult = 'shared' | 'saved' | 'cancelled';

/** Opens the share sheet with the badge image where files can be shared; otherwise downloads it. */
export async function shareBadge(b: BadgeInput & { stars: 1 | 2 | 3; date: string }): Promise<ShareResult> {
  const blob = await internals.png(b);
  const file = new File([blob], badgeFileName(b.id), { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: `Afterlife — ${b.name} badge`, text: shareText(b.name, b.stars) });
      return 'shared';
    } catch (err) {
      // Cancelled, or a sheet is already open: never fall through to a surprise download.
      const name = (err as DOMException)?.name;
      if (name === 'AbortError' || name === 'InvalidStateError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'saved';
}

/** Swappable in tests (happy-dom cannot rasterise SVG). */
export const internals = { png: badgePng };
