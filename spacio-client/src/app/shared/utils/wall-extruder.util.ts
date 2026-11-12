import * as THREE from 'three';
import {
  BASEBOARD_MESH_PREFIX,
  CROWN_MESH_PREFIX,
  IWallSegment,
  TRIM_COLOR,
  TRIM_HEIGHT,
  TRIM_METALNESS,
  TRIM_ROUGHNESS,
  TRIM_THICKNESS,
  WALL_COLOR,
  WALL_METALNESS,
  WALL_MESH_PREFIX,
  WALL_ROUGHNESS,
  WALL_SELECTED_COLOR,
  WALLS_GROUP_NAME,
} from '@spacio/shared-types';

export class WallExtruder {
  private constructor() {}

  public static createWallsMesh(
    walls: ReadonlyArray<IWallSegment>,
    selectedWallId: string | null = null
  ): THREE.Group {
    const group: THREE.Group = new THREE.Group();
    group.name = WALLS_GROUP_NAME;

    if (walls.length === 0) {
      return group;
    }

    const wallMaterial: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
      color: WALL_COLOR,
      roughness: WALL_ROUGHNESS,
      metalness: WALL_METALNESS,
    });

    const selectedWallMaterial: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
      color: WALL_SELECTED_COLOR,
      roughness: WALL_ROUGHNESS,
      metalness: WALL_METALNESS,
      emissive: WALL_SELECTED_COLOR,
      emissiveIntensity: 0.35,
    });

    const trimMaterial: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
      color: TRIM_COLOR,
      roughness: TRIM_ROUGHNESS,
      metalness: TRIM_METALNESS,
    });

    for (const wall of walls) {
      const { start, end, height, thickness, id }: IWallSegment = wall;

      const dx: number = end.x - start.x;
      const dz: number = end.y - start.y;
      const length: number = Math.sqrt(dx * dx + dz * dz);
      if (length <= 0) {
        continue;
      }

      const midX: number = (start.x + end.x) / 2;
      const midZ: number = (start.y + end.y) / 2;
      const angle: number = Math.atan2(dz, dx);

      const wallGeometry: THREE.BoxGeometry = new THREE.BoxGeometry(length, height, thickness);
      const isSelected: boolean = id === selectedWallId;
      const wallMesh: THREE.Mesh = new THREE.Mesh(
        wallGeometry,
        isSelected ? selectedWallMaterial : wallMaterial
      );
      wallMesh.position.set(midX, height / 2, midZ);
      wallMesh.rotation.y = -angle;
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      wallMesh.name = `${WALL_MESH_PREFIX}-${id}`;
      wallMesh.userData = { id, type: 'wall' };
      group.add(wallMesh);

      const baseboard: THREE.Mesh = WallExtruder._createTrimBox(
        trimMaterial,
        length,
        TRIM_THICKNESS,
        TRIM_HEIGHT
      );
      baseboard.position.set(midX, TRIM_HEIGHT / 2, midZ);
      baseboard.rotation.y = -angle;
      baseboard.castShadow = true;
      baseboard.receiveShadow = true;
      baseboard.name = `${BASEBOARD_MESH_PREFIX}-${wall.id}`;
      group.add(baseboard);

      const crown: THREE.Mesh = WallExtruder._createTrimBox(
        trimMaterial,
        length,
        TRIM_THICKNESS,
        TRIM_HEIGHT
      );
      crown.position.set(midX, height - TRIM_HEIGHT / 2, midZ);
      crown.rotation.y = -angle;
      crown.castShadow = true;
      crown.receiveShadow = true;
      crown.name = `${CROWN_MESH_PREFIX}-${wall.id}`;
      group.add(crown);
    }

    return group;
  }

  private static _createTrimBox(
    material: THREE.MeshStandardMaterial,
    length: number,
    thickness: number,
    height: number
  ): THREE.Mesh {
    const geometry: THREE.BoxGeometry = new THREE.BoxGeometry(length, height, thickness);
    const mesh: THREE.Mesh = new THREE.Mesh(geometry, material);
    return mesh;
  }
}
