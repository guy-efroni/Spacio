import { Component, computed, inject, signal, viewChild } from '@angular/core';
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
export class App {
  private readonly _floorplanService = inject(FloorplanService);
  protected readonly isInspectorOpen = signal<boolean>(true);
  protected readonly viewportComponent = viewChild.required<ViewportComponent>('viewportComponent');

  protected readonly wallCount = computed(() => this._floorplanService.walls().length);
  protected readonly roomArea = computed(() => this._floorplanService.roomArea());

  protected readonly ViewportToolMode = ViewportToolMode;

  protected toggleInspector(): void {
    this.isInspectorOpen.update((v) => !v);
  }

  protected _onResetRoom(): void {
    this.viewportComponent().onResetRoom();
  }

  protected readonly floorplanService = this._floorplanService;
}
