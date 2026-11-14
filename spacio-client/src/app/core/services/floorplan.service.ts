import { Injectable, computed, Signal, WritableSignal, signal } from '@angular/core';
import {
  INITIAL_SQUARE_ROOM,
  IWallSegment,
} from '@spacio/shared-types';
import { FloorPolygon } from '../types/floor-polygon.type';

const POINT_KEY_PRECISION: number = 3;
const MIN_LOOP_AREA: number = 1e-6;
const MAX_HISTORY_DEPTH: number = 50;
const EDGE_KEY_SEPARATOR: string = '->';
const POINT_KEY_SEPARATOR: string = ',';

@Injectable({ providedIn: 'root' })
export class FloorplanService {
  private readonly _walls: WritableSignal<IWallSegment[]> = signal<IWallSegment[]>(
    this._createDefaultRoom()
  );
  public readonly walls: Signal<readonly IWallSegment[]> = this._walls.asReadonly();

  private readonly _selectedWallId: WritableSignal<string | null> = signal<string | null>(null);
  public readonly selectedWallId: Signal<string | null> = this._selectedWallId.asReadonly();

  private readonly _undoStack: WritableSignal<IWallSegment[][]> = signal<IWallSegment[][]>([]);
  private readonly _redoStack: WritableSignal<IWallSegment[][]> = signal<IWallSegment[][]>([]);

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
    if (wasSelected) {
      this._selectedWallId.set(null);
    }
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
  }

  public selectWall(id: string | null): void {
    this._selectedWallId.set(id);
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
    this._selectedWallId.set(null);
  }

  public clearAllWalls(): void {
    if (this._walls().length === 0) {
      return;
    }
    this._recordHistory();
    this._walls.set([]);
    this._selectedWallId.set(null);
  }

  public undo(): void {
    const undoStack: IWallSegment[][] = this._undoStack();
    if (undoStack.length === 0) {
      return;
    }
    const previousState: IWallSegment[] = undoStack[undoStack.length - 1];
    const nextUndoStack: IWallSegment[][] = undoStack.slice(0, -1);
    this._undoStack.set(nextUndoStack);
    this._redoStack.update((stack: IWallSegment[][]) => [...stack, this._cloneWalls(this._walls())]);
    this._walls.set(this._cloneWalls(previousState));
    this._revalidateSelectedWall();
  }

  public redo(): void {
    const redoStack: IWallSegment[][] = this._redoStack();
    if (redoStack.length === 0) {
      return;
    }
    const nextState: IWallSegment[] = redoStack[redoStack.length - 1];
    const nextRedoStack: IWallSegment[][] = redoStack.slice(0, -1);
    this._redoStack.set(nextRedoStack);
    this._undoStack.update((stack: IWallSegment[][]) => [...stack, this._cloneWalls(this._walls())]);
    this._walls.set(this._cloneWalls(nextState));
    this._revalidateSelectedWall();
  }

  private _recordHistory(): void {
    this._undoStack.update((stack: IWallSegment[][]) => {
      const next: IWallSegment[][] = [...stack, this._cloneWalls(this._walls())];
      if (next.length > MAX_HISTORY_DEPTH) {
        return next.slice(next.length - MAX_HISTORY_DEPTH);
      }
      return next;
    });
    this._redoStack.set([]);
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

  private _cloneWalls(walls: readonly IWallSegment[]): IWallSegment[] {
    return walls.map((wall: IWallSegment) => ({
      ...wall,
      start: { ...wall.start },
      end: { ...wall.end },
    }));
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
