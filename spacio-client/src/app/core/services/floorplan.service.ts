import { Injectable, computed, Signal, WritableSignal, signal } from '@angular/core';
import {
  DEFAULT_DOOR_ELEVATION,
  DEFAULT_DOOR_HEIGHT,
  DEFAULT_DOOR_WIDTH,
  DEFAULT_WINDOW_ELEVATION,
  DEFAULT_WINDOW_HEIGHT,
  DEFAULT_WINDOW_WIDTH,
  INITIAL_SQUARE_ROOM,
  IWallOpening,
  IWallSegment,
  MAX_OPENING_WIDTH,
  MIN_OPENING_WIDTH,
  WallOpeningType,
} from '@spacio/shared-types';
import {
  OpeningGap,
  OpeningHorizontalPlacement,
  OpeningVerticalPlacement,
  getOpeningFreeGaps,
  getWallLength,
  resolveOpeningPlacement,
  resolveOpeningVertical,
} from '../../shared/utils/opening.util';
import { FloorPolygon } from '../types/floor-polygon.type';

const POINT_KEY_PRECISION: number = 3;
const MIN_LOOP_AREA: number = 1e-6;
const OPENING_EPSILON: number = 1e-6;
const MAX_HISTORY_DEPTH: number = 50;
const EDGE_KEY_SEPARATOR: string = '->';
const POINT_KEY_SEPARATOR: string = ',';

type IFloorplanSnapshot = {
  walls: IWallSegment[];
  openings: IWallOpening[];
};

@Injectable({ providedIn: 'root' })
export class FloorplanService {
  private readonly _walls: WritableSignal<IWallSegment[]> = signal<IWallSegment[]>(
    this._createDefaultRoom()
  );
  public readonly walls: Signal<readonly IWallSegment[]> = this._walls.asReadonly();

  private readonly _openings: WritableSignal<IWallOpening[]> = signal<IWallOpening[]>([]);
  public readonly openings: Signal<readonly IWallOpening[]> = this._openings.asReadonly();

  private readonly _selectedWallId: WritableSignal<string | null> = signal<string | null>(null);
  public readonly selectedWallId: Signal<string | null> = this._selectedWallId.asReadonly();

  private readonly _selectedOpeningId: WritableSignal<string | null> = signal<string | null>(null);
  public readonly selectedOpeningId: Signal<string | null> = this._selectedOpeningId.asReadonly();

  private readonly _undoStack: WritableSignal<IFloorplanSnapshot[]> = signal<IFloorplanSnapshot[]>([]);
  private readonly _redoStack: WritableSignal<IFloorplanSnapshot[]> = signal<IFloorplanSnapshot[]>([]);

  public readonly canUndo: Signal<boolean> = computed<boolean>(() => this._undoStack().length > 0);
  public readonly canRedo: Signal<boolean> = computed<boolean>(() => this._redoStack().length > 0);

  private readonly _floorPolygon: Signal<FloorPolygon> = computed<FloorPolygon>(() => this._computeFloorPolygon(this._walls()));
  public readonly floorPolygon: Signal<readonly { x: number; y: number }[] | null> = computed(
    () => this._floorPolygon()?.points ?? null
  );
  public readonly roomArea: Signal<number> = computed(() => this._floorPolygon()?.area ?? 0);

  public addWall(wall: IWallSegment): void {
    this._recordHistory();
    this._walls.update((walls: IWallSegment[]) => [...walls, wall]);
  }

  public removeWall(id: string): void {
    const exists: boolean = this._walls().some((wall: IWallSegment) => wall.id === id);
    if (!exists) {
      return;
    }
    this._recordHistory();
    const wasSelected: boolean = this._selectedWallId() === id;
    this._walls.update((walls: IWallSegment[]) => walls.filter((wall: IWallSegment) => wall.id !== id));
    this._openings.update((openings: IWallOpening[]) => openings.filter((opening: IWallOpening) => opening.wallId !== id));
    if (wasSelected) {
      this._selectedWallId.set(null);
    }
    this._revalidateSelectedOpening();
  }

