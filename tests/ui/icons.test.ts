import { expect, it } from 'vitest';
import { PLANT_TYPES, SCRAP_KINDS } from '../../src/engine';
import { ICONS } from '../../src/ui/icons';

it('has an inline SVG icon for every plant, every scrap kind and help', () => {
  for (const k of [...PLANT_TYPES, ...SCRAP_KINDS, 'help', 'menu', 'undo', 'restart', 'rotate-left', 'rotate-right', 'sound-on', 'sound-off', 'lock', 'leaf']) {
    expect(ICONS[k], k).toMatch(/^<svg [^>]*viewBox="0 0 32 32"/);
    expect(ICONS[k]).toContain('aria-hidden="true"');
  }
});

it('the turn icons draw a board tile with an arc arrow (not back/next chevrons)', () => {
  for (const k of ['rotate-left', 'rotate-right']) {
    expect(ICONS[k]).toContain('M16 9l8 4.5-8 4.5-8-4.5z');
    expect(ICONS[k]).toMatch(/a11 6 0 0 [01] 22 0|a11 6 0 0 1-22 0/);
  }
});
