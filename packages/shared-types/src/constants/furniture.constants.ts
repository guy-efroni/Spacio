import { IMaterialSlot } from '../furniture/material-slot.interface';
import { IParametricFurniture, ParametricFurnitureCategory } from '../furniture/parametric-furniture.interface';

export const FURNITURE_MESH_PREFIX = 'furniture';
export const FURNITURE_USER_DATA_TYPE = 'furniture';

export const FURNITURE_ROTATION_STEP_RAD = Math.PI / 12;
export const FURNITURE_MIN_DIMENSION = 0.3;
export const FURNITURE_MAX_DIMENSION = 4.0;
export const FURNITURE_MIN_HEIGHT = 0.2;
export const FURNITURE_MAX_HEIGHT = 2.5;

export const DEFAULT_FURNITURE_DIMENSIONS: Record<ParametricFurnitureCategory, { width: number; height: number; depth: number }> = {
  table: { width: 1.4, height: 0.75, depth: 0.8 },
  sofa: { width: 2.0, height: 0.85, depth: 0.9 },
  bed: { width: 1.6, height: 0.55, depth: 2.0 },
  storage: { width: 1.0, height: 1.8, depth: 0.4 },
};

export const DEFAULT_FURNITURE_STYLE_OPTIONS: Record<ParametricFurnitureCategory, Record<string, string>> = {
  table: { topShape: 'rectangle', legStyle: 'tapered' },
  sofa: { armStyle: 'rounded', cushionStyle: 'tufted' },
  bed: { headboardStyle: 'panel', baseStyle: 'platform' },
  storage: { doorStyle: 'flat', shelfStyle: 'open' },
};

export const MATERIAL_FINISH_PRESETS: readonly { name: string; roughness: number; metalness: number }[] = [
  { name: 'Matte', roughness: 0.9, metalness: 0.0 },
  { name: 'Satin', roughness: 0.45, metalness: 0.05 },
  { name: 'Glossy', roughness: 0.15, metalness: 0.05 },
  { name: 'Metallic', roughness: 0.25, metalness: 0.85 },
] as const;

export function createMaterialSlot(key: string, label: string, color: string, roughness: number, metalness: number): IMaterialSlot {
  return { key, label, color, roughness, metalness };
}

export function createDefaultFurnitureMaterials(category: ParametricFurnitureCategory): Record<string, IMaterialSlot> {
  switch (category) {
    case 'table':
      return {
        top: createMaterialSlot('top', 'Top', '#8b5a2b', 0.55, 0.05),
        legs: createMaterialSlot('legs', 'Legs', '#2f2f35', 0.35, 0.2),
      };
    case 'sofa':
      return {
        upholstery: createMaterialSlot('upholstery', 'Upholstery', '#5b6b8a', 0.85, 0.0),
        base: createMaterialSlot('base', 'Base', '#3a3a40', 0.6, 0.1),
      };
    case 'bed':
      return {
        frame: createMaterialSlot('frame', 'Frame', '#7a5230', 0.6, 0.05),
        upholstery: createMaterialSlot('upholstery', 'Upholstery', '#e5e7eb', 0.9, 0.0),
      };
    case 'storage':
      return {
        body: createMaterialSlot('body', 'Body', '#d4d4d8', 0.5, 0.05),
        shelves: createMaterialSlot('shelves', 'Shelves', '#a1a1aa', 0.55, 0.05),
      };
  }
}

export function createDefaultParametricFurniture(
  category: ParametricFurnitureCategory,
  id: string,
  position: { x: number; y: number; z: number }
): IParametricFurniture {
  const dims = DEFAULT_FURNITURE_DIMENSIONS[category];
  return {
    id,
    category,
    position: { ...position },
    rotationY: 0,
    dimensions: { ...dims },
    styleOptions: { ...DEFAULT_FURNITURE_STYLE_OPTIONS[category] },
    materials: createDefaultFurnitureMaterials(category),
  };
}