  public removeLastWall(): void {
    const walls: IWallSegment[] = this._walls();
    if (walls.length === 0) {
      return;
    }
    this._recordHistory();
    const removedWall: IWallSegment | undefined = walls[walls.length - 1];
    if (removedWall && this._selectedWallId() === removedWall.id) {
      this._selectedWallId.set(null);
    }
    this._walls.update((current: IWallSegment[]) => current.slice(0, -1));
    if (removedWall) {
      this._openings.update((openings: IWallOpening[]) =>
        openings.filter((opening: IWallOpening) => opening.wallId !== removedWall.id)
      );
      this._revalidateSelectedOpening();
    }
  }

  public selectWall(id: string | null): void {
    this._selectedWallId.set(id);
  }

  public selectOpening(id: string | null): void {
    this._selectedOpeningId.set(id);
  }

  public addOpeningToWall(wallId: string, type: WallOpeningType): boolean {
    const wall: IWallSegment | undefined = this._walls().find((item: IWallSegment) => item.id === wallId);
    if (!wall) {
      return false;
    }

    const wallLength: number = getWallLength(wall);
    const wallOpenings: IWallOpening[] = this._openings().filter(
      (opening: IWallOpening) => opening.wallId === wallId
    );
    const gaps: OpeningGap[] = getOpeningFreeGaps(wallLength, wallOpenings);
    const usableGaps: OpeningGap[] = gaps.filter(
      (gap: OpeningGap) => gap.end - gap.start + OPENING_EPSILON >= MIN_OPENING_WIDTH
    );
    if (usableGaps.length === 0) {
      return false;
    }

    const largestGap: OpeningGap = usableGaps.reduce((best: OpeningGap, gap: OpeningGap) =>
      gap.end - gap.start > best.end - best.start ? gap : best
    );
    const defaultOpening: IWallOpening = this._createDefaultOpening(wallId, type);
    const width: number = Math.min(
      defaultOpening.width,
      MAX_OPENING_WIDTH,
      largestGap.end - largestGap.start
    );
    if (width + OPENING_EPSILON < MIN_OPENING_WIDTH) {
      return false;
    }

    const vertical: OpeningVerticalPlacement = resolveOpeningVertical(defaultOpening, wall.height);
    const opening: IWallOpening = {
      ...defaultOpening,
      positionAlongWall: largestGap.start + (largestGap.end - largestGap.start - width) / 2,
      width,
      ...vertical,
    };

    this._recordHistory();
    this._openings.update((openings: IWallOpening[]) => [...openings, opening]);
    this._selectedOpeningId.set(opening.id);
    return true;
  }

  public removeOpening(id: string): void {
    const exists: boolean = this._openings().some((opening: IWallOpening) => opening.id === id);
    if (!exists) {
      return;
    }
    this._recordHistory();
    this._openings.update((openings: IWallOpening[]) => openings.filter((opening: IWallOpening) => opening.id !== id));
    if (this._selectedOpeningId() === id) {
      this._selectedOpeningId.set(null);
    }
  }

