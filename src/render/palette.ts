export const PALETTE = {
  bg: 0x23251f,
  soilDry: 0x6b5f52,
  soilLush: 0x56492f,
  concreteDry: 0x8a8a84,
  concreteLush: 0x7b836c,
  wall: 0x55534c,
  ring: 0xf4f1e4,
  invalid: 0xd9534f,
  glow: 0xfff3b0,
  seed: 0x5b4632,
  stem: 0x4a6b2a,
  leaf: 0x4f8a3c,
  moss: [0x6f8f3a, 0x89a94a, 0x5d7a2f],
  vine: [0x3f7a3a, 0x58934a],
  bamboo: [0x9fb85a, 0x86a046],
  bambooNode: 0x5f7430,
  petal: [0xe89ab0, 0xf2c14e, 0xc7a6e8],
  flowerCentre: 0xf6e7a8,
  bud: 0x7aa04a,
  rubber: 0x2e2c2a,
  rubberDark: 0x1b1a19,
  metal: 0x8b979c,
  metalDark: 0x5a6468,
  rust: 0x9a5b3c,
  rustDark: 0x6e3f2a,
  wood: 0x8c6a48,
  woodDark: 0x6b4f35,
  paint: 0xb8a24a,
  paintBlue: 0x4f6f8f,
  paintRed: 0xa84a3c,
  white: 0xcfcac0,
  orange: 0xd9773a,
  sand: 0xd8c48f,
  spriteTint: 0xe8e0d2,
} as const;

const channels = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255] as const;
const pack = (r: number, g: number, b: number) => (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

export function lerpColor(a: number, b: number, t: number): number {
  const k = clamp01(t);
  const [ar, ag, ab] = channels(a);
  const [br, bg, bb] = channels(b);
  return pack(ar + (br - ar) * k, ag + (bg - ag) * k, ab + (bb - ab) * k);
}

export const lighten = (c: number, amount: number): number => lerpColor(c, 0xffffff, amount);
export const darken = (c: number, amount: number): number => lerpColor(c, 0x000000, amount);
