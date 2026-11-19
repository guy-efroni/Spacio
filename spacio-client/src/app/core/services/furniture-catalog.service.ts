import { Injectable, Signal, WritableSignal, computed, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  FURNITURE_PRESETS,
  IFurnitureBlueprint,
  IFurniturePart,
  IFurniturePartDimensions,
  IFurniturePartSculpt,
  IMaterialSlot,
  MATERIAL_FINISH_OPTIONS,
  MATERIAL_PRESET_IDS,
  PART_SHAPE_OPTIONS,
  TMaterialFinish,
  TMaterialPreset,
  TFurnitureCategory,
  TPartShape,
  clampBevel,
  clampTaper,
  cloneBlueprint,
  cloneFurniturePart,
  cloneFurniturePartSculpt,
  createBlankBlueprint,
  createFurniturePartSculpt,
  getMaterialPresetSwatch,
  isSculptShape,
  sculptModeForPartShape,
} from '@spacio/shared-types';

const CUSTOM_BLUEPRINTS_STORAGE_KEY = 'spacio_custom_blueprints';
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_DIMENSIONS: IFurniturePartDimensions = { width: 0.4, height: 0.4, depth: 0.4 };

interface ILegacyPartRecord {
  id?: string;
  name?: string;
  shape?: string;
  dimensions?: Partial<IFurniturePartDimensions>;
  position?: Partial<IFurniturePart['position']>;
  rotation?: Partial<IFurniturePart['rotation']>;
  materialSlot?: string;
  bevel?: number;
  bevelRadius?: number;
  taper?: number;
  materialPreset?: string;
  color?: string;
  sculpt?: IFurniturePartSculpt;
}

interface ILegacyBlueprintRecord {
  id?: string;
  name?: string;
  category?: TFurnitureCategory;
  thumbnailDataUrl?: string;
  parts?: ILegacyPartRecord[];
  materials?: Record<string, IMaterialSlot>;
}

function isHexColor(value: string | undefined): value is string {
  return value !== undefined && HEX_COLOR_PATTERN.test(value);
}

function isPreset(value: string | undefined): value is TMaterialPreset {
  return value !== undefined && MATERIAL_PRESET_IDS.includes(value as TMaterialPreset);
}

function isShape(value: string | undefined): value is TPartShape {
  return value !== undefined && PART_SHAPE_OPTIONS.includes(value as TPartShape);
}

function presetFromFinish(finish: TMaterialFinish | undefined): TMaterialPreset {
  switch (finish) {
    case 'glass':
      return 'glass';
    case 'metallic':
      return 'brushed-brass';
    case 'gloss':
      return 'leather';
    case 'matte':
      return 'boucle';
    default:
      return 'oak';
  }
}

function normalizeMaterials(
  value: Record<string, IMaterialSlot> | undefined,
): Record<string, IMaterialSlot> {
  if (!value) return {};
  const entries: [string, IMaterialSlot][] = [];
  for (const [key, slot] of Object.entries(value)) {
    if (!slot || !isHexColor(slot.color)) continue;
    const finish: TMaterialFinish = MATERIAL_FINISH_OPTIONS.includes(slot.finish)
      ? slot.finish
      : 'satin';
    entries.push([key, { label: slot.label || key, color: slot.color, finish }]);
  }
  return Object.fromEntries(entries);
}

