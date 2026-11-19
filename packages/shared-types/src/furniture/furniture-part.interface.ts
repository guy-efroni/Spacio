import { IEulerRotation } from "../geometry/euler-rotation.interface";
import { IVector3D } from "../geometry/vector3d.interface";

export type TPartShape =
  | "box"
  | "cylinder"
  | "capsule"
  | "cone"
  | "torus"
  | "extrude-2d"
  | "lathe-360";

export type TSculptMode = "extrude" | "lathe";

export type TSculptPointKind = "sharp" | "smooth";

export type TSculptPresetId =
  "rectangle" | "l-shape" | "arch" | "kidney" | "pill" | "turned-leg";

export interface ISculptPoint {
  x: number;
  y: number;
  kind: TSculptPointKind;
}

export interface IFurniturePartSculpt {
  mode: TSculptMode;
  points: ISculptPoint[];
  closed: boolean;
}

export type TMaterialPreset =
  | "oak"
  | "walnut"
  | "boucle"
  | "leather"
  | "brushed-brass"
  | "matte-metal"
  | "travertine"
  | "glass";

export interface IFurniturePartDimensions {
  width: number;
  height: number;
  depth: number;
}

export interface IFurniturePart {
  id: string;
  name: string;
  shape: TPartShape;
  dimensions: IFurniturePartDimensions;
  position: IVector3D;
  rotation: IEulerRotation;
  bevel: number;
  taper: number;
  materialPreset: TMaterialPreset;
  color: string;
  sculpt?: IFurniturePartSculpt;
}

export interface IFurniturePartMaterialOverride {
  color?: string;
  materialPreset?: TMaterialPreset;
}
