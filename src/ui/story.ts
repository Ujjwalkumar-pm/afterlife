import { PIP_INNER } from './pip';

export interface StoryBeat {
  caption: string;
  ms: number;
}

export const STORY_BEATS: StoryBeat[] = [
  { caption: 'The city went quiet.', ms: 5000 },
  { caption: 'People left. The machines fell asleep.', ms: 5000 },
  { caption: 'Years later, the wind carried a seed.', ms: 5000 },
  { caption: 'Something woke up… and remembered how to grow.', ms: 5000 },
  { caption: 'Bring life back, one place at a time.', ms: 5000 },
];

export const storyLength = (): number => STORY_BEATS.reduce((n, b) => n + b.ms, 0);

/** One scene for all beats; CSS on `.story[data-beat]` decides what shows and moves. */
export function storySvg(): string {
  const rain = Array.from({ length: 28 }, (_, i) => {
    const x = ((i * 37) % 380) - 10;
    const y = (i * 53) % 200;
    return `<line x1="${x}" y1="${y}" x2="${x - 4}" y2="${y + 10}" style="animation-delay:-${(i % 9) / 10}s"/>`;
  }).join('');
  return `<svg class="story-scene" viewBox="0 0 360 240" preserveAspectRatio="xMidYMid meet" role="img" aria-label="A quiet, empty city where a small robot finds a seed">
<rect class="story-sky" width="360" height="240"/>
<g class="story-city" fill="#3a3d3a"><rect x="10" y="90" width="44" height="110"/><rect x="62" y="60" width="36" height="140"/><rect x="106" y="105" width="50" height="95"/><rect x="214" y="70" width="40" height="130"/><rect x="262" y="100" width="56" height="100"/><rect x="322" y="80" width="30" height="120"/></g>
<g class="story-windows" fill="#4a4e48"><rect x="70" y="72" width="8" height="10"/><rect x="84" y="72" width="8" height="10"/><rect x="70" y="92" width="8" height="10"/><rect x="222" y="84" width="8" height="10"/><rect x="238" y="104" width="8" height="10"/><rect x="272" y="112" width="10" height="8"/></g>
<g class="story-rain">${rain}</g>
<rect class="story-ground" y="196" width="360" height="44" fill="#4a4237"/>
<g class="story-moss" fill="#6f8f3a"><ellipse cx="60" cy="200" rx="30" ry="5"/><ellipse cx="250" cy="201" rx="40" ry="6"/><ellipse cx="320" cy="199" rx="22" ry="4"/></g>
<g class="story-junk"><rect x="110" y="178" width="22" height="20" fill="#8c6a48"/><rect x="108" y="175" width="26" height="4" fill="#6b4f35"/><ellipse cx="226" cy="194" rx="14" ry="5" fill="#2e2c2a"/><ellipse cx="226" cy="189" rx="14" ry="5" fill="#2e2c2a"/><ellipse cx="226" cy="189" rx="6" ry="2" fill="#1b1a19"/></g>
<g class="story-pip" transform="translate(148 138)">${PIP_INNER}</g>
<g class="story-sprout" transform="translate(196 174)"><path d="M0 22 C0 14 1 8 0 0" stroke="#4a6b2a" stroke-width="2.5" fill="none"/><path d="M0 8 C-8 2 -12 6 -12 10 C-6 12 -2 10 0 8Z" fill="#4f8a3c"/><path d="M0 4 C8 -2 12 2 12 6 C6 8 2 6 0 4Z" fill="#58934a"/></g>
<circle class="story-seed" cx="196" cy="194" r="4" fill="#f3e6a0"/>
<text class="story-title" x="180" y="48" text-anchor="middle" font-size="34" font-weight="800" fill="#f1ede2">Afterlife</text>
</svg>`;
}

export interface StoryOptions {
  onDone(): void;
  onBeat?(beat: number): void;
}

/** The intro story: five timed beats, then it waits on the last one. Skip, Tap to begin or Esc end it. */
export class StoryPlayer {
  readonly el: HTMLElement;
  beat = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private finished = false;
  private readonly onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.finish();
  };

  constructor(
    root: HTMLElement,
    private readonly opts: StoryOptions,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'story';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-label', 'Story');
    this.el.innerHTML = `${storySvg()}<p class="story-caption" aria-live="polite"></p><button class="story-skip" data-story="skip">Skip</button><button class="story-begin primary" data-story="begin" hidden>Tap to begin</button>`;
    this.el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-story]')) this.finish();
    });
    document.addEventListener('keydown', this.onKey);
    root.appendChild(this.el);
    this.go(1);
    this.el.querySelector<HTMLElement>('[data-story="skip"]')?.focus();
  }

  private go(n: number): void {
    this.beat = n;
    this.el.dataset.beat = String(n);
    this.el.querySelector('.story-caption')!.textContent = STORY_BEATS[n - 1]!.caption;
    this.opts.onBeat?.(n);
    if (n === STORY_BEATS.length) {
      const begin = this.el.querySelector<HTMLButtonElement>('[data-story="begin"]')!;
      begin.hidden = false;
      begin.focus();
      return;
    }
    this.timer = setTimeout(() => this.go(n + 1), STORY_BEATS[n - 1]!.ms);
  }

  private finish(): void {
    if (this.finished) return;
    this.destroy();
    this.opts.onDone();
  }

  /** Stops the story without ending it (no onDone), e.g. when the app navigates away. */
  destroy(): void {
    this.finished = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    document.removeEventListener('keydown', this.onKey);
    this.el.remove();
  }
}
