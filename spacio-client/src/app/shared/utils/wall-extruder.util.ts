import * as THREE from 'three';
import {
  BASEBOARD_MESH_PREFIX,
  CROWN_MESH_PREFIX,
  IWallSegment,
  WALL_MESH_PREFIX,
  WALL_ROUGHNESS,
  WALL_METALNESS,
  WALLS_GROUP_NAME,
  WALL_SELECTION_EDGE_OPACITY,
  WALL_SELECTION_EDGE_PREFIX,
  WALL_SELECTION_OUTLINE_COLOR,
  WALL_Z_FIGHT_OFFSET_EPSILON,
  WALL_Z_FIGHT_THICKNESS_OFFSET_RATIO,
} from '@spacio/shared-types';

const TRIM_THICKNESS = 0.06;
const TRIM_HEIGHT = 0.15;

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

    const selectionEdgeMaterial: THREE.LineBasicMaterial = new THREE.LineBasicMaterial({
      color: WALL_SELECTION_OUTLINE_COLOR,
      transparent: true,
      opacity: WALL_SELECTION_EDGE_OPACITY,
      depthWrite: false,
    });

    for (let index: number = 0; index < walls.length; index++) {
      const wall: IWallSegment = walls[index];
      const { start, end, height, thickness, color, id }: IWallSegment = wall;

      const dx: number = end.x - start.x;
      const dz: number = end.y - start.y;
      const length: number = Math.sqrt(dx * dx + dz * dz);
      if (length <= 0) {
        continue;
      }

      const midX: number = (start.x + end.x) / 2;
      const midZ: number = (start.y + end.y) / 2;
      const angle: number = Math.atan2(dz, dx);

      const isSelected: boolean = id === selectedWallId;

      // Wall boxes of adjoining segments overlap at shared corners, which leaves their
      // top/bottom and end faces exactly coplanar and produces Z-fighting. A deterministic
      // sub-millimetre offset per wall index separates those planes without visibly
      // changing the wall's real dimensions.
      const zFightOffset: number = index * WALL_Z_FIGHT_OFFSET_EPSILON;
      const renderedHeight: number = height + zFightOffset;
      const renderedThickness: number = Math.max(
        thickness - zFightOffset,
        thickness * (1 - WALL_Z_FIGHT_THICKNESS_OFFSET_RATIO)
      );

      const wallColor: THREE.Color = new THREE.Color().setStyle(color, THREE.SRGBColorSpace);
      const wallMaterial: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
        color: wallColor,
        roughness: WALL_ROUGHNESS,
        metalness: WALL_METALNESS,
        side: THREE.DoubleSide,
      });

      // The face color always stays exactly the wall's own paint; selection is conveyed by
      // a thin edge outline added below instead of tinting the material.
      const wallGeometry: THREE.BoxGeometry = new THREE.BoxGeometry(
        length,
        renderedHeight,
        renderedThickness
      );
      const wallMesh: THREE.Mesh = new THREE.Mesh(wallGeometry, wallMaterial);
      wallMesh.position.set(midX, renderedHeight / 2, midZ);
      wallMesh.rotation.y = -angle;
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      wallMesh.name = `${WALL_MESH_PREFIX}-${id}`;
      wallMesh.userData = { id, type: 'wall' };
      group.add(wallMesh);

      if (isSelected) {
        const selectionEdges: THREE.LineSegments = new THREE.LineSegments(
          new THREE.EdgesGeometry(wallGeometry),
          selectionEdgeMaterial
        );
        selectionEdges.position.copy(wallMesh.position);
        selectionEdges.rotation.copy(wallMesh.rotation);
        selectionEdges.name = `${WALL_SELECTION_EDGE_PREFIX}-${id}`;
        selectionEdges.renderOrder = 1;
        group.add(selectionEdges);
      }

      const baseboard: THREE.Mesh = WallExtruder._createTrimBox(
        wallMaterial,
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
        wallMaterial,
        length,
        TRIM_THICKNESS,
        TRIM_HEIGHT
      );
      crown.position.set(midX, renderedHeight - TRIM_HEIGHT / 2, midZ);
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
