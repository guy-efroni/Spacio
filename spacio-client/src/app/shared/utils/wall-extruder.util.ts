import * as THREE from 'three';
import {
  BASEBOARD_MESH_PREFIX,
  CROWN_MESH_PREFIX,
  DOOR_LEAF_GAP,
  DOOR_LEAF_THICKNESS,
  IWallOpening,
  IWallSegment,
  OPENING_DOOR_PREFIX,
  OPENING_FRAME_DEPTH,
  OPENING_FRAME_PREFIX,
  OPENING_FRAME_THICKNESS,
  OPENING_GLASS_METALNESS,
  OPENING_GLASS_OPACITY,
  OPENING_GLASS_PREFIX,
  OPENING_GLASS_ROUGHNESS,
  OPENING_GLASS_TRANSMISSION,
  OPENING_MESH_PREFIX,
  MIN_OPENING_GAP,
  MIN_OPENING_HEIGHT,
  MIN_OPENING_WIDTH,
  MIN_WALL_PIER,
  WALL_MESH_PREFIX,
  WALL_ROUGHNESS,
  WALL_METALNESS,
  WALLS_GROUP_NAME,
  WALL_SELECTION_EDGE_OPACITY,
  WALL_SELECTION_EDGE_PREFIX,
  WALL_SELECTION_OUTLINE_COLOR,
  WALL_Z_FIGHT_OFFSET_EPSILON,
  WALL_Z_FIGHT_THICKNESS_OFFSET_RATIO,
  WallOpeningType,
} from '@spacio/shared-types';

const TRIM_THICKNESS = 0.06;
const TRIM_HEIGHT = 0.15;
const SPAN_EPSILON = 1e-6;

type IOpeningSpan = {
  start: number;
  end: number;
  opening: IWallOpening;
};

export class WallExtruder {
  private constructor() {}

  public static createWallsMesh(
    walls: ReadonlyArray<IWallSegment>,
    selectedWallId: string | null = null,
    openings: ReadonlyArray<IWallOpening> = []
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

      const dirX: number = dx / length;
      const dirZ: number = dz / length;
      const midX: number = (start.x + end.x) / 2;
      const midZ: number = (start.y + end.y) / 2;
      const angle: number = Math.atan2(dz, dx);
      const isSelected: boolean = id === selectedWallId;

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

      const wallOpenings: IWallOpening[] = openings.filter((opening: IWallOpening) => opening.wallId === id);
      const spans: IOpeningSpan[] = WallExtruder._computeOpeningSpans(wall, length, wallOpenings);

      WallExtruder._addWallSegments(
        group,
        wall,
        spans,
        {
          length,
          height,
          renderedHeight,
          renderedThickness,
          midX,
          midZ,
          angle,
          dirX,
          dirZ,
          startX: start.x,
          startZ: start.y,
        },
        wallMaterial,
        isSelected ? selectionEdgeMaterial : null
      );

      for (const span of spans) {
        WallExtruder._addOpeningMeshes(group, wall, span, {
          renderedThickness,
          midX,
          midZ,
          angle,
          dirX,
          dirZ,
          startX: start.x,
          startZ: start.y,
        });
      }
    }

