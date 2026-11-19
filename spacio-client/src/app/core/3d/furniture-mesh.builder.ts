import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  DEFAULT_FURNITURE_MATERIAL_FINISH,
  DEFAULT_FURNITURE_SLOT_COLOR,
  FURNITURE_BODY_NAME,
  FURNITURE_FINISH_PBR,
  FURNITURE_GROUP_NAME,
  FURNITURE_PART_ID_USER_DATA_KEY,
  FURNITURE_PART_USER_DATA_TYPE,
  FURNITURE_USER_DATA_TYPE,
  GLASS_FINISH_SETTINGS,
  IFurniturePart,
  IFurniturePartMaterialOverride,
  IFurniturePartSculpt,
  IMaterialPresetDefinition,
  IMaterialSlot,
  MATERIAL_PRESET_IDS,
  MATERIAL_PRESET_OPTIONS,
  cloneFurniturePartSculpt,
  createFurniturePartSculpt,
  sculptModeForPartShape,
  TMaterialFinish,
  TMaterialPreset,
} from '@spacio/shared-types';

const CYLINDER_SEGMENTS = 40;
const CAPSULE_CAP_SEGMENTS = 10;
const CAPSULE_RADIAL_SEGMENTS = 24;
const TORUS_RADIAL_SEGMENTS = 16;
const TORUS_TUBULAR_SEGMENTS = 48;
const TURNED_PROFILE_SEGMENTS = 5;
const ROUNDED_BOX_MIN_SEGMENTS = 3;
const ROUNDED_BOX_MAX_SEGMENTS = 8;
const SCULPT_CURVE_SEGMENTS = 10;
const LATHE_SEGMENTS = 56;
const MIN_GEOMETRY_SIZE = 0.001;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export interface IBuildFurnitureMeshOptions {
  ground?: boolean;
  partMaterialOverrides?: Record<string, IFurniturePartMaterialOverride>;
}

interface IPartGeometryResult {
  geometry: THREE.BufferGeometry;
  scale: THREE.Vector3;
}

interface IRadii {
  top: number;
  bottom: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizeColor(value: string | undefined, fallback: string): string {
  return value !== undefined && HEX_COLOR_PATTERN.test(value) ? value : fallback;
}

function presetForLegacyFinish(finish: TMaterialFinish): TMaterialPreset {
  switch (finish) {
    case 'glass':
      return 'glass';
    case 'metallic':
      return 'brushed-brass';
    case 'gloss':
      return 'leather';
    case 'matte':
      return 'boucle';
    default:
      return 'oak';
  }
}

let definitionsById: Map<TMaterialPreset, IMaterialPresetDefinition> | null = null;

function getPreset(preset: TMaterialPreset): IMaterialPresetDefinition {
  if (!definitionsById) {
    definitionsById = new Map<TMaterialPreset, IMaterialPresetDefinition>(
      MATERIAL_PRESET_OPTIONS.map(
        (definition: IMaterialPresetDefinition): [TMaterialPreset, IMaterialPresetDefinition] => [
          definition.id,
          definition,
        ],
      ),
    );
  }
  return definitionsById.get(preset) ?? MATERIAL_PRESET_OPTIONS[0];
}

function getPresetDefinition(
  preset: TMaterialPreset,
  fallback: IMaterialPresetDefinition,
): IMaterialPresetDefinition {
  return MATERIAL_PRESET_IDS.includes(preset) ? getPreset(preset) : fallback;
}

function createPhysicalMaterial(
  definition: IMaterialPresetDefinition,
  color: string,
  name: string,
): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    roughness: definition.roughness,
    metalness: definition.metalness,
    clearcoat: definition.clearcoat,
    clearcoatRoughness: definition.clearcoatRoughness,
    sheen: definition.sheen,
    sheenRoughness: definition.sheenRoughness,
    transmission: definition.transmission,
    thickness: definition.thickness,
    ior: definition.ior,
    envMapIntensity: definition.envMapIntensity,
    transparent: definition.transmission > 0,
    opacity: definition.transmission > 0 ? 1 : 1,
    depthWrite: definition.transmission === 0,
    side: definition.transmission > 0 ? THREE.DoubleSide : THREE.FrontSide,
  });
  material.name = name;
  return material;
}

