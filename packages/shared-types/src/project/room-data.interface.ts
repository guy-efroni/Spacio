import { WallSegment } from '../geometry/wall.interface';
import { PlacedObject } from '../furniture/placed-object.interface';

export interface RoomData {
  version: string;
  name: string;
  walls: WallSegment[];
  objects: PlacedObject[];
  updatedAt: number;
}
