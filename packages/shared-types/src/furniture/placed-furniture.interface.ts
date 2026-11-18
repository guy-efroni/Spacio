import { IVector3D } from '../geometry/vector3d.interface';
import { IMaterialSlot } from './material-slot.interface';

export interface IPlacedFurniture {
  instanceId: string;
  blueprintId: string;
  blueprintName: string;
  position: IVector3D;
  rotationY: number;
  scale: IVector3D;
  materialOverrides?: Record<string, IMaterialSlot>;
}
