import { IEulerRotation } from "../geometry/euler-rotation.interface";
import { IVector3D } from "../geometry/vector3d.interface";
import {
  IFurnitureBlueprint,
  TFurnitureCategory,
} from "../furniture/furniture-blueprint.interface";
import {
  IFurniturePart,
  IFurniturePartDimensions,
  IFurniturePartSculpt,
  ISculptPoint,
  TMaterialPreset,
  TPartShape,
  TSculptMode,
  TSculptPointKind,
  TSculptPresetId,
} from "../furniture/furniture-part.interface";
import {
  IMaterialSlot,
  TMaterialFinish,
} from "../furniture/material-slot.interface";
import {
  IParametricFurniture,
  ParametricFurnitureCategory,
} from "../furniture/parametric-furniture.interface";
import { IPlacedFurniture } from "../furniture/placed-furniture.interface";
import { IWallMaterialSlot } from "../furniture/wall-material-slot.interface";

export const FURNITURE_MESH_PREFIX = "furniture";
export const FURNITURE_USER_DATA_TYPE = "furniture";
export const FURNITURE_GROUP_NAME = "furniture-mesh";
export const FURNITURE_BODY_NAME = "furniture-body";
export const FURNITURE_PART_USER_DATA_TYPE = "furniture-part";
export const FURNITURE_PART_ID_USER_DATA_KEY = "partId";
export const DEFAULT_FURNITURE_SLOT_COLOR = "#c8c8d0";
export const DEFAULT_FURNITURE_MATERIAL_FINISH: TMaterialFinish = "satin";

export const FURNITURE_ROTATION_STEP_RAD = Math.PI / 12;
export const FURNITURE_MIN_DIMENSION = 0.3;
export const FURNITURE_MAX_DIMENSION = 4.0;
export const FURNITURE_MIN_HEIGHT = 0.2;
export const FURNITURE_MAX_HEIGHT = 2.5;

export const DEFAULT_FURNITURE_DIMENSIONS: Record<
  ParametricFurnitureCategory,
  IFurniturePartDimensions
> = {
  table: { width: 1.4, height: 0.75, depth: 0.8 },
  sofa: { width: 2.0, height: 0.85, depth: 0.9 },
  bed: { width: 1.6, height: 0.55, depth: 2.0 },
  storage: { width: 1.0, height: 1.8, depth: 0.4 },
  decor: { width: 0.6, height: 0.8, depth: 0.6 },
};

export const FURNITURE_FINISH_PBR: Record<
  TMaterialFinish,
  { roughness: number; metalness: number }
> = {
  matte: { roughness: 0.9, metalness: 0 },
  satin: { roughness: 0.45, metalness: 0.05 },
  gloss: { roughness: 0.15, metalness: 0.05 },
  metallic: { roughness: 0.25, metalness: 0.85 },
  glass: { roughness: 0.05, metalness: 0 },
};

export const GLASS_FINISH_SETTINGS = {
  transmission: 0.9,
  opacity: 0.35,
  roughness: 0.05,
  ior: 1.5,
} as const;

export const MATERIAL_FINISH_PRESETS: readonly {
  name: string;
  roughness: number;
  metalness: number;
}[] = [
  { name: "Matte", roughness: 0.9, metalness: 0.0 },
  { name: "Satin", roughness: 0.45, metalness: 0.05 },
  { name: "Glossy", roughness: 0.15, metalness: 0.05 },
  { name: "Metallic", roughness: 0.25, metalness: 0.85 },
  { name: "Glass", roughness: 0.05, metalness: 0.0 },
];

export const MATERIAL_FINISH_OPTIONS: readonly TMaterialFinish[] = [
  "matte",
  "satin",
  "gloss",
  "metallic",
  "glass",
];
export const FURNITURE_CATEGORY_OPTIONS: readonly TFurnitureCategory[] = [
  "tables",
  "seating",
  "beds",
  "storage",
  "decor",
];
export const PART_SHAPE_OPTIONS: readonly TPartShape[] = [
  "box",
  "cylinder",
  "capsule",
  "cone",
  "torus",
  "extrude-2d",
  "lathe-360",
];