export function createFurnitureMaterial(
  slot: IMaterialSlot,
  preset: TMaterialPreset | null = null,
): THREE.MeshStandardMaterial {
  const finish: TMaterialFinish = slot.finish ?? DEFAULT_FURNITURE_MATERIAL_FINISH;
  const selectedPreset: TMaterialPreset = preset ?? presetForLegacyFinish(finish);
  const definition: IMaterialPresetDefinition = getPresetDefinition(
    selectedPreset,
    getPreset('oak'),
  );
  const legacyPbr = FURNITURE_FINISH_PBR[finish];
  const roughness: number =
    preset === null && finish === 'glass' ? GLASS_FINISH_SETTINGS.roughness : definition.roughness;
  const physical = createPhysicalMaterial(
    {
      ...definition,
      roughness,
      metalness: preset === null ? legacyPbr.metalness : definition.metalness,
    },
    normalizeColor(slot.color, DEFAULT_FURNITURE_SLOT_COLOR),
    slot.label,
  );
  return physical;
}

export function createFurniturePartMaterial(
  part: IFurniturePart,
  override: IFurniturePartMaterialOverride | undefined,
): THREE.MeshPhysicalMaterial {
  const selectedPreset: TMaterialPreset =
    override?.materialPreset !== undefined && MATERIAL_PRESET_IDS.includes(override.materialPreset)
      ? override.materialPreset
      : part.materialPreset;
  const definition: IMaterialPresetDefinition = getPresetDefinition(
    selectedPreset,
    getPreset('oak'),
  );
  const color: string = normalizeColor(override?.color ?? part.color, definition.swatch);
  return createPhysicalMaterial(definition, color, part.name);
}

function radiiFor(radius: number, taper: number, minimumTopRatio: number): IRadii {
  const amount: number = clamp(taper, -0.5, 0.5);
  const narrowRatio: number = Math.max(minimumTopRatio, 1 - Math.abs(amount) * 1.8);
  if (amount >= 0) {
    return { top: radius * narrowRatio, bottom: radius };
  }
  return { top: radius, bottom: radius * narrowRatio };
}

function createTurnedGeometry(
  bottomRadius: number,
  topRadius: number,
  height: number,
  bevel: number,
): THREE.BufferGeometry {
  const maxBevel: number = Math.min(bottomRadius, topRadius, height / 2) * 0.9;
  const radius: number = clamp(bevel, 0, Math.max(0, maxBevel));
  const bottomY: number = -height / 2;
  const topY: number = height / 2;
  const profile: THREE.Vector2[] = [new THREE.Vector2(0, bottomY)];

  if (radius > MIN_GEOMETRY_SIZE) {
    profile.push(new THREE.Vector2(bottomRadius - radius, bottomY));
    for (let index = 1; index <= TURNED_PROFILE_SEGMENTS; index += 1) {
      const angle: number = -Math.PI / 2 + (index / TURNED_PROFILE_SEGMENTS) * (Math.PI / 2);
      profile.push(
        new THREE.Vector2(
          bottomRadius - radius + radius * Math.cos(angle),
          bottomY + radius + radius * Math.sin(angle),
        ),
      );
    }
  } else {
    profile.push(new THREE.Vector2(bottomRadius, bottomY));
  }

  profile.push(new THREE.Vector2(topRadius, topY - radius));
  if (radius > MIN_GEOMETRY_SIZE) {
    for (let index = 1; index <= TURNED_PROFILE_SEGMENTS; index += 1) {
      const angle: number = (index / TURNED_PROFILE_SEGMENTS) * (Math.PI / 2);
      profile.push(
        new THREE.Vector2(
          topRadius - radius + radius * Math.cos(angle),
          topY - radius + radius * Math.sin(angle),
        ),
      );
    }
  } else {
    profile.push(new THREE.Vector2(topRadius, topY));
  }
  profile.push(new THREE.Vector2(0, topY));

  const geometry = new THREE.LatheGeometry(profile, CYLINDER_SEGMENTS);
  geometry.computeVertexNormals();
  return geometry;
}

