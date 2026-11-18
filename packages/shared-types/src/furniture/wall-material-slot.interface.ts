import { IMaterialSlot } from './material-slot.interface';

export interface IWallMaterialSlot extends IMaterialSlot {
  key?: string;
  roughness: number;
  metalness: number;
}
