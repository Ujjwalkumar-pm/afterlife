export const SAVE_KEY = 'afterlife.save.v1';

export interface Settings {
  reducedMotion: boolean;
  muted: boolean;
  volume: number;
}

export interface SaveData {
  version: 1;
  completed: string[];
  settings: Settings;
}

export type Store = Pick<Storage, 'getItem' | 'setItem'>;

export const defaultSave = (): SaveData => ({
  version: 1,
  completed: [],
  settings: { reducedMotion: false, muted: false, volume: 0.8 },
});

export function loadSave(store: Store | null): SaveData {
  const base = defaultSave();
  try {
    const raw = store?.getItem(SAVE_KEY);
    if (!raw) return base;
    const d = JSON.parse(raw) as Record<string, unknown>;
    if (d?.version !== 1) return base;
    const s = (typeof d.settings === 'object' && d.settings !== null ? d.settings : {}) as Record<string, unknown>;
    return {
      version: 1,
      completed: Array.isArray(d.completed) ? d.completed.filter((x): x is string => typeof x === 'string') : [],
      settings: {
        reducedMotion: typeof s.reducedMotion === 'boolean' ? s.reducedMotion : base.settings.reducedMotion,
        muted: typeof s.muted === 'boolean' ? s.muted : base.settings.muted,
        volume: typeof s.volume === 'number' && s.volume >= 0 && s.volume <= 1 ? s.volume : base.settings.volume,
      },
    };
  } catch {
    return base;
  }
}

export function writeSave(store: Store | null, data: SaveData): boolean {
  if (!store) return false;
  try {
    store.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function markCompleted(data: SaveData, id: string): SaveData {
  return data.completed.includes(id) ? data : { ...data, completed: [...data.completed, id] };
}

/** The browser's localStorage if it is usable, otherwise null (private mode, blocked cookies). */
export function safeStorage(): Store | null {
  try {
    const s = window.localStorage;
    s.setItem('__afterlife_probe', '1');
    s.removeItem('__afterlife_probe');
    return s;
  } catch {
    return null;
  }
}
