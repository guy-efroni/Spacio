import * as THREE from 'three';
import { IMaterialSlot, IParametricFurniture, IWallOpening, WallOpeningType } from '@spacio/shared-types';

export interface IGeneratedFurniture {
  group: THREE.Group;
  dispose: () => void;
}

export interface IGeneratedOpeningMeshes {
  group: THREE.Group;
  dispose: () => void;
}

export function createMaterialFromSlot(slot: IMaterialSlot): THREE.MeshStandardMaterial {
  const clampedRoughness: number = Math.min(Math.max(slot.roughness, 0), 1);
  const rawMetalness: number = Math.min(Math.max(slot.metalness, 0), 1);
  const effectiveMetalness: number = rawMetalness >= 0.8 ? rawMetalness : Math.min(rawMetalness, 0.2);
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(slot.color),
    roughness: clampedRoughness,
    metalness: effectiveMetalness,
    emissive: 0x000000,
    emissiveIntensity: 0,
  });
  material.name = slot.key;
  return material;
}

export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj: THREE.Object3D) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if ((obj as THREE.LineSegments).isLineSegments) {
      const line = obj as THREE.LineSegments;
      line.geometry?.dispose();
      const lineMat = line.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(lineMat)) {
        lineMat.forEach((m: THREE.Material) => m.dispose());
      } else if (lineMat) {
        lineMat.dispose();
      }
    }
    const material = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) {
      material.forEach((m: THREE.Material) => m.dispose());
    } else if (material) {
      material.dispose();
    }
  });
}

function addMesh(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: THREE.Vector3,
  rotationY: number,
  name: string
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.rotation.y = rotationY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = name;
  group.add(mesh);
  return mesh;
}

function buildTable(item: IParametricFurniture): THREE.Group {
  const group = new THREE.Group();
  const { width, height, depth } = item.dimensions;
  const topShape = item.styleOptions['topShape'] ?? 'rectangle';
  const legStyle = item.styleOptions['legStyle'] ?? 'tapered';
  const topMat = createMaterialFromSlot(item.materials['top'] ?? { key: 'top', label: 'Top', color: '#8b5a2b', roughness: 0.55, metalness: 0.05 });
  const legMat = createMaterialFromSlot(item.materials['legs'] ?? { key: 'legs', label: 'Legs', color: '#2f2f35', roughness: 0.35, metalness: 0.6 });
  const topThickness = Math.max(0.03, Math.min(0.08, height * 0.08));
  const legHeight = Math.max(0.1, height - topThickness);
  let topGeom: THREE.BufferGeometry;
  if (topShape === 'rounded') {
    const shape = new THREE.Shape();
    const r = Math.min(width, depth) * 0.12;
    const hw = width / 2;
    const hd = depth / 2;
    shape.moveTo(-hw + r, -hd);
    shape.lineTo(hw - r, -hd);
    shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
    shape.lineTo(hw, hd - r);
    shape.quadraticCurveTo(hw, hd, hw - r, hd);
    shape.lineTo(-hw + r, hd);
    shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
    shape.lineTo(-hw, -hd + r);
    shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
    topGeom = new THREE.ExtrudeGeometry(shape, { depth: topThickness, bevelEnabled: false });
    topGeom.rotateX(-Math.PI / 2);
    topGeom.translate(0, legHeight, 0);
  } else if (topShape === 'oval') {
    const shape = new THREE.Shape();
    shape.absellipse(0, 0, width / 2, depth / 2, 0, Math.PI * 2, false, 0);
    topGeom = new THREE.ExtrudeGeometry(shape, { depth: topThickness, bevelEnabled: false, curveSegments: 48 });
    topGeom.rotateX(-Math.PI / 2);
    topGeom.translate(0, legHeight, 0);
  } else {
    topGeom = new THREE.BoxGeometry(width, topThickness, depth);
  }
  const topMesh = new THREE.Mesh(topGeom, topMat);
  if (topShape === 'rectangle') {
    topMesh.position.set(0, legHeight + topThickness / 2, 0);
  }
  topMesh.castShadow = true;
  topMesh.receiveShadow = true;
  topMesh.name = `${item.id}-top`;
  group.add(topMesh);

  const insetX = Math.min(width * 0.12, 0.12);
  const insetZ = Math.min(depth * 0.12, 0.12);
  const corners: Array<[number, number]> = [
    [-width / 2 + insetX, -depth / 2 + insetZ],
    [width / 2 - insetX, -depth / 2 + insetZ],
    [-width / 2 + insetX, depth / 2 - insetZ],
    [width / 2 - insetX, depth / 2 - insetZ],
  ];
  corners.forEach((corner: [number, number], index: number) => {
    let geom: THREE.BufferGeometry;
    const x = corner[0];
    const z = corner[1];
    if (legStyle === 'tapered') {
      geom = new THREE.CylinderGeometry(0.015, 0.03, legHeight, 12);
    } else if (legStyle === 'industrial') {
      geom = new THREE.BoxGeometry(0.05, legHeight, 0.05);
    } else {
      geom = new THREE.CylinderGeometry(0.025, 0.025, legHeight, 16);
    }
    addMesh(group, geom, legMat, new THREE.Vector3(x, legHeight / 2, z), 0, `${item.id}-leg-${index}`);
  });
  return group;
}

