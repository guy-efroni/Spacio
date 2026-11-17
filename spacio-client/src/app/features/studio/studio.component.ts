import { Component, computed, inject, OnDestroy, Signal, signal, WritableSignal, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { FloorplanService } from '../../core/services/floorplan.service';
import { BlueprintService } from '../../core/services/blueprint.service';
import { PropertyInspectorComponent } from '../property-inspector/property-inspector.component';
import { ViewportComponent } from '../viewport/viewport.component';
import { WorkspaceNavComponent } from '../../shared/components/workspace-nav.component';
import { HtmlTag, IFurnitureBlueprint, KeyboardKey, StudioViewChild, ViewportToolMode } from '@spacio/shared-types';

@Component({
  selector: 'app-studio',
  standalone: true,
  imports: [DecimalPipe, PropertyInspectorComponent, ViewportComponent, WorkspaceNavComponent],
  providers: [FloorplanService],
  templateUrl: './studio.component.html',
  styleUrl: './studio.component.scss',
})
export class StudioComponent implements OnDestroy {
  private readonly _floorplanService: FloorplanService = inject(FloorplanService);
  private readonly _blueprintService: BlueprintService = inject(BlueprintService);
  private readonly _router: Router = inject(Router);
  protected readonly viewportComponent: Signal<ViewportComponent> = viewChild.required<ViewportComponent>(StudioViewChild.ViewportComponent);
  protected readonly isCatalogOpen: WritableSignal<boolean> = signal<boolean>(false);

  protected readonly wallCount: Signal<number> = computed<number>(() => this._floorplanService.walls().length);
  protected readonly roomArea: Signal<number> = computed<number>(() => this._floorplanService.roomArea());
  protected readonly ViewportToolMode: typeof ViewportToolMode = ViewportToolMode;
  protected readonly furnitureCatalog: Signal<readonly IFurnitureBlueprint[]> = this._blueprintService.blueprints;
  protected readonly isCatalogLoading: Signal<boolean> = this._blueprintService.isLoading;
  protected readonly catalogError: Signal<string | null> = this._blueprintService.error;

  private readonly _onKeyDown: (event: KeyboardEvent) => void = (event: KeyboardEvent): void => this._handleKeyDown(event);

  public constructor() {
    this._blueprintService.load();
    window.addEventListener('keydown', this._onKeyDown);
  }

  public ngOnDestroy(): void {
    window.removeEventListener('keydown', this._onKeyDown);
  }

  protected _onResetRoom(): void {
    this.viewportComponent().onResetRoom();
  }

  protected readonly floorplanService: FloorplanService = this._floorplanService;

  protected onToggleCatalog(): void {
    this.isCatalogOpen.update((open: boolean) => !open);
  }

  protected onSelectFurniture(blueprint: IFurnitureBlueprint): void {
    this.isCatalogOpen.set(false);
    this.viewportComponent().onStartFurniturePlacement(blueprint);
  }

  protected onOpenCraftRoom(): void {
    const selected = this._floorplanService.furniture().find((item) => item.id === this._floorplanService.selectedFurnitureId());
    if (selected) {
      this._blueprintService.setEditSourceFromPlaced(selected);
    }
    void this._router.navigate(['/craft']);
  }

  private _handleKeyDown(event: KeyboardEvent): void {
    if (this._isEditableTarget(event.target)) return;

    const key: string = event.key.toLowerCase();
    const isUndo: boolean = event.ctrlKey && !event.shiftKey && key === KeyboardKey.Undo;
    const isRedo: boolean = event.ctrlKey && (key === KeyboardKey.Redo || (event.shiftKey && key === KeyboardKey.Undo));

    if (isUndo) {
      event.preventDefault();
      this._floorplanService.undo();
      return;
    }
    if (isRedo) {
      event.preventDefault();
      this._floorplanService.redo();
    }
  }

  private _isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tagName: string = target.tagName;
    return tagName === HtmlTag.Input || tagName === HtmlTag.TextArea || tagName === HtmlTag.Select || target.isContentEditable;
  }
}
