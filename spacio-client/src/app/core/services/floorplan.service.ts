import { Injectable, Signal, WritableSignal, signal } from '@angular/core';
import {
  DEFAULT_WALL_HEIGHT,
  DEFAULT_WALL_THICKNESS,
  INITIAL_SQUARE_ROOM,
  IWallSegment,
} from '@spacio/shared-types';

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