function buildSofa(item: IParametricFurniture): THREE.Group {
  const group = new THREE.Group();
  const { width, height, depth } = item.dimensions;
  const baseMat = createMaterialFromSlot(item.materials['base'] ?? { key: 'base', label: 'Base', color: '#3a3a40', roughness: 0.6, metalness: 0.1 });
  const upMat = createMaterialFromSlot(item.materials['upholstery'] ?? { key: 'upholstery', label: 'Upholstery', color: '#5b6b8a', roughness: 0.85, metalness: 0 });
  const baseH = Math.max(0.15, height * 0.35);
  const backH = Math.max(0.25, height - baseH);
  const seatDepth = depth * 0.72;
  const backDepth = Math.max(0.12, depth - seatDepth);
  addMesh(group, new THREE.BoxGeometry(width, baseH, depth), baseMat, new THREE.Vector3(0, baseH / 2, 0), 0, `${item.id}-base`);
  addMesh(group, new THREE.BoxGeometry(width * 0.94, backH, backDepth), upMat, new THREE.Vector3(0, baseH + backH / 2, -depth / 2 + backDepth / 2), 0, `${item.id}-back`);
  addMesh(group, new THREE.BoxGeometry(width * 0.92, baseH * 0.45, seatDepth * 0.9), upMat, new THREE.Vector3(0, baseH + baseH * 0.22, depth * 0.05), 0, `${item.id}-seat`);
  const armW = Math.max(0.08, width * 0.08);
  const armH = backH * 0.75;
  addMesh(group, new THREE.BoxGeometry(armW, armH, seatDepth), upMat, new THREE.Vector3(-width / 2 + armW / 2, baseH + armH / 2, depth * 0.05), 0, `${item.id}-arm-l`);
  addMesh(group, new THREE.BoxGeometry(armW, armH, seatDepth), upMat, new THREE.Vector3(width / 2 - armW / 2, baseH + armH / 2, depth * 0.05), 0, `${item.id}-arm-r`);
  return group;
}

function buildBed(item: IParametricFurniture): THREE.Group {
  const group = new THREE.Group();
  const { width, height, depth } = item.dimensions;
  const frameMat = createMaterialFromSlot(item.materials['frame'] ?? { key: 'frame', label: 'Frame', color: '#7a5230', roughness: 0.6, metalness: 0.05 });
  const upMat = createMaterialFromSlot(item.materials['upholstery'] ?? { key: 'upholstery', label: 'Upholstery', color: '#e5e7eb', roughness: 0.9, metalness: 0 });
  const frameH = Math.max(0.15, height * 0.45);
  const mattressH = Math.max(0.12, height - frameH);
  const headH = Math.max(0.4, height * 1.2);
  addMesh(group, new THREE.BoxGeometry(width, frameH, depth), frameMat, new THREE.Vector3(0, frameH / 2, 0), 0, `${item.id}-frame`);
  addMesh(group, new THREE.BoxGeometry(width * 0.96, mattressH, depth * 0.96), upMat, new THREE.Vector3(0, frameH + mattressH / 2, 0), 0, `${item.id}-mattress`);
  addMesh(group, new THREE.BoxGeometry(width, headH, 0.08), frameMat, new THREE.Vector3(0, headH / 2, -depth / 2 + 0.04), 0, `${item.id}-headboard`);
  return group;
}

