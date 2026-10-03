const svg = (body: string) => `<svg class="icon" viewBox="0 0 32 32" width="22" height="22" aria-hidden="true" focusable="false">${body}</svg>`;
/** Line icons for the HUD tools: one stroke weight, drawn in the button's text colour. */
const line = (body: string) => svg(`<g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${body}</g>`);

export const ICONS: Record<string, string> = {
  moss: svg('<ellipse cx="11" cy="21" rx="8" ry="5" fill="#5d7a2f"/><ellipse cx="20" cy="19" rx="9" ry="6" fill="#89a94a"/><ellipse cx="17" cy="16" rx="3" ry="1.6" fill="#c5d98f"/>'),
  vine: svg('<path d="M8 27 C10 18 18 18 16 10 S22 4 24 5" stroke="#4a6b2a" stroke-width="2.2" fill="none" stroke-linecap="round"/><ellipse cx="12" cy="19" rx="4.5" ry="2.4" fill="#58934a"/><ellipse cx="19" cy="11" rx="4.5" ry="2.4" fill="#3f7a3a"/>'),
  flower: svg('<path d="M16 28 V14" stroke="#4a6b2a" stroke-width="2.2"/><ellipse cx="12" cy="21" rx="4" ry="2" fill="#4f8a3c"/><g fill="#e89ab0"><circle cx="16" cy="7" r="3.4"/><circle cx="21" cy="10.5" r="3.4"/><circle cx="19" cy="15.5" r="3.4"/><circle cx="13" cy="15.5" r="3.4"/><circle cx="11" cy="10.5" r="3.4"/></g><circle cx="16" cy="11.5" r="2.6" fill="#f6e7a8"/>'),
  bamboo: svg('<g stroke-linecap="round"><path d="M12 29 V6" stroke="#9fb85a" stroke-width="3.2"/><path d="M20 29 V10" stroke="#86a046" stroke-width="3.2"/></g><g stroke="#5f7430" stroke-width="1.2"><path d="M10 14h4M10 21h4M18 17h4M18 24h4"/></g><ellipse cx="16" cy="6" rx="5" ry="1.8" fill="#4f8a3c"/>'),
  tyre: svg('<ellipse cx="16" cy="18" rx="11" ry="8" fill="#2e2c2a"/><ellipse cx="16" cy="15" rx="11" ry="7" fill="#45423e"/><ellipse cx="16" cy="15" rx="4.5" ry="2.8" fill="#1b1a19"/>'),
  can: svg('<rect x="11" y="9" width="10" height="16" rx="2" fill="#8b979c"/><ellipse cx="16" cy="9" rx="5" ry="2" fill="#b7c0c4"/>'),
  cone: svg('<path d="M16 5 L23 25 H9 Z" fill="#d9773a"/><path d="M12.6 15 H19.4 L20.5 18 H11.5 Z" fill="#f1ede2"/><rect x="6" y="25" width="20" height="3" rx="1" fill="#b85f2c"/>'),
  crate: svg('<path d="M16 6 L27 11 L16 16 L5 11 Z" fill="#a47e58"/><path d="M5 11 L16 16 V27 L5 22 Z" fill="#8c6a48"/><path d="M27 11 L16 16 V27 L27 22 Z" fill="#6b4f35"/>'),
  barrel: svg('<rect x="9" y="7" width="14" height="19" rx="3" fill="#9a5b3c"/><rect x="9" y="11" width="14" height="2" fill="#6e3f2a"/><rect x="9" y="19" width="14" height="2" fill="#6e3f2a"/><ellipse cx="16" cy="7" rx="7" ry="2.4" fill="#b8775a"/>'),
  sign: svg('<rect x="15" y="12" width="2" height="16" fill="#5a6468"/><path d="M16 3 L26 13 H6 Z" fill="#b8a24a"/><path d="M15 8h2v3h-2z" fill="#3a3a34"/>'),
  car: svg('<path d="M4 20 L8 13 H22 L28 20 V24 H4 Z" fill="#9a5b3c"/><path d="M10 14 H20 L23 19 H8 Z" fill="#cfcac0"/><circle cx="10" cy="24" r="3" fill="#2e2c2a"/><circle cx="23" cy="24" r="3" fill="#2e2c2a"/>'),
  help: svg('<circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12.5 12.5a3.6 3.6 0 1 1 5.2 3.2c-1.2.6-1.7 1.3-1.7 2.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="16" cy="22.8" r="1.6" fill="currentColor"/>'),
  menu: line('<path d="M7 10h18M7 16h18M7 22h18"/>'),
  undo: line('<path d="M11 8 6 13l5 5"/><path d="M6 13h12a6.5 6.5 0 0 1 0 13h-5"/>'),
  restart: line('<path d="M25 16a9 9 0 1 1-2.6-6.4"/><path d="M23.5 4.5v5.5H18"/>'),
  // A board tile with an arc arrow under it: "turn the board", not back/next.
  'rotate-left': line('<path d="M16 9l8 4.5-8 4.5-8-4.5z"/><path d="M27 20.5a11 6 0 0 1-22 0"/><path d="M5 16.5v4h4"/>'),
  'rotate-right': line('<path d="M16 9l8 4.5-8 4.5-8-4.5z"/><path d="M5 20.5a11 6 0 0 0 22 0"/><path d="M27 16.5v4h-4"/>'),
  'sound-on': line('<path d="M5 12.5h5l7-6v19l-7-6H5z"/><path d="M21 12.5a5 5 0 0 1 0 7"/><path d="M24.5 9a10 10 0 0 1 0 14"/>'),
  'sound-off': line('<path d="M5 12.5h5l7-6v19l-7-6H5z"/><path d="M21 12.5l6.5 7M27.5 12.5l-6.5 7"/>'),
  // The growth ring as drawn on the board: a dashed diamond around a centre dot.
  ring: line('<path d="M16 9l13 8-13 8-13-8z" stroke-dasharray="3.2 2.6"/><circle cx="16" cy="17" r="2.4" fill="currentColor" stroke="none"/>'),
  bulb: line('<path d="M12.5 23h7M13.5 27h5"/><path d="M16 4a8 8 0 0 0-4.8 14.4c.9.8 1.3 1.8 1.3 3.1h7c0-1.3.4-2.3 1.3-3.1A8 8 0 0 0 16 4z"/>'),
  lock: line('<rect x="8" y="14" width="16" height="12" rx="3"/><path d="M11 14v-3a5 5 0 0 1 10 0v3"/>'),
  leaf: line('<path d="M7 25C7 13 15 7 26 7c0 11-6 18-17 18z"/><path d="M7 25 18 14"/>'),
};
