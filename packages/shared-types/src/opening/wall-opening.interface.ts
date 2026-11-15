import { WallOpeningType } from '../enums/wall-opening-type.enum';

export interface IWallOpening {
  id: string;
  wallId: string;
  type: WallOpeningType;
  positionAlongWall: number;
  width: number;
  height: number;
  elevation: number;
}