import { WallOpeningType } from '../enums/wall-opening-type.enum';
import { IMaterialSlot } from '../furniture/material-slot.interface';

export interface IWallOpening {
  id: string;
  wallId: string;
  type: WallOpeningType;
  positionAlongWall: number;
  width: number;
  height: number;
  elevation: number;
  materials: Record<string, IMaterialSlot>;
  styleOptions: Record<string, string>;
}