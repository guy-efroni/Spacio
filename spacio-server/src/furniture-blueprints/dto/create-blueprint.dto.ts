import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import type {
  IFurnitureBlueprint,
  TMaterialFinish,
  TFurnitureCategory,
  TPartShape,
} from '../interfaces/furniture-blueprint.interface';

export class Vector3Dto {
  @IsNumber() x: number;
  @IsNumber() y: number;
  @IsNumber() z: number;
}

export class PartDimensionsDto {
  @IsNumber() width: number;
  @IsNumber() height: number;
  @IsNumber() depth: number;
}

export class FurniturePartDto {
  @IsString() id: string;
  @IsString() name: string;
  @IsEnum(['box', 'cylinder', 'sphere', 'capsule'] as const) shape: TPartShape;
  @ValidateNested()
  @Type(() => PartDimensionsDto)
  dimensions: PartDimensionsDto;
  @ValidateNested() @Type(() => Vector3Dto) position: Vector3Dto;
  @ValidateNested() @Type(() => Vector3Dto) rotation: Vector3Dto;
  @IsString() materialSlot: string;
}

export class MaterialSlotDto {
  @IsString() label: string;
  @IsString() color: string;
  @IsEnum(['matte', 'satin', 'gloss', 'metallic'] as const)
  finish: TMaterialFinish;
}

export class BlueprintDefinitionDto {
  @IsString() name: string;
  @IsEnum(['tables', 'seating', 'beds', 'storage', 'decor'] as const)
  category: TFurnitureCategory;
  @IsBoolean() isPreset: boolean;
  @IsOptional() @IsString() thumbnailDataUrl?: string;
  @ValidateNested({ each: true })
  @Type(() => FurniturePartDto)
  parts: FurniturePartDto[];
  @IsObject()
  @ValidateNested({ each: true })
  @Type(() => MaterialSlotDto)
  materials: Record<string, MaterialSlotDto>;
}

export class CreateBlueprintDto extends BlueprintDefinitionDto {}

export class UpdateBlueprintDto extends BlueprintDefinitionDto {}

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
    parts: dto.parts.map((part: FurniturePartDto) => ({
      id: part.id,
      name: part.name,
      shape: part.shape,
      dimensions: { ...part.dimensions },
      position: { ...part.position },
      rotation: { ...part.rotation },
      materialSlot: part.materialSlot,
    })),
    materials: Object.fromEntries(
      Object.entries(dto.materials).map(
        ([key, slot]: [string, MaterialSlotDto]) => [key, { ...slot }],
      ),
    ),
  };
}
