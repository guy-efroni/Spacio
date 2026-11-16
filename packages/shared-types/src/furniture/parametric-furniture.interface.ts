import { IMaterialSlot } from './material-slot.interface';

export type ParametricFurnitureCategory = 'table' | 'sofa' | 'bed' | 'storage';

export interface IParametricFurniture {
  id: string;
  category: ParametricFurnitureCategory;
  position: { x: number; y: number; z: number };
  rotationY: number;
  dimensions: { width: number; height: number; depth: number };
  styleOptions: Record<string, string>;
  materials: Record<string, IMaterialSlot>;
}