function createCapsuleGeometry(
  part: IFurniturePart,
  width: number,
  height: number,
  depth: number,
): IPartGeometryResult {
  const radius: number = Math.max(MIN_GEOMETRY_SIZE, Math.min(width, depth) / 2);
  const length: number = Math.max(MIN_GEOMETRY_SIZE, height - radius * 2);
  const geometry = new THREE.CapsuleGeometry(
    radius,
    length,
    CAPSULE_CAP_SEGMENTS,
    CAPSULE_RADIAL_SEGMENTS,
  );
  const radii: IRadii = radiiFor(radius, part.taper, 0.35);
  const bottomScale: number = radii.bottom / radius;
  const topScale: number = radii.top / radius;
  const positions: THREE.BufferAttribute = geometry.getAttribute(
    'position',
  ) as THREE.BufferAttribute;
  for (let index = 0; index < positions.count; index += 1) {
    const y: number = positions.getY(index);
    const ratio: number = clamp(y / height + 0.5, 0, 1);
    const scale: number = bottomScale + (topScale - bottomScale) * ratio;
    positions.setX(index, positions.getX(index) * scale);
    positions.setZ(index, positions.getZ(index) * scale);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return {
    geometry,
    scale: new THREE.Vector3(width / (radius * 2), 1, depth / (radius * 2)),
  };
}

function midpoint2d(first: THREE.Vector2, second: THREE.Vector2): THREE.Vector2 {
  return new THREE.Vector2((first.x + second.x) / 2, (first.y + second.y) / 2);
}

function resolvePartSculpt(part: IFurniturePart): IFurniturePartSculpt {
  return (
    cloneFurniturePartSculpt(part.sculpt) ??
    createFurniturePartSculpt(
      sculptModeForPartShape(part.shape),
      part.shape === 'lathe-360' ? 'turned-leg' : 'rectangle',
    )
  );
}

function createSculptShape(
  sculpt: IFurniturePartSculpt,
  width: number,
  height: number,
): THREE.Shape {
  const points: THREE.Vector2[] = sculpt.points.map(
    (point): THREE.Vector2 => new THREE.Vector2((point.x - 0.5) * width, (0.5 - point.y) * height),
  );
  const shape = new THREE.Shape();
  if (points.length === 0) {
    shape.moveTo(-width / 2, -height / 2);
    shape.lineTo(width / 2, -height / 2);
    shape.lineTo(width / 2, height / 2);
    shape.lineTo(-width / 2, height / 2);
    shape.closePath();
    return shape;
  }

  const first: THREE.Vector2 = points[0];
  const last: THREE.Vector2 = points[points.length - 1];
  const firstKind = sculpt.points[0].kind;
  const start: THREE.Vector2 = firstKind === 'smooth' ? midpoint2d(first, last) : first;
  shape.moveTo(start.x, start.y);

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const currentKind = sculpt.points[index].kind;
    const nextKind = sculpt.points[(index + 1) % sculpt.points.length].kind;
    if (currentKind === 'smooth') {
      const end: THREE.Vector2 = nextKind === 'smooth' ? midpoint2d(current, next) : next;
      shape.quadraticCurveTo(current.x, current.y, end.x, end.y);
      continue;
    }
    shape.lineTo(current.x, current.y);
    if (nextKind === 'smooth') {
      const mid: THREE.Vector2 = midpoint2d(current, next);
      shape.lineTo(mid.x, mid.y);
    } else {
      shape.lineTo(next.x, next.y);
    }
  }
  shape.closePath();
  return shape;
}

function createLatheProfile(
  sculpt: IFurniturePartSculpt,
  width: number,
  height: number,
): THREE.Vector2[] {
  const points: THREE.Vector2[] = sculpt.points
    .map(
      (point): THREE.Vector2 =>
        new THREE.Vector2(
          Math.max(MIN_GEOMETRY_SIZE, point.x * (width / 2)),
          (0.5 - point.y) * height,
        ),
    )
    .sort((first: THREE.Vector2, second: THREE.Vector2): number => first.y - second.y);
  if (points.length < 2) return points;

  const hasSmooth: boolean = sculpt.points.some((point): boolean => point.kind === 'smooth');
  const profile: THREE.Vector2[] = hasSmooth
    ? new THREE.SplineCurve(points).getPoints((points.length - 1) * SCULPT_CURVE_SEGMENTS)
    : points;
  const bottom: THREE.Vector2 = profile[0];
  const top: THREE.Vector2 = profile[profile.length - 1];
  return [
    new THREE.Vector2(Math.max(MIN_GEOMETRY_SIZE, bottom.x * 0.35), bottom.y),
    ...profile,
    new THREE.Vector2(Math.max(MIN_GEOMETRY_SIZE, top.x * 0.35), top.y),
  ];
}

