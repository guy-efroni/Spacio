import { IEulerRotation } from '../geometry/euler-rotation.interface';
import { IVector3D } from '../geometry/vector3d.interface';

export type TPartShape = 'box' | 'cylinder' | 'sphere' | 'capsule';

export interface IFurniturePart {
  id: string;
  name: string;
  shape: TPartShape;
  dimensions: { width: number; height: number; depth: number };
  position: IVector3D;
  rotation: IEulerRotation;
  materialSlot: string;
}
