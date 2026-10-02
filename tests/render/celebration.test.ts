import { describe, expect, it } from 'vitest';
import { Celebration, type Schedule } from '../../src/render/scene/celebration';

/** A fake clock: run(ms) fires every callback scheduled at or before ms that was not cancelled. */
function fakeClock() {
  const jobs: { at: number; fn: () => void; cancelled: boolean }[] = [];
  const schedule: Schedule = (ms, fn) => {
    const job = { at: ms, fn, cancelled: false };
    jobs.push(job);
    return () => (job.cancelled = true);
  };
  const run = (ms: number) => jobs.filter((j) => j.at <= ms && !j.cancelled).forEach((j) => ((j.cancelled = true), j.fn()));
  return { schedule, run };
}

const rotator = () => ({ turns: 0, rotate(dir: 1 | -1) { this.turns += dir; } });

describe('Celebration', () => {
  it('turns the controller four times, then reports done', () => {
    const clock = fakeClock();
    const ctrl = rotator();
    const c = new Celebration(clock.schedule);
    c.start(ctrl, 450);
    expect(c.running).toBe(true);
    clock.run(10_000);
    expect(ctrl.turns).toBe(4);
    expect(c.running).toBe(false);
  });

  it('cancel stops remaining turns, so a new level or the title demo never spins', () => {
    const clock = fakeClock();
    const won = rotator();
    const c = new Celebration(clock.schedule);
    c.start(won, 450);
    clock.run(500);
    c.cancel();
    clock.run(10_000);
    expect(won.turns).toBe(1);
    expect(c.running).toBe(false);
  });

  it('starting again cancels the previous sequence', () => {
    const clock = fakeClock();
    const first = rotator();
    const second = rotator();
    const c = new Celebration(clock.schedule);
    c.start(first, 450);
    c.start(second, 450);
    clock.run(10_000);
    expect(first.turns).toBe(0);
    expect(second.turns).toBe(4);
  });
});