function applySculptTaper(
  geometry: THREE.BufferGeometry,
  taper: number,
  extent: number,
  axis: 'y' | 'z',
): void {
  const amount: number = clamp(taper, -0.5, 0.5) * 0.6;
  if (Math.abs(amount) < 0.0001 || extent <= 0) return;
  const positions: THREE.BufferAttribute = geometry.getAttribute(
    'position',
  ) as THREE.BufferAttribute;
  for (let index = 0; index < positions.count; index += 1) {
    const coordinate: number = axis === 'y' ? positions.getY(index) : positions.getZ(index);
    const ratio: number = clamp(coordinate / extent + 0.5, 0, 1);
    const factor: number = Math.max(0.2, 1 + amount * (ratio - 0.5));
    positions.setX(index, positions.getX(index) * factor);
    if (axis === 'y') positions.setZ(index, positions.getZ(index) * factor);
    else positions.setY(index, positions.getY(index) * factor);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
}

function createSculptedGeometry(
  part: IFurniturePart,
  sculpt: IFurniturePartSculpt,
  width: number,
  height: number,
  depth: number,
  bevel: number,
): THREE.BufferGeometry {
  if (sculpt.mode === 'lathe') {
    const geometry = new THREE.LatheGeometry(
      createLatheProfile(sculpt, width, height),
      LATHE_SEGMENTS,
    );
    geometry.computeVertexNormals();
    applySculptTaper(geometry, part.taper, height, 'y');
    return geometry;
  }

  const bevelRadius: number = Math.min(
    bevel * Math.min(width, height, depth) * 0.35,
    Math.min(width, height, depth) * 0.22,
  );
  const shapeWidth: number = Math.max(MIN_GEOMETRY_SIZE, width - bevelRadius * 2);
  const shapeHeight: number = Math.max(MIN_GEOMETRY_SIZE, height - bevelRadius * 2);
  const depthBody: number = Math.max(MIN_GEOMETRY_SIZE, depth - bevelRadius * 2);
  const geometry = new THREE.ExtrudeGeometry(createSculptShape(sculpt, shapeWidth, shapeHeight), {
    depth: depthBody,
    bevelEnabled: bevelRadius > MIN_GEOMETRY_SIZE / 2,
    bevelThickness: bevelRadius,
    bevelSize: bevelRadius,
    bevelSegments: 4,
    curveSegments: SCULPT_CURVE_SEGMENTS,
    steps: 1,
  });
  geometry.translate(0, 0, -depthBody / 2);
  geometry.computeVertexNormals();
  applySculptTaper(geometry, part.taper, depthBody, 'z');
  return geometry;
}

function createPartGeometry(part: IFurniturePart): IPartGeometryResult {
  const width: number = Math.max(part.dimensions.width, MIN_GEOMETRY_SIZE);
  const height: number = Math.max(part.dimensions.height, MIN_GEOMETRY_SIZE);
  const depth: number = Math.max(part.dimensions.depth, MIN_GEOMETRY_SIZE);
  const bevel: number = clamp(part.bevel, 0, 1);

  switch (part.shape) {
    case 'cylinder': {
      const radius: number = width / 2;
      const radii: IRadii = radiiFor(radius, part.taper, 0.12);
      const bevelRadius: number = bevel * Math.min(radius, height / 2) * 0.9;
      return {
        geometry: createTurnedGeometry(radii.bottom, radii.top, height, bevelRadius),
        scale: new THREE.Vector3(1, 1, depth / width),
      };
    }
    case 'cone': {
      const radius: number = width / 2;
      const radii: IRadii = radiiFor(radius, part.taper, 0.04);
      const bevelRadius: number = bevel * radius * 0.4;
      return {
        geometry: createTurnedGeometry(radii.bottom, radii.top, height, bevelRadius),
        scale: new THREE.Vector3(1, 1, depth / width),
      };
    }
    case 'capsule':
      return createCapsuleGeometry(part, width, height, depth);
    case 'torus': {
      const outerX: number = width / 2;
      const outerZ: number = depth / 2;
      const baseTube: number = Math.max(
        MIN_GEOMETRY_SIZE,
        Math.min(height / 2, outerX * 0.4, outerZ * 0.4),
      );
      const tubeRadius: number = baseTube * (1 + clamp(part.taper, -0.5, 0.5) * 0.4);
      const majorRadius: number = Math.max(
        MIN_GEOMETRY_SIZE,
        Math.min(outerX, outerZ) - tubeRadius,
      );
      const geometry = new THREE.TorusGeometry(
        majorRadius,
        tubeRadius,
        TORUS_RADIAL_SEGMENTS,
        TORUS_TUBULAR_SEGMENTS,
      );
      geometry.rotateX(Math.PI / 2);
      return {
        geometry,
        scale: new THREE.Vector3(
          outerX / (majorRadius + tubeRadius),
          height / (tubeRadius * 2),
          outerZ / (majorRadius + tubeRadius),
        ),
      };
    }
    case 'extrude-2d':
    case 'lathe-360': {
      const sculpt: IFurniturePartSculpt = resolvePartSculpt(part);
      return {
        geometry: createSculptedGeometry(part, sculpt, width, height, depth, bevel),
        scale: new THREE.Vector3(1, 1, 1),
      };
    }
    case 'box':
    default: {
      const bevelRadius: number = bevel * Math.min(width, height, depth) * 0.48;
      const geometry: THREE.BufferGeometry =
        bevelRadius > MIN_GEOMETRY_SIZE / 2
          ? new RoundedBoxGeometry(
              width,
              height,
              depth,
              Math.round(
                ROUNDED_BOX_MIN_SEGMENTS +
                  bevel * (ROUNDED_BOX_MAX_SEGMENTS - ROUNDED_BOX_MIN_SEGMENTS),
              ),
              bevelRadius,
            )
          : new THREE.BoxGeometry(width, height, depth);
      return { geometry, scale: new THREE.Vector3(1, 1, 1) };
    }
  }
}

export function buildFurnitureMesh(
  parts: readonly IFurniturePart[],
  materials: Record<string, IMaterialSlot>,
  options: IBuildFurnitureMeshOptions = {},
): THREE.Group {
  void materials;
  const group: THREE.Group = new THREE.Group();
  group.name = FURNITURE_GROUP_NAME;
  const body: THREE.Group = new THREE.Group();
  body.name = FURNITURE_BODY_NAME;
  const materialCache: Map<string, THREE.MeshPhysicalMaterial> = new Map<
    string,
    THREE.MeshPhysicalMaterial
  >();

  for (const part of parts) {
    const override: IFurniturePartMaterialOverride | undefined =
      options.partMaterialOverrides?.[part.id];
    const selectedPreset: TMaterialPreset =
      override?.materialPreset !== undefined &&
      MATERIAL_PRESET_IDS.includes(override.materialPreset)
        ? override.materialPreset
        : part.materialPreset;
    const selectedColor: string = normalizeColor(
      override?.color ?? part.color,
      getPreset(selectedPreset).swatch,
    );
    const cacheKey: string = `${selectedPreset}:${selectedColor}`;
    let material: THREE.MeshPhysicalMaterial | undefined = materialCache.get(cacheKey);
    if (!material) {
      material = createFurniturePartMaterial(part, override);
      materialCache.set(cacheKey, material);
    }

    const geometryResult: IPartGeometryResult = createPartGeometry(part);
    const mesh: THREE.Mesh = new THREE.Mesh(geometryResult.geometry, material);
    mesh.name = part.id;
    mesh.position.set(part.position.x, part.position.y, part.position.z);
    mesh.rotation.set(
      THREE.MathUtils.degToRad(part.rotation.x),
      THREE.MathUtils.degToRad(part.rotation.y),
      THREE.MathUtils.degToRad(part.rotation.z),
    );
    mesh.scale.copy(geometryResult.scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = {
      type: FURNITURE_PART_USER_DATA_TYPE,
      [FURNITURE_PART_ID_USER_DATA_KEY]: part.id,
    };
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
    const material: THREE.Material | THREE.Material[] | undefined = mesh.material as
      THREE.Material | THREE.Material[] | undefined;
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