export interface IMaterialPresetDefinition {
  readonly id: TMaterialPreset;
  readonly label: string;
  readonly swatch: string;
  readonly roughness: number;
  readonly metalness: number;
  readonly clearcoat: number;
  readonly clearcoatRoughness: number;
  readonly sheen: number;
  readonly sheenRoughness: number;
  readonly transmission: number;
  readonly thickness: number;
  readonly ior: number;
  readonly envMapIntensity: number;
}

export const MATERIAL_PRESET_OPTIONS: readonly IMaterialPresetDefinition[] = [
  {
    id: "oak",
    label: "Warm Oak",
    swatch: "#b98a5a",
    roughness: 0.58,
    metalness: 0,
    clearcoat: 0.08,
    clearcoatRoughness: 0.55,
    sheen: 0,
    sheenRoughness: 1,
    transmission: 0,
    thickness: 0,
    ior: 1.5,
    envMapIntensity: 0.7,
  },
  {
    id: "walnut",
    label: "Smoked Walnut",
    swatch: "#5b3a26",
    roughness: 0.46,
    metalness: 0,
    clearcoat: 0.14,
    clearcoatRoughness: 0.42,
    sheen: 0,
    sheenRoughness: 1,
    transmission: 0,
    thickness: 0,
    ior: 1.5,
    envMapIntensity: 0.8,
  },
  {
    id: "boucle",
    label: "Bouclé",
    swatch: "#d8cbbb",
    roughness: 0.94,
    metalness: 0,
    clearcoat: 0,
    clearcoatRoughness: 1,
    sheen: 0.65,
    sheenRoughness: 0.85,
    transmission: 0,
    thickness: 0,
    ior: 1.5,
    envMapIntensity: 0.45,
  },
  {
    id: "leather",
    label: "Leather",
    swatch: "#8a4f3d",
    roughness: 0.52,
    metalness: 0,
    clearcoat: 0.32,
    clearcoatRoughness: 0.38,
    sheen: 0.18,
    sheenRoughness: 0.6,
    transmission: 0,
    thickness: 0,
    ior: 1.5,
    envMapIntensity: 0.75,
  },
  {
    id: "brushed-brass",
    label: "Brushed Brass",
    swatch: "#c9a227",
    roughness: 0.31,
    metalness: 0.94,
    clearcoat: 0.06,
    clearcoatRoughness: 0.3,
    sheen: 0,
    sheenRoughness: 1,
    transmission: 0,
    thickness: 0,
    ior: 1.5,
    envMapIntensity: 1.2,
  },
  {
    id: "matte-metal",
    label: "Matte Metal",
    swatch: "#8c9199",
    roughness: 0.62,
    metalness: 0.82,
    clearcoat: 0.02,
    clearcoatRoughness: 0.7,
    sheen: 0,
    sheenRoughness: 1,
    transmission: 0,
    thickness: 0,
    ior: 1.5,
    envMapIntensity: 0.9,
  },
  {
    id: "travertine",
    label: "Travertine",
    swatch: "#cbbca6",
    roughness: 0.79,
    metalness: 0,
    clearcoat: 0.04,
    clearcoatRoughness: 0.8,
    sheen: 0.05,
    sheenRoughness: 1,
    transmission: 0,
    thickness: 0,
    ior: 1.5,
    envMapIntensity: 0.6,
  },
  {
    id: "glass",
    label: "Glass",
    swatch: "#c4dced",
    roughness: 0.06,
    metalness: 0,
    clearcoat: 0.2,
    clearcoatRoughness: 0.08,
    sheen: 0,
    sheenRoughness: 1,
    transmission: 0.88,
    thickness: 0.24,
    ior: 1.5,
    envMapIntensity: 1.1,
  },
];

export const MATERIAL_PRESET_IDS: readonly TMaterialPreset[] =
  MATERIAL_PRESET_OPTIONS.map(
    (preset: IMaterialPresetDefinition): TMaterialPreset => preset.id,
  );

export const DEFAULT_MATERIAL_PRESET: TMaterialPreset = "oak";
export const MIN_BEVEL = 0;
export const MAX_BEVEL = 1;
export const MIN_TAPER = -0.5;
export const MAX_TAPER = 0.5;

