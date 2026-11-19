import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import {
  ISculptPoint,
  SCULPT_PRESET_OPTIONS,
  TSculptMode,
  TSculptPresetId,
  clampSculptCoordinate,
} from '@spacio/shared-types';

const PAD_WIDTH = 320;
const PAD_HEIGHT = 220;
const PAD_PADDING = 24;
const DRAG_THRESHOLD_PX = 3;

@Component({
  selector: 'app-shape-sculptor-panel',
  standalone: true,
  templateUrl: './shape-sculptor-panel.component.html',
  styleUrl: './shape-sculptor-panel.component.scss',
})
export class ShapeSculptorPanelComponent implements OnChanges {
  @Input({ required: true }) public points: readonly ISculptPoint[] = [];
  @Input({ required: true }) public mode: TSculptMode = 'extrude';
  @Output() public readonly pointsChange = new EventEmitter<readonly ISculptPoint[]>();
  @Output() public readonly modeChange = new EventEmitter<TSculptMode>();
  @Output() public readonly presetChange = new EventEmitter<TSculptPresetId>();
  @Output() public readonly closed = new EventEmitter<void>();

  @ViewChild('pad') private readonly _pad?: ElementRef<SVGSVGElement>;

  public readonly presets = SCULPT_PRESET_OPTIONS;
  private readonly _points = signal<readonly ISculptPoint[]>([]);
  public readonly pointsView = this._points.asReadonly();
  public readonly segments = computed<readonly number[]>(() =>
    Array.from({ length: this._points().length }, (_, index): number => index),
  );
  public readonly path = computed<string>((): string => this._buildPath(this._points()));

