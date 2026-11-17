import { IEulerRotation } from '../geometry/euler-rotation.interface';
import { IVector3D } from '../geometry/vector3d.interface';
import { IFurnitureBlueprint, TFurnitureCategory } from '../furniture/furniture-blueprint.interface';
import { IFurniturePart, TPartShape } from '../furniture/furniture-part.interface';
import { IMaterialSlot, TMaterialFinish } from '../furniture/material-slot.interface';
import { IParametricFurniture, ParametricFurnitureCategory } from '../furniture/parametric-furniture.interface';
import { IPlacedFurniture } from '../furniture/placed-furniture.interface';

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

export function createMaterialSlot(key: string, label: string, color: string, roughness: number, metalness: number): IMaterialSlot {
  return { key, label, color, finish: inferMaterialFinish(roughness, metalness), roughness, metalness };
}

export function createFurnitureMaterialSlot(label: string, color: string, finish: TMaterialFinish): IMaterialSlot {
  const pbr: { roughness: number; metalness: number } = FURNITURE_FINISH_PBR[finish];
  return { label, color, finish, roughness: pbr.roughness, metalness: pbr.metalness };
}

export function getMaterialPbr(slot: IMaterialSlot): { roughness: number; metalness: number } {
  const preset: { roughness: number; metalness: number } = FURNITURE_FINISH_PBR[slot.finish];
  return {
    roughness: Math.min(Math.max(slot.roughness ?? preset.roughness, 0), 1),
    metalness: Math.min(Math.max(slot.metalness ?? preset.metalness, 0), 1),
  };
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

function buildDiningTableParts(): IFurniturePart[] {
  const legs: IFurniturePart[] = [];
  const corners: ReadonlyArray<readonly [number, number]> = [
    [-0.72, -0.37],
    [0.72, -0.37],
    [-0.72, 0.37],
    [0.72, 0.37],
  ];
  corners.forEach((corner: readonly [number, number], index: number): void => {
    legs.push(
      createFurniturePart(`dining-table-leg-${index + 1}`, `Leg ${index + 1}`, 'box', { width: 0.07, height: 0.69, depth: 0.07 }, {
        x: corner[0],
        y: 0.345,
        z: corner[1],
      }, 'legs')
    );
  });
  return [
    createFurniturePart('dining-table-top', 'Tabletop', 'box', { width: 1.6, height: 0.06, depth: 0.9 }, { x: 0, y: 0.72, z: 0 }, 'top'),
    ...legs,
  ];
}

function buildCoffeeTableParts(): IFurniturePart[] {
  const legs: IFurniturePart[] = [];
  const corners: ReadonlyArray<readonly [number, number]> = [
    [-0.54, -0.24],
    [0.54, -0.24],
    [-0.54, 0.24],
    [0.54, 0.24],
  ];
  corners.forEach((corner: readonly [number, number], index: number): void => {
    legs.push(
      createFurniturePart(`coffee-table-leg-${index + 1}`, `Leg ${index + 1}`, 'box', { width: 0.06, height: 0.35, depth: 0.06 }, {
        x: corner[0],
        y: 0.175,
        z: corner[1],
      }, 'legs')
    );
  });
  return [
    createFurniturePart('coffee-table-top', 'Tabletop', 'box', { width: 1.2, height: 0.05, depth: 0.6 }, { x: 0, y: 0.375, z: 0 }, 'top'),
    createFurniturePart('coffee-table-shelf', 'Lower Shelf', 'box', { width: 1.05, height: 0.03, depth: 0.48 }, { x: 0, y: 0.12, z: 0 }, 'legs'),
    ...legs,
  ];
}

function buildSofaParts(): IFurniturePart[] {
  return [
    createFurniturePart('sofa-base', 'Base', 'box', { width: 2.0, height: 0.35, depth: 0.9 }, { x: 0, y: 0.175, z: 0 }, 'base'),
    createFurniturePart('sofa-back', 'Backrest', 'box', { width: 2.0, height: 0.5, depth: 0.16 }, { x: 0, y: 0.6, z: -0.37 }, 'upholstery'),
    createFurniturePart('sofa-seat-left', 'Left Cushion', 'box', { width: 0.88, height: 0.12, depth: 0.68 }, { x: -0.45, y: 0.41, z: 0.06 }, 'upholstery'),
    createFurniturePart('sofa-seat-right', 'Right Cushion', 'box', { width: 0.88, height: 0.12, depth: 0.68 }, { x: 0.45, y: 0.41, z: 0.06 }, 'upholstery'),
    createFurniturePart('sofa-arm-left', 'Left Armrest', 'box', { width: 0.14, height: 0.42, depth: 0.9 }, { x: -0.93, y: 0.56, z: 0 }, 'upholstery'),
    createFurniturePart('sofa-arm-right', 'Right Armrest', 'box', { width: 0.14, height: 0.42, depth: 0.9 }, { x: 0.93, y: 0.56, z: 0 }, 'upholstery'),
  ];
}

function buildBedParts(): IFurniturePart[] {
  return [
    createFurniturePart('bed-frame', 'Frame', 'box', { width: 1.6, height: 0.3, depth: 2.0 }, { x: 0, y: 0.15, z: 0 }, 'frame'),
    createFurniturePart('bed-mattress', 'Mattress', 'box', { width: 1.52, height: 0.22, depth: 1.92 }, { x: 0, y: 0.41, z: 0.04 }, 'upholstery'),
    createFurniturePart('bed-headboard', 'Headboard', 'box', { width: 1.6, height: 0.9, depth: 0.08 }, { x: 0, y: 0.45, z: -1.04 }, 'frame'),
    createFurniturePart('bed-pillow-left', 'Left Pillow', 'box', { width: 0.62, height: 0.12, depth: 0.34 }, { x: -0.37, y: 0.58, z: -0.7 }, 'upholstery'),
    createFurniturePart('bed-pillow-right', 'Right Pillow', 'box', { width: 0.62, height: 0.12, depth: 0.34 }, { x: 0.37, y: 0.58, z: -0.7 }, 'upholstery'),
  ];
}

function buildBookshelfParts(): IFurniturePart[] {
  const parts: IFurniturePart[] = [
    createFurniturePart('bookshelf-left', 'Left Panel', 'box', { width: 0.03, height: 1.8, depth: 0.4 }, { x: -0.485, y: 0.9, z: 0 }, 'body'),
    createFurniturePart('bookshelf-right', 'Right Panel', 'box', { width: 0.03, height: 1.8, depth: 0.4 }, { x: 0.485, y: 0.9, z: 0 }, 'body'),
    createFurniturePart('bookshelf-bottom', 'Bottom Panel', 'box', { width: 1.0, height: 0.03, depth: 0.4 }, { x: 0, y: 0.015, z: 0 }, 'body'),
    createFurniturePart('bookshelf-top', 'Top Panel', 'box', { width: 1.0, height: 0.03, depth: 0.4 }, { x: 0, y: 1.785, z: 0 }, 'body'),
    createFurniturePart('bookshelf-back', 'Back Panel', 'box', { width: 0.94, height: 1.74, depth: 0.02 }, { x: 0, y: 0.9, z: -0.19 }, 'body'),
  ];
  const shelfHeights: readonly number[] = [0.37, 0.72, 1.07, 1.42];
  shelfHeights.forEach((height: number, index: number): void => {
    parts.push(
      createFurniturePart(`bookshelf-shelf-${index + 1}`, `Shelf ${index + 1}`, 'box', { width: 0.94, height: 0.03, depth: 0.36 }, {
        x: 0,
        y: height,
        z: 0,
      }, 'shelves')
    );
  });
  return parts;
}

export const FURNITURE_PRESETS: readonly IFurnitureBlueprint[] = [
  {
    id: 'preset-dining-table',
    name: 'Dining Table',
    category: 'tables',
    isPreset: true,
    parts: buildDiningTableParts(),
    materials: {
      top: createFurnitureMaterialSlot('Top', '#8b5a2b', 'satin'),
      legs: createFurnitureMaterialSlot('Legs', '#2f2f35', 'satin'),
    },
  },
  {
    id: 'preset-coffee-table',
    name: 'Coffee Table',
    category: 'tables',
    isPreset: true,
    parts: buildCoffeeTableParts(),
    materials: {
      top: createFurnitureMaterialSlot('Top', '#a9743d', 'satin'),
      legs: createFurnitureMaterialSlot('Legs', '#2f2f35', 'satin'),
    },
  },
  {
    id: 'preset-sofa',
    name: 'Sofa',
    category: 'seating',
    isPreset: true,
    parts: buildSofaParts(),
    materials: {
      upholstery: createFurnitureMaterialSlot('Upholstery', '#5b6b8a', 'matte'),
      base: createFurnitureMaterialSlot('Base', '#3a3a40', 'satin'),
    },
  },
  {
    id: 'preset-bed',
    name: 'Bed',
    category: 'beds',
    isPreset: true,
    parts: buildBedParts(),
    materials: {
      frame: createFurnitureMaterialSlot('Frame', '#7a5230', 'satin'),
      upholstery: createFurnitureMaterialSlot('Upholstery', '#e5e7eb', 'matte'),
    },
  },
  {
    id: 'preset-bookshelf',
    name: 'Bookshelf',
    category: 'storage',
    isPreset: true,
    parts: buildBookshelfParts(),
    materials: {
      body: createFurnitureMaterialSlot('Body', '#d4d4d8', 'satin'),
      shelves: createFurnitureMaterialSlot('Shelves', '#a1a1aa', 'satin'),
    },
  },
] as const;

export function cloneBlueprint(blueprint: IFurnitureBlueprint, id: string = blueprint.id): IFurnitureBlueprint {
  return {
    id,
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
  id: string,
  position: IVector3D
): IPlacedFurniture {
  const clone: IFurnitureBlueprint = cloneBlueprint(blueprint, blueprint.id);
  return {
    id,
    blueprintId: blueprint.id,
    name: blueprint.name,
    parts: clone.parts,
    materials: clone.materials,
    scale: { ...DEFAULT_FURNITURE_SCALE },
    position: { ...position },
    rotation: { ...DEFAULT_FURNITURE_ROTATION },
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
