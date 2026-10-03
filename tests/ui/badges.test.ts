import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../src/levels';
import { BADGES, badgeFileName, badgeSvg, formatBadgeDate, shareText } from '../../src/ui/badges';

const svgOf = (id: string, date = '2026-10-03', stars: 1 | 2 | 3 = 2) => badgeSvg({ id, name: LEVELS.find((l) => l.id === id)!.name, stars, date });

describe('BADGES', () => {
  it('has a design for every place', () => {
    expect(Object.keys(BADGES).sort()).toEqual(LEVELS.map((l) => l.id).sort());
  });
  it('every design is distinct: unique shape+emblem pairs and unique colours', () => {
    const pairs = Object.values(BADGES).map((b) => `${b.shape}/${b.emblem}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    const colours = Object.values(BADGES).map((b) => b.colors.join());
    expect(new Set(colours).size).toBe(colours.length);
  });
});

describe('badgeSvg', () => {
  it('names the place, shows earned stars and the date, and is labelled', () => {
    const svg = svgOf('laundromat', '2026-10-03', 2);
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="Laundromat badge, 2 of 3 stars, restored 3 Oct 2026"');
    expect(svg).toContain('>Laundromat<');
    expect(svg).toContain('AFTERLIFE');
    expect(svg).toContain('Restored 3 Oct 2026');
    expect(svg.match(/class="bstar on"/g)).toHaveLength(2);
    expect(svg.match(/class="bstar"/g)).toHaveLength(1);
  });
  it('escapes the place name', () => {
    expect(badgeSvg({ id: 'bus-stop', name: 'A<b>', stars: 3, date: '2026-10-03' })).toContain('A&#60;b&#62;');
  });
  it('is one of a kind: the leaf ring depends on the day earned, and repeats for the same day', () => {
    expect(svgOf('rooftop', '2026-10-03')).toBe(svgOf('rooftop', '2026-10-03'));
    const leaves = (s: string) => s.slice(s.indexOf('<g class="bleaves"'), s.indexOf('</g>', s.indexOf('<g class="bleaves"')));
    expect(leaves(svgOf('rooftop', '2026-10-03'))).not.toBe(leaves(svgOf('rooftop', '2026-10-04')));
    expect(leaves(svgOf('rooftop', '2026-10-03'))).not.toBe(leaves(svgOf('playground', '2026-10-03')));
  });
  it('every place draws a different emblem', () => {
    const emblems = LEVELS.map((l) => { const s = svgOf(l.id); const i = s.indexOf('<g class="bemblem"'); return s.slice(i, s.indexOf('</g>', i)); });
    expect(new Set(emblems).size).toBe(LEVELS.length);
  });
  it('a locked badge is a plain silhouette without a date', () => {
    const svg = badgeSvg({ id: 'bus-depot', name: 'Bus Depot', stars: null, date: null });
    expect(svg).toContain('class="badge-svg locked"');
    expect(svg).toContain('aria-label="Bus Depot badge, not earned yet"');
    expect(svg).not.toContain('Restored');
  });
});

describe('sharing helpers', () => {
  it('formats dates, file names and share text', () => {
    expect(formatBadgeDate('2026-10-03')).toBe('3 Oct 2026');
    expect(badgeFileName('rooftop-garden')).toBe('afterlife-rooftop-garden-badge.png');
    expect(shareText('Laundromat', 2)).toBe('I restored the Laundromat in Afterlife ★★☆ — afterlifeme.vercel.app');
  });
});
