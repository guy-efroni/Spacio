import {
  IWallOpening,
  IWallSegment,
  MAX_OPENING_ELEVATION,
  MAX_OPENING_HEIGHT,
  MAX_OPENING_WIDTH,
  MIN_OPENING_ELEVATION,
  MIN_OPENING_GAP,
  MIN_OPENING_HEIGHT,
  MIN_OPENING_WIDTH,
  MIN_WALL_PIER,
} from '@spacio/shared-types';

const OPENING_EPSILON: number = 1e-6;

export type OpeningGap = {
  start: number;
  end: number;
};

export type OpeningHorizontalPlacement = Pick<IWallOpening, 'positionAlongWall' | 'width'>;

export type OpeningVerticalPlacement = Pick<IWallOpening, 'height' | 'elevation'>;

export type OpeningPlacementBounds = {
  wallLength: number;
  minPosition: number;
  maxPosition: number;
  minWidth: number;
  maxWidth: number;
};

type OpeningFit = {
  start: number;
  end: number;
  width: number;
};

export function getWallLength(wall: IWallSegment): number {
  const dx: number = wall.end.x - wall.start.x;
  const dz: number = wall.end.y - wall.start.y;
  return Math.sqrt(dx * dx + dz * dz);
}

export function getOpeningFreeGaps(
  wallLength: number,
  otherOpenings: ReadonlyArray<OpeningHorizontalPlacement>
): OpeningGap[] {
  const usableStart: number = MIN_WALL_PIER;
  const usableEnd: number = wallLength - MIN_WALL_PIER;

  if (!Number.isFinite(wallLength) || usableEnd - usableStart <= OPENING_EPSILON) {
    return [];
  }

  const blockers: OpeningGap[] = otherOpenings
    .filter(
      (opening: OpeningHorizontalPlacement) =>
        Number.isFinite(opening.positionAlongWall) && Number.isFinite(opening.width)
    )
    .map((opening: OpeningHorizontalPlacement): OpeningGap => ({
      start: opening.positionAlongWall - MIN_OPENING_GAP,
      end: opening.positionAlongWall + Math.max(opening.width, 0) + MIN_OPENING_GAP,
    }))
    .sort((a: OpeningGap, b: OpeningGap) => a.start - b.start);

  const gaps: OpeningGap[] = [];
  let cursor: number = usableStart;

  for (const blocker of blockers) {
    const blockStart: number = Math.max(usableStart, blocker.start);
    const blockEnd: number = Math.min(usableEnd, blocker.end);

    if (blockEnd <= usableStart || blockStart >= usableEnd) {
      continue;
    }

    if (blockStart > cursor + OPENING_EPSILON) {
      gaps.push({ start: cursor, end: Math.min(blockStart, usableEnd) });
    }

    cursor = Math.max(cursor, blockEnd);

    if (cursor >= usableEnd - OPENING_EPSILON) {
      break;
    }
  }

  if (cursor < usableEnd - OPENING_EPSILON) {
    gaps.push({ start: cursor, end: usableEnd });
  }

  return gaps.filter((gap: OpeningGap) => gap.end - gap.start > OPENING_EPSILON);
}

export function resolveOpeningPlacement(
  opening: OpeningHorizontalPlacement,
  otherOpenings: ReadonlyArray<OpeningHorizontalPlacement>,
  wallLength: number
): OpeningHorizontalPlacement | null {
  const usableWidth: number = wallLength - MIN_WALL_PIER * 2;
  const maxWidth: number = Math.min(MAX_OPENING_WIDTH, usableWidth);

  if (maxWidth + OPENING_EPSILON < MIN_OPENING_WIDTH) {
    return null;
  }

  const gaps: OpeningGap[] = getOpeningFreeGaps(wallLength, otherOpenings);
  if (gaps.length === 0) {
    return null;
  }

  const requestedWidth: number = clamp(
    Number.isFinite(opening.width) ? opening.width : MIN_OPENING_WIDTH,
    MIN_OPENING_WIDTH,
    maxWidth
  );
  const requestedPosition: number = Number.isFinite(opening.positionAlongWall)
    ? opening.positionAlongWall
    : MIN_WALL_PIER;

  const fullWidthFit: OpeningFit | null = findBestOpeningFit(
    gaps,
    requestedPosition,
    requestedWidth,
    requestedWidth
  );
  if (fullWidthFit) {
    return {
      positionAlongWall: clamp(requestedPosition, fullWidthFit.start, fullWidthFit.end),
      width: fullWidthFit.width,
    };
  }

  const partialWidthFit: OpeningFit | null = findBestOpeningFit(
    gaps,
    requestedPosition,
    MIN_OPENING_WIDTH,
    requestedWidth
  );
  if (!partialWidthFit) {
    return null;
  }

  return {
    positionAlongWall: clamp(requestedPosition, partialWidthFit.start, partialWidthFit.end),
    width: partialWidthFit.width,
  };
}