function normalizePart(
  part: ILegacyPartRecord,
  materials: Record<string, IMaterialSlot>,
): IFurniturePart | null {
  if (!part || typeof part.id !== 'string' || typeof part.name !== 'string') return null;
  const slot: IMaterialSlot | undefined =
    part.materialSlot !== undefined ? materials[part.materialSlot] : undefined;
  const materialPreset: TMaterialPreset = isPreset(part.materialPreset)
    ? part.materialPreset
    : presetFromFinish(slot?.finish);
  const shape: TPartShape = isShape(part.shape) ? part.shape : 'box';
  const sculpt: IFurniturePartSculpt | undefined = part.sculpt
    ? cloneFurniturePartSculpt(part.sculpt)
    : isSculptShape(shape)
      ? createFurniturePartSculpt(
          sculptModeForPartShape(shape),
          shape === 'lathe-360' ? 'turned-leg' : 'rectangle',
        )
      : undefined;
  const legacyBevel: number =
    part.bevelRadius !== undefined ? Math.min(1, part.bevelRadius / 0.08) : 0;
  const color: string = isHexColor(part.color)
    ? part.color
    : isHexColor(slot?.color)
      ? slot.color
      : getMaterialPresetSwatch(materialPreset);
  return cloneFurniturePart({
    id: part.id,
    name: part.name,
    shape,
    dimensions: {
      width: part.dimensions?.width ?? DEFAULT_DIMENSIONS.width,
      height: part.dimensions?.height ?? DEFAULT_DIMENSIONS.height,
      depth: part.dimensions?.depth ?? DEFAULT_DIMENSIONS.depth,
    },
    position: {
      x: part.position?.x ?? 0,
      y: part.position?.y ?? DEFAULT_DIMENSIONS.height / 2,
      z: part.position?.z ?? 0,
    },
    rotation: {
      x: part.rotation?.x ?? 0,
      y: part.rotation?.y ?? 0,
      z: part.rotation?.z ?? 0,
    },
    bevel: clampBevel(part.bevel ?? legacyBevel),
    taper: clampTaper(part.taper ?? 0),
    materialPreset,
    color,
    sculpt,
  });
}

function normalizeBlueprint(record: ILegacyBlueprintRecord): IFurnitureBlueprint | null {
  if (
    !record ||
    typeof record.id !== 'string' ||
    typeof record.name !== 'string' ||
    !Array.isArray(record.parts)
  ) {
    return null;
  }
  const materials: Record<string, IMaterialSlot> = normalizeMaterials(record.materials);
  const parts: IFurniturePart[] = record.parts
    .map((part: ILegacyPartRecord): IFurniturePart | null => normalizePart(part, materials))
    .filter((part: IFurniturePart | null): part is IFurniturePart => part !== null);
  return {
    id: record.id,
    userId: null,
    name: record.name,
    category: record.category ?? 'decor',
    isPreset: false,
    thumbnailDataUrl: record.thumbnailDataUrl,
    parts,
    materials,
  };
}

function cloneStoredBlueprint(blueprint: IFurnitureBlueprint): IFurnitureBlueprint {
  return {
    ...blueprint,
    parts: blueprint.parts.map((part: IFurniturePart): IFurniturePart => cloneFurniturePart(part)),
    materials: normalizeMaterials(blueprint.materials),
  };
}

@Injectable({ providedIn: 'root' })
export class FurnitureCatalogService {
  private readonly _blueprints: WritableSignal<IFurnitureBlueprint[]> = signal<
    IFurnitureBlueprint[]
  >(
    FURNITURE_PRESETS.map((preset: IFurnitureBlueprint): IFurnitureBlueprint =>
      cloneStoredBlueprint(preset),
    ),
  );
  private readonly _isLoading: WritableSignal<boolean> = signal<boolean>(false);
  private readonly _isOnline: WritableSignal<boolean> = signal<boolean>(true);
  private readonly _error: WritableSignal<string | null> = signal<string | null>(null);

  public readonly blueprints: Signal<readonly IFurnitureBlueprint[]> =
    this._blueprints.asReadonly();
  public readonly presets: Signal<readonly IFurnitureBlueprint[]> = computed(() =>
    this._blueprints().filter((item: IFurnitureBlueprint): boolean => item.isPreset),
  );
  public readonly customPieces: Signal<readonly IFurnitureBlueprint[]> = computed(() =>
    this._blueprints().filter((item: IFurnitureBlueprint): boolean => !item.isPreset),
  );
  public readonly isLoading: Signal<boolean> = this._isLoading.asReadonly();
  public readonly isOnline: Signal<boolean> = this._isOnline.asReadonly();
  public readonly error: Signal<string | null> = this._error.asReadonly();

  public constructor() {
    this._applyCustom(this._readCache());
    this._persistCache();
  }

  public refresh(): void {
    this._applyCustom(this._readCache());
  }

  public getById(id: string): IFurnitureBlueprint | undefined {
    return this._blueprints().find((item: IFurnitureBlueprint): boolean => item.id === id);
  }

