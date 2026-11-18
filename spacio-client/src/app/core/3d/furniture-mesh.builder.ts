import * as THREE from 'three';
import {
  FURNITURE_FINISH_PBR,
  FURNITURE_USER_DATA_TYPE,
  IFurniturePart,
  IMaterialSlot,
} from '@spacio/shared-types';

const DEFAULT_SLOT_COLOR: string = '#c8c8d0';
const CYLINDER_SEGMENTS: number = 24;
const SPHERE_WIDTH_SEGMENTS: number = 24;
const SPHERE_HEIGHT_SEGMENTS: number = 16;
const CAPSULE_CAP_SEGMENTS: number = 8;
const CAPSULE_RADIAL_SEGMENTS: number = 16;

export interface IBuildFurnitureMeshOptions {
  ground?: boolean;
}

export function createFurnitureMaterial(slot: IMaterialSlot): THREE.MeshStandardMaterial {
  const pbr: { roughness: number; metalness: number } = FURNITURE_FINISH_PBR[slot.finish];
  const material: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(slot.color),
    roughness: pbr.roughness,
    metalness: pbr.metalness,
  });
  material.name = slot.label;
  return material;
}

function createPartGeometry(part: IFurniturePart): { geometry: THREE.BufferGeometry; scale: THREE.Vector3 } {
  const width: number = Math.max(part.dimensions.width, 0.001);
  const height: number = Math.max(part.dimensions.height, 0.001);
  const depth: number = Math.max(part.dimensions.depth, 0.001);

  if (part.shape === 'cylinder') {
    const radius: number = width / 2;
    return {
      geometry: new THREE.CylinderGeometry(radius, radius, height, CYLINDER_SEGMENTS),
      scale: new THREE.Vector3(1, 1, depth / width),
    };
  }

  if (part.shape === 'sphere') {
    const radius: number = Math.max(width, height, depth) / 2;
    return {
      geometry: new THREE.SphereGeometry(radius, SPHERE_WIDTH_SEGMENTS, SPHERE_HEIGHT_SEGMENTS),
      scale: new THREE.Vector3(width / (radius * 2), height / (radius * 2), depth / (radius * 2)),
    };
  }

  if (part.shape === 'capsule') {
    const radius: number = Math.min(width, depth) / 2;
    const length: number = Math.max(0.001, height - radius * 2);
    return {
      geometry: new THREE.CapsuleGeometry(radius, length, CAPSULE_CAP_SEGMENTS, CAPSULE_RADIAL_SEGMENTS),
      scale: new THREE.Vector3(width / (radius * 2), 1, depth / (radius * 2)),
    };
  }

  return {
    geometry: new THREE.BoxGeometry(width, height, depth),
    scale: new THREE.Vector3(1, 1, 1),
  };
}

export function buildFurnitureMesh(
  parts: readonly IFurniturePart[],
  materials: Record<string, IMaterialSlot>,
  options: IBuildFurnitureMeshOptions = {}
): THREE.Group {
  const group: THREE.Group = new THREE.Group();
  group.name = 'furniture-mesh';
  const body: THREE.Group = new THREE.Group();
  body.name = 'furniture-body';
  const materialCache: Map<string, THREE.MeshStandardMaterial> = new Map<string, THREE.MeshStandardMaterial>();

  for (const part of parts) {
    let material: THREE.MeshStandardMaterial | undefined = materialCache.get(part.materialSlot);
    if (!material) {
      const slot: IMaterialSlot = materials[part.materialSlot] ?? {
        label: part.materialSlot,
        color: DEFAULT_SLOT_COLOR,
        finish: 'satin',
      };
      material = createFurnitureMaterial(slot);
      material.name = part.materialSlot;
      materialCache.set(part.materialSlot, material);
    }

    const geometryResult: { geometry: THREE.BufferGeometry; scale: THREE.Vector3 } = createPartGeometry(part);
    const mesh: THREE.Mesh = new THREE.Mesh(geometryResult.geometry, material);
    mesh.name = part.id;
    mesh.position.set(part.position.x, part.position.y, part.position.z);
    mesh.rotation.set(
      THREE.MathUtils.degToRad(part.rotation.x),
      THREE.MathUtils.degToRad(part.rotation.y),
      THREE.MathUtils.degToRad(part.rotation.z)
    );
    mesh.scale.copy(geometryResult.scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { type: 'furniture-part', partId: part.id };
    body.add(mesh);
  }

  if (options.ground === true) {
    body.updateMatrixWorld(true);
    const bounds: THREE.Box3 = new THREE.Box3().setFromObject(body);
    if (!bounds.isEmpty() && Number.isFinite(bounds.min.y)) {
      body.position.y = -bounds.min.y;
    }
  }

  group.add(body);
  group.userData = {
    type: FURNITURE_USER_DATA_TYPE,
    partIds: parts.map((part: IFurniturePart): string => part.id),
  };
  return group;
}

export function disposeFurnitureGroup(group: THREE.Group): void {
  const disposedMaterials: Set<THREE.Material> = new Set<THREE.Material>();
  group.traverse((object: THREE.Object3D): void => {
    const mesh: THREE.Mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
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