    return group;
  }

  private static _computeOpeningSpans(
    wall: IWallSegment,
    wallLength: number,
    openings: ReadonlyArray<IWallOpening>
  ): IOpeningSpan[] {
    const usableLength: number = wallLength - MIN_WALL_PIER * 2;
    if (wallLength <= 0 || usableLength + SPAN_EPSILON < MIN_OPENING_WIDTH || openings.length === 0) {
      return [];
    }

    const sortedSpans: IOpeningSpan[] = openings
      .map((opening: IWallOpening): IOpeningSpan | null => {
        if (!Number.isFinite(opening.positionAlongWall) || !Number.isFinite(opening.width)) {
          return null;
        }

        const width: number = Math.min(Math.max(opening.width, 0), usableLength);
        if (width + SPAN_EPSILON < MIN_OPENING_WIDTH) {
          return null;
        }

        const start: number = clamp(
          opening.positionAlongWall,
          MIN_WALL_PIER,
          wallLength - MIN_WALL_PIER - width
        );
        const maxTop: number = Math.max(wall.height, 0);
        const minHeight: number = Math.min(MIN_OPENING_HEIGHT, maxTop);
        const height: number = clamp(
          Number.isFinite(opening.height) ? opening.height : minHeight,
          minHeight,
          maxTop
        );
        const elevation: number = clamp(
          Number.isFinite(opening.elevation) ? opening.elevation : 0,
          0,
          Math.max(0, maxTop - height)
        );

        return {
          start,
          end: start + width,
          opening: { ...opening, width, elevation, height },
        };
      })
      .filter((span: IOpeningSpan | null): span is IOpeningSpan => span !== null)
      .sort((a: IOpeningSpan, b: IOpeningSpan) => a.start - b.start);

    const spans: IOpeningSpan[] = [];
    let cursor: number = MIN_WALL_PIER;

    for (const span of sortedSpans) {
      const start: number = Math.max(span.start, cursor);
      const end: number = Math.min(start + (span.end - span.start), wallLength - MIN_WALL_PIER);

      if (end - start + SPAN_EPSILON < MIN_OPENING_WIDTH) {
        continue;
      }

      spans.push({
        start,
        end,
        opening: { ...span.opening, width: end - start },
      });
      cursor = end + MIN_OPENING_GAP;
    }

    return spans;
  }

  private static _addWallSegments(
    group: THREE.Group,
    wall: IWallSegment,
    spans: ReadonlyArray<IOpeningSpan>,
    dims: {
      length: number;
      height: number;
      renderedHeight: number;
      renderedThickness: number;
      midX: number;
      midZ: number;
      angle: number;
      dirX: number;
      dirZ: number;
      startX: number;
      startZ: number;
    },
    material: THREE.MeshStandardMaterial,
    selectionEdgeMaterial: THREE.LineBasicMaterial | null
  ): void {
    if (spans.length === 0) {
      const wallGeometry: THREE.BoxGeometry = new THREE.BoxGeometry(
        dims.length,
        dims.renderedHeight,
        dims.renderedThickness
      );
      const wallMesh: THREE.Mesh = WallExtruder._createSegmentMesh(
        wallGeometry,
        material,
        dims.midX,
        dims.renderedHeight / 2,
        dims.midZ,
        dims.angle,
        `${WALL_MESH_PREFIX}-${wall.id}`,
        { id: wall.id, type: 'wall' }
      );
      group.add(wallMesh);
      if (selectionEdgeMaterial) {
        WallExtruder._addSelectionEdges(group, wallGeometry, wallMesh, selectionEdgeMaterial, wall.id);
      }
      WallExtruder._addTrim(group, material, wall.id, dims.length, dims.midX, dims.midZ, dims.angle, dims.renderedHeight);
      return;
    }

    let cursor: number = 0;
    let segmentIndex: number = 0;
    for (const span of spans) {
      if (span.start - cursor > 0.01) {
        WallExtruder._addSolidSegment(group, wall, material, selectionEdgeMaterial, dims, cursor, span.start, 0, dims.renderedHeight, segmentIndex++);
      }
      const bottom: number = span.opening.elevation;
      const top: number = Math.min(span.opening.elevation + span.opening.height, dims.height);
      if (bottom > 0.01) {
        WallExtruder._addSolidSegment(group, wall, material, null, dims, span.start, span.end, 0, bottom, segmentIndex++);
      }
      if (dims.renderedHeight - top > 0.01) {
        WallExtruder._addSolidSegment(group, wall, material, null, dims, span.start, span.end, top, dims.renderedHeight, segmentIndex++);
      }
      cursor = span.end;
    }
    if (dims.length - cursor > 0.01) {
      WallExtruder._addSolidSegment(group, wall, material, selectionEdgeMaterial, dims, cursor, dims.length, 0, dims.renderedHeight, segmentIndex++);
    }

    WallExtruder._addTrimWithOpenings(group, material, wall.id, dims, spans);
  }

  private static _addSolidSegment(
    group: THREE.Group,
    wall: IWallSegment,
    material: THREE.MeshStandardMaterial,
    selectionEdgeMaterial: THREE.LineBasicMaterial | null,
    dims: {
      length: number;
      renderedHeight: number;
      renderedThickness: number;
      midX: number;
      midZ: number;
      angle: number;
      dirX: number;
      dirZ: number;
      startX: number;
      startZ: number;
    },
    from: number,
    to: number,
    bottomY: number,
    topY: number,
    segmentIndex: number
  ): void {
    const segLength: number = to - from;
    const segHeight: number = topY - bottomY;
    if (segLength <= 0.005 || segHeight <= 0.005) {
      return;
    }
    const centerAlong: number = (from + to) / 2;
    const centerX: number = dims.startX + dims.dirX * centerAlong;
    const centerZ: number = dims.startZ + dims.dirZ * centerAlong;
    const centerY: number = (bottomY + topY) / 2;
    const geometry: THREE.BoxGeometry = new THREE.BoxGeometry(segLength, segHeight, dims.renderedThickness);
    const mesh: THREE.Mesh = WallExtruder._createSegmentMesh(
      geometry,
      material,
      centerX,
      centerY,
      centerZ,
      dims.angle,
      `${WALL_MESH_PREFIX}-${wall.id}-seg-${segmentIndex}`,
      { id: wall.id, type: 'wall' }
    );
    group.add(mesh);
    if (selectionEdgeMaterial) {
      WallExtruder._addSelectionEdges(group, geometry, mesh, selectionEdgeMaterial, `${wall.id}-seg-${segmentIndex}`);
    }
  }

  private static _addTrim(
    group: THREE.Group,
    material: THREE.MeshStandardMaterial,
    wallId: string,
    length: number,
    midX: number,
    midZ: number,
    angle: number,
    renderedHeight: number
  ): void {
    const baseboard: THREE.Mesh = WallExtruder._createTrimBox(material, length, TRIM_THICKNESS, TRIM_HEIGHT);
    baseboard.position.set(midX, TRIM_HEIGHT / 2, midZ);
    baseboard.rotation.y = -angle;
    baseboard.castShadow = true;
    baseboard.receiveShadow = true;
    baseboard.name = `${BASEBOARD_MESH_PREFIX}-${wallId}`;
    group.add(baseboard);

    const crown: THREE.Mesh = WallExtruder._createTrimBox(material, length, TRIM_THICKNESS, TRIM_HEIGHT);
    crown.position.set(midX, renderedHeight - TRIM_HEIGHT / 2, midZ);
    crown.rotation.y = -angle;
    crown.castShadow = true;
    crown.receiveShadow = true;
    crown.name = `${CROWN_MESH_PREFIX}-${wallId}`;
    group.add(crown);
  }

  private static _addTrimWithOpenings(
    group: THREE.Group,
    material: THREE.MeshStandardMaterial,
    wallId: string,
    dims: { length: number; renderedHeight: number; angle: number; dirX: number; dirZ: number; startX: number; startZ: number },
    spans: ReadonlyArray<IOpeningSpan>
  ): void {
    // Crown along full length
    const crown: THREE.Mesh = WallExtruder._createTrimBox(material, dims.length, TRIM_THICKNESS, TRIM_HEIGHT);
    const midX: number = dims.startX + dims.dirX * (dims.length / 2);
    const midZ: number = dims.startZ + dims.dirZ * (dims.length / 2);
    crown.position.set(midX, dims.renderedHeight - TRIM_HEIGHT / 2, midZ);
    crown.rotation.y = -dims.angle;
    crown.castShadow = true;
    crown.receiveShadow = true;
    crown.name = `${CROWN_MESH_PREFIX}-${wallId}`;
    group.add(crown);

    // Baseboard only where floor touches (skip under openings with elevation ~0)
    let cursor: number = 0;
    let idx: number = 0;
    const addBase = (from: number, to: number): void => {
      const segLength: number = to - from;
      if (segLength <= 0.01) return;
      const centerAlong: number = (from + to) / 2;
      const cx: number = dims.startX + dims.dirX * centerAlong;
      const cz: number = dims.startZ + dims.dirZ * centerAlong;
      const base: THREE.Mesh = WallExtruder._createTrimBox(material, segLength, TRIM_THICKNESS, TRIM_HEIGHT);
      base.position.set(cx, TRIM_HEIGHT / 2, cz);
      base.rotation.y = -dims.angle;
      base.castShadow = true;
      base.receiveShadow = true;
      base.name = `${BASEBOARD_MESH_PREFIX}-${wallId}-${idx++}`;
      group.add(base);
    };
    for (const span of spans) {
      if (span.opening.elevation <= 0.01) {
        if (span.start - cursor > 0.01) addBase(cursor, span.start);
        cursor = span.end;
      }
    }
    if (dims.length - cursor > 0.01) addBase(cursor, dims.length);
  }

  private static _addOpeningMeshes(
    group: THREE.Group,
    wall: IWallSegment,
    span: IOpeningSpan,
    dims: { renderedThickness: number; midX: number; midZ: number; angle: number; dirX: number; dirZ: number; startX: number; startZ: number }
  ): void {
    const opening: IWallOpening = span.opening;
    const width: number = span.end - span.start;
    const height: number = opening.height;
    const elevation: number = opening.elevation;
    const centerAlong: number = (span.start + span.end) / 2;
    const centerX: number = dims.startX + dims.dirX * centerAlong;
    const centerZ: number = dims.startZ + dims.dirZ * centerAlong;
    const centerY: number = elevation + height / 2;
    const frameDepth: number = dims.renderedThickness + OPENING_FRAME_DEPTH;

    const frameMaterial: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b7355,
      roughness: 0.7,
      metalness: 0.05,
    });

    // Frame: top, bottom, left, right
    const t = OPENING_FRAME_THICKNESS;
    const top = new THREE.Mesh(new THREE.BoxGeometry(width + t * 2, t, frameDepth), frameMaterial);
    top.position.set(centerX, elevation + height + t / 2, centerZ);
    top.rotation.y = -dims.angle;
    top.name = `${OPENING_FRAME_PREFIX}-${opening.id}-top`;
    group.add(top);

    const bottom = new THREE.Mesh(new THREE.BoxGeometry(width + t * 2, t, frameDepth), frameMaterial);
    bottom.position.set(centerX, elevation - t / 2, centerZ);
    bottom.rotation.y = -dims.angle;
    bottom.name = `${OPENING_FRAME_PREFIX}-${opening.id}-bottom`;
    group.add(bottom);

    const left = new THREE.Mesh(new THREE.BoxGeometry(t, height, frameDepth), frameMaterial);
    const leftAlong: number = span.start - t / 2;
    left.position.set(dims.startX + dims.dirX * leftAlong, centerY, dims.startZ + dims.dirZ * leftAlong);
    left.rotation.y = -dims.angle;
    left.name = `${OPENING_FRAME_PREFIX}-${opening.id}-left`;
    group.add(left);

    const right = new THREE.Mesh(new THREE.BoxGeometry(t, height, frameDepth), frameMaterial);
    const rightAlong: number = span.end + t / 2;
    right.position.set(dims.startX + dims.dirX * rightAlong, centerY, dims.startZ + dims.dirZ * rightAlong);
    right.rotation.y = -dims.angle;
    right.name = `${OPENING_FRAME_PREFIX}-${opening.id}-right`;
    group.add(right);

    if (opening.type === WallOpeningType.Window) {
      const glassMaterial: THREE.MeshPhysicalMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xcfe8ff,
        transparent: true,
        opacity: OPENING_GLASS_OPACITY,
        transmission: OPENING_GLASS_TRANSMISSION,
        roughness: OPENING_GLASS_ROUGHNESS,
        metalness: OPENING_GLASS_METALNESS,
        thickness: 0.02,
      });
      const glass: THREE.Mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.02), glassMaterial);
      glass.position.set(centerX, centerY, centerZ);
      glass.rotation.y = -dims.angle;
      glass.name = `${OPENING_GLASS_PREFIX}-${opening.id}`;
      group.add(glass);
    } else {
      const doorMaterial: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
        color: 0x6b4f3a,
        roughness: 0.8,
        metalness: 0.02,
      });
      const leafWidth: number = Math.max(width - DOOR_LEAF_GAP * 2, 0.1);
      const leafHeight: number = Math.max(height - DOOR_LEAF_GAP, 0.1);
      const leaf: THREE.Mesh = new THREE.Mesh(new THREE.BoxGeometry(leafWidth, leafHeight, DOOR_LEAF_THICKNESS), doorMaterial);
      leaf.position.set(centerX, elevation + leafHeight / 2 + DOOR_LEAF_GAP, centerZ);
      leaf.rotation.y = -dims.angle;
      leaf.name = `${OPENING_DOOR_PREFIX}-${opening.id}`;
      leaf.castShadow = true;
      leaf.receiveShadow = true;
      group.add(leaf);
    }

    // marker for picking/debug
    const marker: THREE.Object3D = new THREE.Object3D();
    marker.name = `${OPENING_MESH_PREFIX}-${opening.id}`;
    marker.position.set(centerX, centerY, centerZ);
    marker.userData = { id: opening.id, wallId: wall.id, type: 'opening' };
    group.add(marker);
  }

  private static _createSegmentMesh(
    geometry: THREE.BoxGeometry,
    material: THREE.MeshStandardMaterial,
    x: number,
    y: number,
    z: number,
    angle: number,
    name: string,
    userData: { id: string; type: string }
  ): THREE.Mesh {
    const mesh: THREE.Mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = -angle;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = name;
    mesh.userData = userData;
    return mesh;
  }

  private static _addSelectionEdges(
    group: THREE.Group,
    geometry: THREE.BoxGeometry,
    mesh: THREE.Mesh,
    material: THREE.LineBasicMaterial,
    wallId: string
  ): void {
    const selectionEdges: THREE.LineSegments = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      material
    );
    selectionEdges.position.copy(mesh.position);
    selectionEdges.rotation.copy(mesh.rotation);
    selectionEdges.name = `${WALL_SELECTION_EDGE_PREFIX}-${wallId}`;
    selectionEdges.renderOrder = 1;
    group.add(selectionEdges);
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
