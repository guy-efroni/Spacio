import {
  DEFAULT_BEVEL_RADIUS,
  DEFAULT_EXTRUDE_POINTS,
  DEFAULT_LATHE_POINTS,
  DEFAULT_TUBE_PATH_POINTS,
  DEFAULT_TUBE_RADIUS,
  IFurniturePart,
  IFurniturePoint2D,
  IFurniturePoint3D,
  TPartShape,
  cloneFurniturePart,
} from '@spacio/shared-types';

const HALF: number = 0.5;
const MIN_GEOMETRY_SIZE: number = 0.001;
const CIRCLE_SEGMENTS: number = 16;
const PROFILE_SEGMENTS: number = 8;
const CAP_SEGMENTS: number = 4;
const TORUS_TUBE_RATIO: number = 0.4;
const PART_SHAPE_BOX: TPartShape = 'box';
const PART_SHAPE_ROUNDED_BOX: TPartShape = 'rounded-box';
const PART_SHAPE_CYLINDER: TPartShape = 'cylinder';
const PART_SHAPE_SPHERE: TPartShape = 'sphere';
const PART_SHAPE_CAPSULE: TPartShape = 'capsule';
const PART_SHAPE_CONE: TPartShape = 'cone';
const PART_SHAPE_TORUS: TPartShape = 'torus';
const PART_SHAPE_EXTRUDE: TPartShape = 'extrude-2d';
const PART_SHAPE_LATHE: TPartShape = 'lathe-360';
const PART_SHAPE_TUBE: TPartShape = 'tube-path';

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function safeDimension(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : MIN_GEOMETRY_SIZE;
}

function clonePoints2D(points: readonly IFurniturePoint2D[]): IFurniturePoint2D[] {
  return points.map((point: IFurniturePoint2D): IFurniturePoint2D => ({ ...point }));
}

function clonePoints3D(points: readonly IFurniturePoint3D[]): IFurniturePoint3D[] {
  return points.map((point: IFurniturePoint3D): IFurniturePoint3D => ({ ...point }));
}

function createRectanglePoints(): IFurniturePoint2D[] {
  return [
    { x: -HALF, y: -HALF },
    { x: HALF, y: -HALF },
    { x: HALF, y: HALF },
    { x: -HALF, y: HALF },
  ];
}

function createCylinderProfile(): IFurniturePoint2D[] {
  return [
    { x: 0, y: -HALF },
    { x: HALF, y: -HALF },
    { x: HALF, y: HALF },
    { x: 0, y: HALF },
  ];
}

function createConeProfile(): IFurniturePoint2D[] {
  return [
    { x: 0, y: -HALF },
    { x: HALF, y: -HALF },
    { x: 0, y: HALF },
  ];
}

function createSphereProfile(): IFurniturePoint2D[] {
  const points: IFurniturePoint2D[] = [{ x: 0, y: -HALF }];
  for (let index: number = 1; index < PROFILE_SEGMENTS; index += 1) {
    const y: number = -HALF + index / PROFILE_SEGMENTS;
    const normalized: number = 2 * y;
    const x: number = HALF * Math.sqrt(Math.max(0, 1 - normalized * normalized));
    points.push({ x, y, smooth: true });
  }
  points.push({ x: 0, y: HALF });
  return points;
}

function createCapsuleProfile(width: number, height: number, depth: number): IFurniturePoint2D[] {
  const radius: number = Math.min(safeDimension(width), safeDimension(depth)) / 2;
  const halfHeight: number = safeDimension(height) / 2;
  const capFraction: number = clamp(radius / halfHeight, 0, HALF);
  const points: IFurniturePoint2D[] = [{ x: 0, y: -HALF }];

  for (let index: number = 1; index <= CAP_SEGMENTS; index += 1) {
    const angle: number = -Math.PI / 2 + (Math.PI / 2) * (index / CAP_SEGMENTS);
    points.push({
      x: HALF * Math.cos(angle),
      y: -HALF + capFraction + capFraction * Math.sin(angle),
    });
  }

  const straightTop: number = HALF - capFraction;
  if (straightTop > -HALF + capFraction + MIN_GEOMETRY_SIZE) {
    points.push({ x: HALF, y: straightTop });
  }

  for (let index: number = 0; index <= CAP_SEGMENTS; index += 1) {
    const angle: number = (Math.PI / 2) * (index / CAP_SEGMENTS);
    points.push({
      x: HALF * Math.cos(angle),
      y: straightTop + capFraction * Math.sin(angle),
    });
  }

  return points;
}

function createLatheProfile(shape: TPartShape, width: number, height: number, depth: number): IFurniturePoint2D[] {
  switch (shape) {
    case PART_SHAPE_CYLINDER:
      return createCylinderProfile();
    case PART_SHAPE_CONE:
      return createConeProfile();
    case PART_SHAPE_SPHERE:
      return createSphereProfile();
    case PART_SHAPE_CAPSULE:
      return createCapsuleProfile(width, height, depth);
    default:
      return clonePoints2D(DEFAULT_LATHE_POINTS);
  }
}

