import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import type {
  IFurnitureBlueprint,
  IFurniturePart,
  IFurniturePoint2D,
  IFurniturePoint3D,
  TMaterialFinish,
  TFurnitureCategory,
  TPartShape,
} from '../interfaces/furniture-blueprint.interface';

const PART_SHAPES: readonly TPartShape[] = [
  'box',
  'rounded-box',
  'cylinder',
  'sphere',
  'capsule',
  'cone',
  'torus',
  'extrude-2d',
  'lathe-360',
  'tube-path',
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

export class FurniturePoint2DDto implements IFurniturePoint2D {
  @IsNumber() x: number;
  @IsNumber() y: number;
  @IsOptional() @IsBoolean() smooth?: boolean;
}

export class FurniturePoint3DDto implements IFurniturePoint3D {
  @IsNumber() x: number;
  @IsNumber() y: number;
  @IsNumber() z: number;
}

export class PartDimensionsDto {
  @IsNumber() width: number;
  @IsNumber() height: number;
  @IsNumber() depth: number;
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
  @IsString() materialSlot: string;
  @IsOptional() @IsNumber() bevelRadius?: number;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FurniturePoint2DDto)
  points2D?: FurniturePoint2DDto[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FurniturePoint3DDto)
  pathPoints3D?: FurniturePoint3DDto[];
  @IsOptional() @IsNumber() tubeRadius?: number;
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

function toFurniturePart(dto: FurniturePartDto): IFurniturePart {
  return {
    id: dto.id,
    name: dto.name,
    shape: dto.shape,
    dimensions: { ...dto.dimensions },
    position: { ...dto.position },
    rotation: { ...dto.rotation },
    materialSlot: dto.materialSlot,
    ...(dto.bevelRadius === undefined ? {} : { bevelRadius: dto.bevelRadius }),
    ...(dto.points2D === undefined
      ? {}
      : {
          points2D: dto.points2D.map(
            (point: FurniturePoint2DDto): IFurniturePoint2D => ({ ...point }),
          ),
        }),
    ...(dto.pathPoints3D === undefined
      ? {}
      : {
          pathPoints3D: dto.pathPoints3D.map(
            (point: FurniturePoint3DDto): IFurniturePoint3D => ({ ...point }),
          ),
        }),
    ...(dto.tubeRadius === undefined ? {} : { tubeRadius: dto.tubeRadius }),
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
