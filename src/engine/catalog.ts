import type { PlantType, ScrapKind, Size, WorldObject } from './types';

export const RADIUS: Record<Size, number> = { small: 1, medium: 2, large: 3 };

export const SCRAP: Record<ScrapKind, { size: Size }> = {
  tyre: { size: 'small' },
  can: { size: 'small' },
  cone: { size: 'small' },
  crate: { size: 'medium' },
  barrel: { size: 'medium' },
  sign: { size: 'medium' },
  car: { size: 'large' },
};

export type GrownAction = 'spread' | 'spreadPreferObjects' | 'bloom' | 'none';

export interface PlantRule {
  maxStage: number;
  growsOn: (object: WorldObject | null) => boolean;
  onGrown: GrownAction;
}

export const PLANTS: Record<PlantType, PlantRule> = {
  moss: { maxStage: 2, growsOn: (o) => o === null || o.size === 'small', onGrown: 'spread' },
  vine: { maxStage: 3, growsOn: () => true, onGrown: 'spreadPreferObjects' },
  flower: { maxStage: 3, growsOn: (o) => o === null, onGrown: 'bloom' },
  bamboo: { maxStage: 5, growsOn: (o) => o === null, onGrown: 'none' },
};

export const PLANT_TYPES = Object.keys(PLANTS) as PlantType[];
export const SCRAP_KINDS = Object.keys(SCRAP) as ScrapKind[];
