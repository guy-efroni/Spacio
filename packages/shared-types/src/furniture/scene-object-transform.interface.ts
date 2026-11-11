import { IVector3D } from '../geometry/vector3d.interface';
import { IEulerRotation } from '../geometry/euler-rotation.interface';

export interface ISceneObjectTransform {
  position: IVector3D;
  rotation: IEulerRotation;
  scale: IVector3D;
}
