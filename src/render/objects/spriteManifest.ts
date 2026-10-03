import type { Rotation } from '../iso/projection';

export type SpriteManifest = Record<string, { originY: number; topHeight: number; scale: number }>;

export function spriteFor(manifest: SpriteManifest, name: string, rotation: Rotation | number, base: string): { key: string; url: string; originY: number; scale: number } | null {
  const entry = Object.hasOwn(manifest, name) ? manifest[name] : undefined;
  if (!entry) return null;
  return { key: `sprite-${name}-r${rotation}`, url: `${base}sprites/${name}-r${rotation}.png`, originY: entry.originY, scale: entry.scale };
}

export function spriteAssets(manifest: SpriteManifest, base: string): { key: string; url: string }[] {
  return Object.keys(manifest).flatMap((name) => [0, 1, 2, 3].map((r) => spriteFor(manifest, name, r, base)!)).map(({ key, url }) => ({ key, url }));
}
