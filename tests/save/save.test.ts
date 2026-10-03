import { describe, expect, it } from 'vitest';
import { defaultSave, loadSave, markCompleted, probeStorage, recordStars, SAVE_KEY, writeSave, type Store } from '../../src/save/save';

const memoryStore = (initial: Record<string, string> = {}): Store & { data: Record<string, string> } => {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
};
const throwingStore: Store = {
  getItem: () => { throw new Error('SecurityError'); },
  setItem: () => { throw new Error('QuotaExceededError'); },
};

describe('save', () => {
  it('hintsUsed defaults to {}, round-trips, and drops bad entries', () => {
    expect(defaultSave().hintsUsed).toEqual({});
    const store = memoryStore();
    writeSave(store, { ...defaultSave(), hintsUsed: { rooftop: 2 } });
    expect(loadSave(store).hintsUsed).toEqual({ rooftop: 2 });
    const bad = memoryStore({ [SAVE_KEY]: JSON.stringify({ version: 1, hintsUsed: { a: 1, b: 'x', c: 9, d: -1 } }) });
    expect(loadSave(bad).hintsUsed).toEqual({ a: 1 });
  });
  it('storySeen defaults to false, round-trips, and old saves load as false', () => {
    expect(defaultSave().storySeen).toBe(false);
    const store = memoryStore();
    writeSave(store, { ...defaultSave(), storySeen: true });
    expect(loadSave(store).storySeen).toBe(true);
    const old = memoryStore({ [SAVE_KEY]: JSON.stringify({ version: 1, completed: ['bus-stop'], tutorialDone: true, settings: {} }) });
    expect(loadSave(old).storySeen).toBe(false);
    expect(loadSave(memoryStore({ [SAVE_KEY]: JSON.stringify({ version: 1, storySeen: 'yes' }) })).storySeen).toBe(false);
  });
  it('uses the agreed key', () => {
    expect(SAVE_KEY).toBe('afterlife.save.v1');
  });
  it('returns defaults when nothing is stored or storage is missing', () => {
    expect(loadSave(memoryStore())).toEqual(defaultSave());
    expect(loadSave(null)).toEqual(defaultSave());
  });
  it('round-trips through writeSave and loadSave', () => {
    const store = memoryStore();
    const data = { ...defaultSave(), completed: ['bus-stop'], settings: { reducedMotion: true, muted: true, volume: 0.3 } };
    expect(writeSave(store, data)).toBe(true);
    expect(loadSave(store)).toEqual(data);
  });
  it('loadSave survives corrupt JSON and throwing storage', () => {
    expect(loadSave(memoryStore({ [SAVE_KEY]: '{not json' }))).toEqual(defaultSave());
    expect(loadSave(memoryStore({ [SAVE_KEY]: '{"version":2}' }))).toEqual(defaultSave());
    expect(loadSave(throwingStore)).toEqual(defaultSave());
  });
  it('drops invalid fields but keeps valid ones', () => {
    const raw = JSON.stringify({ version: 1, completed: ['bus-stop', 7, null], settings: { reducedMotion: 'yes', muted: true, volume: 9 } });
    expect(loadSave(memoryStore({ [SAVE_KEY]: raw }))).toEqual({
      version: 1,
      completed: ['bus-stop'],
      tutorialDone: false,
      storySeen: false,
      stars: {},
      hintsUsed: {},
      settings: { reducedMotion: false, muted: true, volume: 0.8 },
    });
  });
  it('writeSave returns false when storage throws or is missing', () => {
    expect(writeSave(throwingStore, defaultSave())).toBe(false);
    expect(writeSave(null, defaultSave())).toBe(false);
  });
  it('markCompleted adds an id once', () => {
    const once = markCompleted(defaultSave(), 'bus-stop');
    expect(once.completed).toEqual(['bus-stop']);
    expect(markCompleted(once, 'bus-stop').completed).toEqual(['bus-stop']);
  });
});

describe('probeStorage', () => {
  const fake = (opts: { writes: boolean; reads: boolean; data?: Record<string, string> }) => {
    const data = { ...(opts.data ?? {}) };
    return {
      getItem: (k: string) => {
        if (!opts.reads) throw new Error('SecurityError');
        return data[k] ?? null;
      },
      setItem: (k: string, v: string) => {
        if (!opts.writes) throw new Error('QuotaExceededError');
        data[k] = v;
      },
      removeItem: (k: string) => void delete data[k],
    } as unknown as Storage;
  };

  it('returns the storage itself when reads and writes work', () => {
    const s = fake({ writes: true, reads: true });
    expect(probeStorage(s)).toBe(s);
  });
  it('returns a read-only store when writes fail but reads work', () => {
    const saved = JSON.stringify({ version: 1, completed: ['bus-stop'], settings: {} });
    const store = probeStorage(fake({ writes: false, reads: true, data: { [SAVE_KEY]: saved } }));
    expect(store).not.toBeNull();
    expect(loadSave(store).completed).toEqual(['bus-stop']);
    expect(writeSave(store, defaultSave())).toBe(false);
  });
  it('returns null when nothing works', () => {
    expect(probeStorage(fake({ writes: false, reads: false }))).toBeNull();
  });
});

describe('tutorialDone', () => {
  it('defaults to false and round-trips', () => {
    expect(defaultSave().tutorialDone).toBe(false);
    const store = memoryStore();
    writeSave(store, { ...defaultSave(), tutorialDone: true });
    expect(loadSave(store).tutorialDone).toBe(true);
  });
  it('reads false from an old save without the field', () => {
    const old = JSON.stringify({ version: 1, completed: ['bus-stop'], settings: { reducedMotion: false, muted: false, volume: 0.8 } });
    expect(loadSave(memoryStore({ [SAVE_KEY]: old })).tutorialDone).toBe(false);
  });
});

describe('stars', () => {
  it('defaults to {}, keeps the best, and drops invalid entries', () => {
    expect(defaultSave().stars).toEqual({});
    let d = recordStars(defaultSave(), 'bus-stop', 2);
    d = recordStars(d, 'bus-stop', 1);
    expect(d.stars).toEqual({ 'bus-stop': 2 });
    d = recordStars(d, 'bus-stop', 3);
    expect(d.stars['bus-stop']).toBe(3);
    const raw = JSON.stringify({ version: 1, completed: [], stars: { a: 3, b: 7, c: 'x' }, settings: {} });
    expect(loadSave(memoryStore({ [SAVE_KEY]: raw })).stars).toEqual({ a: 3 });
  });
});