export const SCULPT_MIN_POINTS = 3;
export const SCULPT_MAX_POINTS = 24;
export const SCULPT_COORD_MIN = 0;
export const SCULPT_COORD_MAX = 1;

export interface ISculptPresetDefinition {
  readonly id: TSculptPresetId;
  readonly label: string;
  readonly mode: TSculptMode;
  readonly points: readonly ISculptPoint[];
}

function sculptPoint(
  x: number,
  y: number,
  kind: TSculptPointKind = "sharp",
): ISculptPoint {
  return { x, y, kind };
}

export const SCULPT_PRESET_OPTIONS: readonly ISculptPresetDefinition[] = [
  {
    id: "rectangle",
    label: "Rectangle",
    mode: "extrude",
    points: [
      sculptPoint(0, 0),
      sculptPoint(1, 0),
      sculptPoint(1, 1),
      sculptPoint(0, 1),
    ],
  },
  {
    id: "l-shape",
    label: "L-Shape",
    mode: "extrude",
    points: [
      sculptPoint(0, 0),
      sculptPoint(0.45, 0),
      sculptPoint(0.45, 0.58),
      sculptPoint(1, 0.58),
      sculptPoint(1, 1),
      sculptPoint(0, 1),
    ],
  },
  {
    id: "arch",
    label: "Arch",
    mode: "extrude",
    points: [
      sculptPoint(0, 1),
      sculptPoint(0, 0.38),
      sculptPoint(0.12, 0.14, "smooth"),
      sculptPoint(0.5, 0, "smooth"),
      sculptPoint(0.88, 0.14, "smooth"),
      sculptPoint(1, 0.38),
      sculptPoint(1, 1),
    ],
  },
  {
    id: "kidney",
    label: "Kidney Curve",
    mode: "extrude",
    points: [
      sculptPoint(0.12, 0.18, "smooth"),
      sculptPoint(0.5, 0.04, "smooth"),
      sculptPoint(0.9, 0.25, "smooth"),
      sculptPoint(0.82, 0.65, "smooth"),
      sculptPoint(0.5, 0.96, "smooth"),
      sculptPoint(0.16, 0.78, "smooth"),
    ],
  },
  {
    id: "pill",
    label: "Rounded Pill",
    mode: "extrude",
    points: [
      sculptPoint(0.25, 0, "smooth"),
      sculptPoint(0.75, 0, "smooth"),
      sculptPoint(1, 0.25, "smooth"),
      sculptPoint(1, 0.75, "smooth"),
      sculptPoint(0.75, 1, "smooth"),
      sculptPoint(0.25, 1, "smooth"),
      sculptPoint(0, 0.75, "smooth"),
      sculptPoint(0, 0.25, "smooth"),
    ],
  },
  {
    id: "turned-leg",
    label: "Turned Leg",
    mode: "lathe",
    points: [
      sculptPoint(0.42, 0.92),
      sculptPoint(0.32, 0.76, "smooth"),
      sculptPoint(0.18, 0.52, "smooth"),
      sculptPoint(0.3, 0.3, "smooth"),
      sculptPoint(0.46, 0.08),
      sculptPoint(0.08, 0.08),
    ],
  },
];

export const SCULPT_PRESET_IDS: readonly TSculptPresetId[] =
  SCULPT_PRESET_OPTIONS.map(
    (preset: ISculptPresetDefinition): TSculptPresetId => preset.id,
  );

export function getSculptPreset(id: TSculptPresetId): ISculptPresetDefinition {
  return (
    SCULPT_PRESET_OPTIONS.find(
      (preset: ISculptPresetDefinition): boolean => preset.id === id,
    ) ?? SCULPT_PRESET_OPTIONS[0]
  );
}

export function clampSculptCoordinate(value: number): number {
  return Number.isFinite(value)
    ? Math.min(SCULPT_COORD_MAX, Math.max(SCULPT_COORD_MIN, value))
    : SCULPT_COORD_MIN;
}

