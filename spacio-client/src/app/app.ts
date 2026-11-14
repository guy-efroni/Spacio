import { Component, computed, inject, OnDestroy, Signal, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FloorplanService } from './core/services/floorplan.service';
import { PropertyInspectorComponent } from './features/property-inspector/property-inspector.component';
import { ViewportComponent } from './features/viewport/viewport.component';
import { ViewportToolMode } from '@spacio/shared-types';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DecimalPipe, PropertyInspectorComponent, ViewportComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnDestroy {
  private readonly _floorplanService: FloorplanService = inject(FloorplanService);
  protected readonly viewportComponent: Signal<ViewportComponent> = viewChild.required<ViewportComponent>('viewportComponent');

  protected readonly wallCount: Signal<number> = computed(() => this._floorplanService.walls().length);
  protected readonly roomArea: Signal<number> = computed(() => this._floorplanService.roomArea());

  protected readonly ViewportToolMode: typeof ViewportToolMode = ViewportToolMode;
  private readonly _onKeyDown: (event: KeyboardEvent) => void = (event: KeyboardEvent): void =>
    this._handleKeyDown(event);

  public constructor() {
    window.addEventListener('keydown', this._onKeyDown);
  }

  public ngOnDestroy(): void {
    window.removeEventListener('keydown', this._onKeyDown);
  }

  protected _onResetRoom(): void {
    this.viewportComponent().onResetRoom();
  }

  protected readonly floorplanService: FloorplanService = this._floorplanService;

  private _handleKeyDown(event: KeyboardEvent): void {
    if (this._isEditableTarget(event.target)) {
      return;
    }

    const key: string = event.key.toLowerCase();
    const isUndo: boolean = event.ctrlKey && !event.shiftKey && key === 'z';
    const isRedo: boolean =
      event.ctrlKey && (key === 'y' || (event.shiftKey && key === 'z'));

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
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    const tagName: string = target.tagName;
    return (
      tagName === 'INPUT' ||
      tagName === 'TEXTAREA' ||
      tagName === 'SELECT' ||
      target.isContentEditable
    );
  }
}
