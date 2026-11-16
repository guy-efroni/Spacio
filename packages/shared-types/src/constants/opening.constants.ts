import { WallOpeningType } from '../enums/wall-opening-type.enum';
import { IMaterialSlot } from '../furniture/material-slot.interface';
import { createMaterialSlot } from './furniture.constants';

export const DEFAULT_DOOR_WIDTH = 0.9;
export const DEFAULT_DOOR_HEIGHT = 2.1;
export const DEFAULT_DOOR_ELEVATION = 0;

export const DEFAULT_WINDOW_WIDTH = 1.2;
export const DEFAULT_WINDOW_HEIGHT = 1.2;
export const DEFAULT_WINDOW_ELEVATION = 0.9;

export const MIN_OPENING_WIDTH = 0.4;
export const MAX_OPENING_WIDTH = 3.0;
export const MIN_OPENING_HEIGHT = 0.5;
export const MAX_OPENING_HEIGHT = 3.0;
export const MIN_OPENING_ELEVATION = 0;
export const MAX_OPENING_ELEVATION = 2.5;

export const MIN_OPENING_GAP = 0.25;
export const MIN_WALL_PIER = 0.25;

export const OPENING_FRAME_THICKNESS = 0.05;
export const OPENING_FRAME_DEPTH = 0.08;
export const OPENING_GLASS_OPACITY = 0.25;
export const OPENING_GLASS_TRANSMISSION = 0.9;
export const OPENING_GLASS_ROUGHNESS = 0.05;
export const OPENING_GLASS_METALNESS = 0.0;

export const DOOR_LEAF_THICKNESS = 0.04;
export const DOOR_LEAF_GAP = 0.01;

export const OPENING_MESH_PREFIX = 'opening';
export const OPENING_FRAME_PREFIX = 'opening-frame';
export const OPENING_GLASS_PREFIX = 'opening-glass';
export const OPENING_DOOR_PREFIX = 'opening-door';

export function createDefaultOpeningMaterials(type: WallOpeningType): Record<string, IMaterialSlot> {
  if (type === WallOpeningType.Door) {
    return {
      frame: createMaterialSlot('frame', 'Frame', '#8b7355', 0.7, 0.05),
      panel: createMaterialSlot('panel', 'Panel', '#6b4f3a', 0.8, 0.02),
      hardware: createMaterialSlot('hardware', 'Hardware', '#c0c0c0', 0.3, 0.85),
    };
  }
  return {
    frame: createMaterialSlot('frame', 'Frame', '#d4d4d8', 0.45, 0.1),
    glass: createMaterialSlot('glass', 'Glass', '#cfe8ff', 0.05, 0.0),
    hardware: createMaterialSlot('hardware', 'Hardware', '#a1a1aa', 0.3, 0.8),
  };
}

export function createDefaultOpeningStyleOptions(type: WallOpeningType): Record<string, string> {
  if (type === WallOpeningType.Door) {
    return { panelStyle: 'solid', swing: 'left' };
  }
  return { gridStyle: 'single', mullionStyle: 'none' };
}