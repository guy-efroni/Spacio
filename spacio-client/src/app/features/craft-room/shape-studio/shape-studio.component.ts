import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import {
  DEFAULT_BEVEL_RADIUS,
  DEFAULT_EXTRUDE_POINTS,
  DEFAULT_LATHE_POINTS,
  DEFAULT_TUBE_PATH_POINTS,
  DEFAULT_TUBE_RADIUS,
  IFurniturePart,
  IFurniturePoint2D,
  IFurniturePoint3D,
  ISilhouettePreset,
  SILHOUETTE_PRESETS,
  TSilhouetteMode,
} from '@spacio/shared-types';

const PAD_SIZE: number = 200;
const GRID_STEP: number = 25;
const MIN_POINTS_2D: number = 3;
const MIN_POINTS_3D: number = 2;
const AXIS_CENTER: number = PAD_SIZE / 2;
const COORD_MIN: number = -0.5;
const COORD_MAX: number = 0.5;
const RADIUS_MIN: number = 0;
const TUBE_Z_STEP: number = 0.2;

interface IGridLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

@Component({
  selector: 'app-shape-studio',
  standalone: true,
  templateUrl: './shape-studio.component.html',
  styleUrl: './shape-studio.component.scss',
})
export class ShapeStudioComponent {
  @ViewChild('pad', { static: true }) private _padRef?: ElementRef<SVGSVGElement>;

  @Input({ required: true }) public part!: IFurniturePart;

  @Output() public readonly points2DChange: EventEmitter<IFurniturePoint2D[]> = new EventEmitter<IFurniturePoint2D[]>();
  @Output() public readonly pathPoints3DChange: EventEmitter<IFurniturePoint3D[]> = new EventEmitter<IFurniturePoint3D[]>();
  @Output() public readonly tubeRadiusChange: EventEmitter<number> = new EventEmitter<number>();
  @Output() public readonly bevelRadiusChange: EventEmitter<number> = new EventEmitter<number>();
  @Output() public readonly close: EventEmitter<void> = new EventEmitter<void>();

  public readonly gridLines: readonly IGridLine[] = this._buildGridLines();
  public selectedPointIndex: number = -1;

  private _draggingIndex: number | null = null;

  public get isTubePath(): boolean {
    return this.part.shape === 'tube-path';
  }

  public get isLathe(): boolean {
    return this.part.shape === 'lathe-360';
  }

  public get canToggleSmooth(): boolean {
    return !this.isTubePath;
  }

  public get silhouettePresets(): readonly ISilhouettePreset[] {
    const mode: TSilhouetteMode = this.isLathe ? 'lathe' : 'extrude';
    return SILHOUETTE_PRESETS.filter((preset: ISilhouettePreset): boolean => preset.mode === mode);
  }

  public get points2D(): readonly IFurniturePoint2D[] {
    if (this.part.points2D && this.part.points2D.length >= MIN_POINTS_2D) return this.part.points2D;
    return this.isLathe ? DEFAULT_LATHE_POINTS : DEFAULT_EXTRUDE_POINTS;
  }

  public get points3D(): readonly IFurniturePoint3D[] {
    if (this.part.pathPoints3D && this.part.pathPoints3D.length >= MIN_POINTS_3D) return this.part.pathPoints3D;
    return DEFAULT_TUBE_PATH_POINTS;
  }

  public get tubeRadius(): number {
    return this.part.tubeRadius ?? DEFAULT_TUBE_RADIUS;
  }

  public get bevelRadius(): number {
    return this.part.bevelRadius ?? DEFAULT_BEVEL_RADIUS;
  }

  public get canRemovePoint(): boolean {
    const length: number = this.isTubePath ? this.points3D.length : this.points2D.length;
    const minimum: number = this.isTubePath ? MIN_POINTS_3D : MIN_POINTS_2D;
    return length > minimum && this.selectedPointIndex >= 0;
  }

  public svgX(point: { x: number }): number {
    return (point.x + 0.5) * PAD_SIZE;
  }

  public svgY(point: { y: number }): number {
    return (0.5 - point.y) * PAD_SIZE;
  }

  public polylinePoints(): string {
    const points: readonly { x: number; y: number }[] = this.isTubePath ? this.points3D : this.points2D;
    return points.map((point: { x: number; y: number }): string => `${this.svgX(point)},${this.svgY(point)}`).join(' ');
  }

  public onPadPointerDown(event: PointerEvent): void {
    event.preventDefault();
    const point: IFurniturePoint2D = this._pointFromEvent(event);
    if (this.isTubePath) {
      const points: IFurniturePoint3D[] = this.points3D.map((item: IFurniturePoint3D): IFurniturePoint3D => ({ ...item }));
      const last: IFurniturePoint3D | undefined = points[points.length - 1];
      const z: number = last ? this._clamp(last.z === 0 ? TUBE_Z_STEP : 0, COORD_MIN, COORD_MAX) : 0;
      points.push({ x: point.x, y: point.y, z });
      this.pathPoints3DChange.emit(points);
      this.selectedPointIndex = points.length - 1;
      return;
    }

    const points: IFurniturePoint2D[] = this.points2D.map((item: IFurniturePoint2D): IFurniturePoint2D => ({ ...item }));
    points.push(point);
    this.points2DChange.emit(points);
    this.selectedPointIndex = points.length - 1;
  }

