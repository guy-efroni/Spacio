import { IEulerRotation } from '../geometry/euler-rotation.interface';
import { IVector3D } from '../geometry/vector3d.interface';
import { IFurnitureBlueprint, TFurnitureCategory } from '../furniture/furniture-blueprint.interface';
import { IFurniturePart, TPartShape } from '../furniture/furniture-part.interface';
import { IMaterialSlot, TMaterialFinish } from '../furniture/material-slot.interface';
import { IParametricFurniture, ParametricFurnitureCategory } from '../furniture/parametric-furniture.interface';
import { IPlacedFurniture } from '../furniture/placed-furniture.interface';
import { IWallMaterialSlot } from '../furniture/wall-material-slot.interface';

export const FURNITURE_MESH_PREFIX = 'furniture';
export const FURNITURE_USER_DATA_TYPE = 'furniture';
export const FURNITURE_GROUP_NAME = 'furniture-mesh';
export const FURNITURE_BODY_NAME = 'furniture-body';
export const FURNITURE_PART_USER_DATA_TYPE = 'furniture-part';
export const FURNITURE_PART_ID_USER_DATA_KEY = 'partId';
export const DEFAULT_FURNITURE_SLOT_COLOR = '#c8c8d0';
export const DEFAULT_FURNITURE_MATERIAL_FINISH: TMaterialFinish = 'satin';

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
  decor: { width: 0.6, height: 0.8, depth: 0.6 },
};

export const FURNITURE_FINISH_PBR: Record<TMaterialFinish, { roughness: number; metalness: number }> = {
  matte: { roughness: 0.9, metalness: 0 },
  satin: { roughness: 0.45, metalness: 0.05 },
  gloss: { roughness: 0.15, metalness: 0.05 },
  metallic: { roughness: 0.25, metalness: 0.85 },
};

export const MATERIAL_FINISH_PRESETS: readonly { name: string; roughness: number; metalness: number }[] = [
  { name: 'Matte', roughness: 0.9, metalness: 0.0 },
  { name: 'Satin', roughness: 0.45, metalness: 0.05 },
  { name: 'Glossy', roughness: 0.15, metalness: 0.05 },
  { name: 'Metallic', roughness: 0.25, metalness: 0.85 },
] as const;

export const MATERIAL_FINISH_OPTIONS: readonly TMaterialFinish[] = ['matte', 'satin', 'gloss', 'metallic'];
export const FURNITURE_CATEGORY_OPTIONS: readonly TFurnitureCategory[] = ['tables', 'seating', 'beds', 'storage', 'decor'];
export const PART_SHAPE_OPTIONS: readonly TPartShape[] = ['box', 'cylinder', 'sphere', 'capsule'];

export const DEFAULT_FURNITURE_SCALE: IVector3D = { x: 1, y: 1, z: 1 };
export const DEFAULT_FURNITURE_ROTATION: IEulerRotation = { x: 0, y: 0, z: 0 };

export const LEGACY_CATEGORY_TO_BLUEPRINT_CATEGORY: Record<ParametricFurnitureCategory, TFurnitureCategory> = {
  table: 'tables',
  sofa: 'seating',
  bed: 'beds',
  storage: 'storage',
  decor: 'decor',
};

export function inferMaterialFinish(roughness: number, metalness: number): TMaterialFinish {
  if (metalness >= 0.8) return 'metallic';
  if (roughness <= 0.25) return 'gloss';
  if (roughness >= 0.75) return 'matte';
  return 'satin';
}

export function createMaterialSlot(key: string, label: string, color: string, roughness: number, metalness: number): IWallMaterialSlot {
  return { key, label, color, finish: inferMaterialFinish(roughness, metalness), roughness, metalness };
}

export function createFurnitureMaterialSlot(label: string, color: string, finish: TMaterialFinish): IMaterialSlot {
  return { label, color, finish };
}

export function getMaterialPbr(slot: IMaterialSlot): { roughness: number; metalness: number } {
  return FURNITURE_FINISH_PBR[slot.finish];
}

export function createFurniturePart(
  id: string,
  name: string,
  shape: TPartShape,
  dimensions: { width: number; height: number; depth: number },
  position: IVector3D,
  materialSlot: string,
  rotation: IEulerRotation = { x: 0, y: 0, z: 0 }
): IFurniturePart {
  return {
    id,
    name,
    shape,
    dimensions: { ...dimensions },
    position: { ...position },
    rotation: { ...rotation },
    materialSlot,
  };
}

