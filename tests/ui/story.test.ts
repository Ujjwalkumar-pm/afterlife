// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORY_BEATS, StoryPlayer, storyLength, storySvg } from '../../src/ui/story';

let root: HTMLElement;
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="ui"></div>';
  root = document.getElementById('ui')!;
});
afterEach(() => vi.useRealTimers());
const caption = () => root.querySelector('.story-caption')!.textContent;
const begin = () => root.querySelector<HTMLButtonElement>('[data-story="begin"]')!;

describe('story beats', () => {
  it('has five 5-second beats, under 30 s in total, with the agreed captions', () => {
    expect(STORY_BEATS.map((b) => b.caption)).toEqual([
      'The city went quiet.',
      'People left. The machines fell asleep.',
      'Years later, the wind carried a seed.',
      'Something woke up… and remembered how to grow.',
      'Bring life back, one place at a time.',
    ]);
    expect(STORY_BEATS.every((b) => b.ms === 5000)).toBe(true);
    expect(storyLength()).toBe(25000);
    expect(storyLength()).toBeLessThan(30000);
  });
  it('animated parts carry no transform attribute (CSS animation would replace it and move them)', () => {
    const svg = storySvg();
    for (const cls of ['story-sprout', 'story-seed']) expect(svg).not.toMatch(new RegExp(`class="${cls}"[^>]*transform=|transform="[^"]*"[^>]*class="${cls}"`));
  });
  it('draws the scene with Pip in it', () => {
    const svg = storySvg();
    expect(svg).toContain('class="story-scene"');
    expect(svg).toContain('class="story-pip"');
    expect(svg).toContain('class="pip-figure"');
    expect(svg).toContain('class="story-seed"');
  });
});

describe('StoryPlayer', () => {
  it('plays beat by beat, then waits on the last beat for Tap to begin', () => {
    const onBeat = vi.fn();
    const p = new StoryPlayer(root, { onDone: vi.fn(), onBeat });
    expect(p.beat).toBe(1);
    expect(root.querySelector('.story')!.getAttribute('data-beat')).toBe('1');
    expect(caption()).toBe('The city went quiet.');
    expect(begin().hidden).toBe(true);
    vi.advanceTimersByTime(5000);
    expect(caption()).toBe('People left. The machines fell asleep.');
    vi.advanceTimersByTime(15000);
    expect(p.beat).toBe(5);
    expect(begin().hidden).toBe(false);
    vi.advanceTimersByTime(60000);
    expect(p.beat).toBe(5);
    expect(onBeat.mock.calls.map((c) => c[0])).toEqual([1, 2, 3, 4, 5]);
  });
  it('is a labelled dialog with Skip focused and the caption in a live region', () => {
    new StoryPlayer(root, { onDone: vi.fn() });
    const el = root.querySelector('.story')!;
    expect(el.getAttribute('role')).toBe('dialog');
    expect(el.getAttribute('aria-label')).toBe('Story');
    expect(root.querySelector('.story-caption')!.getAttribute('aria-live')).toBe('polite');
    expect(document.activeElement).toBe(root.querySelector('[data-story="skip"]'));
  });
  it('Skip ends it at once and removes it; later timers do nothing', () => {
    const onDone = vi.fn();
    new StoryPlayer(root, { onDone });
    (root.querySelector('[data-story="skip"]') as HTMLElement).click();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(root.querySelector('.story')).toBeNull();
    vi.advanceTimersByTime(30000);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
  it('Tap to begin ends it once, even when tapped twice or after Esc', () => {
    const onDone = vi.fn();
    new StoryPlayer(root, { onDone });
    vi.advanceTimersByTime(20000);
    const b = begin();
    b.click();
    b.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
  it('Esc skips', () => {
    const onDone = vi.fn();
    new StoryPlayer(root, { onDone });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
  it('destroy stops it without calling onDone', () => {
    const onDone = vi.fn();
    const p = new StoryPlayer(root, { onDone });
    p.destroy();
    vi.advanceTimersByTime(30000);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onDone).not.toHaveBeenCalled();
    expect(root.querySelector('.story')).toBeNull();
  });
});
