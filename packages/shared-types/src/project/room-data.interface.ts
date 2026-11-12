import { IWallSegment } from '../geometry/wall.interface';
import { IPlacedObject } from '../furniture/placed-object.interface';

export interface IRoomData {
  version: string;
  name: string;
  walls: IWallSegment[];
  objects: IPlacedObject[];
  updatedAt: number;
}
