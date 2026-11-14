import {
  Component,
  Signal,
  WritableSignal,
  computed,
  inject,
  signal,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { FloorplanService } from '../../core/services/floorplan.service';
import {
  DEFAULT_WALL_HEIGHT,
  DEFAULT_WALL_THICKNESS,
  MAX_WALL_HEIGHT,
  MIN_WALL_HEIGHT,
  MAX_WALL_THICKNESS,
  MIN_WALL_THICKNESS,
  WALL_COLOR_PRESETS,
  IWallSegment,
} from '@spacio/shared-types';

type WallColorPreset = { readonly name: string; readonly value: string };

@Component({
  selector: 'app-property-inspector',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './property-inspector.component.html',
  styleUrl: './property-inspector.component.scss',
})
export class PropertyInspectorComponent {
  private readonly _floorplanService: FloorplanService = inject(FloorplanService);

  public readonly selectedWall: Signal<IWallSegment | null> = computed<IWallSegment | null>(
    () => {
      const id: string | null = this._floorplanService.selectedWallId();
      if (!id) return null;
      return this._floorplanService.walls().find((wall: IWallSegment) => wall.id === id) ?? null;
    }
  );

  public readonly wallLength: Signal<number> = computed<number>(() => {
    const wall: IWallSegment | null = this.selectedWall();
    if (!wall) return 0;
    const dx: number = wall.end.x - wall.start.x;
    const dz: number = wall.end.y - wall.start.y;
    return Math.sqrt(dx * dx + dz * dz);
  });

  public readonly wallIdSuffix: Signal<string> = computed<string>(() => {
    const wall: IWallSegment | null = this.selectedWall();
    if (!wall) return 'unknown';
    const parts: string[] = wall.id.split('-');
    return parts[parts.length - 1] ?? 'unknown';
  });

  public readonly height: WritableSignal<number> = signal<number>(DEFAULT_WALL_HEIGHT);
  public readonly thickness: WritableSignal<number> = signal<number>(DEFAULT_WALL_THICKNESS);
  public readonly color: WritableSignal<string> = signal<string>('#e2e8f0');

  public readonly colorPresets: readonly WallColorPreset[] = WALL_COLOR_PRESETS;
  public readonly minHeight: number = MIN_WALL_HEIGHT;
  public readonly maxHeight: number = MAX_WALL_HEIGHT;
  public readonly minThickness: number = MIN_WALL_THICKNESS;
  public readonly maxThickness: number = MAX_WALL_THICKNESS;
  public readonly heightStep: number = 0.1;
  public readonly thicknessStep: number = 0.05;

  public constructor() {
    // Initialize from selected wall when component is created
    effect((): void => {
      const wall: IWallSegment | null = this.selectedWall();
      if (wall) {
        this.height.set(wall.height);
        this.thickness.set(wall.thickness);
        this.color.set(wall.color);
      }
    });
  }

  public onHeightChange(value: number): void {
    this.height.set(value);
    const id: string | null = this._floorplanService.selectedWallId();
    if (id) {
      this._floorplanService.updateWallProperties(id, { height: value });
    }
  }

  public onThicknessChange(value: number): void {
    this.thickness.set(value);
    const id: string | null = this._floorplanService.selectedWallId();
    if (id) {
      this._floorplanService.updateWallProperties(id, { thickness: value });
    }
  }

  public onColorChange(value: string): void {
    this.color.set(value);
    const id: string | null = this._floorplanService.selectedWallId();
    if (id) {
      this._floorplanService.updateWallProperties(id, { color: value });
    }
  }

  public onDeselect(): void {
    this._floorplanService.selectWall(null);
  }

  public onDeleteWall(): void {
    const id: string | null = this._floorplanService.selectedWallId();
    if (id) {
      this._floorplanService.removeWall(id);
    }
  }
}
