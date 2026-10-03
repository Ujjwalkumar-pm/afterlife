import { describe, expect, it } from 'vitest';
import { defaultSave, loadSave, markCompleted, probeStorage, SAVE_KEY, writeSave, type Store } from '../../src/save/save';

const memoryStore = (initial: Record<string, string> = {}): Store & { data: Record<string, string> } => {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
};
const throwingStore: Store = {
  getItem: () => { throw new Error('SecurityError'); },
  setItem: () => { throw new Error('QuotaExceededError'); },
};

describe('save', () => {
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
