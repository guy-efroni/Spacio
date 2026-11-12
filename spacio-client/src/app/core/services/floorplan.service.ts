import { Injectable, Signal, WritableSignal, signal } from '@angular/core';
import { IWallSegment } from '@spacio/shared-types';

const DEFAULT_WALL_HEIGHT = 3;
const DEFAULT_WALL_THICKNESS = 0.2;

const INITIAL_SQUARE_ROOM: IWallSegment[] = [
  {
    id: 'wall-1',
    start: { x: -4, y: -4 },
    end: { x: 4, y: -4 },
    height: DEFAULT_WALL_HEIGHT,
    thickness: DEFAULT_WALL_THICKNESS,
  },
  {
    id: 'wall-2',
    start: { x: 4, y: -4 },
    end: { x: 4, y: 4 },
    height: DEFAULT_WALL_HEIGHT,
    thickness: DEFAULT_WALL_THICKNESS,
  },
  {
    id: 'wall-3',
    start: { x: 4, y: 4 },
    end: { x: -4, y: 4 },
    height: DEFAULT_WALL_HEIGHT,
    thickness: DEFAULT_WALL_THICKNESS,
  },
  {
    id: 'wall-4',
    start: { x: -4, y: 4 },
    end: { x: -4, y: -4 },
    height: DEFAULT_WALL_HEIGHT,
    thickness: DEFAULT_WALL_THICKNESS,
  },
];

@Injectable({ providedIn: 'root' })
export class FloorplanService {
  private readonly _walls: WritableSignal<IWallSegment[]> = signal<IWallSegment[]>(
    this._createDefaultRoom()
  );
  readonly walls: Signal<readonly IWallSegment[]> = this._walls.asReadonly();

  addWall(wall: IWallSegment): void {
    this._walls.update((walls: IWallSegment[]) => [...walls, wall]);
  }

  removeLastWall(): void {
    this._walls.update((walls: IWallSegment[]) => walls.slice(0, -1));
  }

  resetToDefaultRoom(): void {
    this._walls.set(this._createDefaultRoom());
  }

  private _createDefaultRoom(): IWallSegment[] {
    return INITIAL_SQUARE_ROOM.map((wall: IWallSegment) => ({
      ...wall,
      start: { ...wall.start },
      end: { ...wall.end },
    }));
  }
}
