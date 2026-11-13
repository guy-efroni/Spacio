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
  WALL_MESH_PREFIX,
  WALL_ROUGHNESS,
  WALL_METALNESS,
  WALLS_GROUP_NAME,
  WALL_SELECTED_COLOR,
  WALL_SELECTED_EMISSIVE_INTENSITY,
  WALL_SELECTION_OUTLINE_COLOR,
  WALL_SELECTION_OUTLINE_WIDTH,
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

    const trimMaterial: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
      color: TRIM_COLOR,
      roughness: TRIM_ROUGHNESS,
      metalness: TRIM_METALNESS,
      side: THREE.DoubleSide,
    });

    const selectionOutlineMaterial: THREE.MeshBasicMaterial = new THREE.MeshBasicMaterial({
      color: WALL_SELECTION_OUTLINE_COLOR,
      transparent: true,
      opacity: 0.8,
      side: THREE.BackSide,
    });

    for (const wall of walls) {
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

      const wallColor = new THREE.Color(color);
      const wallMaterial: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
        color: wallColor,
        roughness: WALL_ROUGHNESS,
        metalness: WALL_METALNESS,
        side: THREE.DoubleSide,
      });

      let effectiveMaterial: THREE.Material = wallMaterial;
      let outlineMesh: THREE.Mesh | null = null;

      if (isSelected) {
        const selectedMaterial = wallMaterial.clone();
        selectedMaterial.emissive = new THREE.Color(WALL_SELECTED_COLOR);
        selectedMaterial.emissiveIntensity = WALL_SELECTED_EMISSIVE_INTENSITY;
        selectedMaterial.side = THREE.DoubleSide;
        effectiveMaterial = selectedMaterial;

        const outlineGeometry = new THREE.BoxGeometry(
          length + WALL_SELECTION_OUTLINE_WIDTH * 2,
          height + WALL_SELECTION_OUTLINE_WIDTH * 2,
          thickness + WALL_SELECTION_OUTLINE_WIDTH * 2
        );
        outlineMesh = new THREE.Mesh(outlineGeometry, selectionOutlineMaterial);
        outlineMesh.position.set(midX, height / 2, midZ);
        outlineMesh.rotation.y = -angle;
        outlineMesh.name = `selection-outline-${id}`;
        group.add(outlineMesh);
      }

      const wallGeometry: THREE.BoxGeometry = new THREE.BoxGeometry(length, height, thickness);
      const wallMesh: THREE.Mesh = new THREE.Mesh(wallGeometry, effectiveMaterial);
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
