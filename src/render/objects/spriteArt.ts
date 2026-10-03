import type Phaser from 'phaser';
import type { Rotation } from '../iso/projection';
import { PALETTE } from '../palette';
import { codeObjectArt, type ObjectArt } from './objectArt';
import { objectTopHeight } from './objectShapes';
import { spriteFor, type SpriteManifest } from './spriteManifest';

export { spriteAssets, spriteFor, type SpriteManifest } from './spriteManifest';

/** Kenney sprites where we have them, code-drawn shapes otherwise (and if a texture failed to load). */
export function makeSpriteObjectArt(manifest: SpriteManifest, base: string): ObjectArt {
  return {
    create(scene: Phaser.Scene, x: number, y: number, name: string, rotation: Rotation) {
      const s = spriteFor(manifest, name, rotation, base);
      if (!s || !scene.textures.exists(s.key)) return codeObjectArt.create(scene, x, y, name, rotation);
      return scene.add.image(x, y, s.key).setOrigin(0.5, s.originY).setScale(s.scale).setTint(PALETTE.spriteTint);
    },
    topHeight(name: string) {
      return Object.hasOwn(manifest, name) ? manifest[name]!.topHeight : objectTopHeight(name);
    },
  };
}
