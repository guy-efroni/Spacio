import * as THREE from 'three';
import { IWallSegment } from '@spacio/shared-types';

const WALL_COLOR = 0xf5f5f0;
const WALL_ROUGHNESS = 0.75;
const WALL_METALNESS = 0.0;

const TRIM_COLOR = 0xe8e8e0;
const TRIM_ROUGHNESS = 0.6;
const TRIM_METALNESS = 0.0;

const TRIM_THICKNESS = 0.06;
const TRIM_HEIGHT = 0.15;

export class WallExtruder {
  private constructor() {}

  public static createWallsMesh(walls: ReadonlyArray<IWallSegment>): THREE.Group {
    const group: THREE.Group = new THREE.Group();
    group.name = 'walls';

    if (walls.length === 0) {
      return group;
    }

    const wallMaterial: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
      color: WALL_COLOR,
      roughness: WALL_ROUGHNESS,
      metalness: WALL_METALNESS,
    });

    const trimMaterial: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
      color: TRIM_COLOR,
      roughness: TRIM_ROUGHNESS,
      metalness: TRIM_METALNESS,
    });

    for (const wall of walls) {
      const { start, end, height, thickness }: IWallSegment = wall;

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
      const wallMesh: THREE.Mesh = new THREE.Mesh(wallGeometry, wallMaterial);
      wallMesh.position.set(midX, height / 2, midZ);
      wallMesh.rotation.y = -angle;
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      wallMesh.name = `wall-${wall.id}`;
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
      baseboard.name = `baseboard-${wall.id}`;
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
      crown.name = `crown-${wall.id}`;
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
