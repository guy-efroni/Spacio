import {
  Component,
  Signal,
  WritableSignal,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, TitleCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { FloorplanService } from '../../core/services/floorplan.service';
import { BlueprintService } from '../../core/services/blueprint.service';
import { OpeningPlacementBounds, getOpeningPlacementBounds } from '../../shared/utils/opening.util';
import {
  DEFAULT_WALL_HEIGHT,
  DEFAULT_WALL_THICKNESS,
  FURNITURE_FINISH_PBR,
  IMaterialSlot,
  IPlacedFurniture,
  IWallOpening,
  IWallSegment,
  MATERIAL_FINISH_OPTIONS,
  MATERIAL_FINISH_PRESETS,
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
  TMaterialFinish,
  WALL_COLOR_PRESETS,
  WallOpeningType,
  createDefaultOpeningMaterials,
  createDefaultOpeningStyleOptions,
} from '@spacio/shared-types';

type WallColorPreset = { readonly name: string; readonly value: string };

@Component({
  selector: 'app-property-inspector',
  standalone: true,
  imports: [FormsModule, DecimalPipe, TitleCasePipe],
  templateUrl: './property-inspector.component.html',
  styleUrl: './property-inspector.component.scss',
})
export class PropertyInspectorComponent {
  private readonly _floorplanService: FloorplanService = inject(FloorplanService);
  private readonly _blueprintService: BlueprintService = inject(BlueprintService);
  private readonly _router: Router = inject(Router);

  public readonly selectedWall: Signal<IWallSegment | null> = computed<IWallSegment | null>(() => {
    const id: string | null = this._floorplanService.selectedWallId();
    if (!id) return null;
    return this._floorplanService.walls().find((wall: IWallSegment) => wall.id === id) ?? null;
  });

  public readonly selectedFurniture: Signal<IPlacedFurniture | null> = computed<IPlacedFurniture | null>(() => {
    const id: string | null = this._floorplanService.selectedFurnitureId();
    if (!id) return null;
    return this._floorplanService.furniture().find((item: IPlacedFurniture) => item.id === id) ?? null;
  });

  public readonly selectionMode: Signal<'wall' | 'furniture' | 'none'> = computed<'wall' | 'furniture' | 'none'>(() => {
    if (this.selectedFurniture()) return 'furniture';
    if (this.selectedWall()) return 'wall';
    return 'none';
  });

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

  public readonly furnitureIdSuffix: Signal<string> = computed<string>(() => {
    const item: IPlacedFurniture | null = this.selectedFurniture();
    if (!item) return 'unknown';
    const parts: string[] = item.id.split('-');
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
    return this._floorplanService.openings().filter((opening: IWallOpening) => opening.wallId === id);
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

  public readonly furnitureScaleStep: number = 0.05;
  public readonly minFurnitureScale: number = 0.2;
  public readonly maxFurnitureScale: number = 5;
  public readonly finishPresets: readonly { name: string; roughness: number; metalness: number }[] = MATERIAL_FINISH_PRESETS;
  public readonly finishOptions: readonly TMaterialFinish[] = MATERIAL_FINISH_OPTIONS;

  public constructor() {
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
    if (id) this._floorplanService.updateWallProperties(id, { height: value });
  }

  public onThicknessChange(value: number): void {
    this.thickness.set(value);
    const id: string | null = this._floorplanService.selectedWallId();
    if (id) this._floorplanService.updateWallProperties(id, { thickness: value });
  }

  public onColorChange(value: string): void {
    this.color.set(value);
    const id: string | null = this._floorplanService.selectedWallId();
    if (id) this._floorplanService.updateWallProperties(id, { color: value });
  }

  public onDeselect(): void {
    this._floorplanService.selectWall(null);
    this._floorplanService.selectFurniture(null);
  }

  public onDeleteWall(): void {
    const id: string | null = this._floorplanService.selectedWallId();
    if (id) this._floorplanService.removeWall(id);
  }

  public onDeleteFurniture(): void {
    const id: string | null = this._floorplanService.selectedFurnitureId();
    if (id) this._floorplanService.removeFurniture(id);
  }

  public onAddDoor(): void {
    const id: string | null = this._floorplanService.selectedWallId();
    if (id) this._floorplanService.addOpeningToWall(id, WallOpeningType.Door);
  }

  public onAddWindow(): void {
    const id: string | null = this._floorplanService.selectedWallId();
    if (id) this._floorplanService.addOpeningToWall(id, WallOpeningType.Window);
  }

  public onRemoveOpening(id: string): void {
    this._floorplanService.removeOpening(id);
  }

  public openingBounds(opening: IWallOpening): OpeningPlacementBounds | null {
    const otherOpenings: IWallOpening[] = this.wallOpenings().filter((item: IWallOpening) => item.id !== opening.id);
    return getOpeningPlacementBounds(opening, otherOpenings, this.wallLength());
  }

  public openingMinPosition(_opening: IWallOpening): number { return MIN_WALL_PIER; }
  public openingMaxPosition(opening: IWallOpening): number { return Math.max(MIN_WALL_PIER, this.wallLength() - MIN_WALL_PIER - opening.width); }
  public openingMaxWidth(opening: IWallOpening): number { return this.openingBounds(opening)?.maxWidth ?? this.maxOpeningWidth; }
  public openingMaxHeight(opening: IWallOpening): number {
    const wall: IWallSegment | null = this.selectedWall();
    if (!wall) return this.maxOpeningHeight;
    return Math.max(this.minOpeningHeight, Math.min(this.maxOpeningHeight, wall.height - opening.elevation));
  }
  public openingMaxElevation(opening: IWallOpening): number {
    const wall: IWallSegment | null = this.selectedWall();
    if (!wall) return this.maxOpeningElevation;
    return Math.max(this.minOpeningElevation, Math.min(this.maxOpeningElevation, wall.height - opening.height));
  }
  public formatOpeningValue(value: number): string { return Number.isFinite(value) ? value.toFixed(2) : '0.00'; }
  public formatNum(value: number): string { return Number.isFinite(value) ? value.toFixed(2) : '0.00'; }

  public onOpeningPositionChange(id: string, value: number): void {
    if (!Number.isFinite(value)) return;
    const opening: IWallOpening | undefined = this.wallOpenings().find((item: IWallOpening) => item.id === id);
    if (!opening) return;
    this._floorplanService.updateOpening(id, { positionAlongWall: Math.min(this.openingMaxPosition(opening), Math.max(MIN_WALL_PIER, value)) });
  }
  public onOpeningWidthChange(id: string, value: number): void {
    if (!Number.isFinite(value)) return;
    const opening: IWallOpening | undefined = this.wallOpenings().find((item: IWallOpening) => item.id === id);
    if (!opening) return;
    const bounds: OpeningPlacementBounds | null = this.openingBounds(opening);
    const minWidth: number = bounds?.minWidth ?? this.minOpeningWidth;
    const maxWidth: number = bounds?.maxWidth ?? this.maxOpeningWidth;
    this._floorplanService.updateOpening(id, { width: Math.min(maxWidth, Math.max(minWidth, value)) });
  }
  public onOpeningHeightChange(id: string, value: number): void {
    if (!Number.isFinite(value)) return;
    const opening: IWallOpening | undefined = this.wallOpenings().find((item: IWallOpening) => item.id === id);
    if (!opening) return;
    this._floorplanService.updateOpening(id, { height: Math.min(this.openingMaxHeight(opening), Math.max(this.minOpeningHeight, value)) });
  }
  public onOpeningElevationChange(id: string, value: number): void {
    if (!Number.isFinite(value)) return;
    const opening: IWallOpening | undefined = this.wallOpenings().find((item: IWallOpening) => item.id === id);
    if (!opening) return;
    this._floorplanService.updateOpening(id, { elevation: Math.min(this.openingMaxElevation(opening), Math.max(this.minOpeningElevation, value)) });
  }

  public openingMaterials(opening: IWallOpening): Array<{ key: string; slot: IMaterialSlot }> {
    const mats = opening.materials ?? createDefaultOpeningMaterials(opening.type);
    return Object.entries(mats).map(([key, slot]: [string, IMaterialSlot]) => ({ key, slot }));
  }

  public openingStyleEntries(opening: IWallOpening): Array<{ key: string; value: string }> {
    const styles = opening.styleOptions ?? createDefaultOpeningStyleOptions(opening.type);
    return Object.entries(styles).map(([key, value]: [string, string]) => ({ key, value }));
  }

  public onOpeningMaterialColorChange(openingId: string, slotKey: string, color: string): void {
    const opening = this.wallOpenings().find((o) => o.id === openingId);
    if (!opening) return;
    const slot = (opening.materials ?? {})[slotKey];
    if (!slot) return;
    this._floorplanService.updateOpening(openingId, { materials: { [slotKey]: { ...slot, color } } as Record<string, IMaterialSlot> });
  }

  public onOpeningMaterialFinishChange(openingId: string, slotKey: string, finishName: string): void {
    const opening = this.wallOpenings().find((o) => o.id === openingId);
    if (!opening) return;
    const slot = (opening.materials ?? {})[slotKey];
    const preset = this.finishPresets.find((p) => p.name === finishName);
    if (!slot || !preset) return;
    const finish: TMaterialFinish = preset.metalness >= 0.8 ? 'metallic' : preset.roughness <= 0.25 ? 'gloss' : preset.roughness >= 0.75 ? 'matte' : 'satin';
    this._floorplanService.updateOpening(openingId, { materials: { [slotKey]: { ...slot, finish, roughness: preset.roughness, metalness: preset.metalness } } as Record<string, IMaterialSlot> });
  }

  public onOpeningStyleChange(openingId: string, styleKey: string, value: string): void {
    const opening = this.wallOpenings().find((o) => o.id === openingId);
    if (!opening) return;
    this._floorplanService.updateOpening(openingId, { styleOptions: { ...(opening.styleOptions ?? {}), [styleKey]: value } });
  }

  public styleOptionsFor(key: string, categoryOrType: string): readonly string[] {
    if (key === 'panelStyle') return ['solid', 'glass'];
    if (key === 'swing') return ['left', 'right'];
    if (key === 'gridStyle') return ['single', '2x2', '3x2'];
    if (key === 'mullionStyle') return ['none', 'colonial', 'prairie'];
    return [categoryOrType];
  }

  public furnitureMaterialEntries(item: IPlacedFurniture): Array<{ key: string; slot: IMaterialSlot }> {
    return Object.entries(item.materials).map(([key, slot]: [string, IMaterialSlot]) => ({ key, slot }));
  }

  public onFurnitureRotationChange(value: number): void {
    const item: IPlacedFurniture | null = this.selectedFurniture();
    if (!item || !Number.isFinite(value)) return;
    this._floorplanService.updateFurniture(item.id, { rotation: { ...item.rotation, y: value } });
  }

  public onFurnitureScaleChange(axis: 'x' | 'y' | 'z', value: number): void {
    const item: IPlacedFurniture | null = this.selectedFurniture();
    if (!item || !Number.isFinite(value)) return;
    const clamped: number = Math.min(this.maxFurnitureScale, Math.max(this.minFurnitureScale, value));
    this._floorplanService.updateFurniture(item.id, { scale: { ...item.scale, [axis]: clamped } });
  }

  public onFurnitureUniformScaleChange(value: number): void {
    const item: IPlacedFurniture | null = this.selectedFurniture();
    if (!item || !Number.isFinite(value)) return;
    const clamped: number = Math.min(this.maxFurnitureScale, Math.max(this.minFurnitureScale, value));
    this._floorplanService.updateFurniture(item.id, { scale: { x: clamped, y: clamped, z: clamped } });
  }

  public uniformScale(item: IPlacedFurniture): number {
    return Number(((item.scale.x + item.scale.y + item.scale.z) / 3).toFixed(2));
  }

  public onFurnitureMaterialColorChange(slotKey: string, color: string): void {
    const item: IPlacedFurniture | null = this.selectedFurniture();
    if (!item) return;
    const slot: IMaterialSlot | undefined = item.materials[slotKey];
    if (!slot) return;
    this._floorplanService.updateFurniture(item.id, { materials: { [slotKey]: { ...slot, color } } as Record<string, IMaterialSlot> });
  }

  public onFurnitureMaterialFinishChange(slotKey: string, finish: TMaterialFinish): void {
    const item: IPlacedFurniture | null = this.selectedFurniture();
    if (!item) return;
    const slot: IMaterialSlot | undefined = item.materials[slotKey];
    if (!slot) return;
    const pbr: { roughness: number; metalness: number } = FURNITURE_FINISH_PBR[finish];
    this._floorplanService.updateFurniture(item.id, {
      materials: { [slotKey]: { ...slot, finish, roughness: pbr.roughness, metalness: pbr.metalness } } as Record<string, IMaterialSlot>,
    });
  }

  public onEditInCraftRoom(): void {
    const item: IPlacedFurniture | null = this.selectedFurniture();
    if (!item) return;
    this._blueprintService.setEditSourceFromPlaced(item);
    void this._router.navigate(['/craft'], { queryParams: { edit: item.blueprintId } });
  }
}
