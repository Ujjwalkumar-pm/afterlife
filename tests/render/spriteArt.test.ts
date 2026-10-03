import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { spriteAssets, spriteFor, type SpriteManifest } from '../../src/render/objects/spriteManifest';
import manifest from '../../src/render/objects/sprites.json';
import { hasObjectShape } from '../../src/render/objects/objectShapes';

const m = manifest as SpriteManifest;

describe('spriteFor', () => {
  it('builds sprite URLs from the base path and rotation', () => {
    const fixture: SpriteManifest = { tyre: { originY: 0.75, topHeight: 12, scale: 0.5 } };
    expect(spriteFor(fixture, 'tyre', 2, '/')).toEqual({ key: 'sprite-tyre-r2', url: '/sprites/tyre-r2.png', originY: 0.75, scale: 0.5 });
    expect(spriteFor(fixture, 'tyre', 0, '/game/')?.url).toBe('/game/sprites/tyre-r0.png');
  });
  it('falls back for unknown names', () => {
    expect(spriteFor(m, 'pump', 0, '/')).toBeNull();
    expect(spriteFor(m, 'piano', 0, '/')).toBeNull();
  });
});

describe('the generated manifest', () => {
  it('covers the 11 Kenney-matched objects, each a known object', () => {
    expect(Object.keys(m).sort()).toEqual(['barrel', 'bench', 'bin', 'car', 'cone', 'crate', 'old-car', 'sign', 'station-sign', 'tyre', 'water-tank']);
    for (const name of Object.keys(m)) expect(hasObjectShape(name), name).toBe(true);
  });
  it('every manifest sprite has 4 PNGs on disk', () => {
    for (const name of Object.keys(m)) for (let r = 0; r < 4; r++) expect(existsSync(`public/sprites/${name}-r${r}.png`), `${name}-r${r}`).toBe(true);
  });
  it('lists one preload asset per object and rotation', () => {
    expect(spriteAssets(m, '/')).toHaveLength(44);
  });
});
