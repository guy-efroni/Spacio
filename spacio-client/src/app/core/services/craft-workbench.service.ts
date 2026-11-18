import { Injectable, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { Observable, catchError, of, tap } from 'rxjs';
import {
  DEFAULT_BEVEL_RADIUS,
  DEFAULT_EXTRUDE_POINTS,
  DEFAULT_FURNITURE_MATERIAL_FINISH,
  DEFAULT_FURNITURE_SLOT_COLOR,
  DEFAULT_LATHE_POINTS,
  DEFAULT_TUBE_PATH_POINTS,
  DEFAULT_TUBE_RADIUS,
  FURNITURE_CATEGORY_OPTIONS,
  IFurnitureBlueprint,
  IFurniturePart,
  IFurniturePartShapeParameters,
  IFurniturePoint2D,
  IFurniturePoint3D,
  IMaterialSlot,
  MATERIAL_FINISH_OPTIONS,
  PART_SHAPE_OPTIONS,
  TMaterialFinish,
  TFurnitureCategory,
  TPartShape,
  cloneFurniturePart,
  createFurnitureMaterialSlot,
  createFurniturePart,
} from '@spacio/shared-types';
import { convertPartToEditableShape } from '../../shared/utils/shape-converter.util';
import { FurnitureCatalogService } from './furniture-catalog.service';

export interface ICraftMaterialEntry {
  key: string;
  slot: IMaterialSlot;
}

const BLANK_BLUEPRINT_OPTION_ID: string = 'blank';
const DEFAULT_BLUEPRINT_NAME: string = 'Untitled Piece';
const DEFAULT_BLUEPRINT_CATEGORY: TFurnitureCategory = 'decor';
const FALLBACK_MATERIAL_SLOT_KEY: string = 'material-1';
const MATERIAL_SLOT_KEY_PREFIX: string = 'material-';
const MATERIAL_SLOT_KEY_RANDOM_LENGTH: number = 4;
const DEFAULT_MATERIAL_LABEL_PREFIX: string = 'Material ';
const COPY_SUFFIX: string = ' Copy';
const EDITED_SUFFIX: string = ' Edited';
const UNSAVED_CHANGES_MESSAGE: string = 'Unsaved changes';
const BLANK_STARTED_MESSAGE: string = 'Blank piece started.';
const SAVING_MESSAGE: string = 'Saving…';
const NO_PARTS_SAVE_MESSAGE: string = 'Add at least one part before saving.';
const SAVE_FAILED_MESSAGE: string = 'Save failed. Please try again.';

const MESSAGE_BLUEPRINT_LOADED_PREFIX: string = 'Cloned “';
const MESSAGE_BLUEPRINT_LOADED_SUFFIX: string = '”.';
const MESSAGE_ADDED_PREFIX: string = 'Added ';
const MESSAGE_SAVED_PREFIX: string = '“';
const MESSAGE_SAVED_SUFFIX: string = '” saved to catalog.';
const MESSAGE_DUPLICATED: string = 'Duplicated part.';
const MESSAGE_DUPLICATED_MIRROR: string = 'Duplicated with mirror.';

const PART_SHAPE_BOX: TPartShape = 'box';
const PART_SHAPE_ROUNDED_BOX: TPartShape = 'rounded-box';
const PART_SHAPE_CYLINDER: TPartShape = 'cylinder';
const PART_SHAPE_SPHERE: TPartShape = 'sphere';
const PART_SHAPE_CAPSULE: TPartShape = 'capsule';
const PART_SHAPE_CONE: TPartShape = 'cone';
const PART_SHAPE_TORUS: TPartShape = 'torus';
const PART_SHAPE_EXTRUDE: TPartShape = 'extrude-2d';
const PART_SHAPE_LATHE: TPartShape = 'lathe-360';
const PART_SHAPE_TUBE: TPartShape = 'tube-path';

const AXIS_X: 'x' = 'x';
const AXIS_Z: 'z' = 'z';

const DEFAULT_PART_DIMENSIONS: Record<TPartShape, { width: number; height: number; depth: number }> = {
  [PART_SHAPE_BOX]: { width: 0.4, height: 0.4, depth: 0.4 },
  [PART_SHAPE_ROUNDED_BOX]: { width: 0.4, height: 0.4, depth: 0.4 },
  [PART_SHAPE_CYLINDER]: { width: 0.2, height: 0.6, depth: 0.2 },
  [PART_SHAPE_SPHERE]: { width: 0.4, height: 0.4, depth: 0.4 },
  [PART_SHAPE_CAPSULE]: { width: 0.2, height: 0.6, depth: 0.2 },
  [PART_SHAPE_CONE]: { width: 0.3, height: 0.6, depth: 0.3 },
  [PART_SHAPE_TORUS]: { width: 0.5, height: 0.12, depth: 0.5 },
  [PART_SHAPE_EXTRUDE]: { width: 0.6, height: 0.06, depth: 0.5 },
  [PART_SHAPE_LATHE]: { width: 0.24, height: 0.6, depth: 0.24 },
  [PART_SHAPE_TUBE]: { width: 0.6, height: 0.6, depth: 0.4 },
};

function createShapeParameters(shape: TPartShape): IFurniturePartShapeParameters {
  if (shape === PART_SHAPE_ROUNDED_BOX || shape === PART_SHAPE_EXTRUDE) {
    return {
      bevelRadius: DEFAULT_BEVEL_RADIUS,
      ...(shape === PART_SHAPE_EXTRUDE
        ? { points2D: DEFAULT_EXTRUDE_POINTS.map((point: IFurniturePoint2D): IFurniturePoint2D => ({ ...point })) }
        : {}),
    };
  }
  if (shape === PART_SHAPE_LATHE) {
    return {
      points2D: DEFAULT_LATHE_POINTS.map((point: IFurniturePoint2D): IFurniturePoint2D => ({ ...point })),
    };
  }
  if (shape === PART_SHAPE_TUBE) {
    return {
      pathPoints3D: DEFAULT_TUBE_PATH_POINTS.map((point: IFurniturePoint3D): IFurniturePoint3D => ({ ...point })),
      tubeRadius: DEFAULT_TUBE_RADIUS,
    };
  }
  return {};
}
const PART_GRID_COLUMNS: number = 3;
const PART_GRID_STEP: number = 0.5;
const PART_GRID_OFFSET: number = 0.5;

function cloneDraft(blueprint: IFurnitureBlueprint): IFurnitureBlueprint {
  return {
    ...blueprint,
    parts: blueprint.parts.map((part: IFurniturePart): IFurniturePart => cloneFurniturePart(part)),
    materials: Object.fromEntries(
      Object.entries(blueprint.materials).map(([key, slot]: [string, IMaterialSlot]): [string, IMaterialSlot] => [key, { ...slot }])
    ),
  };
}

@Injectable()
export class CraftWorkbenchService {
  private readonly _catalog: FurnitureCatalogService = inject(FurnitureCatalogService);

  private readonly _draft: WritableSignal<IFurnitureBlueprint>;
  private readonly _selectedPartId: WritableSignal<string | null> = signal<string | null>(null);
  private readonly _blueprintName: WritableSignal<string> = signal<string>(DEFAULT_BLUEPRINT_NAME);
  private readonly _blueprintCategory: WritableSignal<TFurnitureCategory> = signal<TFurnitureCategory>(DEFAULT_BLUEPRINT_CATEGORY);
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
  public readonly partShapes: readonly TPartShape[] = PART_SHAPE_OPTIONS;
  public readonly finishOptions: readonly TMaterialFinish[] = MATERIAL_FINISH_OPTIONS;
  public readonly categoryOptions: readonly TFurnitureCategory[] = FURNITURE_CATEGORY_OPTIONS;

  public readonly selectedPart: Signal<IFurniturePart | null>;
  public readonly materialEntries: Signal<readonly ICraftMaterialEntry[]>;

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
    this.materialEntries = computed<readonly ICraftMaterialEntry[]>((): readonly ICraftMaterialEntry[] =>
      Object.entries(this._draft().materials).map(
        ([key, slot]: [string, IMaterialSlot]): ICraftMaterialEntry => ({ key, slot })
      )
    );
  }

  public startBlank(): void {
    const blank: IFurnitureBlueprint = this._catalog.createBlankDraft();
    this._isExisting.set(false);
    this._applyBlueprint(blank, blank.name);
    this._saveMessage.set(BLANK_STARTED_MESSAGE);
  }

  public loadBlueprint(blueprint: IFurnitureBlueprint, message: string): void {
    const isExisting: boolean = !blueprint.isPreset && this._catalog.getById(blueprint.id) !== undefined;
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
    this._saveMessage.set(`Cloned “${blueprint.name}”.`);
  }

  public addPart(shape: TPartShape): void {
    const dimensions: { width: number; height: number; depth: number } = DEFAULT_PART_DIMENSIONS[shape];
    const index: number = this._draft().parts.length;
    const materialSlot: string = Object.keys(this._draft().materials)[0] ?? FALLBACK_MATERIAL_SLOT_KEY;
    const part: IFurniturePart = createFurniturePart(
      this._catalog.generateId(),
      `${this._toTitleCase(shape)} ${index + 1}`,
      shape,
      dimensions,
      { x: (index % PART_GRID_COLUMNS) * PART_GRID_STEP - PART_GRID_OFFSET, y: dimensions.height / 2, z: 0 },
      materialSlot,
      { x: 0, y: 0, z: 0 },
      createShapeParameters(shape)
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
    if (!id) return;
    this.removePart(id);
  }

  public removePart(id: string): void {
    const blueprint: IFurnitureBlueprint = this._draft();
    if (!blueprint.parts.some((part: IFurniturePart): boolean => part.id === id)) return;
    this._mutateDraft((current: IFurnitureBlueprint): IFurnitureBlueprint => ({
      ...current,
      parts: current.parts.filter((part: IFurniturePart): boolean => part.id !== id),
    }));
    if (this._selectedPartId() === id) this._selectedPartId.set(null);
  }

  public deletePart(id: string): void {
    this.removePart(id);
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

  public updatePartDimension(field: 'width' | 'height' | 'depth', value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
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

  public updatePartMaterialSlot(materialSlot: string): void {
    this._updateSelectedPart((part: IFurniturePart): IFurniturePart => ({ ...part, materialSlot }));
  }

  public convertSelectedPartToEditableShape(): boolean {
    const part: IFurniturePart | null = this.selectedPart();
    if (!part) return false;
    this._updateSelectedPart((current: IFurniturePart): IFurniturePart => convertPartToEditableShape(current));
    return true;
  }

  public updatePartBevelRadius(value: number): void {
    if (!Number.isFinite(value) || value < 0) return;
    this._updateSelectedPart((part: IFurniturePart): IFurniturePart => ({ ...part, bevelRadius: value }));
  }

  public updatePartPoints2D(points: readonly IFurniturePoint2D[]): void {
    if (points.length < 3) return;
    this._updateSelectedPart((part: IFurniturePart): IFurniturePart => ({
      ...part,
      points2D: points.map((point: IFurniturePoint2D): IFurniturePoint2D => ({ ...point })),
    }));
  }

  public updatePartPathPoints3D(points: readonly IFurniturePoint3D[]): void {
    if (points.length < 2) return;
    this._updateSelectedPart((part: IFurniturePart): IFurniturePart => ({
      ...part,
      pathPoints3D: points.map((point: IFurniturePoint3D): IFurniturePoint3D => ({ ...point })),
    }));
  }

  public updatePartTubeRadius(value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this._updateSelectedPart((part: IFurniturePart): IFurniturePart => ({ ...part, tubeRadius: value }));
  }

  public toggleMirror(axis: 'x' | 'z'): void {
    if (axis === AXIS_X) this._mirrorX.update((value: boolean): boolean => !value);
    else this._mirrorZ.update((value: boolean): boolean => !value);
  }

  public setName(name: string): void {
    this._blueprintName.set(name);
  }

  public setCategory(category: TFurnitureCategory): void {
    this._blueprintCategory.set(category);
  }

  public addMaterialSlot(): void {
    const index: number = Object.keys(this._draft().materials).length + 1;
    const key: string = `${MATERIAL_SLOT_KEY_PREFIX}${index}-${this._catalog.generateId().slice(0, MATERIAL_SLOT_KEY_RANDOM_LENGTH)}`;
    this._mutateDraft((blueprint: IFurnitureBlueprint): IFurnitureBlueprint => ({
      ...blueprint,
      materials: {
        ...blueprint.materials,
        [key]: createFurnitureMaterialSlot(`${DEFAULT_MATERIAL_LABEL_PREFIX}${index}`, DEFAULT_FURNITURE_SLOT_COLOR, DEFAULT_FURNITURE_MATERIAL_FINISH),
      },
    }));
  }

  public removeMaterialSlot(key: string): void {
    const remaining: [string, IMaterialSlot][] = Object.entries(this._draft().materials).filter(
      ([slotKey]: [string, IMaterialSlot]): boolean => slotKey !== key
    );
    if (remaining.length === 0) return;
    const fallbackKey: string = remaining[0][0];
    this._mutateDraft((blueprint: IFurnitureBlueprint): IFurnitureBlueprint => ({
      ...blueprint,
      parts: blueprint.parts.map((part: IFurniturePart): IFurniturePart =>
        part.materialSlot === key ? { ...part, materialSlot: fallbackKey } : part
      ),
      materials: Object.fromEntries(remaining),
    }));
  }

  public updateMaterialLabel(key: string, label: string): void {
    this._updateMaterial(key, (slot: IMaterialSlot): IMaterialSlot => ({ ...slot, label }));
  }

  public updateMaterialColor(key: string, color: string): void {
    this._updateMaterial(key, (slot: IMaterialSlot): IMaterialSlot => ({ ...slot, color }));
  }

  public updateMaterialFinish(key: string, finish: TMaterialFinish): void {
    this._updateMaterial(key, (slot: IMaterialSlot): IMaterialSlot => ({ ...slot, finish }));
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
      })
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
        part.id === id ? mutator(part) : part
      ),
    }));
  }

  private _updateMaterial(key: string, mutator: (slot: IMaterialSlot) => IMaterialSlot): void {
    this._mutateDraft((blueprint: IFurnitureBlueprint): IFurnitureBlueprint => {
      const slot: IMaterialSlot | undefined = blueprint.materials[key];
      if (!slot) return blueprint;
      return {
        ...blueprint,
        materials: { ...blueprint.materials, [key]: mutator(slot) },
      };
    });
  }

  private _toTitleCase(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
