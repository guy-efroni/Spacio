import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  DEFAULT_BEVEL_RADIUS,
  DEFAULT_EXTRUDE_POINTS,
  DEFAULT_FURNITURE_MATERIAL_FINISH,
  DEFAULT_FURNITURE_SLOT_COLOR,
  DEFAULT_LATHE_POINTS,
  DEFAULT_TUBE_PATH_POINTS,
  DEFAULT_TUBE_RADIUS,
  FURNITURE_BODY_NAME,
  FURNITURE_FINISH_PBR,
  FURNITURE_GROUP_NAME,
  FURNITURE_PART_ID_USER_DATA_KEY,
  FURNITURE_PART_USER_DATA_TYPE,
  FURNITURE_USER_DATA_TYPE,
  GLASS_FINISH_SETTINGS,
  IFurniturePart,
  IFurniturePoint2D,
  IFurniturePoint3D,
  IMaterialSlot,
  TPartShape,
} from '@spacio/shared-types';

const CYLINDER_SEGMENTS: number = 24;
const SPHERE_WIDTH_SEGMENTS: number = 24;
const SPHERE_HEIGHT_SEGMENTS: number = 16;
const CAPSULE_CAP_SEGMENTS: number = 8;
const CAPSULE_RADIAL_SEGMENTS: number = 16;
const CONE_SEGMENTS: number = 24;
const TORUS_RADIAL_SEGMENTS: number = 12;
const TORUS_TUBULAR_SEGMENTS: number = 32;
const LATHE_SEGMENTS: number = 32;
const TUBE_SEGMENTS: number = 64;
const TUBE_RADIAL_SEGMENTS: number = 8;
const EXTRUDE_CURVE_SEGMENTS: number = 12;
const ROUNDED_BOX_SEGMENTS: number = 3;
const LATHE_SMOOTH_SAMPLES: number = 32;
const MIN_GEOMETRY_SIZE: number = 0.001;

const PART_SHAPE_CYLINDER: TPartShape = 'cylinder';
const PART_SHAPE_SPHERE: TPartShape = 'sphere';
const PART_SHAPE_CAPSULE: TPartShape = 'capsule';
const PART_SHAPE_CONE: TPartShape = 'cone';
const PART_SHAPE_TORUS: TPartShape = 'torus';
const PART_SHAPE_ROUNDED_BOX: TPartShape = 'rounded-box';
const PART_SHAPE_EXTRUDE: TPartShape = 'extrude-2d';
const PART_SHAPE_LATHE: TPartShape = 'lathe-360';
const PART_SHAPE_TUBE: TPartShape = 'tube-path';

export interface IBuildFurnitureMeshOptions {
  ground?: boolean;
}

interface IPartGeometryResult {
  geometry: THREE.BufferGeometry;
  scale: THREE.Vector3;
}

