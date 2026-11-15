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
  OpeningPlacementBounds,
  getOpeningPlacementBounds,
} from '../../shared/utils/opening.util';
import {
  DEFAULT_WALL_HEIGHT,
  DEFAULT_WALL_THICKNESS,
  IWallOpening,
  IWallSegment,
  MAX_OPENING_ELEVATION,
  MAX_OPENING_HEIGHT,
  MAX_OPENING_WIDTH,
  MAX_WALL_HEIGHT,
  MAX_WALL_THICKNESS,
  MIN_OPENING_ELEVATION,
  MIN_OPENING_HEIGHT,
  MIN_OPENING_WIDTH,
  MIN_WALL_HEIGHT,
  MIN_WALL_PIER,
  MIN_WALL_THICKNESS,
  WALL_COLOR_PRESETS,
  WallOpeningType,
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

  public readonly wallOpeningType: typeof WallOpeningType = WallOpeningType;
  public readonly colorPresets: readonly WallColorPreset[] = WALL_COLOR_PRESETS;
  public readonly minHeight: number = MIN_WALL_HEIGHT;
  public readonly maxHeight: number = MAX_WALL_HEIGHT;
  public readonly minThickness: number = MIN_WALL_THICKNESS;
  public readonly maxThickness: number = MAX_WALL_THICKNESS;
  public readonly heightStep: number = 0.1;
  public readonly thicknessStep: number = 0.05;

  public readonly wallOpenings: Signal<readonly IWallOpening[]> = computed<readonly IWallOpening[]>(() => {
    const id: string | null = this._floorplanService.selectedWallId();
    if (!id) return [];
    return this._floorplanService
      .openings()
      .filter((opening: IWallOpening) => opening.wallId === id);
  });

  public readonly minOpeningWidth: number = MIN_OPENING_WIDTH;
  public readonly maxOpeningWidth: number = MAX_OPENING_WIDTH;
  public readonly minOpeningHeight: number = MIN_OPENING_HEIGHT;
  public readonly maxOpeningHeight: number = MAX_OPENING_HEIGHT;
  public readonly minOpeningElevation: number = MIN_OPENING_ELEVATION;
  public readonly maxOpeningElevation: number = MAX_OPENING_ELEVATION;
  public readonly openingWidthStep: number = 0.05;
  public readonly openingHeightStep: number = 0.05;
  public readonly openingElevationStep: number = 0.05;
  public readonly openingPositionStep: number = 0.05;

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

  public onAddDoor(): void {
    const id: string | null = this._floorplanService.selectedWallId();
    if (id) {
      this._floorplanService.addOpeningToWall(id, WallOpeningType.Door);
    }
  }

  public onAddWindow(): void {
    const id: string | null = this._floorplanService.selectedWallId();
    if (id) {
      this._floorplanService.addOpeningToWall(id, WallOpeningType.Window);
    }
  }

  public onRemoveOpening(id: string): void {
    this._floorplanService.removeOpening(id);
  }

  public openingBounds(opening: IWallOpening): OpeningPlacementBounds | null {
    const otherOpenings: IWallOpening[] = this.wallOpenings().filter(
      (item: IWallOpening) => item.id !== opening.id
    );
    return getOpeningPlacementBounds(opening, otherOpenings, this.wallLength());
  }

  public openingMinPosition(_opening: IWallOpening): number {
    return MIN_WALL_PIER;
  }

  public openingMaxPosition(opening: IWallOpening): number {
    return Math.max(
      MIN_WALL_PIER,
      this.wallLength() - MIN_WALL_PIER - opening.width
    );
  }

  public openingMaxWidth(opening: IWallOpening): number {
    return this.openingBounds(opening)?.maxWidth ?? this.maxOpeningWidth;
  }

  public openingMaxHeight(opening: IWallOpening): number {
    const wall: IWallSegment | null = this.selectedWall();
    if (!wall) return this.maxOpeningHeight;
    return Math.max(
      this.minOpeningHeight,
      Math.min(this.maxOpeningHeight, wall.height - opening.elevation)
    );
  }

  public openingMaxElevation(opening: IWallOpening): number {
    const wall: IWallSegment | null = this.selectedWall();
    if (!wall) return this.maxOpeningElevation;
    return Math.max(
      this.minOpeningElevation,
      Math.min(this.maxOpeningElevation, wall.height - opening.height)
    );
  }

  public formatOpeningValue(value: number): string {
    return Number.isFinite(value) ? value.toFixed(2) : '0.00';
  }

  public onOpeningPositionChange(id: string, value: number): void {
    if (!Number.isFinite(value)) return;
    const opening: IWallOpening | undefined = this.wallOpenings().find(
      (item: IWallOpening) => item.id === id
    );
    if (!opening) return;
    this._floorplanService.updateOpening(id, {
      positionAlongWall: Math.min(
        this.openingMaxPosition(opening),
        Math.max(MIN_WALL_PIER, value)
      ),
    });
  }

  public onOpeningWidthChange(id: string, value: number): void {
    if (!Number.isFinite(value)) return;
    const opening: IWallOpening | undefined = this.wallOpenings().find(
      (item: IWallOpening) => item.id === id
    );
    if (!opening) return;
    const bounds: OpeningPlacementBounds | null = this.openingBounds(opening);
    const minWidth: number = bounds?.minWidth ?? this.minOpeningWidth;
    const maxWidth: number = bounds?.maxWidth ?? this.maxOpeningWidth;
    this._floorplanService.updateOpening(id, {
      width: Math.min(maxWidth, Math.max(minWidth, value)),
    });
  }

  public onOpeningHeightChange(id: string, value: number): void {
    if (!Number.isFinite(value)) return;
    const opening: IWallOpening | undefined = this.wallOpenings().find(
      (item: IWallOpening) => item.id === id
    );
    if (!opening) return;
    this._floorplanService.updateOpening(id, {
      height: Math.min(this.openingMaxHeight(opening), Math.max(this.minOpeningHeight, value)),
    });
  }

  public onOpeningElevationChange(id: string, value: number): void {
    if (!Number.isFinite(value)) return;
    const opening: IWallOpening | undefined = this.wallOpenings().find(
      (item: IWallOpening) => item.id === id
    );
    if (!opening) return;
    this._floorplanService.updateOpening(id, {
      elevation: Math.min(this.openingMaxElevation(opening), Math.max(this.minOpeningElevation, value)),
    });
  }
}
