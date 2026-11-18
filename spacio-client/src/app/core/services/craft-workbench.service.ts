import { Injectable, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { Observable, catchError, of, tap } from 'rxjs';
import {
  FURNITURE_CATEGORY_OPTIONS,
  IFurnitureBlueprint,
  IFurniturePart,
  IMaterialSlot,
  MATERIAL_FINISH_OPTIONS,
  PART_SHAPE_OPTIONS,
  TMaterialFinish,
  TFurnitureCategory,
  TPartShape,
  createFurnitureMaterialSlot,
  createFurniturePart,
} from '@spacio/shared-types';
import { FurnitureCatalogService } from './furniture-catalog.service';

export interface ICraftMaterialEntry {
  key: string;
  slot: IMaterialSlot;
}

function cloneDraft(blueprint: IFurnitureBlueprint): IFurnitureBlueprint {
  return {
    ...blueprint,
    parts: blueprint.parts.map((part: IFurniturePart): IFurniturePart => ({
      ...part,
      dimensions: { ...part.dimensions },
      position: { ...part.position },
      rotation: { ...part.rotation },
    })),
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
  private readonly _blueprintName: WritableSignal<string> = signal<string>('Untitled Piece');
  private readonly _blueprintCategory: WritableSignal<TFurnitureCategory> = signal<TFurnitureCategory>('decor');
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
    this._saveMessage.set('Blank piece started.');
  }

  public loadBlueprint(blueprint: IFurnitureBlueprint, message: string): void {
    const isExisting: boolean = !blueprint.isPreset && this._catalog.getById(blueprint.id) !== undefined;
    const source: IFurnitureBlueprint = isExisting
      ? cloneDraft(blueprint)
      : this._catalog.cloneAsDraft(blueprint);
    this._isExisting.set(isExisting);
    this._applyBlueprint(source, isExisting ? blueprint.name : `${blueprint.name} Edited`);
    this._saveMessage.set(message);
  }

  public selectBlueprint(id: string): void {
    if (id === 'blank') {
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
    const sizes: Record<TPartShape, { width: number; height: number; depth: number }> = {
      box: { width: 0.4, height: 0.4, depth: 0.4 },
      cylinder: { width: 0.2, height: 0.6, depth: 0.2 },
      sphere: { width: 0.4, height: 0.4, depth: 0.4 },
      capsule: { width: 0.2, height: 0.6, depth: 0.2 },
    };
    const dimensions: { width: number; height: number; depth: number } = sizes[shape];
    const index: number = this._draft().parts.length;
    const materialSlot: string = Object.keys(this._draft().materials)[0] ?? 'material-1';
    const part: IFurniturePart = createFurniturePart(
      this._catalog.generateId(),
      `${this._toTitleCase(shape)} ${index + 1}`,
      shape,
      dimensions,
      { x: (index % 3) * 0.5 - 0.5, y: dimensions.height / 2, z: 0 },
      materialSlot
    );
    this._mutateDraft((blueprint: IFurnitureBlueprint): IFurnitureBlueprint => ({
      ...blueprint,
      parts: [...blueprint.parts, part],
    }));
    this._selectedPartId.set(part.id);
    this._saveMessage.set(`Added ${part.name}.`);
  }

  public duplicateSelectedPart(): void {
    const part: IFurniturePart | null = this.selectedPart();
    if (!part) return;
    const mirrorX: boolean = this._mirrorX();
    const mirrorZ: boolean = this._mirrorZ();
    const copy: IFurniturePart = {
      ...part,
      id: this._catalog.generateId(),
      name: `${part.name} Copy`,
      dimensions: { ...part.dimensions },
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
    this._saveMessage.set(mirrorX || mirrorZ ? 'Duplicated with mirror.' : 'Duplicated part.');
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

  public addMaterialSlot(): void {
    const index: number = Object.keys(this._draft().materials).length + 1;
    const key: string = `material-${index}-${this._catalog.generateId().slice(0, 4)}`;
    this._mutateDraft((blueprint: IFurnitureBlueprint): IFurnitureBlueprint => ({
      ...blueprint,
      materials: {
        ...blueprint.materials,
        [key]: createFurnitureMaterialSlot(`Material ${index}`, '#8b5a2b', 'satin'),
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
      this._saveMessage.set('Add at least one part before saving.');
      return of(this._draft());
    }

    const prepared: IFurnitureBlueprint = {
      ...this._draft(),
      userId: null,
      name: this._blueprintName().trim() || 'Untitled Piece',
      category: this._blueprintCategory(),
      isPreset: false,
    };
    this._isSaving.set(true);
    this._saveMessage.set('Saving…');
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
        this._saveMessage.set(`“${saved.name}” saved to catalog.`);
      }),
      catchError((): Observable<IFurnitureBlueprint> => {
        this._isSaving.set(false);
        this._saveMessage.set('Save failed. Please try again.');
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
    this._saveMessage.set('Unsaved changes');
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
