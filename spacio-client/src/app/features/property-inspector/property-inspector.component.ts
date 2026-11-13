import {
  Component,
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

@Component({
  selector: 'app-property-inspector',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './property-inspector.component.html',
  styleUrl: './property-inspector.component.scss',
})
export class PropertyInspectorComponent {
  private readonly _floorplanService = inject(FloorplanService);

  protected readonly selectedWall = computed<IWallSegment | null>(() => {
    const id = this._floorplanService.selectedWallId();
    if (!id) return null;
    return this._floorplanService.walls().find((w) => w.id === id) ?? null;
  });

  protected readonly wallLength = computed(() => {
    const wall = this.selectedWall();
    if (!wall) return 0;
    const dx = wall.end.x - wall.start.x;
    const dz = wall.end.y - wall.start.y;
    return Math.sqrt(dx * dx + dz * dz);
  });

  protected readonly wallIdSuffix = computed(() => {
    const wall = this.selectedWall();
    if (!wall) return 'unknown';
    const parts = wall.id.split('-');
    return parts[parts.length - 1] ?? 'unknown';
  });

  protected readonly height = signal<number>(DEFAULT_WALL_HEIGHT);
  protected readonly thickness = signal<number>(DEFAULT_WALL_THICKNESS);
  protected readonly color = signal<string>('#e2e8f0');

  protected readonly colorPresets = WALL_COLOR_PRESETS;
  protected readonly minHeight = MIN_WALL_HEIGHT;
  protected readonly maxHeight = MAX_WALL_HEIGHT;
  protected readonly minThickness = MIN_WALL_THICKNESS;
  protected readonly maxThickness = MAX_WALL_THICKNESS;
  protected readonly heightStep = 0.1;
  protected readonly thicknessStep = 0.05;

  constructor() {
    // Initialize from selected wall when component is created
    effect(() => {
      const wall = this.selectedWall();
      if (wall) {
        this.height.set(wall.height);
        this.thickness.set(wall.thickness);
        this.color.set(wall.color);
      }
    });
  }

  protected onHeightChange(value: number): void {
    this.height.set(value);
    const id = this._floorplanService.selectedWallId();
    if (id) {
      this._floorplanService.updateWallProperties(id, { height: value });
    }
  }

  protected onThicknessChange(value: number): void {
    this.thickness.set(value);
    const id = this._floorplanService.selectedWallId();
    if (id) {
      this._floorplanService.updateWallProperties(id, { thickness: value });
    }
  }

  protected onColorChange(value: string): void {
    this.color.set(value);
    const id = this._floorplanService.selectedWallId();
    if (id) {
      this._floorplanService.updateWallProperties(id, { color: value });
    }
  }

  protected onDeselect(): void {
    this._floorplanService.selectWall(null);
  }

  protected onDeleteWall(): void {
    const id = this._floorplanService.selectedWallId();
    if (id) {
      this._floorplanService.removeWall(id);
    }
  }
}