  public updateOpening(
    id: string,
    updates: Partial<Omit<IWallOpening, 'id' | 'wallId' | 'type'>>
  ): boolean {
    const target: IWallOpening | undefined = this._openings().find((opening: IWallOpening) => opening.id === id);
    if (!target) {
      return false;
    }

    const wall: IWallSegment | undefined = this._walls().find(
      (item: IWallSegment) => item.id === target.wallId
    );
    if (!wall) {
      return false;
    }

    const otherOpenings: IWallOpening[] = this._openings().filter(
      (opening: IWallOpening) => opening.wallId === target.wallId && opening.id !== target.id
    );
    const candidate: IWallOpening = { ...target, ...updates };
    const horizontal: OpeningHorizontalPlacement | null = resolveOpeningPlacement(
      candidate,
      otherOpenings,
      getWallLength(wall)
    );
    if (!horizontal) {
      return false;
    }

    const vertical: OpeningVerticalPlacement = resolveOpeningVertical(candidate, wall.height);
    const next: IWallOpening = { ...candidate, ...horizontal, ...vertical };
    const hasChange: boolean = (
      Object.keys(next) as Array<keyof IWallOpening>
    ).some((key: keyof IWallOpening) => next[key] !== target[key]);
    if (!hasChange) {
      return false;
    }

    this._recordHistory();
    this._openings.update((openings: IWallOpening[]) =>
      openings.map((opening: IWallOpening) => (opening.id === id ? next : opening))
    );
    return true;
  }

  public updateWallProperties(
    id: string,
    updates: Partial<Pick<IWallSegment, 'height' | 'thickness' | 'color'>>
  ): void {
    const target: IWallSegment | undefined = this._walls().find((wall: IWallSegment) => wall.id === id);
    if (!target) {
      return;
    }
    const hasChange: boolean = Object.entries(updates).some(
      ([key, value]: [string, number | string | undefined]) =>
        value !== undefined && target[key as keyof IWallSegment] !== value
    );
    if (!hasChange) {
      return;
    }
    this._recordHistory();
    this._walls.update((walls: IWallSegment[]) =>
      walls.map((wall: IWallSegment) =>
        wall.id === id ? { ...wall, ...updates } : wall
      )
    );
  }

  public resetToDefaultRoom(): void {
    this._recordHistory();
    this._walls.set(this._createDefaultRoom());
    this._openings.set([]);
    this._selectedWallId.set(null);
    this._selectedOpeningId.set(null);
  }

  public clearAllWalls(): void {
    if (this._walls().length === 0 && this._openings().length === 0) {
      return;
    }
    this._recordHistory();
    this._walls.set([]);
    this._openings.set([]);
    this._selectedWallId.set(null);
    this._selectedOpeningId.set(null);
  }

  public undo(): void {
    const undoStack: IFloorplanSnapshot[] = this._undoStack();
    if (undoStack.length === 0) {
      return;
    }
    const previousState: IFloorplanSnapshot = undoStack[undoStack.length - 1];
    const nextUndoStack: IFloorplanSnapshot[] = undoStack.slice(0, -1);
    this._undoStack.set(nextUndoStack);
    this._redoStack.update((stack: IFloorplanSnapshot[]) => [...stack, this._snapshot()]);
    this._restoreSnapshot(previousState);
  }

  public redo(): void {
    const redoStack: IFloorplanSnapshot[] = this._redoStack();
    if (redoStack.length === 0) {
      return;
    }
    const nextState: IFloorplanSnapshot = redoStack[redoStack.length - 1];
    const nextRedoStack: IFloorplanSnapshot[] = redoStack.slice(0, -1);
    this._redoStack.set(nextRedoStack);
    this._undoStack.update((stack: IFloorplanSnapshot[]) => [...stack, this._snapshot()]);
    this._restoreSnapshot(nextState);
  }

  private _recordHistory(): void {
    this._undoStack.update((stack: IFloorplanSnapshot[]) => {
      const next: IFloorplanSnapshot[] = [...stack, this._snapshot()];
      if (next.length > MAX_HISTORY_DEPTH) {
        return next.slice(next.length - MAX_HISTORY_DEPTH);
      }
      return next;
    });
    this._redoStack.set([]);
  }

  private _snapshot(): IFloorplanSnapshot {
    return {
      walls: this._cloneWalls(this._walls()),
      openings: this._cloneOpenings(this._openings()),
    };
  }

  private _restoreSnapshot(snapshot: IFloorplanSnapshot): void {
    this._walls.set(this._cloneWalls(snapshot.walls));
    this._openings.set(this._cloneOpenings(snapshot.openings));
    this._revalidateSelectedWall();
    this._revalidateSelectedOpening();
  }