function buildTableParts(): IFurniturePart[] {
  const legs: IFurniturePart[] = [];
  const corners: ReadonlyArray<readonly [number, number]> = [
    [-0.52, -0.27],
    [0.52, -0.27],
    [-0.52, 0.27],
    [0.52, 0.27],
  ];
  corners.forEach((corner: readonly [number, number], index: number): void => {
    legs.push(
      createFurniturePart(`table-leg-${index + 1}`, `Leg ${index + 1}`, 'box', { width: 0.08, height: 0.69, depth: 0.08 }, {
        x: corner[0],
        y: 0.345,
        z: corner[1],
      }, 'legs')
    );
  });
  return [
    createFurniturePart('table-top', 'Tabletop', 'box', { width: 1.2, height: 0.06, depth: 0.7 }, { x: 0, y: 0.72, z: 0 }, 'top'),
    ...legs,
  ];
}

function buildChairParts(): IFurniturePart[] {
  const legs: IFurniturePart[] = [];
  const corners: ReadonlyArray<readonly [number, number]> = [
    [-0.19, -0.19],
    [0.19, -0.19],
    [-0.19, 0.19],
    [0.19, 0.19],
  ];
  corners.forEach((corner: readonly [number, number], index: number): void => {
    legs.push(
      createFurniturePart(`chair-leg-${index + 1}`, `Leg ${index + 1}`, 'box', { width: 0.05, height: 0.45, depth: 0.05 }, {
        x: corner[0],
        y: 0.225,
        z: corner[1],
      }, 'frame')
    );
  });
  return [
    createFurniturePart('chair-seat', 'Seat', 'box', { width: 0.46, height: 0.06, depth: 0.46 }, { x: 0, y: 0.45, z: 0 }, 'upholstery'),
    createFurniturePart('chair-back', 'Backrest', 'box', { width: 0.46, height: 0.5, depth: 0.05 }, { x: 0, y: 0.73, z: -0.205 }, 'upholstery'),
    ...legs,
  ];
}

function buildShelfParts(): IFurniturePart[] {
  return [
    createFurniturePart('shelf-left', 'Left Panel', 'box', { width: 0.04, height: 1.4, depth: 0.32 }, { x: -0.48, y: 0.7, z: 0 }, 'body'),
    createFurniturePart('shelf-right', 'Right Panel', 'box', { width: 0.04, height: 1.4, depth: 0.32 }, { x: 0.48, y: 0.7, z: 0 }, 'body'),
    createFurniturePart('shelf-bottom', 'Bottom Panel', 'box', { width: 1.0, height: 0.04, depth: 0.32 }, { x: 0, y: 0.02, z: 0 }, 'body'),
    createFurniturePart('shelf-top', 'Top Panel', 'box', { width: 1.0, height: 0.04, depth: 0.32 }, { x: 0, y: 1.38, z: 0 }, 'body'),
    createFurniturePart('shelf-back', 'Back Panel', 'box', { width: 0.96, height: 1.36, depth: 0.02 }, { x: 0, y: 0.7, z: -0.15 }, 'body'),
    createFurniturePart('shelf-level-1', 'Shelf 1', 'box', { width: 0.92, height: 0.03, depth: 0.3 }, { x: 0, y: 0.35, z: 0 }, 'shelves'),
    createFurniturePart('shelf-level-2', 'Shelf 2', 'box', { width: 0.92, height: 0.03, depth: 0.3 }, { x: 0, y: 0.7, z: 0 }, 'shelves'),
    createFurniturePart('shelf-level-3', 'Shelf 3', 'box', { width: 0.92, height: 0.03, depth: 0.3 }, { x: 0, y: 1.05, z: 0 }, 'shelves'),
  ];
}

export const FURNITURE_PRESETS: readonly IFurnitureBlueprint[] = [
  {
    id: 'preset-table',
    userId: null,
    name: 'Table',
    category: 'tables',
    isPreset: true,
    parts: buildTableParts(),
    materials: {
      top: createFurnitureMaterialSlot('Top', '#8b5a2b', 'satin'),
      legs: createFurnitureMaterialSlot('Legs', '#2f2f35', 'satin'),
    },
  },
  {
    id: 'preset-chair',
    userId: null,
    name: 'Chair',
    category: 'seating',
    isPreset: true,
    parts: buildChairParts(),
    materials: {
      upholstery: createFurnitureMaterialSlot('Upholstery', '#5b6b8a', 'matte'),
      frame: createFurnitureMaterialSlot('Frame', '#2f2f35', 'satin'),
    },
  },
  {
    id: 'preset-shelf',
    userId: null,
    name: 'Shelf',
    category: 'storage',
    isPreset: true,
    parts: buildShelfParts(),
    materials: {
      body: createFurnitureMaterialSlot('Body', '#d4d4d8', 'satin'),
      shelves: createFurnitureMaterialSlot('Shelves', '#a1a1aa', 'satin'),
    },
  },
] as const;