export function normalizeSculptPoints(
  points: readonly ISculptPoint[],
): ISculptPoint[] {
  if (!Array.isArray(points)) return [];
  const normalized: ISculptPoint[] = [];
  for (const point of points) {
    if (!point || typeof point !== "object") continue;
    const x: number = clampSculptCoordinate(Number(point.x));
    const y: number = clampSculptCoordinate(Number(point.y));
    const previous: ISculptPoint | undefined =
      normalized[normalized.length - 1];
    if (previous && Math.hypot(previous.x - x, previous.y - y) < 0.004)
      continue;
    const kind: TSculptPointKind = point.kind === "smooth" ? "smooth" : "sharp";
    normalized.push({ x, y, kind });
    if (normalized.length >= SCULPT_MAX_POINTS) break;
  }
  return normalized;
}

export function cloneFurniturePartSculpt(
  sculpt: IFurniturePartSculpt | undefined,
): IFurniturePartSculpt | undefined {
  if (!sculpt) return undefined;
  return {
    mode: sculpt.mode === "lathe" ? "lathe" : "extrude",
    closed: sculpt.mode !== "lathe" && sculpt.closed !== false,
    points: normalizeSculptPoints(sculpt.points),
  };
}

export function createFurniturePartSculpt(
  mode: TSculptMode,
  presetId: TSculptPresetId,
): IFurniturePartSculpt {
  const preset: ISculptPresetDefinition = getSculptPreset(presetId);
  return cloneFurniturePartSculpt({
    mode,
    closed: mode === "extrude",
    points: preset.points.map((point: ISculptPoint): ISculptPoint => ({
      ...point,
    })),
  }) as IFurniturePartSculpt;
}

export function isSculptShape(shape: TPartShape): boolean {
  return shape === "extrude-2d" || shape === "lathe-360";
}

export function sculptModeForPartShape(shape: TPartShape): TSculptMode {
  return shape === "cylinder" ||
    shape === "cone" ||
    shape === "torus" ||
    shape === "lathe-360"
    ? "lathe"
    : "extrude";
}

export const DEFAULT_FURNITURE_SCALE: IVector3D = { x: 1, y: 1, z: 1 };
export const DEFAULT_FURNITURE_ROTATION: IEulerRotation = { x: 0, y: 0, z: 0 };
export const DEFAULT_FURNITURE_STYLE_OPTIONS: Record<
  ParametricFurnitureCategory,
  Record<string, string>
> = {
  table: {},
  sofa: {},
  bed: {},
  storage: {},
  decor: {},
};

export function getMaterialPresetDefinition(
  preset: TMaterialPreset,
): IMaterialPresetDefinition {
  return (
    MATERIAL_PRESET_OPTIONS.find(
      (option: IMaterialPresetDefinition): boolean => option.id === preset,
    ) ?? MATERIAL_PRESET_OPTIONS[0]
  );
}

export function getMaterialPresetSwatch(preset: TMaterialPreset): string {
  return getMaterialPresetDefinition(preset).swatch;
}

export function clampBevel(value: number): number {
  return Number.isFinite(value)
    ? Math.min(MAX_BEVEL, Math.max(MIN_BEVEL, value))
    : 0;
}

export function clampTaper(value: number): number {
  return Number.isFinite(value)
    ? Math.min(MAX_TAPER, Math.max(MIN_TAPER, value))
    : 0;
}

export function inferMaterialFinish(
  roughness: number,
  metalness: number,
): TMaterialFinish {
  if (metalness >= 0.8) return "metallic";
  if (roughness <= 0.25) return "gloss";
  if (roughness >= 0.75) return "matte";
  return "satin";
}

export function createMaterialSlot(
  key: string,
  label: string,
  color: string,
  roughness: number,
  metalness: number,
): IWallMaterialSlot {
  return {
    key,
    label,
    color,
    finish: inferMaterialFinish(roughness, metalness),
    roughness,
    metalness,
  };
}

export function createFurnitureMaterialSlot(
  label: string,
  color: string,
  finish: TMaterialFinish,
): IMaterialSlot {
  return { label, color, finish };
}

export function getMaterialPbr(slot: IMaterialSlot): {
  roughness: number;
  metalness: number;
} {
  return FURNITURE_FINISH_PBR[slot.finish];
}

