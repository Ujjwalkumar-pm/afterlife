import { expect, it } from 'vitest';
import { PLANT_TYPES, SCRAP_KINDS } from '../../src/engine';
import { ICONS } from '../../src/ui/icons';

it('has an inline SVG icon for every plant, every scrap kind and help', () => {
  for (const k of [...PLANT_TYPES, ...SCRAP_KINDS, 'help']) {
    expect(ICONS[k], k).toMatch(/^<svg [^>]*viewBox="0 0 32 32"/);
    expect(ICONS[k]).toContain('aria-hidden="true"');
  }
});