  private _revalidateSelectedWall(): void {
    const selectedId: string | null = this._selectedWallId();
    if (selectedId === null) {
      return;
    }
    const exists: boolean = this._walls().some((wall: IWallSegment) => wall.id === selectedId);
    if (!exists) {
      this._selectedWallId.set(null);
    }
  }

  private _revalidateSelectedOpening(): void {
    const selectedId: string | null = this._selectedOpeningId();
    if (selectedId === null) {
      return;
    }
    const exists: boolean = this._openings().some((opening: IWallOpening) => opening.id === selectedId);
    if (!exists) {
      this._selectedOpeningId.set(null);
    }
  }

  private _cloneWalls(walls: readonly IWallSegment[]): IWallSegment[] {
    return walls.map((wall: IWallSegment) => ({
      ...wall,
      start: { ...wall.start },
      end: { ...wall.end },
    }));
  }

  private _cloneOpenings(openings: readonly IWallOpening[]): IWallOpening[] {
    return openings.map((opening: IWallOpening) => ({ ...opening }));
  }

  private _createDefaultOpening(wallId: string, type: WallOpeningType): IWallOpening {
    if (type === WallOpeningType.Door) {
      return {
        id: this._generateOpeningId(),
        wallId,
        type,
        positionAlongWall: 0.5,
        width: DEFAULT_DOOR_WIDTH,
        height: DEFAULT_DOOR_HEIGHT,
        elevation: DEFAULT_DOOR_ELEVATION,
      };
    }
    return {
      id: this._generateOpeningId(),
      wallId,
      type,
      positionAlongWall: 0.5,
      width: DEFAULT_WINDOW_WIDTH,
      height: DEFAULT_WINDOW_HEIGHT,
      elevation: DEFAULT_WINDOW_ELEVATION,
    };
  }

