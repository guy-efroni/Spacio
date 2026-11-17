import { IFurniturePart } from './furniture-part.interface';
import { IMaterialSlot } from './material-slot.interface';

export type TFurnitureCategory = 'tables' | 'seating' | 'beds' | 'storage' | 'decor';

export interface IFurnitureBlueprint {
  id: string;
  name: string;
  category: TFurnitureCategory;
  isPreset: boolean;
  thumbnailDataUrl?: string;
  parts: IFurniturePart[];
  materials: Record<string, IMaterialSlot>;
}
