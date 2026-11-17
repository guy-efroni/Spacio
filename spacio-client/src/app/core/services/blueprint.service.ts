import { Injectable, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { IFurnitureBlueprint, IPlacedFurniture, createBlankBlueprint } from '@spacio/shared-types';

const BLUEPRINTS_ENDPOINT: string = '/api/blueprints';

@Injectable({ providedIn: 'root' })
export class BlueprintService {
  private readonly _http: HttpClient = inject(HttpClient);
  private readonly _blueprints: WritableSignal<readonly IFurnitureBlueprint[]> = signal<readonly IFurnitureBlueprint[]>([]);
  private readonly _isLoading: WritableSignal<boolean> = signal<boolean>(false);
  private readonly _error: WritableSignal<string | null> = signal<string | null>(null);
  private readonly _editSource: WritableSignal<IFurnitureBlueprint | null> = signal<IFurnitureBlueprint | null>(null);

  public readonly blueprints: Signal<readonly IFurnitureBlueprint[]> = this._blueprints.asReadonly();
  public readonly presets: Signal<readonly IFurnitureBlueprint[]> = computed(() => this._blueprints().filter((item: IFurnitureBlueprint) => item.isPreset));
  public readonly customPieces: Signal<readonly IFurnitureBlueprint[]> = computed(() => this._blueprints().filter((item: IFurnitureBlueprint) => !item.isPreset));
  public readonly isLoading: Signal<boolean> = this._isLoading.asReadonly();
  public readonly error: Signal<string | null> = this._error.asReadonly();

  public load(): void {
    this._isLoading.set(true);
    this._error.set(null);
    this._http.get<IFurnitureBlueprint[]>(BLUEPRINTS_ENDPOINT).subscribe({
      next: (items: IFurnitureBlueprint[]): void => {
        this._blueprints.set(items);
        this._isLoading.set(false);
      },
      error: (): void => {
        this._error.set('Unable to load the furniture catalog.');
        this._isLoading.set(false);
      },
    });
  }

  public save(blueprint: IFurnitureBlueprint): Observable<IFurnitureBlueprint> {
    return this._http.post<IFurnitureBlueprint>(BLUEPRINTS_ENDPOINT, blueprint).pipe(
      tap((saved: IFurnitureBlueprint): void => this._upsert(saved))
    );
  }

  public update(id: string, blueprint: IFurnitureBlueprint): Observable<IFurnitureBlueprint> {
    return this._http.put<IFurnitureBlueprint>(`${BLUEPRINTS_ENDPOINT}/${id}`, blueprint).pipe(
      tap((saved: IFurnitureBlueprint): void => this._upsert(saved))
    );
  }

  public remove(id: string): Observable<void> {
    return this._http.delete<void>(`${BLUEPRINTS_ENDPOINT}/${id}`).pipe(
      tap((): void => this._blueprints.update((items: readonly IFurnitureBlueprint[]) => items.filter((item: IFurnitureBlueprint) => item.id !== id)))
    );
  }

  public setEditSource(blueprint: IFurnitureBlueprint): void {
    this._editSource.set(blueprint);
  }

  public setEditSourceFromPlaced(item: IPlacedFurniture): void {
    this._editSource.set({
      id: item.blueprintId,
      name: item.name,
      category: 'decor',
      isPreset: false,
      parts: item.parts,
      materials: item.materials,
    });
  }

  public peekEditSource(): IFurnitureBlueprint | null {
    return this._editSource();
  }

  public clearEditSource(): void {
    this._editSource.set(null);
  }

  public createBlankDraft(): IFurnitureBlueprint {
    return createBlankBlueprint(this._generateId());
  }

  public cloneAsDraft(blueprint: IFurnitureBlueprint): IFurnitureBlueprint {
    return {
      ...blueprint,
      id: this._generateId(),
      name: `${blueprint.name} Copy`,
      isPreset: false,
      thumbnailDataUrl: undefined,
      parts: blueprint.parts.map((part) => ({ ...part, dimensions: { ...part.dimensions }, position: { ...part.position }, rotation: { ...part.rotation } })),
      materials: Object.fromEntries(Object.entries(blueprint.materials).map(([key, slot]) => [key, { ...slot }])),
    };
  }

  public generateId(): string {
    return this._generateId();
  }

  private _upsert(saved: IFurnitureBlueprint): void {
    this._blueprints.update((items: readonly IFurnitureBlueprint[]) => {
      const index: number = items.findIndex((item: IFurnitureBlueprint) => item.id === saved.id);
      if (index === -1) return [...items, saved];
      const next: IFurnitureBlueprint[] = [...items];
      next[index] = saved;
      return next;
    });
  }

  private _generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `blueprint-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
