import { WallOpeningType } from '../enums/wall-opening-type.enum';
import { IWallMaterialSlot } from '../furniture/wall-material-slot.interface';

export interface IWallOpening {
  id: string;
  wallId: string;
  type: WallOpeningType;
  positionAlongWall: number;
  width: number;
  height: number;
  elevation: number;
  materials: Record<string, IWallMaterialSlot>;
  styleOptions: Record<string, string>;
}