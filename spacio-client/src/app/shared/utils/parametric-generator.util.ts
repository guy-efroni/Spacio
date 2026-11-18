import * as THREE from 'three';
import { IMaterialSlot } from '@spacio/shared-types';
import { createFurnitureMaterial } from '../../core/3d/furniture-mesh.builder';

export {
  createFurnitureMaterial,
  buildFurnitureMesh,
  buildFurnitureMesh as buildFurnitureGroupFromBlueprint,
  disposeFurnitureGroup,
  disposeFurnitureGroup as disposeObject3D,
} from '../../core/3d/furniture-mesh.builder';

export function createMaterialFromSlot(slot: IMaterialSlot): THREE.MeshStandardMaterial {
  return createFurnitureMaterial(slot);
}
