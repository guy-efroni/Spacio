import { IPlacedFurniture } from './placed-furniture.interface';

export type ParametricFurnitureCategory = 'table' | 'sofa' | 'bed' | 'storage' | 'decor';

export interface IParametricFurniture extends IPlacedFurniture {
  category: ParametricFurnitureCategory;
}
