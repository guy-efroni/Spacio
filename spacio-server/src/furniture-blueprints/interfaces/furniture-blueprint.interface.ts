export type TPartShape = 'box' | 'cylinder' | 'sphere' | 'capsule';
export type TMaterialFinish = 'matte' | 'satin' | 'gloss' | 'metallic';
export type TFurnitureCategory =
  'tables' | 'seating' | 'beds' | 'storage' | 'decor';

export interface IVector3D {
  x: number;
  y: number;
  z: number;
}

export interface IFurniturePart {
  id: string;
  name: string;
  shape: TPartShape;
  dimensions: { width: number; height: number; depth: number };
  position: IVector3D;
  rotation: IVector3D;
  materialSlot: string;
}

export interface IMaterialSlot {
  label: string;
  color: string;
  finish: TMaterialFinish;
  key?: string;
  roughness?: number;
  metalness?: number;
}

export interface IFurnitureBlueprint {
  id: string;
  name: string;
  category: TFurnitureCategory;
  isPreset: boolean;
  thumbnailDataUrl?: string;
  parts: IFurniturePart[];
  materials: Record<string, IMaterialSlot>;
}
