import { Injectable, Signal, WritableSignal, computed, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  FURNITURE_PRESETS,
  IFurnitureBlueprint,
  cloneBlueprint,
  cloneFurniturePart,
  createBlankBlueprint,
} from '@spacio/shared-types';

const CUSTOM_BLUEPRINTS_STORAGE_KEY: string = 'spacio_custom_blueprints';

function cloneStoredBlueprint(blueprint: IFurnitureBlueprint): IFurnitureBlueprint {
  return {
    ...blueprint,
    parts: blueprint.parts.map((part) => cloneFurniturePart(part)),
    materials: Object.fromEntries(
      Object.entries(blueprint.materials).map(([key, slot]) => [key, { ...slot }])
    ),
  };
}

@Injectable({ providedIn: 'root' })
export class FurnitureCatalogService {
  private readonly _blueprints: WritableSignal<IFurnitureBlueprint[]> = signal<IFurnitureBlueprint[]>(
    FURNITURE_PRESETS.map((preset: IFurnitureBlueprint): IFurnitureBlueprint => cloneStoredBlueprint(preset))
  );
  private readonly _isLoading: WritableSignal<boolean> = signal<boolean>(false);
  private readonly _isOnline: WritableSignal<boolean> = signal<boolean>(true);
  private readonly _error: WritableSignal<string | null> = signal<string | null>(null);

  public readonly blueprints: Signal<readonly IFurnitureBlueprint[]> = this._blueprints.asReadonly();
  public readonly presets: Signal<readonly IFurnitureBlueprint[]> = computed(() =>
    this._blueprints().filter((item: IFurnitureBlueprint): boolean => item.isPreset)
  );
  public readonly customPieces: Signal<readonly IFurnitureBlueprint[]> = computed(() =>
    this._blueprints().filter((item: IFurnitureBlueprint): boolean => !item.isPreset)
  );
  public readonly isLoading: Signal<boolean> = this._isLoading.asReadonly();
  public readonly isOnline: Signal<boolean> = this._isOnline.asReadonly();
  public readonly error: Signal<string | null> = this._error.asReadonly();

  public constructor() {
    this._applyCustom(this._readCache());
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
      (item: IFurnitureBlueprint): boolean => item.name.toLowerCase() === normalized
    );
  }

  public saveBlueprint(blueprint: IFurnitureBlueprint): Observable<IFurnitureBlueprint> {
    const prepared: IFurnitureBlueprint = this._prepare(blueprint);
    this._upsert(prepared);
    return of(prepared);
  }

  public updateBlueprint(id: string, blueprint: IFurnitureBlueprint): Observable<IFurnitureBlueprint> {
    const prepared: IFurnitureBlueprint = this._prepare({ ...blueprint, id });
    this._upsert(prepared);
    return of(prepared);
  }

  public deleteBlueprint(id: string): Observable<void> {
    const existing: IFurnitureBlueprint | undefined = this.getById(id);
    if (!existing || existing.isPreset) return of(void 0);

    this._blueprints.update((items: IFurnitureBlueprint[]): IFurnitureBlueprint[] =>
      items.filter((item: IFurnitureBlueprint): boolean => item.id !== id)
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
      (item: IFurnitureBlueprint): boolean => item.id === blueprint.id
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
      const parsed: IFurnitureBlueprint[] = JSON.parse(raw) as IFurnitureBlueprint[];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (item: IFurnitureBlueprint): boolean =>
          !!item && !item.isPreset && typeof item.id === 'string' && Array.isArray(item.parts)
      );
    } catch {
      return [];
    }
  }

  private _persistCache(): void {
    if (typeof localStorage === 'undefined') return;
    const custom: IFurnitureBlueprint[] = this._blueprints().filter(
      (item: IFurnitureBlueprint): boolean => !item.isPreset
    );
    try {
      localStorage.setItem(CUSTOM_BLUEPRINTS_STORAGE_KEY, JSON.stringify(custom));
    } catch {
      this._error.set('Local storage is full — this piece is kept for this session only.');
    }
  }
}