export function cloneFurniturePart(part: IFurniturePart): IFurniturePart {
  return {
    id: part.id,
    name: part.name,
    shape: part.shape,
    dimensions: { ...part.dimensions },
    position: { ...part.position },
    rotation: { ...part.rotation },
    bevel: part.bevel,
    taper: part.taper,
    materialPreset: part.materialPreset,
    color: part.color,
    sculpt: cloneFurniturePartSculpt(part.sculpt),
  };
}

export interface IFurniturePartStyleOptions {
  rotation?: IEulerRotation;
  bevel?: number;
  taper?: number;
  sculpt?: IFurniturePartSculpt;
}

export function createFurniturePart(
  id: string,
  name: string,
  shape: TPartShape,
  dimensions: IFurniturePartDimensions,
  position: IVector3D,
  materialPreset: TMaterialPreset = DEFAULT_MATERIAL_PRESET,
  color: string = getMaterialPresetSwatch(materialPreset),
  style: IFurniturePartStyleOptions = {},
): IFurniturePart {
  return cloneFurniturePart({
    id,
    name,
    shape,
    dimensions,
    position,
    rotation: style.rotation ?? { x: 0, y: 0, z: 0 },
    bevel: clampBevel(style.bevel ?? 0),
    taper: clampTaper(style.taper ?? 0),
    materialPreset,
    color,
    sculpt: cloneFurniturePartSculpt(style.sculpt),
  });
}

function buildMinimalistTableParts(): IFurniturePart[] {
  const legs: IFurniturePart[] = [];
  const corners: ReadonlyArray<readonly [number, number]> = [
    [-0.58, -0.28],
    [0.58, -0.28],
    [-0.58, 0.28],
    [0.58, 0.28],
  ];
  corners.forEach((corner: readonly [number, number], index: number): void => {
    legs.push(
      createFurniturePart(
        `table-leg-${index + 1}`,
        `Leg ${index + 1}`,
        "cylinder",
        { width: 0.075, height: 0.7, depth: 0.075 },
        { x: corner[0], y: 0.35, z: corner[1] },
        "walnut",
        "#5b3a26",
        { bevel: 0.08, taper: 0.3 },
      ),
    );
  });
  return [
    createFurniturePart(
      "table-top",
      "Solid Oak Top",
      "box",
      { width: 1.4, height: 0.06, depth: 0.8 },
      { x: 0, y: 0.73, z: 0 },
      "oak",
      "#b98a5a",
      { bevel: 0.1 },
    ),
    ...legs,
  ];
}

function buildLoungeChairParts(): IFurniturePart[] {
  const legs: IFurniturePart[] = [];
  const corners: ReadonlyArray<readonly [number, number]> = [
    [-0.22, -0.2],
    [0.22, -0.2],
    [-0.22, 0.2],
    [0.22, 0.2],
  ];
  corners.forEach((corner: readonly [number, number], index: number): void => {
    legs.push(
      createFurniturePart(
        `chair-leg-${index + 1}`,
        `Leg ${index + 1}`,
        "cylinder",
        { width: 0.045, height: 0.42, depth: 0.045 },
        { x: corner[0], y: 0.21, z: corner[1] },
        "brushed-brass",
        "#c9a227",
        { taper: 0.22 },
      ),
    );
  });
  return [
    createFurniturePart(
      "chair-seat",
      "Bouclé Seat",
      "box",
      { width: 0.56, height: 0.13, depth: 0.54 },
      { x: 0, y: 0.49, z: 0 },
      "boucle",
      "#d8cbbb",
      { bevel: 0.42 },
    ),
    createFurniturePart(
      "chair-back",
      "Bouclé Back",
      "box",
      { width: 0.56, height: 0.56, depth: 0.12 },
      { x: 0, y: 0.8, z: -0.22 },
      "boucle",
      "#d8cbbb",
      { bevel: 0.38, rotation: { x: -9, y: 0, z: 0 } },
    ),
    ...legs,
  ];
}

