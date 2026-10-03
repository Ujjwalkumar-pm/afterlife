import { describe, expect, it } from 'vitest';
import { PIP_INNER, pipSvg } from '../../src/ui/pip';

describe('pipSvg', () => {
  it('is a decorative 64×64 drawing with two eyes, a sprout leaf and two arms', () => {
    const svg = pipSvg();
    expect(svg).toContain('viewBox="0 0 64 64"');
    expect(svg).toContain('aria-hidden="true"');
    expect(svg.match(/class="pip-eye"/g)).toHaveLength(2);
    expect(svg).toContain('class="pip-leaf"');
    expect(svg).toContain('pip-arm-l');
    expect(svg).toContain('pip-arm-r');
  });
  it('shares one figure between the HUD and the story', () => {
    expect(PIP_INNER.startsWith('<g class="pip-figure">')).toBe(true);
    expect(pipSvg()).toContain(PIP_INNER);
  });
});
