import { Injectable, Signal, WritableSignal, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, tap } from 'rxjs';
import {
  IFurnitureBlueprint,
  IUserProfile,
  cloneBlueprint,
  createBlankBlueprint,
  FURNITURE_PRESETS,
} from '@spacio/shared-types';
import { AuthService } from './auth.service';

const BLUEPRINTS_ENDPOINT: string = '/api/blueprints';
const CACHE_KEY_PREFIX: string = 'spacio.catalog.';

function cloneStoredBlueprint(blueprint: IFurnitureBlueprint): IFurnitureBlueprint {
  return {
    ...blueprint,
    parts: blueprint.parts.map((part) => ({
      ...part,
      dimensions: { ...part.dimensions },
      position: { ...part.position },
      rotation: { ...part.rotation },
    })),
    materials: Object.fromEntries(
      Object.entries(blueprint.materials).map(([key, slot]) => [key, { ...slot }])
    ),
  };
}

@Injectable({ providedIn: 'root' })
export class FurnitureCatalogService {
  private readonly _http: HttpClient = inject(HttpClient);
  private readonly _auth: AuthService = inject(AuthService);

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
    this._applyCustom(this._readCache(this._cacheKey()));
    effect((): void => {
      this._loadForUser(this._auth.currentUser());
    });
  }

  public refresh(): void {
    this._loadForUser(this._auth.currentUser());
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
    if (!this._auth.isAuthenticated()) {
      this._error.set('Saved locally — sign in to sync this piece.');
      return of(prepared);
    }

    return this._http.post<IFurnitureBlueprint>(BLUEPRINTS_ENDPOINT, prepared, {
      headers: this._auth.authorizationHeaders(),
    }).pipe(
      tap((saved: IFurnitureBlueprint): void => {
        this._upsert(saved);
        this._isOnline.set(true);
        this._error.set(null);
      }),
      catchError((): Observable<IFurnitureBlueprint> => {
        this._isOnline.set(false);
        this._error.set('Offline — saved locally.');
        return of(prepared);
      })
    );
  }

  public updateBlueprint(id: string, blueprint: IFurnitureBlueprint): Observable<IFurnitureBlueprint> {
    const prepared: IFurnitureBlueprint = this._prepare({ ...blueprint, id });
    this._upsert(prepared);
    if (!this._auth.isAuthenticated()) {
      this._error.set('Updated locally — sign in to sync this piece.');
      return of(prepared);
    }

    return this._http.put<IFurnitureBlueprint>(`${BLUEPRINTS_ENDPOINT}/${encodeURIComponent(id)}`, prepared, {
      headers: this._auth.authorizationHeaders(),
    }).pipe(
      tap((saved: IFurnitureBlueprint): void => {
        this._upsert(saved);
        this._isOnline.set(true);
        this._error.set(null);
      }),
      catchError((): Observable<IFurnitureBlueprint> => {
        this._isOnline.set(false);
        this._error.set('Offline — updated locally.');
        return of(prepared);
      })
    );
  }

  public deleteBlueprint(id: string): Observable<void> {
    const existing: IFurnitureBlueprint | undefined = this.getById(id);
    if (!existing || existing.isPreset) return of(void 0);

    this._blueprints.update((items: IFurnitureBlueprint[]): IFurnitureBlueprint[] =>
      items.filter((item: IFurnitureBlueprint): boolean => item.id !== id)
    );
    this._persistCache();
    if (!this._auth.isAuthenticated()) return of(void 0);

    return this._http.delete<void>(`${BLUEPRINTS_ENDPOINT}/${encodeURIComponent(id)}`, {
      headers: this._auth.authorizationHeaders(),
    }).pipe(
      tap((): void => {
        this._isOnline.set(true);
        this._error.set(null);
      }),
      catchError((): Observable<void> => {
        this._isOnline.set(false);
        this._error.set('Offline — removed locally.');
        return of(void 0);
      })
    );
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

  private _loadForUser(user: IUserProfile | null): void {
    if (!user) {
      this._applyCustom(this._readCache(this._cacheKey()));
      return;
    }

    this._isLoading.set(true);
    this._error.set(null);
    this._http.get<IFurnitureBlueprint[]>(BLUEPRINTS_ENDPOINT, {
      headers: this._auth.authorizationHeaders(),
    }).subscribe({
      next: (items: IFurnitureBlueprint[]): void => {
        this._applyCustom(items.filter((item: IFurnitureBlueprint): boolean => !item.isPreset));
        this._isOnline.set(true);
        this._isLoading.set(false);
      },
      error: (): void => {
        this._applyCustom(this._readCache(this._cacheKey()));
        this._isOnline.set(false);
        this._error.set('Offline — showing cached furniture.');
        this._isLoading.set(false);
      },
    });
  }

  private _prepare(blueprint: IFurnitureBlueprint): IFurnitureBlueprint {
    return {
      ...cloneStoredBlueprint(blueprint),
      id: blueprint.id || this.generateId(),
      userId: this._auth.currentUser()?.id ?? null,
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

  private _cacheKey(): string {
    return `${CACHE_KEY_PREFIX}${this._auth.currentUser()?.id ?? 'guest'}`;
  }

  private _readCache(key: string): IFurnitureBlueprint[] {
    if (typeof localStorage === 'undefined') return [];
    const raw: string | null = localStorage.getItem(key);
    if (!raw) return [];
    try {
      const parsed: IFurnitureBlueprint[] = JSON.parse(raw) as IFurnitureBlueprint[];
      return parsed.filter((item: IFurnitureBlueprint): boolean => !item.isPreset && !!item.id);
    } catch {
      return [];
    }
  }

  private _persistCache(): void {
    if (typeof localStorage === 'undefined') return;
    const custom: IFurnitureBlueprint[] = this._blueprints().filter(
      (item: IFurnitureBlueprint): boolean => !item.isPreset
    );
    localStorage.setItem(this._cacheKey(), JSON.stringify(custom));
  }
}
