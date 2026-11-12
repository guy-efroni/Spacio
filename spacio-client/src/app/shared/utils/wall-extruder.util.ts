import * as THREE from 'three';
import { IWallSegment } from '@spacio/shared-types';

export class WallExtruder {
  private constructor() {}

  public static createWallsMesh(walls: ReadonlyArray<IWallSegment>): THREE.Group {
    const group: THREE.Group = new THREE.Group();
    group.name = 'walls';

    if (walls.length === 0) {
      return group;
    }

    const material: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b5cf6,
      roughness: 0.4,
      metalness: 0.1,
    });

    for (const wall of walls) {
      const { start, end, height, thickness }: IWallSegment = wall;

      const length: number = Math.hypot(end.x - start.x, end.y - start.y);
      if (length <= 0) {
        continue;
      }

      const midX: number = (start.x + end.x) / 2;
      const midZ: number = (start.y + end.y) / 2;
      const angle: number = Math.atan2(end.y - start.y, end.x - start.x);

      const shape: THREE.Shape = new THREE.Shape();
      shape.moveTo(-thickness / 2, 0);
      shape.lineTo(thickness / 2, 0);
      shape.lineTo(thickness / 2, height);
      shape.lineTo(-thickness / 2, height);
      shape.closePath();

      const extrudeSettings: THREE.ExtrudeGeometryOptions = {
        depth: length,
        bevelEnabled: false,
      };

      const geometry: THREE.ExtrudeGeometry = new THREE.ExtrudeGeometry(
        shape,
        extrudeSettings
      );
      geometry.translate(0, 0, -length / 2);

      const mesh: THREE.Mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(midX, 0, midZ);
      mesh.rotation.y = angle;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      group.add(mesh);
    }

    return group;
  }
}
