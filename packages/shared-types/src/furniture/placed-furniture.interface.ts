import { IEulerRotation } from '../geometry/euler-rotation.interface';
import { IVector3D } from '../geometry/vector3d.interface';
import { IFurniturePart } from './furniture-part.interface';
import { IMaterialSlot } from './material-slot.interface';

export interface IPlacedFurniture {
  id: string;
  blueprintId: string;
  name: string;
  parts: IFurniturePart[];
  materials: Record<string, IMaterialSlot>;
  scale: IVector3D;
  position: IVector3D;
  rotation: IEulerRotation;
}