interface IMappedPoint2D {
  x: number;
  y: number;
  smooth: boolean;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function mapRange(value: number, sourceMin: number, sourceMax: number, targetMin: number, targetMax: number): number {
  if (sourceMax - sourceMin < MIN_GEOMETRY_SIZE) return (targetMin + targetMax) / 2;
  return targetMin + ((value - sourceMin) / (sourceMax - sourceMin)) * (targetMax - targetMin);
}

export function createFurnitureMaterial(slot: IMaterialSlot): THREE.MeshStandardMaterial {
  const pbr: { roughness: number; metalness: number } = FURNITURE_FINISH_PBR[slot.finish];
  const material: THREE.MeshStandardMaterial =
    slot.finish === 'glass'
      ? new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(slot.color),
          roughness: GLASS_FINISH_SETTINGS.roughness,
          metalness: pbr.metalness,
          transmission: GLASS_FINISH_SETTINGS.transmission,
          opacity: GLASS_FINISH_SETTINGS.opacity,
          ior: GLASS_FINISH_SETTINGS.ior,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      : new THREE.MeshStandardMaterial({
          color: new THREE.Color(slot.color),
          roughness: pbr.roughness,
          metalness: pbr.metalness,
        });
  material.name = slot.label;
  return material;
}

function rotateToSharpStart(points: readonly IFurniturePoint2D[]): IFurniturePoint2D[] {
  const startIndex: number = points.findIndex((point: IFurniturePoint2D): boolean => point.smooth !== true);
  const offset: number = startIndex === -1 ? 0 : startIndex;
  return [...points.slice(offset), ...points.slice(0, offset)];
}

function appendSilhouettePath(shape: THREE.Shape, points: readonly IMappedPoint2D[]): void {
  const first: IMappedPoint2D = points[0];
  shape.moveTo(first.x, first.y);
  for (let index: number = 1; index < points.length - 1; index += 1) {
    const current: IMappedPoint2D = points[index];
    const next: IMappedPoint2D = points[index + 1];
    if (current.smooth) shape.quadraticCurveTo(current.x, current.y, next.x, next.y);
    else shape.lineTo(current.x, current.y);
  }
  const last: IMappedPoint2D = points[points.length - 1];
  if (last.smooth) shape.quadraticCurveTo(last.x, last.y, first.x, first.y);
  else shape.lineTo(first.x, first.y);
  shape.closePath();
}

function createExtrudeGeometry(part: IFurniturePart, width: number, height: number, depth: number): THREE.BufferGeometry {
  const source: readonly IFurniturePoint2D[] =
    part.points2D && part.points2D.length >= 3 ? part.points2D : DEFAULT_EXTRUDE_POINTS;
  const bounds: IFurniturePoint2D = {
    x: Math.min(...source.map((point: IFurniturePoint2D): number => point.x)),
    y: Math.min(...source.map((point: IFurniturePoint2D): number => point.y)),
  };
  const maxPoint: IFurniturePoint2D = {
    x: Math.max(...source.map((point: IFurniturePoint2D): number => point.x)),
    y: Math.max(...source.map((point: IFurniturePoint2D): number => point.y)),
  };
  const maxBevel: number = Math.max(0, Math.min(width, depth, height) / 2 - MIN_GEOMETRY_SIZE);
  const bevel: number = clamp(part.bevelRadius ?? DEFAULT_BEVEL_RADIUS, 0, maxBevel);
  const mapped: IMappedPoint2D[] = rotateToSharpStart(source).map((point: IFurniturePoint2D): IMappedPoint2D => ({
    x: mapRange(point.x, bounds.x, maxPoint.x, -width / 2 + bevel, width / 2 - bevel),
    y: mapRange(point.y, bounds.y, maxPoint.y, -depth / 2 + bevel, depth / 2 - bevel),
    smooth: point.smooth === true,
  }));

  const shape: THREE.Shape = new THREE.Shape();
  appendSilhouettePath(shape, mapped);

  const bevelThickness: number = Math.min(bevel, Math.max(0, height / 2 - MIN_GEOMETRY_SIZE));
  const coreDepth: number = Math.max(MIN_GEOMETRY_SIZE, height - bevelThickness * 2);
  const geometry: THREE.ExtrudeGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: coreDepth,
    steps: 1,
    curveSegments: EXTRUDE_CURVE_SEGMENTS,
    bevelEnabled: bevelThickness > MIN_GEOMETRY_SIZE / 2,
    bevelThickness,
    bevelSize: bevel,
    bevelSegments: ROUNDED_BOX_SEGMENTS,
  });
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, height / 2 - bevelThickness, 0);
  geometry.computeVertexNormals();
  return geometry;
}

function createLatheGeometry(part: IFurniturePart, width: number, height: number, depth: number): THREE.BufferGeometry {
  const source: readonly IFurniturePoint2D[] =
    part.points2D && part.points2D.length >= 2 ? part.points2D : DEFAULT_LATHE_POINTS;
  let profile: IFurniturePoint2D[] = [...source].sort(
    (left: IFurniturePoint2D, right: IFurniturePoint2D): number => left.y - right.y
  );

  if (profile.length >= 3 && profile.some((point: IFurniturePoint2D): boolean => point.smooth === true)) {
    const curve: THREE.SplineCurve = new THREE.SplineCurve(
      profile.map((point: IFurniturePoint2D): THREE.Vector2 => new THREE.Vector2(Math.abs(point.x), point.y))
    );
    profile = curve.getPoints(LATHE_SMOOTH_SAMPLES).map((point: THREE.Vector2): IFurniturePoint2D => ({
      x: Math.abs(point.x),
      y: point.y,
    }));
  }

  const maxRadius: number = Math.max(
    MIN_GEOMETRY_SIZE,
    ...profile.map((point: IFurniturePoint2D): number => Math.abs(point.x))
  );
  const minY: number = Math.min(...profile.map((point: IFurniturePoint2D): number => point.y));
  const maxY: number = Math.max(...profile.map((point: IFurniturePoint2D): number => point.y));
  const vectors: THREE.Vector2[] = profile
    .map((point: IFurniturePoint2D): THREE.Vector2 =>
      new THREE.Vector2(
        (Math.abs(point.x) / maxRadius) * (width / 2),
        mapRange(point.y, minY, maxY, -height / 2, height / 2)
      )
    )
    .sort((left: THREE.Vector2, right: THREE.Vector2): number => left.y - right.y);

  const geometry: THREE.LatheGeometry = new THREE.LatheGeometry(vectors, LATHE_SEGMENTS);
  geometry.scale(1, 1, depth / width);
  geometry.computeVertexNormals();
  return geometry;
}