  private _generateOpeningId(): string {
    return `opening-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  private _createDefaultRoom(): IWallSegment[] {
    return INITIAL_SQUARE_ROOM.map((wall: IWallSegment) => ({
      ...wall,
      start: { ...wall.start },
      end: { ...wall.end },
    }));
  }

  private _computeFloorPolygon(walls: readonly IWallSegment[]): FloorPolygon {
    if (walls.length < 3) {
      return null;
    }

    const loops: { x: number; y: number }[][] = this._findClosedLoops(walls);

    if (loops.length > 0) {
      let main: FloorPolygon = { points: loops[0], area: this._polygonArea(loops[0]) };
      for (const loop of loops.slice(1)) {
        const area: number = this._polygonArea(loop);
        if (area > main.area) {
          main = { points: loop, area };
        }
      }
      return main.area > MIN_LOOP_AREA ? main : null;
    }

    const uniquePoints: { x: number; y: number }[] = this._uniquePoints(
      walls.flatMap((wall: IWallSegment) => [wall.start, wall.end])
    );
    if (uniquePoints.length < 3) {
      return null;
    }

    const hull: { x: number; y: number }[] = this._convexHull(uniquePoints);
    const area: number = this._polygonArea(hull);
    return area > MIN_LOOP_AREA ? { points: hull, area } : null;
  }

  private _findClosedLoops(walls: readonly IWallSegment[]): { x: number; y: number }[][] {
    const adjacency: Map<string, string[]> = new Map();
    const coordByKey: Map<string, { x: number; y: number }> = new Map();
    const unusedEdges: Set<string> = new Set();

    const addPoint: (point: { x: number; y: number }) => string = (point: { x: number; y: number }): string => {
      const key: string = this._pointKey(point);
      if (!coordByKey.has(key)) {
        coordByKey.set(key, point);
      }
      if (!adjacency.has(key)) {
        adjacency.set(key, []);
      }
      return key;
    };

    for (const wall of walls) {
      const a: string = addPoint(wall.start);
      const b: string = addPoint(wall.end);
      adjacency.get(a)!.push(b);
      adjacency.get(b)!.push(a);
      unusedEdges.add(`${a}${EDGE_KEY_SEPARATOR}${b}`);
      unusedEdges.add(`${b}${EDGE_KEY_SEPARATOR}${a}`);
    }

    const loops: { x: number; y: number }[][] = [];
    const edgeSnapshot: string[] = [...unusedEdges];

    for (const edge of edgeSnapshot) {
      if (!unusedEdges.has(edge)) {
        continue;
      }

      const [fromKey, toKey]: [string, string] = edge.split(EDGE_KEY_SEPARATOR) as [string, string];
      const loopKeys: string[] = [fromKey, toKey];

      unusedEdges.delete(edge);
      unusedEdges.delete(`${toKey}${EDGE_KEY_SEPARATOR}${fromKey}`);

      let prevKey: string = fromKey;
      let currKey: string = toKey;
      const startKey: string = fromKey;

      while (currKey !== startKey) {
        const neighbors: string[] = adjacency.get(currKey)!;
        let nextKey: string | null = null;

        for (const neighbor of neighbors) {
          if (neighbor !== prevKey && unusedEdges.has(`${currKey}${EDGE_KEY_SEPARATOR}${neighbor}`)) {
            nextKey = neighbor;
            break;
          }
        }

        if (nextKey === null) {
          break;
        }

        unusedEdges.delete(`${currKey}${EDGE_KEY_SEPARATOR}${nextKey}`);
        unusedEdges.delete(`${nextKey}${EDGE_KEY_SEPARATOR}${currKey}`);
        prevKey = currKey;
        currKey = nextKey;
        loopKeys.push(currKey);

        if (loopKeys.length > walls.length * 2 + 2) {
          break;
        }
      }

      if (currKey === startKey && loopKeys.length >= 3) {
        loops.push(loopKeys.map((key: string) => coordByKey.get(key)!));
      }
    }

    return loops;
  }

  private _polygonArea(points: readonly { x: number; y: number }[]): number {
    let area: number = 0;
    for (let i: number = 0; i < points.length; i++) {
      const p1: { x: number; y: number } = points[i];
      const p2: { x: number; y: number } = points[(i + 1) % points.length];
      area += p1.x * p2.y - p2.x * p1.y;
    }
    return Math.abs(area) / 2;
  }

  private _uniquePoints(points: readonly { x: number; y: number }[]): { x: number; y: number }[] {
    const seen: Set<string> = new Set();
    const unique: { x: number; y: number }[] = [];
    for (const point of points) {
      const key: string = this._pointKey(point);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(point);
      }
    }
    return unique;
  }

  private _convexHull(points: readonly { x: number; y: number }[]): { x: number; y: number }[] {
    const sorted: { x: number; y: number }[] = [...points].sort(
      (a: { x: number; y: number }, b: { x: number; y: number }) =>
        a.x === b.x ? a.y - b.y : a.x - b.x
    );

    const cross = (
      o: { x: number; y: number },
      a: { x: number; y: number },
      b: { x: number; y: number }
    ): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

    const lower: { x: number; y: number }[] = [];
    for (const point of sorted) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
        lower.pop();
      }
      lower.push(point);
    }

    const upper: { x: number; y: number }[] = [];
    for (let i: number = sorted.length - 1; i >= 0; i--) {
      const point: { x: number; y: number } = sorted[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
        upper.pop();
      }
      upper.push(point);
    }

    upper.pop();
    lower.pop();
    return [...lower, ...upper];
  }

  private _pointKey(point: { x: number; y: number }): string {
    return `${point.x.toFixed(POINT_KEY_PRECISION)}${POINT_KEY_SEPARATOR}${point.y.toFixed(POINT_KEY_PRECISION)}`;
  }
}