function buildPlushSofaParts(): IFurniturePart[] {
  const legs: IFurniturePart[] = [];
  const corners: ReadonlyArray<readonly [number, number]> = [
    [-0.82, -0.3],
    [0.82, -0.3],
    [-0.82, 0.3],
    [0.82, 0.3],
  ];
  corners.forEach((corner: readonly [number, number], index: number): void => {
    legs.push(
      createFurniturePart(
        `sofa-leg-${index + 1}`,
        `Leg ${index + 1}`,
        "cylinder",
        { width: 0.06, height: 0.16, depth: 0.06 },
        { x: corner[0], y: 0.08, z: corner[1] },
        "walnut",
        "#5b3a26",
        { taper: 0.24 },
      ),
    );
  });
  return [
    createFurniturePart(
      "sofa-base",
      "Plush Base",
      "box",
      { width: 2.0, height: 0.3, depth: 0.88 },
      { x: 0, y: 0.31, z: 0 },
      "boucle",
      "#cbbba9",
      { bevel: 0.3 },
    ),
    createFurniturePart(
      "sofa-back",
      "Plush Back",
      "box",
      { width: 2.0, height: 0.6, depth: 0.24 },
      { x: 0, y: 0.72, z: -0.36 },
      "boucle",
      "#cbbba9",
      { bevel: 0.4 },
    ),
    createFurniturePart(
      "sofa-cushion-left",
      "Left Cushion",
      "box",
      { width: 0.88, height: 0.18, depth: 0.68 },
      { x: -0.44, y: 0.53, z: 0.04 },
      "boucle",
      "#ddd0c0",
      { bevel: 0.48 },
    ),
    createFurniturePart(
      "sofa-cushion-right",
      "Right Cushion",
      "box",
      { width: 0.88, height: 0.18, depth: 0.68 },
      { x: 0.44, y: 0.53, z: 0.04 },
      "boucle",
      "#ddd0c0",
      { bevel: 0.48 },
    ),
    createFurniturePart(
      "sofa-arm-left",
      "Left Arm",
      "box",
      { width: 0.2, height: 0.48, depth: 0.88 },
      { x: -0.9, y: 0.55, z: 0 },
      "boucle",
      "#cbbba9",
      { bevel: 0.34 },
    ),
    createFurniturePart(
      "sofa-arm-right",
      "Right Arm",
      "box",
      { width: 0.2, height: 0.48, depth: 0.88 },
      { x: 0.9, y: 0.55, z: 0 },
      "boucle",
      "#cbbba9",
      { bevel: 0.34 },
    ),
    ...legs,
  ];
}

function buildCredenzaParts(): IFurniturePart[] {
  const legs: IFurniturePart[] = [];
  const corners: ReadonlyArray<readonly [number, number]> = [
    [-0.68, -0.16],
    [0.68, -0.16],
    [-0.68, 0.16],
    [0.68, 0.16],
  ];
  corners.forEach((corner: readonly [number, number], index: number): void => {
    legs.push(
      createFurniturePart(
        `credenza-leg-${index + 1}`,
        `Leg ${index + 1}`,
        "cylinder",
        { width: 0.05, height: 0.26, depth: 0.05 },
        { x: corner[0], y: 0.13, z: corner[1] },
        "brushed-brass",
        "#c9a227",
        { taper: 0.34 },
      ),
    );
  });
  return [
    createFurniturePart(
      "credenza-body",
      "Walnut Carcass",
      "box",
      { width: 1.6, height: 0.62, depth: 0.44 },
      { x: 0, y: 0.57, z: 0 },
      "walnut",
      "#4a2f21",
      { bevel: 0.06 },
    ),
    createFurniturePart(
      "credenza-door-left",
      "Left Door",
      "box",
      { width: 0.76, height: 0.54, depth: 0.02 },
      { x: -0.39, y: 0.57, z: 0.23 },
      "oak",
      "#a9794d",
      { bevel: 0.03 },
    ),
    createFurniturePart(
      "credenza-door-right",
      "Right Door",
      "box",
      { width: 0.76, height: 0.54, depth: 0.02 },
      { x: 0.39, y: 0.57, z: 0.23 },
      "oak",
      "#a9794d",
      { bevel: 0.03 },
    ),
    createFurniturePart(
      "credenza-pull-left",
      "Left Pull",
      "cylinder",
      { width: 0.018, height: 0.16, depth: 0.018 },
      { x: -0.06, y: 0.57, z: 0.25 },
      "brushed-brass",
      "#d4b13b",
      { bevel: 0.12 },
    ),
    createFurniturePart(
      "credenza-pull-right",
      "Right Pull",
      "cylinder",
      { width: 0.018, height: 0.16, depth: 0.018 },
      { x: 0.06, y: 0.57, z: 0.25 },
      "brushed-brass",
      "#d4b13b",
      { bevel: 0.12 },
    ),
    ...legs,
  ];
}

