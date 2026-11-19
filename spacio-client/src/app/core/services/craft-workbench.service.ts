import { Injectable, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { Observable, catchError, of, tap } from 'rxjs';
import {
  DEFAULT_MATERIAL_PRESET,
  FURNITURE_CATEGORY_OPTIONS,
  IFurnitureBlueprint,
  IFurniturePart,
  IFurniturePartDimensions,
  IFurniturePartSculpt,
  IMaterialPresetDefinition,
  ISculptPoint,
  MATERIAL_PRESET_IDS,
  MATERIAL_PRESET_OPTIONS,
  SCULPT_MAX_POINTS,
  TMaterialPreset,
  TFurnitureCategory,
  TPartShape,
  TSculptMode,
  TSculptPresetId,
  clampBevel,
  clampTaper,
  cloneFurniturePart,
  cloneFurniturePartSculpt,
  createFurniturePart,
  createFurniturePartSculpt,
  getMaterialPresetDefinition,
  normalizeSculptPoints,
  getMaterialPresetSwatch,
  getSculptPreset,
  isSculptShape,
  sculptModeForPartShape,
} from '@spacio/shared-types';
import { FurnitureCatalogService } from './furniture-catalog.service';

export interface ICraftShapeOption {
  readonly shape: TPartShape;
  readonly label: string;
  readonly hint: string;
}

const BLANK_BLUEPRINT_OPTION_ID = 'blank';
const DEFAULT_BLUEPRINT_NAME = 'Untitled Piece';
const DEFAULT_BLUEPRINT_CATEGORY: TFurnitureCategory = 'decor';
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const COPY_SUFFIX = ' Copy';
const EDITED_SUFFIX = ' Edited';
const UNSAVED_CHANGES_MESSAGE = 'Unsaved changes';
const BLANK_STARTED_MESSAGE = 'Blank canvas ready.';
const SAVING_MESSAGE = 'Saving…';
const NO_PARTS_SAVE_MESSAGE = 'Add at least one part before saving.';
const SAVE_FAILED_MESSAGE = 'Save failed. Please try again.';
const MESSAGE_ADDED_PREFIX = 'Added ';
const MESSAGE_SAVED_PREFIX = '“';
const MESSAGE_SAVED_SUFFIX = '” saved to catalog.';
const MESSAGE_DUPLICATED = 'Duplicated part.';
const MESSAGE_DUPLICATED_MIRROR = 'Duplicated with mirror.';
const MESSAGE_DROPPED = 'Dropped to floor.';
const MESSAGE_CENTERED = 'Centered on stage.';
const MESSAGE_MIRRORED = 'Mirrored ';
const MESSAGE_SCULPTED = '2D sculptor opened.';
const MESSAGE_SCULPT_UPDATED = 'Outline updated.';

const SHAPE_OPTIONS: readonly ICraftShapeOption[] = [
  { shape: 'box', label: 'Block', hint: 'Soft-edged volume' },
  { shape: 'cylinder', label: 'Cylinder', hint: 'Tapered pedestal' },
  { shape: 'capsule', label: 'Pill / Arch', hint: 'Plush rounded form' },
  { shape: 'cone', label: 'Cone', hint: 'Shade or accent' },
  { shape: 'torus', label: 'Ring', hint: 'Sculptural detail' },
];

const DEFAULT_PART_DIMENSIONS: Record<TPartShape, IFurniturePartDimensions> = {
  box: { width: 0.5, height: 0.4, depth: 0.5 },
  cylinder: { width: 0.22, height: 0.6, depth: 0.22 },
  capsule: { width: 0.26, height: 0.6, depth: 0.26 },
  cone: { width: 0.34, height: 0.6, depth: 0.34 },
  torus: { width: 0.6, height: 0.14, depth: 0.6 },
  'extrude-2d': { width: 0.5, height: 0.5, depth: 0.18 },
  'lathe-360': { width: 0.28, height: 0.6, depth: 0.28 },
};

const PART_GRID_COLUMNS = 3;
const PART_GRID_STEP = 0.55;
const PART_GRID_OFFSET = 0.55;

function cloneDraft(blueprint: IFurnitureBlueprint): IFurnitureBlueprint {
  return {
    ...blueprint,
    parts: blueprint.parts.map((part: IFurniturePart): IFurniturePart => cloneFurniturePart(part)),
    materials: Object.fromEntries(
      Object.entries(blueprint.materials).map(([key, slot]) => [key, { ...slot }]),
    ),
  };
}

@Injectable()
export class CraftWorkbenchService {
  private readonly _catalog: FurnitureCatalogService = inject(FurnitureCatalogService);

  private readonly _draft: WritableSignal<IFurnitureBlueprint>;
  private readonly _selectedPartId: WritableSignal<string | null> = signal<string | null>(null);
  private readonly _blueprintName: WritableSignal<string> = signal<string>(DEFAULT_BLUEPRINT_NAME);
  private readonly _blueprintCategory: WritableSignal<TFurnitureCategory> =
    signal<TFurnitureCategory>(DEFAULT_BLUEPRINT_CATEGORY);
  private readonly _saveMessage: WritableSignal<string> = signal<string>('');
  private readonly _isSaving: WritableSignal<boolean> = signal<boolean>(false);
  private readonly _isExisting: WritableSignal<boolean> = signal<boolean>(false);
  private readonly _mirrorX: WritableSignal<boolean> = signal<boolean>(false);
  private readonly _mirrorZ: WritableSignal<boolean> = signal<boolean>(false);

  public readonly draft: Signal<IFurnitureBlueprint>;
  public readonly selectedPartId: Signal<string | null>;
  public readonly blueprintName: Signal<string>;
  public readonly blueprintCategory: Signal<TFurnitureCategory>;
  public readonly saveMessage: Signal<string>;
  public readonly isSaving: Signal<boolean>;
  public readonly mirrorX: Signal<boolean>;
  public readonly mirrorZ: Signal<boolean>;

  public readonly shapeOptions: readonly ICraftShapeOption[] = SHAPE_OPTIONS;
  public readonly materialPresets: readonly IMaterialPresetDefinition[] = MATERIAL_PRESET_OPTIONS;
  public readonly categoryOptions: readonly TFurnitureCategory[] = FURNITURE_CATEGORY_OPTIONS;

  public readonly selectedPart: Signal<IFurniturePart | null>;

  public constructor() {
    this._draft = signal<IFurnitureBlueprint>(this._catalog.createBlankDraft());
    this.draft = this._draft.asReadonly();
    this.selectedPartId = this._selectedPartId.asReadonly();
    this.blueprintName = this._blueprintName.asReadonly();
    this.blueprintCategory = this._blueprintCategory.asReadonly();
    this.saveMessage = this._saveMessage.asReadonly();
    this.isSaving = this._isSaving.asReadonly();
    this.mirrorX = this._mirrorX.asReadonly();
    this.mirrorZ = this._mirrorZ.asReadonly();

    this.selectedPart = computed<IFurniturePart | null>((): IFurniturePart | null => {
      const id: string | null = this._selectedPartId();
      if (!id) return null;
      return this._draft().parts.find((part: IFurniturePart): boolean => part.id === id) ?? null;
    });
  }

  public startBlank(): void {
    const blank: IFurnitureBlueprint = this._catalog.createBlankDraft();
    this._isExisting.set(false);
    this._applyBlueprint(blank, blank.name);
    this._saveMessage.set(BLANK_STARTED_MESSAGE);
  }

  public loadBlueprint(blueprint: IFurnitureBlueprint, message: string): void {
    const isExisting: boolean =
      !blueprint.isPreset && this._catalog.getById(blueprint.id) !== undefined;
    const source: IFurnitureBlueprint = isExisting
      ? cloneDraft(blueprint)
      : this._catalog.cloneAsDraft(blueprint);
    this._isExisting.set(isExisting);
    this._applyBlueprint(source, isExisting ? blueprint.name : `${blueprint.name}${EDITED_SUFFIX}`);
    this._saveMessage.set(message);
  }

  public selectBlueprint(id: string): void {
    if (id === BLANK_BLUEPRINT_OPTION_ID) {
      this.startBlank();
      return;
    }
    const blueprint: IFurnitureBlueprint | undefined = this._catalog.getById(id);
    if (!blueprint) return;
    const source: IFurnitureBlueprint = this._catalog.cloneAsDraft(blueprint);
    this._isExisting.set(false);
    this._applyBlueprint(source, source.name);
    this._saveMessage.set(`Starting from “${blueprint.name}”.`);
  }

  public addPart(shape: TPartShape): void {
    const dimensions: IFurniturePartDimensions = DEFAULT_PART_DIMENSIONS[shape];
    const index: number = this._draft().parts.length;
    const preset: TMaterialPreset = shape === 'capsule' ? 'boucle' : DEFAULT_MATERIAL_PRESET;
    const part: IFurniturePart = createFurniturePart(
      this._catalog.generateId(),
      `${this._toTitleCase(shape)} ${index + 1}`,
      shape,
      dimensions,
      {
        x: (index % PART_GRID_COLUMNS) * PART_GRID_STEP - PART_GRID_OFFSET,
        y: dimensions.height / 2,
        z: Math.floor(index / PART_GRID_COLUMNS) * PART_GRID_STEP - PART_GRID_OFFSET,
      },
      preset,
      getMaterialPresetSwatch(preset),
      {
        bevel: shape === 'box' ? 0.16 : shape === 'torus' ? 0 : 0.08,
        taper: shape === 'cylinder' || shape === 'cone' ? 0.18 : 0,
      },
    );
    this._mutateDraft((blueprint: IFurnitureBlueprint): IFurnitureBlueprint => ({
      ...blueprint,
      parts: [...blueprint.parts, part],
    }));
    this._selectedPartId.set(part.id);
    this._saveMessage.set(`${MESSAGE_ADDED_PREFIX}${part.name}.`);
  }

  public duplicateSelectedPart(): void {
    const part: IFurniturePart | null = this.selectedPart();
    if (!part) return;
    const mirrorX: boolean = this._mirrorX();
    const mirrorZ: boolean = this._mirrorZ();
    const copy: IFurniturePart = {
      ...cloneFurniturePart(part),
      id: this._catalog.generateId(),
      name: `${part.name}${COPY_SUFFIX}`,
      position: {
        x: mirrorX ? -part.position.x : part.position.x + part.dimensions.width,
        y: part.position.y,
        z: mirrorZ ? -part.position.z : part.position.z,
      },
      rotation: { ...part.rotation, y: mirrorX || mirrorZ ? -part.rotation.y : part.rotation.y },
    };
    this._mutateDraft((blueprint: IFurnitureBlueprint): IFurnitureBlueprint => ({
      ...blueprint,
      parts: [...blueprint.parts, copy],
    }));
    this._selectedPartId.set(copy.id);
    this._saveMessage.set(mirrorX || mirrorZ ? MESSAGE_DUPLICATED_MIRROR : MESSAGE_DUPLICATED);
  }

  public deleteSelectedPart(): void {
    const id: string | null = this._selectedPartId();
    if (id) this.removePart(id);
  }

  public removePart(id: string): void {
    if (!this._draft().parts.some((part: IFurniturePart): boolean => part.id === id)) return;
    this._mutateDraft((current: IFurnitureBlueprint): IFurnitureBlueprint => ({
      ...current,
      parts: current.parts.filter((part: IFurniturePart): boolean => part.id !== id),
    }));
    if (this._selectedPartId() === id) this._selectedPartId.set(null);
  }

  public selectPart(id: string): void {
    this._selectedPartId.set(id);
  }

  public clearPartSelection(): void {
    this._selectedPartId.set(null);
  }

  public updatePartName(name: string): void {
    this._updateSelectedPart((part: IFurniturePart): IFurniturePart => ({ ...part, name }));
  }

  public updatePartDimension(field: keyof IFurniturePartDimensions, value: number): void {
    if (!Number.isFinite(value) || value < 0.01) return;
    this._updateSelectedPart((part: IFurniturePart): IFurniturePart => ({
      ...part,
      dimensions: { ...part.dimensions, [field]: value },
    }));
  }

  public updatePartPosition(axis: 'x' | 'y' | 'z', value: number): void {
    if (!Number.isFinite(value)) return;
    this._updateSelectedPart((part: IFurniturePart): IFurniturePart => ({
      ...part,
      position: { ...part.position, [axis]: value },
    }));
  }

  public updatePartRotation(axis: 'x' | 'y' | 'z', value: number): void {
    if (!Number.isFinite(value)) return;
    this._updateSelectedPart((part: IFurniturePart): IFurniturePart => ({
      ...part,
      rotation: { ...part.rotation, [axis]: value },
    }));
  }

  public updatePartBevel(value: number): void {
    this._updateSelectedPart((part: IFurniturePart): IFurniturePart => ({
      ...part,
      bevel: clampBevel(value),
    }));
  }

  public updatePartTaper(value: number): void {
    this._updateSelectedPart((part: IFurniturePart): IFurniturePart => ({
      ...part,
      taper: clampTaper(value),
    }));
  }

  public updatePartMaterialPreset(preset: TMaterialPreset): void {
    if (!MATERIAL_PRESET_IDS.includes(preset)) return;
    this._updateSelectedPart((part: IFurniturePart): IFurniturePart => ({
      ...part,
      materialPreset: preset,
      color: getMaterialPresetDefinition(preset).swatch,
    }));
  }

  public updatePartColor(color: string): void {
    if (!HEX_COLOR_PATTERN.test(color)) return;
    this._updateSelectedPart((part: IFurniturePart): IFurniturePart => ({ ...part, color }));
  }

  public sculptSelectedPart(): void {
    this._updateSelectedPart((part: IFurniturePart): IFurniturePart => {
      if (isSculptShape(part.shape) && part.sculpt) return part;
      const mode: TSculptMode = sculptModeForPartShape(part.shape);
      return {
        ...part,
        shape: mode === 'lathe' ? 'lathe-360' : 'extrude-2d',
        sculpt: this._sculptForPrimitive(part.shape),
      };
    });
    this._saveMessage.set(MESSAGE_SCULPTED);
  }

  public setSculptMode(mode: TSculptMode): void {
    this._updateSelectedPart((part: IFurniturePart): IFurniturePart => ({
      ...part,
      shape: mode === 'lathe' ? 'lathe-360' : 'extrude-2d',
      sculpt: createFurniturePartSculpt(mode, mode === 'lathe' ? 'turned-leg' : 'rectangle'),
    }));
    this._saveMessage.set(MESSAGE_SCULPT_UPDATED);
  }

  public applySculptPreset(presetId: TSculptPresetId): void {
    const preset = getSculptPreset(presetId);
    this._updateSelectedPart((part: IFurniturePart): IFurniturePart => ({
      ...part,
      shape: preset.mode === 'lathe' ? 'lathe-360' : 'extrude-2d',
      sculpt: createFurniturePartSculpt(preset.mode, presetId),
    }));
    this._saveMessage.set(MESSAGE_SCULPT_UPDATED);
  }

  public updateSculptPoints(points: readonly ISculptPoint[]): void {
    this._updateSelectedPart((part: IFurniturePart): IFurniturePart => {
      const mode: TSculptMode = part.sculpt?.mode ?? sculptModeForPartShape(part.shape);
      return {
        ...part,
        sculpt: cloneFurniturePartSculpt({
          mode,
          closed: part.sculpt?.closed ?? mode === 'extrude',
          points: [...points],
        }),
      };
    });
  }

  public toggleSculptPoint(index: number): void {
    this._updateSelectedPart((part: IFurniturePart): IFurniturePart => {
      const sculpt = this._partSculpt(part);
      const points = sculpt.points.map((point, pointIndex) =>
        pointIndex === index
          ? { ...point, kind: point.kind === 'sharp' ? ('smooth' as const) : ('sharp' as const) }
          : { ...point },
      );
      return { ...part, sculpt: { ...sculpt, points } };
    });
    this._saveMessage.set(MESSAGE_SCULPT_UPDATED);
  }

  public addSculptPoint(index: number): void {
    this._updateSelectedPart((part: IFurniturePart): IFurniturePart => {
      const sculpt = this._partSculpt(part);
      if (sculpt.points.length >= SCULPT_MAX_POINTS) return part;
      const current = sculpt.points[index];
      const next = sculpt.points[(index + 1) % sculpt.points.length];
      if (!current || !next) return part;
      const points = [...sculpt.points];
      points.splice(index + 1, 0, {
        x: Number(((current.x + next.x) / 2).toFixed(4)),
        y: Number(((current.y + next.y) / 2).toFixed(4)),
        kind: 'smooth',
      });
      return { ...part, sculpt: { ...sculpt, points } };
    });
    this._saveMessage.set(MESSAGE_SCULPT_UPDATED);
  }

  public removeSculptPoint(index: number): void {
    this._updateSelectedPart((part: IFurniturePart): IFurniturePart => {
      const sculpt = this._partSculpt(part);
      if (sculpt.points.length <= 3) return part;
      return {
        ...part,
        sculpt: {
          ...sculpt,
          points: sculpt.points.filter((_, pointIndex) => pointIndex !== index),
        },
      };
    });
    this._saveMessage.set(MESSAGE_SCULPT_UPDATED);
  }

  public dropSelectedToFloor(): void {
    this._updateSelectedPart((part: IFurniturePart): IFurniturePart => ({
      ...part,
      position: { ...part.position, y: part.dimensions.height / 2 },
    }));
    this._saveMessage.set(MESSAGE_DROPPED);
  }

  public centerSelected(): void {
    this._updateSelectedPart((part: IFurniturePart): IFurniturePart => ({
      ...part,
      position: { ...part.position, x: 0, z: 0 },
    }));
    this._saveMessage.set(MESSAGE_CENTERED);
  }

  public mirrorSelected(axis: 'x' | 'z'): void {
    this._updateSelectedPart((part: IFurniturePart): IFurniturePart => ({
      ...part,
      position: {
        ...part.position,
        [axis]: -part.position[axis],
      },
      rotation:
        axis === 'x'
          ? { ...part.rotation, y: -part.rotation.y, z: -part.rotation.z }
          : { ...part.rotation, x: -part.rotation.x, y: -part.rotation.y },
    }));
    this._saveMessage.set(`${MESSAGE_MIRRORED}${axis.toUpperCase()}.`);
  }

  public toggleMirror(axis: 'x' | 'z'): void {
    if (axis === 'x') this._mirrorX.update((value: boolean): boolean => !value);
    else this._mirrorZ.update((value: boolean): boolean => !value);
  }

  public setName(name: string): void {
    this._blueprintName.set(name);
  }

  public setCategory(category: TFurnitureCategory): void {
    this._blueprintCategory.set(category);
  }

  public setThumbnail(dataUrl: string | undefined): void {
    if (!dataUrl) return;
    this._draft.update((blueprint: IFurnitureBlueprint): IFurnitureBlueprint => ({
      ...blueprint,
      thumbnailDataUrl: dataUrl,
    }));
  }

  public save(): Observable<IFurnitureBlueprint> {
    if (this._isSaving()) return of(this._draft());
    if (this._draft().parts.length === 0) {
      this._saveMessage.set(NO_PARTS_SAVE_MESSAGE);
      return of(this._draft());
    }

    const prepared: IFurnitureBlueprint = {
      ...this._draft(),
      userId: null,
      name: this._blueprintName().trim() || DEFAULT_BLUEPRINT_NAME,
      category: this._blueprintCategory(),
      isPreset: false,
    };
    this._isSaving.set(true);
    this._saveMessage.set(SAVING_MESSAGE);
    const request: Observable<IFurnitureBlueprint> = this._isExisting()
      ? this._catalog.updateBlueprint(prepared.id, prepared)
      : this._catalog.saveBlueprint(prepared);
    return request.pipe(
      tap((saved: IFurnitureBlueprint): void => {
        this._isExisting.set(true);
        this._draft.set(saved);
        this._blueprintName.set(saved.name);
        this._blueprintCategory.set(saved.category);
        this._isSaving.set(false);
        this._saveMessage.set(`${MESSAGE_SAVED_PREFIX}${saved.name}${MESSAGE_SAVED_SUFFIX}`);
      }),
      catchError((): Observable<IFurnitureBlueprint> => {
        this._isSaving.set(false);
        this._saveMessage.set(SAVE_FAILED_MESSAGE);
        return of(this._draft());
      }),
    );
  }

  public resetMessage(message: string): void {
    this._saveMessage.set(message);
  }

  private _applyBlueprint(blueprint: IFurnitureBlueprint, name: string): void {
    this._draft.set(blueprint);
    this._blueprintName.set(name);
    this._blueprintCategory.set(blueprint.category);
    this._selectedPartId.set(blueprint.parts.length > 0 ? blueprint.parts[0].id : null);
  }

  private _mutateDraft(mutator: (blueprint: IFurnitureBlueprint) => IFurnitureBlueprint): void {
    this._draft.update(mutator);
    this._saveMessage.set(UNSAVED_CHANGES_MESSAGE);
  }

  private _updateSelectedPart(mutator: (part: IFurniturePart) => IFurniturePart): void {
    const id: string | null = this._selectedPartId();
    if (!id) return;
    this._mutateDraft((blueprint: IFurnitureBlueprint): IFurnitureBlueprint => ({
      ...blueprint,
      parts: blueprint.parts.map((part: IFurniturePart): IFurniturePart =>
        part.id === id ? mutator(part) : part,
      ),
    }));
  }

  private _sculptForPrimitive(shape: TPartShape): IFurniturePartSculpt {
    if (shape === 'box') return createFurniturePartSculpt('extrude', 'rectangle');
    if (shape === 'capsule') return createFurniturePartSculpt('extrude', 'pill');

    const points =
      shape === 'cone'
        ? [
            { x: 1, y: 0, kind: 'sharp' as const },
            { x: 0.5, y: 0.5, kind: 'sharp' as const },
            { x: 0, y: 1, kind: 'sharp' as const },
          ]
        : shape === 'torus'
          ? [
              { x: 0.55, y: 0.4, kind: 'sharp' as const },
              { x: 1, y: 0.5, kind: 'smooth' as const },
              { x: 0.55, y: 0.6, kind: 'sharp' as const },
            ]
          : [
              { x: 1, y: 0, kind: 'sharp' as const },
              { x: 1, y: 0.5, kind: 'sharp' as const },
              { x: 1, y: 1, kind: 'sharp' as const },
            ];
    return {
      mode: 'lathe',
      closed: false,
      points: normalizeSculptPoints(points),
    };
  }

  private _partSculpt(part: IFurniturePart): IFurniturePartSculpt {
    return (
      cloneFurniturePartSculpt(part.sculpt) ??
      createFurniturePartSculpt(
        sculptModeForPartShape(part.shape),
        part.shape === 'lathe-360' ? 'turned-leg' : 'rectangle',
      )
    );
  }

  private _toTitleCase(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
