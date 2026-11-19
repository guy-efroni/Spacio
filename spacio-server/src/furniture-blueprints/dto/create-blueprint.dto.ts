import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsHexColor,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import type {
  IFurnitureBlueprint,
  IFurniturePart,
  IFurniturePartSculpt,
  ISculptPoint,
  TMaterialFinish,
  TMaterialPreset,
  TFurnitureCategory,
  TPartShape,
  TSculptMode,
  TSculptPointKind,
} from '../interfaces/furniture-blueprint.interface';

const PART_SHAPES: readonly TPartShape[] = [
  'box',
  'cylinder',
  'capsule',
  'cone',
  'torus',
  'extrude-2d',
  'lathe-360',
];

const SCULPT_MODES: readonly TSculptMode[] = ['extrude', 'lathe'];
const SCULPT_POINT_KINDS: readonly TSculptPointKind[] = ['sharp', 'smooth'];

const MATERIAL_PRESETS: readonly TMaterialPreset[] = [
  'oak',
  'walnut',
  'boucle',
  'leather',
  'brushed-brass',
  'matte-metal',
  'travertine',
  'glass',
];

const MATERIAL_FINISHES: readonly TMaterialFinish[] = [
  'matte',
  'satin',
  'gloss',
  'metallic',
  'glass',
];

const FURNITURE_CATEGORIES: readonly TFurnitureCategory[] = [
  'tables',
  'seating',
  'beds',
  'storage',
  'decor',
];

export class Vector3Dto {
  @IsNumber() x: number;
  @IsNumber() y: number;
  @IsNumber() z: number;
}

export class PartDimensionsDto {
  @IsNumber() @Min(0.001) width: number;
  @IsNumber() @Min(0.001) height: number;
  @IsNumber() @Min(0.001) depth: number;
}

export class SculptPointDto implements ISculptPoint {
  @IsNumber() @Min(0) @Max(1) x: number;
  @IsNumber() @Min(0) @Max(1) y: number;
  @IsIn(SCULPT_POINT_KINDS) kind: TSculptPointKind;
}

export class FurniturePartSculptDto implements IFurniturePartSculpt {
  @IsIn(SCULPT_MODES) mode: TSculptMode;
  @IsBoolean() closed: boolean;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SculptPointDto)
  points: SculptPointDto[];
}

export class FurniturePartDto implements IFurniturePart {
  @IsString() id: string;
  @IsString() name: string;
  @IsIn(PART_SHAPES) shape: TPartShape;
  @ValidateNested()
  @Type(() => PartDimensionsDto)
  dimensions: PartDimensionsDto;
  @ValidateNested() @Type(() => Vector3Dto) position: Vector3Dto;
  @ValidateNested() @Type(() => Vector3Dto) rotation: Vector3Dto;
  @IsNumber() @Min(0) @Max(1) bevel: number;
  @IsNumber() @Min(-0.5) @Max(0.5) taper: number;
  @IsIn(MATERIAL_PRESETS) materialPreset: TMaterialPreset;
  @IsHexColor() color: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => FurniturePartSculptDto)
  sculpt?: FurniturePartSculptDto;
}

export class MaterialSlotDto {
  @IsString() label: string;
  @IsString() color: string;
  @IsIn(MATERIAL_FINISHES) finish: TMaterialFinish;
}

export class BlueprintDefinitionDto {
  @IsString() name: string;
  @IsIn(FURNITURE_CATEGORIES)
  category: TFurnitureCategory;
  @IsBoolean() isPreset: boolean;
  @IsOptional() @IsString() thumbnailDataUrl?: string;
  @ValidateNested({ each: true })
  @Type(() => FurniturePartDto)
  parts: FurniturePartDto[];
  @IsObject()
  materials: Record<string, MaterialSlotDto>;
}

export class CreateBlueprintDto extends BlueprintDefinitionDto {}

export class UpdateBlueprintDto extends BlueprintDefinitionDto {}

function toFurniturePartSculpt(
  sculpt: FurniturePartSculptDto | undefined,
): IFurniturePartSculpt | undefined {
  if (!sculpt) return undefined;
  return {
    mode: sculpt.mode,
    closed: sculpt.closed,
    points: sculpt.points.map((point: SculptPointDto): ISculptPoint => ({
      ...point,
    })),
  };
}

function toFurniturePart(dto: FurniturePartDto): IFurniturePart {
  return {
    id: dto.id,
    name: dto.name,
    shape: dto.shape,
    dimensions: { ...dto.dimensions },
    position: { ...dto.position },
    rotation: { ...dto.rotation },
    bevel: dto.bevel,
    taper: dto.taper,
    materialPreset: dto.materialPreset,
    color: dto.color,
    sculpt: toFurniturePartSculpt(dto.sculpt),
  };
}

export function toBlueprintDefinition(
  dto: BlueprintDefinitionDto,
): IFurnitureBlueprint {
  return {
    id: '',
    userId: null,
    name: dto.name,
    category: dto.category,
    isPreset: false,
    thumbnailDataUrl: dto.thumbnailDataUrl,
    parts: dto.parts.map(toFurniturePart),
    materials: Object.fromEntries(
      Object.entries(dto.materials).map(
        ([key, slot]: [string, MaterialSlotDto]): [string, MaterialSlotDto] => [
          key,
          { ...slot },
        ],
      ),
    ),
  };
}