export function resolveOpeningVertical(
  opening: OpeningVerticalPlacement,
  wallHeight: number
): OpeningVerticalPlacement {
  const safeWallHeight: number = Number.isFinite(wallHeight) ? Math.max(wallHeight, 0) : 0;
  const maxHeight: number = Math.min(MAX_OPENING_HEIGHT, safeWallHeight);
  const minHeight: number = Math.min(MIN_OPENING_HEIGHT, maxHeight);
  const height: number = clamp(
    Number.isFinite(opening.height) ? opening.height : minHeight,
    minHeight,
    maxHeight
  );
  const maxElevation: number = Math.max(
    MIN_OPENING_ELEVATION,
    Math.min(MAX_OPENING_ELEVATION, safeWallHeight - height)
  );
  const elevation: number = clamp(
    Number.isFinite(opening.elevation) ? opening.elevation : MIN_OPENING_ELEVATION,
    MIN_OPENING_ELEVATION,
    maxElevation
  );

  return { height, elevation };
}

export function getOpeningPlacementBounds(
  opening: OpeningHorizontalPlacement,
  otherOpenings: ReadonlyArray<OpeningHorizontalPlacement>,
  wallLength: number
): OpeningPlacementBounds | null {
  const usableWidth: number = wallLength - MIN_WALL_PIER * 2;
  const maxAllowedWidth: number = Math.min(MAX_OPENING_WIDTH, usableWidth);

  if (maxAllowedWidth + OPENING_EPSILON < MIN_OPENING_WIDTH) {
    return null;
  }

  const gaps: OpeningGap[] = getOpeningFreeGaps(wallLength, otherOpenings);
  if (gaps.length === 0) {
    return null;
  }

  const gap: OpeningGap = findNearestGap(gaps, opening.positionAlongWall);
  const gapLength: number = gap.end - gap.start;
  const maxWidth: number = Math.min(maxAllowedWidth, gapLength);

  if (maxWidth + OPENING_EPSILON < MIN_OPENING_WIDTH) {
    return null;
  }

  const minWidth: number = MIN_OPENING_WIDTH;
  const width: number = clamp(
    Number.isFinite(opening.width) ? opening.width : minWidth,
    minWidth,
    maxWidth
  );

  return {
    wallLength,
    minPosition: gap.start,
    maxPosition: Math.max(gap.start, gap.end - width),
    minWidth,
    maxWidth,
  };
}

function findBestOpeningFit(
  gaps: ReadonlyArray<OpeningGap>,
  position: number,
  requiredGapWidth: number,
  requestedWidth: number
): OpeningFit | null {
  let best: OpeningFit | null = null;
  let bestDistance: number = Number.POSITIVE_INFINITY;

  for (const gap of gaps) {
    const gapLength: number = gap.end - gap.start;
    if (gapLength + OPENING_EPSILON < requiredGapWidth) {
      continue;
    }

    const width: number = Math.min(requestedWidth, gapLength);
    const start: number = gap.start;
    const end: number = gap.end - width;
    if (end + OPENING_EPSILON < start) {
      continue;
    }

    const distance: number = distanceToInterval(position, start, end);
    if (distance < bestDistance - OPENING_EPSILON) {
      best = { start, end, width };
      bestDistance = distance;
    }
  }

  return best;
}

function findNearestGap(gaps: ReadonlyArray<OpeningGap>, position: number): OpeningGap {
  const target: number = Number.isFinite(position) ? position : MIN_WALL_PIER;
  let nearest: OpeningGap = gaps[0];

  for (const gap of gaps) {
    const currentDistance: number = distanceToInterval(target, gap.start, gap.end);
    const nearestDistance: number = distanceToInterval(target, nearest.start, nearest.end);
    if (currentDistance < nearestDistance - OPENING_EPSILON) {
      nearest = gap;
    }
  }

  return nearest;
}

function distanceToInterval(value: number, start: number, end: number): number {
  if (value < start) {
    return start - value;
  }
  if (value > end) {
    return value - end;
  }
  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