  private _draggingIndex: number | null = null;
  private _dragOrigin: { x: number; y: number } | null = null;
  private _dragged: boolean = false;

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['points']) {
      this._points.set(this.points.map((point: ISculptPoint): ISculptPoint => ({ ...point })));
    }
  }

  public pointX(point: ISculptPoint): number {
    return PAD_PADDING + point.x * (PAD_WIDTH - PAD_PADDING * 2);
  }

  public pointY(point: ISculptPoint): number {
    return PAD_PADDING + point.y * (PAD_HEIGHT - PAD_PADDING * 2);
  }

  public midpointX(index: number): number {
    const points: readonly ISculptPoint[] = this._points();
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (!current || !next) return PAD_WIDTH / 2;
    return this.pointX({ ...current, x: (current.x + next.x) / 2 });
  }

  public midpointY(index: number): number {
    const points: readonly ISculptPoint[] = this._points();
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (!current || !next) return PAD_HEIGHT / 2;
    return this.pointY({ ...current, y: (current.y + next.y) / 2 });
  }

  public startDrag(event: PointerEvent, index: number): void {
    event.preventDefault();
    event.stopPropagation();
    this._draggingIndex = index;
    this._dragOrigin = { x: event.clientX, y: event.clientY };
    this._dragged = false;
    this._pad?.nativeElement.setPointerCapture(event.pointerId);
  }

  public onPointerMove(event: PointerEvent): void {
    if (this._draggingIndex === null || !this._dragOrigin) return;
    if (
      Math.hypot(event.clientX - this._dragOrigin.x, event.clientY - this._dragOrigin.y) >
      DRAG_THRESHOLD_PX
    ) {
      this._dragged = true;
    }
    if (!this._dragged) return;

    const svg: SVGSVGElement | undefined = this._pad?.nativeElement;
    if (!svg) return;
    const local: { x: number; y: number } = this._clientToPad(event, svg);
    const index: number = this._draggingIndex;
    const next: readonly ISculptPoint[] = this._points().map(
      (point: ISculptPoint, pointIndex: number): ISculptPoint =>
        pointIndex === index
          ? {
              x: clampSculptCoordinate((local.x - PAD_PADDING) / (PAD_WIDTH - PAD_PADDING * 2)),
              y: clampSculptCoordinate((local.y - PAD_PADDING) / (PAD_HEIGHT - PAD_PADDING * 2)),
              kind: point.kind,
            }
          : { ...point },
    );
    this._points.set(next);
    this.pointsChange.emit(next.map((point: ISculptPoint): ISculptPoint => ({ ...point })));
  }

  public onPointerUp(event: PointerEvent): void {
    if (this._draggingIndex === null) return;
    const index: number = this._draggingIndex;
    this._draggingIndex = null;
    this._dragOrigin = null;
    if (this._pad?.nativeElement.hasPointerCapture(event.pointerId)) {
      this._pad.nativeElement.releasePointerCapture(event.pointerId);
    }
    if (!this._dragged) this.togglePoint(index);
    this._dragged = false;
  }

  public togglePoint(index: number): void {
    const next: readonly ISculptPoint[] = this._points().map(
      (point: ISculptPoint, pointIndex: number): ISculptPoint =>
        pointIndex === index
          ? { ...point, kind: point.kind === 'sharp' ? 'smooth' : 'sharp' }
          : { ...point },
    );
    this._points.set(next);
    this.pointsChange.emit(next.map((point: ISculptPoint): ISculptPoint => ({ ...point })));
  }

  public addPoint(index: number): void {
    const points: readonly ISculptPoint[] = this._points();
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (!current || !next) return;
    const inserted: readonly ISculptPoint[] = [...points];
    (inserted as ISculptPoint[]).splice(index + 1, 0, {
      x: (current.x + next.x) / 2,
      y: (current.y + next.y) / 2,
      kind: 'smooth',
    });
    this._points.set(inserted);
    this.pointsChange.emit(inserted.map((point: ISculptPoint): ISculptPoint => ({ ...point })));
  }

  public removePoint(index: number): void {
    const points: readonly ISculptPoint[] = this._points();
    if (points.length <= 3) return;
    const next: readonly ISculptPoint[] = points.filter(
      (_point: ISculptPoint, pointIndex: number): boolean => pointIndex !== index,
    );
    this._points.set(next);
    this.pointsChange.emit(next.map((point: ISculptPoint): ISculptPoint => ({ ...point })));
  }

  public setMode(mode: TSculptMode): void {
    this.modeChange.emit(mode);
  }

  public selectPreset(id: TSculptPresetId): void {
    this.presetChange.emit(id);
  }

  public close(): void {
    this.closed.emit();
  }

  private _clientToPad(event: PointerEvent, svg: SVGSVGElement): { x: number; y: number } {
    const point: DOMPoint = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix: DOMMatrix | null = svg.getScreenCTM();
    const transformed: DOMPoint = matrix ? point.matrixTransform(matrix.inverse()) : point;
    return { x: transformed.x, y: transformed.y };
  }

  private _buildPath(points: readonly ISculptPoint[]): string {
    if (points.length === 0) return '';
    const vectors: readonly { x: number; y: number; kind: 'sharp' | 'smooth' }[] = points.map(
      (point: ISculptPoint): { x: number; y: number; kind: 'sharp' | 'smooth' } => ({
        x: this.pointX(point),
        y: this.pointY(point),
        kind: point.kind,
      }),
    );
    const first = vectors[0];
    const last = vectors[vectors.length - 1];
    const start = first.kind === 'smooth' ? this._midpoint(first, last) : first;
    let path: string = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`;
    for (let index = 0; index < vectors.length; index += 1) {
      const current = vectors[index];
      const next = vectors[(index + 1) % vectors.length];
      if (current.kind === 'smooth') {
        const end = next.kind === 'smooth' ? this._midpoint(current, next) : next;
        path += ` Q ${current.x.toFixed(2)} ${current.y.toFixed(2)} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
        continue;
      }
      path += ` L ${current.x.toFixed(2)} ${current.y.toFixed(2)}`;
      if (next.kind === 'smooth') {
        const mid = this._midpoint(current, next);
        path += ` L ${mid.x.toFixed(2)} ${mid.y.toFixed(2)}`;
      } else {
        path += ` L ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
      }
    }
    return `${path} Z`;
  }

  private _midpoint(
    first: { x: number; y: number },
    second: { x: number; y: number },
  ): { x: number; y: number } {
    return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  }
}