function buildStorage(item: IParametricFurniture): THREE.Group {
  const group = new THREE.Group();
  const { width, height, depth } = item.dimensions;
  const bodyMat = createMaterialFromSlot(item.materials['body'] ?? { key: 'body', label: 'Body', color: '#d4d4d8', roughness: 0.5, metalness: 0.05 });
  const shelfMat = createMaterialFromSlot(item.materials['shelves'] ?? { key: 'shelves', label: 'Shelves', color: '#a1a1aa', roughness: 0.55, metalness: 0.05 });
  const t = 0.03;
  addMesh(group, new THREE.BoxGeometry(width, t, depth), bodyMat, new THREE.Vector3(0, t / 2, 0), 0, `${item.id}-bottom`);
  addMesh(group, new THREE.BoxGeometry(width, t, depth), bodyMat, new THREE.Vector3(0, height - t / 2, 0), 0, `${item.id}-top`);
  addMesh(group, new THREE.BoxGeometry(t, height, depth), bodyMat, new THREE.Vector3(-width / 2 + t / 2, height / 2, 0), 0, `${item.id}-left`);
  addMesh(group, new THREE.BoxGeometry(t, height, depth), bodyMat, new THREE.Vector3(width / 2 - t / 2, height / 2, 0), 0, `${item.id}-right`);
  addMesh(group, new THREE.BoxGeometry(width, height, t), bodyMat, new THREE.Vector3(0, height / 2, -depth / 2 + t / 2), 0, `${item.id}-back`);
  const shelfCount = 3;
  for (let i = 1; i <= shelfCount; i++) {
    const y = (height / (shelfCount + 1)) * i;
    addMesh(group, new THREE.BoxGeometry(width - t * 2, t, depth - t * 2), shelfMat, new THREE.Vector3(0, y, 0), 0, `${item.id}-shelf-${i}`);
  }
  return group;
}

export function buildParametricFurniture(item: IParametricFurniture): IGeneratedFurniture {
  let body: THREE.Group;
  switch (item.category) {
    case 'table':
      body = buildTable(item);
      break;
    case 'sofa':
      body = buildSofa(item);
      break;
    case 'bed':
      body = buildBed(item);
      break;
    case 'storage':
      body = buildStorage(item);
      break;
    default:
      body = new THREE.Group();
  }
  const group = new THREE.Group();
  group.name = item.id;
  group.userData = { type: 'furniture', id: item.id, category: item.category };
  group.add(body);

  group.position.set(item.position.x, 0, item.position.z);
  group.rotation.y = item.rotationY;
  group.updateMatrixWorld(true);
  const bounds: THREE.Box3 = new THREE.Box3().setFromObject(group);
  if (Number.isFinite(bounds.min.y) && Number.isFinite(bounds.max.y)) {
    group.position.y -= bounds.min.y;
  }

  group.traverse((obj: THREE.Object3D): void => {
    obj.frustumCulled = false;
    const mesh: THREE.Mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.visible = true;
    const material: THREE.Material | THREE.Material[] | undefined = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (!material) return;
    const mats: THREE.Material[] = Array.isArray(material) ? material : [material];
    mats.forEach((m: THREE.Material): void => {
      const std: THREE.MeshStandardMaterial = m as THREE.MeshStandardMaterial;
      std.transparent = false;
      std.opacity = 1;
      std.depthWrite = true;
      std.depthTest = true;
      std.side = THREE.FrontSide;
      std.visible = true;
      std.vertexColors = false;
      std.emissive.setHex(0x000000);
      std.emissiveIntensity = 0;
      std.needsUpdate = true;
    });
  });

  group.updateMatrixWorld(true);
  return {
    group,
    dispose: (): void => disposeObject3D(group),
  };
}
