import * as THREE from 'three';
import { IMaterialSlot, IPlacedFurniture } from '@spacio/shared-types';
import {
  IGeneratedFurniture,
  buildPlacedFurniture,
  createFurnitureMaterial,
  disposeObject3D,
} from './furniture-blueprint-mesh.util';

export type { IGeneratedFurniture } from './furniture-blueprint-mesh.util';
export { disposeObject3D } from './furniture-blueprint-mesh.util';
export {
  buildFurnitureGroupFromBlueprint,
  buildPlacedFurniture,
  createFurnitureMaterial,
  createPartGeometry,
} from './furniture-blueprint-mesh.util';

export interface IGeneratedOpeningMeshes {
  group: THREE.Group;
  dispose: () => void;
}

export function createMaterialFromSlot(slot: IMaterialSlot): THREE.MeshStandardMaterial {
  return createFurnitureMaterial(slot);
}

export function buildParametricFurniture(item: IPlacedFurniture): IGeneratedFurniture {
  return buildPlacedFurniture(item);
}
