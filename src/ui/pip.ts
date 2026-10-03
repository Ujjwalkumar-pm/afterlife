/** Pip, the mossy robot, in a 64×64 box. Mood classes on a parent animate it (see styles.css). */
export const PIP_INNER = `<g class="pip-figure">
<line x1="32" y1="14" x2="32" y2="6" stroke="#5a6468" stroke-width="2" stroke-linecap="round"/>
<path class="pip-leaf" d="M32 6 C34 0 40 -1 43 2 C39 7 35 7 32 6Z" fill="#7aa04a"/>
<rect x="18" y="13" width="28" height="21" rx="9" fill="#8b979c"/>
<rect x="21" y="18" width="22" height="11" rx="5" fill="#2e2c2a"/>
<circle class="pip-eye" cx="27" cy="23.5" r="3.2" fill="#fff3b0"/>
<circle class="pip-eye" cx="37" cy="23.5" r="3.2" fill="#fff3b0"/>
<path d="M18 22 C17 17 21 13 26 14 C22 16 20 19 18 22Z" fill="#6f8f3a"/>
<rect class="pip-arm pip-arm-l" x="11" y="37" width="9" height="5" rx="2.5" fill="#5a6468"/>
<rect class="pip-arm pip-arm-r" x="44" y="37" width="9" height="5" rx="2.5" fill="#5a6468"/>
<rect x="20" y="34" width="24" height="20" rx="8" fill="#7b836c"/>
<path d="M21 41 C24 36 30 37 32 40 C28 43 24 43 21 41Z" fill="#6f8f3a"/>
<path d="M33 49 C36 46 41 46 43 49 C40 52 36 52 33 49Z" fill="#89a94a"/>
<circle cx="38" cy="40" r="1.6" fill="#89a94a"/>
<rect x="23" y="54" width="6" height="6" rx="2" fill="#5a6468"/>
<rect x="35" y="54" width="6" height="6" rx="2" fill="#5a6468"/>
</g>`;

export const pipSvg = (): string => `<svg class="pip-svg" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" focusable="false">${PIP_INNER}</svg>`;
