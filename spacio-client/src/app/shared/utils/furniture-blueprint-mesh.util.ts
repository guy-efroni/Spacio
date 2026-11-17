import * as THREE from 'three';
import { FURNITURE_USER_DATA_TYPE, getMaterialPbr, IFurniturePart, IMaterialSlot, IPlacedFurniture } from '@spacio/shared-types';

const DEFAULT_SLOT_COLOR: string = '#c8c8d0';
const CYLINDER_SEGMENTS: number = 24;
const SPHERE_WIDTH_SEGMENTS: number = 24;
const SPHERE_HEIGHT_SEGMENTS: number = 16;
const CAPSULE_CAP_SEGMENTS: number = 8;
const CAPSULE_RADIAL_SEGMENTS: number = 16;

export function createFurnitureMaterial(slot: IMaterialSlot): THREE.MeshStandardMaterial {
  const pbr: { roughness: number; metalness: number } = getMaterialPbr(slot);
  const material: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(slot.color),
    roughness: pbr.roughness,
    metalness: pbr.metalness,
    emissive: 0x000000,
    emissiveIntensity: 0,
  });
  material.name = slot.label;
  return material;
}

export function createPartGeometry(part: IFurniturePart): { geometry: THREE.BufferGeometry; scale: THREE.Vector3 } {
  const { width, height, depth }: { width: number; height: number; depth: number } = part.dimensions;
  const safeWidth: number = Math.max(width, 0.001);
  const safeHeight: number = Math.max(height, 0.001);
  const safeDepth: number = Math.max(depth, 0.001);

  if (part.shape === 'cylinder') {
    const radius: number = safeWidth / 2;
    return {
      geometry: new THREE.CylinderGeometry(radius, radius, safeHeight, CYLINDER_SEGMENTS),
      scale: new THREE.Vector3(1, 1, safeDepth / safeWidth),
    };
  }
  if (part.shape === 'sphere') {
    const radius: number = Math.max(safeWidth, safeHeight, safeDepth) / 2;
    return {
      geometry: new THREE.SphereGeometry(radius, SPHERE_WIDTH_SEGMENTS, SPHERE_HEIGHT_SEGMENTS),
      scale: new THREE.Vector3(safeWidth / (radius * 2), safeHeight / (radius * 2), safeDepth / (radius * 2)),
    };
  }
  if (part.shape === 'capsule') {
    const radius: number = Math.min(safeWidth, safeDepth) / 2;
    const length: number = Math.max(0.001, safeHeight - radius * 2);
    return {
      geometry: new THREE.CapsuleGeometry(radius, length, CAPSULE_CAP_SEGMENTS, CAPSULE_RADIAL_SEGMENTS),
      scale: new THREE.Vector3(safeWidth / (radius * 2), 1, safeDepth / (radius * 2)),
    };
  }
  return {
    geometry: new THREE.BoxGeometry(safeWidth, safeHeight, safeDepth),
    scale: new THREE.Vector3(1, 1, 1),
  };
}

export function buildFurnitureGroupFromBlueprint(parts: readonly IFurniturePart[], materials: Record<string, IMaterialSlot>): THREE.Group {
  const group: THREE.Group = new THREE.Group();
  const body: THREE.Group = new THREE.Group();
  body.name = 'blueprint-body';
  const materialCache: Map<string, THREE.MeshStandardMaterial> = new Map<string, THREE.MeshStandardMaterial>();

  for (const part of parts) {
    const slot: IMaterialSlot | undefined = materials[part.materialSlot];
    let material: THREE.MeshStandardMaterial | undefined = materialCache.get(part.materialSlot);
    if (!material) {
      material = createFurnitureMaterial(slot ?? { label: part.materialSlot, color: DEFAULT_SLOT_COLOR, finish: 'satin' });
      material.name = part.materialSlot;
      materialCache.set(part.materialSlot, material);
    }

    const { geometry, scale }: { geometry: THREE.BufferGeometry; scale: THREE.Vector3 } = createPartGeometry(part);
    const mesh: THREE.Mesh = new THREE.Mesh(geometry, material);
    mesh.name = part.id;
    mesh.position.set(part.position.x, part.position.y, part.position.z);
    mesh.rotation.set(
      THREE.MathUtils.degToRad(part.rotation.x),
      THREE.MathUtils.degToRad(part.rotation.y),
      THREE.MathUtils.degToRad(part.rotation.z)
    );
    mesh.scale.copy(scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { type: 'furniture-part', partId: part.id };
    body.add(mesh);
  }

  body.updateMatrixWorld(true);
  const bounds: THREE.Box3 = new THREE.Box3().setFromObject(body);
  if (!bounds.isEmpty() && Number.isFinite(bounds.min.y)) {
    body.position.y = -bounds.min.y;
  }
  group.add(body);
  group.userData = { partIds: parts.map((part: IFurniturePart): string => part.id) };
  return group;
}

export interface IGeneratedFurniture {
  group: THREE.Group;
  dispose: () => void;
}

export function disposeObject3D(root: THREE.Object3D): void {
  const disposedMaterials: Set<THREE.Material> = new Set<THREE.Material>();
  root.traverse((object: THREE.Object3D): void => {
    const mesh: THREE.Mesh = object as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const material: THREE.Material | THREE.Material[] | undefined = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (!material) return;
    const materials: THREE.Material[] = Array.isArray(material) ? material : [material];
    for (const item of materials) {
      if (!disposedMaterials.has(item)) {
        disposedMaterials.add(item);
        item.dispose();
      }
    }
  });
}

export function buildPlacedFurniture(item: IPlacedFurniture): IGeneratedFurniture {
  const group: THREE.Group = buildFurnitureGroupFromBlueprint(item.parts, item.materials);
  group.name = item.id;
  group.userData = {
    type: FURNITURE_USER_DATA_TYPE,
    id: item.id,
    blueprintId: item.blueprintId,
  };
  group.position.set(item.position.x, item.position.y, item.position.z);
  group.rotation.set(
    THREE.MathUtils.degToRad(item.rotation.x),
    THREE.MathUtils.degToRad(item.rotation.y),
    THREE.MathUtils.degToRad(item.rotation.z)
  );
  group.scale.set(item.scale.x, item.scale.y, item.scale.z);
  group.traverse((object: THREE.Object3D): void => {
    object.frustumCulled = false;
  });
  group.updateMatrixWorld(true);
  return { group, dispose: (): void => disposeObject3D(group) };
}
