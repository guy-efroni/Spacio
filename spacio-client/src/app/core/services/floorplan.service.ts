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

  private readonly _selectedWallId: WritableSignal<string | null> = signal<string | null>(null);
  readonly selectedWallId: Signal<string | null> = this._selectedWallId.asReadonly();

  addWall(wall: IWallSegment): void {
    this._walls.update((walls: IWallSegment[]) => [...walls, wall]);
  }

  removeWall(id: string): void {
    const wasSelected: boolean = this._selectedWallId() === id;
    this._walls.update((walls: IWallSegment[]) => walls.filter((wall: IWallSegment) => wall.id !== id));
    if (wasSelected) {
      this._selectedWallId.set(null);
    }
  }

  removeLastWall(): void {
    const walls: IWallSegment[] = this._walls();
    const removedWall: IWallSegment | undefined = walls[walls.length - 1];
    if (removedWall && this._selectedWallId() === removedWall.id) {
      this._selectedWallId.set(null);
    }
    this._walls.update((walls: IWallSegment[]) => walls.slice(0, -1));
  }

  selectWall(id: string | null): void {
    this._selectedWallId.set(id);
  }

  resetToDefaultRoom(): void {
    this._walls.set(this._createDefaultRoom());
    this._selectedWallId.set(null);
  }

  private _createDefaultRoom(): IWallSegment[] {
    return INITIAL_SQUARE_ROOM.map((wall: IWallSegment) => ({
      ...wall,
      start: { ...wall.start },
      end: { ...wall.end },
    }));
  }
}
