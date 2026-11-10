export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface EulerRotation {
  x: number;
  y: number;
  z: number;
}

export interface SceneObjectTransform {
  position: Vector3D;
  rotation: EulerRotation;
  scale: Vector3D;
}

export interface PlacedObject {
  id: string;
  modelId: string;
  transform: SceneObjectTransform;
}

export interface WallSegment {
  id: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  height: number;
  thickness: number;
}

export interface RoomData {
  version: string;
  name: string;
  walls: WallSegment[];
  objects: PlacedObject[];
  updatedAt: number;
}