  public getByName(name: string): IFurnitureBlueprint | undefined {
    const normalized: string = name.trim().toLowerCase();
    return this._blueprints().find(
      (item: IFurnitureBlueprint): boolean => item.name.toLowerCase() === normalized,
    );
  }

  public saveBlueprint(blueprint: IFurnitureBlueprint): Observable<IFurnitureBlueprint> {
    const prepared: IFurnitureBlueprint = this._prepare(blueprint);
    this._upsert(prepared);
    return of(prepared);
  }

  public updateBlueprint(
    id: string,
    blueprint: IFurnitureBlueprint,
  ): Observable<IFurnitureBlueprint> {
    const prepared: IFurnitureBlueprint = this._prepare({ ...blueprint, id });
    this._upsert(prepared);
    return of(prepared);
  }

  public deleteBlueprint(id: string): Observable<void> {
    const existing: IFurnitureBlueprint | undefined = this.getById(id);
    if (!existing || existing.isPreset) return of(void 0);

    this._blueprints.update((items: IFurnitureBlueprint[]): IFurnitureBlueprint[] =>
      items.filter((item: IFurnitureBlueprint): boolean => item.id !== id),
    );
    this._persistCache();
    return of(void 0);
  }

  public createBlankDraft(): IFurnitureBlueprint {
    return createBlankBlueprint(this.generateId());
  }

  public cloneAsDraft(blueprint: IFurnitureBlueprint): IFurnitureBlueprint {
    const draft: IFurnitureBlueprint = cloneBlueprint(blueprint, this.generateId());
    draft.name = `${blueprint.name} Copy`;
    return draft;
  }

  public generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `blueprint-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private _prepare(blueprint: IFurnitureBlueprint): IFurnitureBlueprint {
    return {
      ...cloneStoredBlueprint(blueprint),
      id: blueprint.id || this.generateId(),
      userId: null,
      isPreset: false,
    };
  }

  private _upsert(blueprint: IFurnitureBlueprint): void {
    const next: IFurnitureBlueprint[] = [...this._blueprints()];
    const index: number = next.findIndex(
      (item: IFurnitureBlueprint): boolean => item.id === blueprint.id,
    );
    if (index === -1) next.push(cloneStoredBlueprint(blueprint));
    else next[index] = cloneStoredBlueprint(blueprint);
    this._blueprints.set(next);
    this._persistCache();
  }

  private _applyCustom(items: readonly IFurnitureBlueprint[]): void {
    const byId: Map<string, IFurnitureBlueprint> = new Map<string, IFurnitureBlueprint>();
    for (const preset of FURNITURE_PRESETS) {
      byId.set(preset.id, cloneStoredBlueprint(preset));
    }
    for (const item of items) {
      if (!item.isPreset) byId.set(item.id, cloneStoredBlueprint(item));
    }
    this._blueprints.set([...byId.values()]);
  }

  private _readCache(): IFurnitureBlueprint[] {
    if (typeof localStorage === 'undefined') return [];
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(CUSTOM_BLUEPRINTS_STORAGE_KEY);
    } catch {
      return [];
    }
    if (!raw) return [];
    try {
      const parsed: ILegacyBlueprintRecord[] = JSON.parse(raw) as ILegacyBlueprintRecord[];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item: ILegacyBlueprintRecord): IFurnitureBlueprint | null => normalizeBlueprint(item))
        .filter((item: IFurnitureBlueprint | null): item is IFurnitureBlueprint => item !== null);
    } catch {
      return [];
    }
  }

  private _persistCache(): void {
    if (typeof localStorage === 'undefined') return;
    const custom: IFurnitureBlueprint[] = this._blueprints()
      .filter((item: IFurnitureBlueprint): boolean => !item.isPreset)
      .map((item: IFurnitureBlueprint): IFurnitureBlueprint => cloneStoredBlueprint(item));
    try {
      localStorage.setItem(CUSTOM_BLUEPRINTS_STORAGE_KEY, JSON.stringify(custom));
    } catch {
      this._error.set('Local storage is full — this piece is kept for this session only.');
    }
  }
}
