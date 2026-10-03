import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { coverage, Session, validateLevel } from '../../src/engine';
import { LEVELS } from '../../src/levels';

const dir = new URL('../../src/levels/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();

it('has exactly 8 level files, all exported in order', () => {
  expect(files).toHaveLength(8);
  expect(LEVELS.map((l) => l.id)).toEqual(['bus-stop', 'rooftop', 'petrol-station', 'railway-platform', 'playground', 'laundromat', 'bus-depot', 'rooftop-garden']);
});

describe.each(files)('%s', (file) => {
  const level = validateLevel(JSON.parse(readFileSync(new URL(file, dir), 'utf8')));

  it('has a reference solution', () => {
    expect(level.solution.length).toBeGreaterThan(0);
  });

  it('reference solution reaches the target', () => {
    const session = new Session(level);
    level.solution.forEach((move, i) => {
      const r = session.apply(move);
      expect(r.ok, `move ${i} ${JSON.stringify(move)}: ${r.ok ? '' : r.reason}`).toBe(true);
    });
    expect(coverage(session.state)).toBeGreaterThanOrEqual(level.target);
  });
});