function createTorusPath(
  width: number,
  height: number,
  depth: number
): { pathPoints3D: IFurniturePoint3D[]; tubeRadius: number } {
  const outerX: number = safeDimension(width) / 2;
  const outerZ: number = safeDimension(depth) / 2;
  const tubeRadius: number = Math.max(
    MIN_GEOMETRY_SIZE,
    Math.min(safeDimension(height) / 2, outerX * TORUS_TUBE_RATIO, outerZ * TORUS_TUBE_RATIO)
  );
  const majorRadius: number = Math.max(MIN_GEOMETRY_SIZE, Math.min(outerX, outerZ) - tubeRadius);
  const scaleX: number = outerX / (majorRadius + tubeRadius);
  const scaleZ: number = outerZ / (majorRadius + tubeRadius);
  const majorX: number = majorRadius * scaleX;
  const majorZ: number = majorRadius * scaleZ;
  const usableX: number = Math.max(MIN_GEOMETRY_SIZE, outerX - tubeRadius);
  const usableZ: number = Math.max(MIN_GEOMETRY_SIZE, outerZ - tubeRadius);
  const normalizedX: number = clamp(majorX / usableX, -HALF, HALF);
  const normalizedZ: number = clamp(majorZ / usableZ, -HALF, HALF);
  const pathPoints3D: IFurniturePoint3D[] = [];

  for (let index: number = 0; index < CIRCLE_SEGMENTS; index += 1) {
    const angle: number = (Math.PI * 2 * index) / CIRCLE_SEGMENTS;
    pathPoints3D.push({
      x: normalizedX * Math.cos(angle),
      y: 0,
      z: normalizedZ * Math.sin(angle),
    });
  }

  const first: IFurniturePoint3D = pathPoints3D[0];
  pathPoints3D.push({ ...first });
  return { pathPoints3D, tubeRadius };
}

export function convertPartToEditableShape(part: IFurniturePart): IFurniturePart {
  const converted: IFurniturePart = cloneFurniturePart(part);

  switch (part.shape) {
    case PART_SHAPE_BOX:
      return {
        ...converted,
        shape: PART_SHAPE_EXTRUDE,
        bevelRadius: 0,
        points2D: createRectanglePoints(),
        pathPoints3D: undefined,
        tubeRadius: undefined,
      };
    case PART_SHAPE_ROUNDED_BOX:
      return {
        ...converted,
        shape: PART_SHAPE_EXTRUDE,
        bevelRadius: part.bevelRadius ?? DEFAULT_BEVEL_RADIUS,
        points2D: createRectanglePoints(),
        pathPoints3D: undefined,
        tubeRadius: undefined,
      };
    case PART_SHAPE_CYLINDER:
    case PART_SHAPE_CONE:
    case PART_SHAPE_SPHERE:
    case PART_SHAPE_CAPSULE:
      return {
        ...converted,
        shape: PART_SHAPE_LATHE,
        points2D: createLatheProfile(part.shape, part.dimensions.width, part.dimensions.height, part.dimensions.depth),
        pathPoints3D: undefined,
        tubeRadius: undefined,
        bevelRadius: undefined,
      };
    case PART_SHAPE_TORUS: {
      const path: { pathPoints3D: IFurniturePoint3D[]; tubeRadius: number } = createTorusPath(
        part.dimensions.width,
        part.dimensions.height,
        part.dimensions.depth
      );
      return {
        ...converted,
        shape: PART_SHAPE_TUBE,
        points2D: undefined,
        bevelRadius: undefined,
        pathPoints3D: path.pathPoints3D,
        tubeRadius: path.tubeRadius,
      };
    }
    case PART_SHAPE_EXTRUDE:
      return {
        ...converted,
        points2D: part.points2D && part.points2D.length >= 3 ? clonePoints2D(part.points2D) : clonePoints2D(DEFAULT_EXTRUDE_POINTS),
        bevelRadius: part.bevelRadius ?? DEFAULT_BEVEL_RADIUS,
        pathPoints3D: undefined,
        tubeRadius: undefined,
      };
    case PART_SHAPE_LATHE:
      return {
        ...converted,
        points2D: part.points2D && part.points2D.length >= 2 ? clonePoints2D(part.points2D) : clonePoints2D(DEFAULT_LATHE_POINTS),
        pathPoints3D: undefined,
        tubeRadius: undefined,
        bevelRadius: undefined,
      };
    case PART_SHAPE_TUBE:
      return {
        ...converted,
        pathPoints3D:
          part.pathPoints3D && part.pathPoints3D.length >= 2
            ? clonePoints3D(part.pathPoints3D)
            : clonePoints3D(DEFAULT_TUBE_PATH_POINTS),
        tubeRadius: part.tubeRadius ?? DEFAULT_TUBE_RADIUS,
        points2D: undefined,
        bevelRadius: undefined,
      };
    default:
      return converted;
  }
}
