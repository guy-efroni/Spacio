import { IEulerRotation } from '../geometry/euler-rotation.interface';
import { IVector3D } from '../geometry/vector3d.interface';

export type TPartShape =
  | 'box'
  | 'rounded-box'
  | 'cylinder'
  | 'sphere'
  | 'capsule'
  | 'cone'
  | 'torus'
  | 'extrude-2d'
  | 'lathe-360'
  | 'tube-path';

export interface IFurniturePoint2D {
  x: number;
  y: number;
  smooth?: boolean;
}

export interface IFurniturePoint3D {
  x: number;
  y: number;
  z: number;
}

export interface IFurniturePartShapeParameters {
  bevelRadius?: number;
  points2D?: IFurniturePoint2D[];
  pathPoints3D?: IFurniturePoint3D[];
  tubeRadius?: number;
}

export interface IFurniturePart extends IFurniturePartShapeParameters {
  id: string;
  name: string;
  shape: TPartShape;
  dimensions: { width: number; height: number; depth: number };
  position: IVector3D;
  rotation: IEulerRotation;
  materialSlot: string;
}