export function cloneBlueprint(blueprint: IFurnitureBlueprint, id: string = blueprint.id): IFurnitureBlueprint {
  return {
    id,
    userId: null,
    name: blueprint.name,
    category: blueprint.category,
    isPreset: false,
    thumbnailDataUrl: undefined,
    parts: blueprint.parts.map((part: IFurniturePart): IFurniturePart => ({
      ...part,
      dimensions: { ...part.dimensions },
      position: { ...part.position },
      rotation: { ...part.rotation },
    })),
    materials: Object.fromEntries(
      Object.entries(blueprint.materials).map(([key, slot]: [string, IMaterialSlot]): [string, IMaterialSlot] => [key, { ...slot }])
    ),
  };
}

export function createBlankBlueprint(id: string): IFurnitureBlueprint {
  return {
    id,
    userId: null,
    name: 'Untitled Piece',
    category: 'decor',
    isPreset: false,
    parts: [],
    materials: {
      'material-1': createFurnitureMaterialSlot('Material 1', '#8b5a2b', 'satin'),
    },
  };
}

export function createPlacedFurnitureFromBlueprint(
  blueprint: IFurnitureBlueprint,
  instanceId: string,
  position: IVector3D
): IPlacedFurniture {
  return {
    instanceId,
    blueprintId: blueprint.id,
    blueprintName: blueprint.name,
    position: { ...position },
    rotationY: 0,
    scale: { ...DEFAULT_FURNITURE_SCALE },
  };
}

export function getBlueprintBounds(parts: readonly IFurniturePart[]): { width: number; height: number; depth: number } {
  if (parts.length === 0) return { width: 0.4, height: 0.4, depth: 0.4 };
  let minX: number = Number.POSITIVE_INFINITY;
  let maxX: number = Number.NEGATIVE_INFINITY;
  let minY: number = Number.POSITIVE_INFINITY;
  let maxY: number = Number.NEGATIVE_INFINITY;
  let minZ: number = Number.POSITIVE_INFINITY;
  let maxZ: number = Number.NEGATIVE_INFINITY;
  for (const part of parts) {
    const halfWidth: number = part.dimensions.width / 2;
    const halfHeight: number = part.dimensions.height / 2;
    const halfDepth: number = part.dimensions.depth / 2;
    minX = Math.min(minX, part.position.x - halfWidth);
    maxX = Math.max(maxX, part.position.x + halfWidth);
    minY = Math.min(minY, part.position.y - halfHeight);
    maxY = Math.max(maxY, part.position.y + halfHeight);
    minZ = Math.min(minZ, part.position.z - halfDepth);
    maxZ = Math.max(maxZ, part.position.z + halfDepth);
  }
  return {
    width: Math.max(0.1, maxX - minX),
    height: Math.max(0.1, maxY - minY),
    depth: Math.max(0.1, maxZ - minZ),
  };
}

export function createDefaultFurnitureMaterials(category: ParametricFurnitureCategory): Record<string, IMaterialSlot> {
  const blueprint: IFurnitureBlueprint = FURNITURE_PRESETS.find(
    (preset: IFurnitureBlueprint) => preset.category === LEGACY_CATEGORY_TO_BLUEPRINT_CATEGORY[category]
  ) ?? FURNITURE_PRESETS[0];
  return Object.fromEntries(
    Object.entries(blueprint.materials).map(([key, slot]: [string, IMaterialSlot]): [string, IMaterialSlot] => [key, { ...slot }])
  );
}

export function createDefaultParametricFurniture(
  category: ParametricFurnitureCategory,
  id: string,
  position: { x: number; y: number; z: number }
): IParametricFurniture {
  const blueprint: IFurnitureBlueprint = FURNITURE_PRESETS.find(
    (preset: IFurnitureBlueprint) => preset.category === LEGACY_CATEGORY_TO_BLUEPRINT_CATEGORY[category]
  ) ?? FURNITURE_PRESETS[0];
  return {
    ...createPlacedFurnitureFromBlueprint(blueprint, id, position),
    category,
  };
}

export const DEFAULT_FURNITURE_STYLE_OPTIONS: Record<ParametricFurnitureCategory, Record<string, string>> = {
  table: {},
  sofa: {},
  bed: {},
  storage: {},
  decor: {},
};
