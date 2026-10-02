export type LevelStatus = 'locked' | 'open' | 'completed';

/** Levels unlock in order: a level is open when it is the first or the one before it is completed. */
export function levelStatuses(ids: string[], completed: string[]): LevelStatus[] {
  return ids.map((id, i) => {
    if (completed.includes(id)) return 'completed';
    if (i === 0 || completed.includes(ids[i - 1]!)) return 'open';
    return 'locked';
  });
}
