import type Phaser from 'phaser';
import { drawPrims } from './plantArt';
import { offsetPrims, plantPrims, primBounds, scalePrims, type PlantDrawInput } from './plantShapes';

/** Plant textures are drawn at 2× and shown at 0.5 so they stay crisp when the camera zooms in. */
export const PLANT_RES = 3;
const PAD = 2;

export interface PlantTexture {
  key: string;
  /** Where the tile's ground centre sits inside the texture, as origin fractions. */
  originX: number;
  originY: number;
}

export function ensurePlantTexture(scene: Phaser.Scene, key: string, input: PlantDrawInput): PlantTexture {
  const scaled = scalePrims(plantPrims(input), PLANT_RES);
  const b = primBounds(scaled);
  const dx = -b.minX + PAD;
  const dy = -b.minY + PAD;
  const w = Math.ceil(b.maxX - b.minX + PAD * 2);
  const h = Math.ceil(b.maxY - b.minY + PAD * 2);
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({}, false);
    drawPrims(g, offsetPrims(scaled, dx, dy));
    g.generateTexture(key, w, h);
    g.destroy();
  }
  return { key, originX: dx / w, originY: dy / h };
}
