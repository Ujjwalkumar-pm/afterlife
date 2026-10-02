import { expect, it } from 'vitest';
import { levelStatuses } from '../../src/app/progress';

const ids = ['a', 'b', 'c'];

it('opens only the first level at the start', () => {
  expect(levelStatuses(ids, [])).toEqual(['open', 'locked', 'locked']);
});
it('opens the level after each completed one', () => {
  expect(levelStatuses(ids, ['a'])).toEqual(['completed', 'open', 'locked']);
  expect(levelStatuses(ids, ['a', 'b', 'c'])).toEqual(['completed', 'completed', 'completed']);
});
it('ignores unknown ids', () => {
  expect(levelStatuses(ids, ['zzz'])).toEqual(['open', 'locked', 'locked']);
});