export const FURNITURE_PRESETS: readonly IFurnitureBlueprint[] = [
  {
    id: "preset-minimalist-table",
    userId: null,
    name: "Minimalist Table",
    category: "tables",
    isPreset: true,
    parts: buildMinimalistTableParts(),
    materials: {},
  },
  {
    id: "preset-lounge-chair",
    userId: null,
    name: "Lounge Chair",
    category: "seating",
    isPreset: true,
    parts: buildLoungeChairParts(),
    materials: {},
  },
  {
    id: "preset-plush-sofa",
    userId: null,
    name: "Plush Sofa",
    category: "seating",
    isPreset: true,
    parts: buildPlushSofaParts(),
    materials: {},
  },
  {
    id: "preset-credenza",
    userId: null,
    name: "Credenza",
    category: "storage",
    isPreset: true,
    parts: buildCredenzaParts(),
    materials: {},
  },
  {
    id: "preset-blank",
    userId: null,
    name: "Blank",
    category: "decor",
    isPreset: true,
    parts: [],
    materials: {},
  },
];

export function cloneBlueprint(
  blueprint: IFurnitureBlueprint,
  id: string = blueprint.id,
): IFurnitureBlueprint {
  return {
    id,
    userId: null,
    name: blueprint.name,
    category: blueprint.category,
    isPreset: false,
    thumbnailDataUrl: blueprint.thumbnailDataUrl,
    parts: blueprint.parts.map((part: IFurniturePart): IFurniturePart =>
      cloneFurniturePart(part),
    ),
    materials: Object.fromEntries(
      Object.entries(blueprint.materials).map(
        ([key, slot]: [string, IMaterialSlot]): [string, IMaterialSlot] => [
          key,
          { ...slot },
        ],
      ),
    ),
  };
}

export function createBlankBlueprint(id: string): IFurnitureBlueprint {
  return {
    id,
    userId: null,
    name: "Untitled Piece",
    category: "decor",
    isPreset: false,
    parts: [],
    materials: {},
  };
}

export function createPlacedFurnitureFromBlueprint(
  blueprint: IFurnitureBlueprint,
  instanceId: string,
  position: IVector3D,
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

export function getBlueprintBounds(
  parts: readonly IFurniturePart[],
): IFurniturePartDimensions {
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

export function createDefaultFurnitureMaterials(
  category: ParametricFurnitureCategory,
): Record<string, IMaterialSlot> {
  const blueprint: IFurnitureBlueprint =
    FURNITURE_PRESETS.find(
      (preset: IFurnitureBlueprint) =>
        preset.category === LEGACY_CATEGORY_TO_BLUEPRINT_CATEGORY[category],
    ) ?? FURNITURE_PRESETS[0];
  return Object.fromEntries(
    Object.entries(blueprint.materials).map(
      ([key, slot]: [string, IMaterialSlot]): [string, IMaterialSlot] => [
        key,
        { ...slot },
      ],
    ),
  );
}

export function createDefaultParametricFurniture(
  category: ParametricFurnitureCategory,
  id: string,
  position: { x: number; y: number; z: number },
): IParametricFurniture {
  const blueprint: IFurnitureBlueprint =
    FURNITURE_PRESETS.find(
      (preset: IFurnitureBlueprint) =>
        preset.category === LEGACY_CATEGORY_TO_BLUEPRINT_CATEGORY[category],
    ) ?? FURNITURE_PRESETS[0];
  return {
    ...createPlacedFurnitureFromBlueprint(blueprint, id, position),
    category,
  };
}

export const LEGACY_CATEGORY_TO_BLUEPRINT_CATEGORY: Record<
  ParametricFurnitureCategory,
  TFurnitureCategory
> = {
  table: "tables",
  sofa: "seating",
  bed: "beds",
  storage: "storage",
  decor: "decor",
};
