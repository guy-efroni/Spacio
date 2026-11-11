import { Vector3D } from '../geometry/vector3d.interface';
import { EulerRotation } from '../geometry/euler-rotation.interface';

export interface SceneObjectTransform {
  position: Vector3D;
  rotation: EulerRotation;
  scale: Vector3D;
}