function createTubeGeometry(part: IFurniturePart, width: number, height: number, depth: number): THREE.BufferGeometry {
  const source: readonly IFurniturePoint3D[] =
    part.pathPoints3D && part.pathPoints3D.length >= 2 ? part.pathPoints3D : DEFAULT_TUBE_PATH_POINTS;
  const minPoint: IFurniturePoint3D = {
    x: Math.min(...source.map((point: IFurniturePoint3D): number => point.x)),
    y: Math.min(...source.map((point: IFurniturePoint3D): number => point.y)),
    z: Math.min(...source.map((point: IFurniturePoint3D): number => point.z)),
  };
  const maxPoint: IFurniturePoint3D = {
    x: Math.max(...source.map((point: IFurniturePoint3D): number => point.x)),
    y: Math.max(...source.map((point: IFurniturePoint3D): number => point.y)),
    z: Math.max(...source.map((point: IFurniturePoint3D): number => point.z)),
  };
  const maxRadius: number = Math.max(MIN_GEOMETRY_SIZE, Math.min(width, height, depth) / 2 - MIN_GEOMETRY_SIZE);
  const tubeRadius: number = clamp(part.tubeRadius ?? DEFAULT_TUBE_RADIUS, MIN_GEOMETRY_SIZE, maxRadius);
  const points: THREE.Vector3[] = source.map(
    (point: IFurniturePoint3D): THREE.Vector3 =>
      new THREE.Vector3(
        mapRange(point.x, minPoint.x, maxPoint.x, -width / 2 + tubeRadius, width / 2 - tubeRadius),
        mapRange(point.y, minPoint.y, maxPoint.y, -height / 2 + tubeRadius, height / 2 - tubeRadius),
        mapRange(point.z, minPoint.z, maxPoint.z, -depth / 2 + tubeRadius, depth / 2 - tubeRadius)
      )
  );
  const isClosed: boolean =
    points.length > 3 && points[0].distanceTo(points[points.length - 1]) < MIN_GEOMETRY_SIZE;
  const curvePoints: THREE.Vector3[] = isClosed ? points.slice(0, -1) : points;
  const curve: THREE.CatmullRomCurve3 = new THREE.CatmullRomCurve3(curvePoints, isClosed, 'catmullrom', 0.5);
  const geometry: THREE.TubeGeometry = new THREE.TubeGeometry(
    curve,
    TUBE_SEGMENTS,
    tubeRadius,
    TUBE_RADIAL_SEGMENTS,
    isClosed
  );
  geometry.computeBoundingBox();
  const bounds: THREE.Box3 | null = geometry.boundingBox;
  if (bounds) {
    const center: THREE.Vector3 = bounds.getCenter(new THREE.Vector3());
    geometry.translate(-center.x, -center.y, -center.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function createPartGeometry(part: IFurniturePart): IPartGeometryResult {
  const width: number = Math.max(part.dimensions.width, MIN_GEOMETRY_SIZE);
  const height: number = Math.max(part.dimensions.height, MIN_GEOMETRY_SIZE);
  const depth: number = Math.max(part.dimensions.depth, MIN_GEOMETRY_SIZE);

  switch (part.shape) {
    case PART_SHAPE_CYLINDER: {
      const radius: number = width / 2;
      return {
        geometry: new THREE.CylinderGeometry(radius, radius, height, CYLINDER_SEGMENTS),
        scale: new THREE.Vector3(1, 1, depth / width),
      };
    }
    case PART_SHAPE_SPHERE: {
      const radius: number = Math.max(width, height, depth) / 2;
      return {
        geometry: new THREE.SphereGeometry(radius, SPHERE_WIDTH_SEGMENTS, SPHERE_HEIGHT_SEGMENTS),
        scale: new THREE.Vector3(width / (radius * 2), height / (radius * 2), depth / (radius * 2)),
      };
    }
    case PART_SHAPE_CAPSULE: {
      const radius: number = Math.min(width, depth) / 2;
      const length: number = Math.max(MIN_GEOMETRY_SIZE, height - radius * 2);
      return {
        geometry: new THREE.CapsuleGeometry(radius, length, CAPSULE_CAP_SEGMENTS, CAPSULE_RADIAL_SEGMENTS),
        scale: new THREE.Vector3(width / (radius * 2), 1, depth / (radius * 2)),
      };
    }
    case PART_SHAPE_CONE:
      return {
        geometry: new THREE.ConeGeometry(width / 2, height, CONE_SEGMENTS),
        scale: new THREE.Vector3(1, 1, depth / width),
      };
    case PART_SHAPE_TORUS: {
      const outerX: number = width / 2;
      const outerZ: number = depth / 2;
      const tubeRadius: number = Math.max(
        MIN_GEOMETRY_SIZE,
        Math.min(height / 2, outerX * 0.4, outerZ * 0.4)
      );
      const majorRadius: number = Math.max(MIN_GEOMETRY_SIZE, Math.min(outerX, outerZ) - tubeRadius);
      const geometry: THREE.TorusGeometry = new THREE.TorusGeometry(
        majorRadius,
        tubeRadius,
        TORUS_RADIAL_SEGMENTS,
        TORUS_TUBULAR_SEGMENTS
      );
      geometry.rotateX(Math.PI / 2);
      return {
        geometry,
        scale: new THREE.Vector3(
          outerX / (majorRadius + tubeRadius),
          height / (tubeRadius * 2),
          outerZ / (majorRadius + tubeRadius)
        ),
      };
    }
    case PART_SHAPE_ROUNDED_BOX: {
      const maxBevel: number = Math.max(0, Math.min(width, height, depth) / 2 - MIN_GEOMETRY_SIZE);
      const bevel: number = clamp(part.bevelRadius ?? DEFAULT_BEVEL_RADIUS, 0, maxBevel);
      const geometry: THREE.BufferGeometry =
        bevel > MIN_GEOMETRY_SIZE / 2
          ? new RoundedBoxGeometry(width, height, depth, ROUNDED_BOX_SEGMENTS, bevel)
          : new THREE.BoxGeometry(width, height, depth);
      return { geometry, scale: new THREE.Vector3(1, 1, 1) };
    }
    case PART_SHAPE_EXTRUDE:
      return {
        geometry: createExtrudeGeometry(part, width, height, depth),
        scale: new THREE.Vector3(1, 1, 1),
      };
    case PART_SHAPE_LATHE:
      return {
        geometry: createLatheGeometry(part, width, height, depth),
        scale: new THREE.Vector3(1, 1, 1),
      };
    case PART_SHAPE_TUBE:
      return {
        geometry: createTubeGeometry(part, width, height, depth),
        scale: new THREE.Vector3(1, 1, 1),
      };
    default:
      return {
        geometry: new THREE.BoxGeometry(width, height, depth),
        scale: new THREE.Vector3(1, 1, 1),
      };
  }
}

export function buildFurnitureMesh(
  parts: readonly IFurniturePart[],
  materials: Record<string, IMaterialSlot>,
  options: IBuildFurnitureMeshOptions = {}
): THREE.Group {
  const group: THREE.Group = new THREE.Group();
  group.name = FURNITURE_GROUP_NAME;
  const body: THREE.Group = new THREE.Group();
  body.name = FURNITURE_BODY_NAME;
  const materialCache: Map<string, THREE.MeshStandardMaterial> = new Map<string, THREE.MeshStandardMaterial>();

  for (const part of parts) {
    let material: THREE.MeshStandardMaterial | undefined = materialCache.get(part.materialSlot);
    if (!material) {
      const slot: IMaterialSlot = materials[part.materialSlot] ?? {
        label: part.materialSlot,
        color: DEFAULT_FURNITURE_SLOT_COLOR,
        finish: DEFAULT_FURNITURE_MATERIAL_FINISH,
      };
      material = createFurnitureMaterial(slot);
      material.name = part.materialSlot;
      materialCache.set(part.materialSlot, material);
    }

    const geometryResult: IPartGeometryResult = createPartGeometry(part);
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
    mesh.userData = { type: FURNITURE_PART_USER_DATA_TYPE, [FURNITURE_PART_ID_USER_DATA_KEY]: part.id };
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