  public onPointPointerDown(event: PointerEvent, index: number): void {
    event.preventDefault();
    event.stopPropagation();
    this._draggingIndex = index;
    this.selectedPointIndex = index;
    const target: Element | null = event.target as Element | null;
    target?.setPointerCapture?.(event.pointerId);
  }

  public onPadPointerMove(event: PointerEvent): void {
    if (this._draggingIndex === null) return;
    event.preventDefault();
    const index: number = this._draggingIndex;
    const point: IFurniturePoint2D = this._pointFromEvent(event);

    if (this.isTubePath) {
      const points: IFurniturePoint3D[] = this.points3D.map((item: IFurniturePoint3D): IFurniturePoint3D => ({ ...item }));
      const current: IFurniturePoint3D | undefined = points[index];
      if (!current) return;
      points[index] = { ...current, x: point.x, y: point.y };
      this.pathPoints3DChange.emit(points);
      return;
    }

    const points: IFurniturePoint2D[] = this.points2D.map((item: IFurniturePoint2D): IFurniturePoint2D => ({ ...item }));
    const current: IFurniturePoint2D | undefined = points[index];
    if (!current) return;
    points[index] = { ...current, x: point.x, y: point.y };
    this.points2DChange.emit(points);
  }

  public onPadPointerUp(event: PointerEvent): void {
    if (this._draggingIndex === null) return;
    const target: Element | null = event.target as Element | null;
    if (target?.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId);
    this._draggingIndex = null;
  }

  public toggleSmooth(index: number): void {
    const points: IFurniturePoint2D[] = this.points2D.map((item: IFurniturePoint2D): IFurniturePoint2D => ({ ...item }));
    const point: IFurniturePoint2D | undefined = points[index];
    if (!point) return;
    point.smooth = point.smooth !== true;
    this.points2DChange.emit(points);
  }

  public removeSelectedPoint(): void {
    if (!this.canRemovePoint) return;
    if (this.isTubePath) {
      const points: IFurniturePoint3D[] = this.points3D
        .map((item: IFurniturePoint3D): IFurniturePoint3D => ({ ...item }))
        .filter((_item: IFurniturePoint3D, index: number): boolean => index !== this.selectedPointIndex);
      this.pathPoints3DChange.emit(points);
    } else {
      const points: IFurniturePoint2D[] = this.points2D
        .map((item: IFurniturePoint2D): IFurniturePoint2D => ({ ...item }))
        .filter((_item: IFurniturePoint2D, index: number): boolean => index !== this.selectedPointIndex);
      this.points2DChange.emit(points);
    }
    this.selectedPointIndex = -1;
  }

  public applyPreset(preset: ISilhouettePreset): void {
    this.points2DChange.emit(preset.points.map((point: IFurniturePoint2D): IFurniturePoint2D => ({ ...point })));
    this.selectedPointIndex = -1;
  }

  public onTubeCoordinateChange(index: number, axis: 'x' | 'y' | 'z', event: Event): void {
    const input: HTMLInputElement = event.target as HTMLInputElement;
    const value: number = input.valueAsNumber;
    if (!Number.isFinite(value)) return;
    const points: IFurniturePoint3D[] = this.points3D.map((item: IFurniturePoint3D): IFurniturePoint3D => ({ ...item }));
    const point: IFurniturePoint3D | undefined = points[index];
    if (!point) return;
    points[index] = { ...point, [axis]: this._clamp(value, COORD_MIN, COORD_MAX) };
    this.pathPoints3DChange.emit(points);
  }

  public onTubeRadiusChange(event: Event): void {
    const input: HTMLInputElement = event.target as HTMLInputElement;
    const value: number = input.valueAsNumber;
    if (Number.isFinite(value) && value > 0) this.tubeRadiusChange.emit(value);
  }

  public onBevelRadiusChange(event: Event): void {
    const input: HTMLInputElement = event.target as HTMLInputElement;
    const value: number = input.valueAsNumber;
    if (Number.isFinite(value) && value >= 0) this.bevelRadiusChange.emit(value);
  }

  public format(value: number): string {
    return Number.isFinite(value) ? value.toFixed(2) : '0.00';
  }

  private _buildGridLines(): IGridLine[] {
    const lines: IGridLine[] = [];
    for (let coordinate: number = 0; coordinate <= PAD_SIZE; coordinate += GRID_STEP) {
      lines.push({ x1: coordinate, y1: 0, x2: coordinate, y2: PAD_SIZE });
      lines.push({ x1: 0, y1: coordinate, x2: PAD_SIZE, y2: coordinate });
    }
    return lines;
  }

  private _pointFromEvent(event: PointerEvent): IFurniturePoint2D {
    const pad: SVGSVGElement | undefined = this._padRef?.nativeElement;
    const rect: DOMRect | undefined = pad?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    const svgX: number = ((event.clientX - rect.left) / rect.width) * PAD_SIZE;
    const svgY: number = ((event.clientY - rect.top) / rect.height) * PAD_SIZE;
    const minimumX: number = this.isLathe && !this.isTubePath ? RADIUS_MIN : COORD_MIN;
    return {
      x: this._clamp(svgX / PAD_SIZE - 0.5, minimumX, COORD_MAX),
      y: this._clamp(0.5 - svgY / PAD_SIZE, COORD_MIN, COORD_MAX),
    };
  }

  private _clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(Math.max(value, minimum), maximum);
  }
}
