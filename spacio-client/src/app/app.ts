import { Component, computed, inject, Signal, viewChild } from '@angular/core';
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
  private readonly _floorplanService: FloorplanService = inject(FloorplanService);
  protected readonly viewportComponent: Signal<ViewportComponent> = viewChild.required<ViewportComponent>('viewportComponent');

  protected readonly wallCount: Signal<number> = computed(() => this._floorplanService.walls().length);
  protected readonly roomArea: Signal<number> = computed(() => this._floorplanService.roomArea());

  protected readonly ViewportToolMode: typeof ViewportToolMode = ViewportToolMode;

  protected _onResetRoom(): void {
    this.viewportComponent().onResetRoom();
  }

  protected readonly floorplanService: FloorplanService = this._floorplanService;
}
