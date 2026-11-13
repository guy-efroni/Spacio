import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  WritableSignal,
  afterNextRender,
  effect,
  inject,
  signal,
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  DEFAULT_WALL_HEIGHT,
  DEFAULT_WALL_THICKNESS,
  DEFAULT_WALL_COLOR,
  ESCAPE_KEY,
  IWallSegment,
  PRIMARY_POINTER_BUTTON,
  VIEWPORT_AMBIENT_LIGHT_COLOR,
  VIEWPORT_AMBIENT_LIGHT_INTENSITY,
  VIEWPORT_BACKGROUND_COLOR,
  VIEWPORT_CAMERA_FAR,
  VIEWPORT_CAMERA_FOV,
  VIEWPORT_CAMERA_LOOK_AT,
  VIEWPORT_CAMERA_NEAR,
  VIEWPORT_CAMERA_POSITION,
  VIEWPORT_CONTROLS_DAMPING_FACTOR,
  VIEWPORT_DIRECTIONAL_LIGHT_COLOR,
  VIEWPORT_DIRECTIONAL_LIGHT_INTENSITY,
  VIEWPORT_DIRECTIONAL_LIGHT_POSITION,
  VIEWPORT_FLOOR_COLOR,
  VIEWPORT_FLOOR_METALNESS,
  VIEWPORT_FLOOR_ROUGHNESS,
  VIEWPORT_FLOOR_SIZE,
  VIEWPORT_GHOST_WALL_COLOR,
  VIEWPORT_GHOST_WALL_OPACITY,
  VIEWPORT_GRID_COLOR_CENTER_LINE,
  VIEWPORT_GRID_COLOR_GRID,
  VIEWPORT_GRID_DIVISIONS,
  VIEWPORT_GRID_SIZE,
  VIEWPORT_GRID_SNAP,
  VIEWPORT_MAX_DISTANCE,
  VIEWPORT_MAX_PIXEL_RATIO,
  VIEWPORT_MIN_DISTANCE,
  VIEWPORT_MAX_POLAR_ANGLE,
  VIEWPORT_PREVIEW_LINE_COLOR,
  VIEWPORT_PREVIEW_LINE_HEIGHT_OFFSET,
  VIEWPORT_PREVIEW_LINE_OPACITY,
  VIEWPORT_RENDERER_POWER_PREFERENCE,
  VIEWPORT_ROOM_FLOOR_COLOR,
  VIEWPORT_ROOM_FLOOR_HEIGHT_OFFSET,
  VIEWPORT_ROOM_FLOOR_METALNESS,
  VIEWPORT_ROOM_FLOOR_OPACITY,
  VIEWPORT_ROOM_FLOOR_ROUGHNESS,
  VIEWPORT_SHADOW_BIAS,
  VIEWPORT_SHADOW_CAMERA_EXTENT,
  VIEWPORT_SHADOW_CAMERA_FAR,
  VIEWPORT_SHADOW_CAMERA_NEAR,
  VIEWPORT_SHADOW_MAP_SIZE,
  VIEWPORT_TONE_MAPPING_EXPOSURE,
  WALLS_ROOT_GROUP_NAME,
  WALL_ID_SEPARATOR,
  WALL_MESH_PREFIX,
  WALL_PLACEMENT_EPSILON,
  WALL_PREVIEW_NAME,
  ViewportToolMode,
  DELETE_KEY,
  BACKSPACE_KEY,
  IWallMeshUserData,
  RULER_LINE_COLOR,
  RULER_LINE_OPACITY,
  RULER_LINE_DASH_SIZE,
  RULER_LINE_GAP_SIZE,
  RULER_MARKER_COLOR,
  RULER_MARKER_SIZE,
  RULER_BADGE_HEIGHT_OFFSET,
  RULER_MARKER_HEIGHT,
} from '@spacio/shared-types';
import { WallExtruder } from '../../shared/utils/wall-extruder.util';
import { FloorplanService } from '../../core/services/floorplan.service';

const DEFAULT_INITIAL_WIDTH = typeof window !== 'undefined' ? window.innerWidth : 0;
const DEFAULT_INITIAL_HEIGHT = typeof window !== 'undefined' ? window.innerHeight : 0;

@Component({
  selector: 'app-viewport',
  standalone: true,
  imports: [],
  templateUrl: './viewport.component.html',
  styleUrl: './viewport.component.scss',
})
export class ViewportComponent implements OnDestroy {
  private readonly _elementRef: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly _ngZone: NgZone = inject(NgZone);
  protected readonly floorplanService: FloorplanService = inject(FloorplanService);
  protected readonly isDrawingMode: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly isRulerMode: WritableSignal<boolean> = signal<boolean>(false);
  public readonly isDrawingModePublic = this.isDrawingMode.asReadonly();
  public readonly isRulerModePublic = this.isRulerMode.asReadonly();

  private _renderer?: THREE.WebGLRenderer;
  private _scene?: THREE.Scene;
  private _camera?: THREE.PerspectiveCamera;
  private _controls?: OrbitControls;
  private _animationFrameId?: number;
  private _resizeObserver?: ResizeObserver;
  private readonly _wallsGroup: THREE.Group = new THREE.Group();
  private readonly _floorsGroup: THREE.Group = new THREE.Group();

  private _floorMesh?: THREE.Mesh;
  private _floorMaterial?: THREE.MeshStandardMaterial;

  private readonly _raycaster: THREE.Raycaster = new THREE.Raycaster();
  private readonly _mouse: THREE.Vector2 = new THREE.Vector2();
  private readonly _floorPlane: THREE.Plane = new THREE.Plane(
    new THREE.Vector3(0, 1, 0),
    0
  );
  private readonly _intersectionPoint: THREE.Vector3 = new THREE.Vector3();

  private _drawingStartPoint: { x: number; y: number } | null = null;
  protected readonly ghostBadgeLength: WritableSignal<string> = signal<string>('');
  protected readonly ghostBadgePosition: WritableSignal<{ x: number; y: number } | null> = signal<{ x: number; y: number } | null>(null);
  private _previewLine?: THREE.Line;
  private _previewGeometry?: THREE.BufferGeometry;
  private _previewMaterial?: THREE.LineBasicMaterial;
  private _ghostWallMesh: THREE.Mesh | null = null;
  private _ghostWallGeometry?: THREE.BoxGeometry;
  private _ghostWallMaterial?: THREE.MeshStandardMaterial;

  // Ruler state
  private _rulerStartPoint: { x: number; y: number } | null = null;
  private _rulerEndPoint: { x: number; y: number } | null = null;
  private _rulerLine?: THREE.Line;
  private _rulerLineGeometry?: THREE.BufferGeometry;
  private _rulerLineMaterial?: THREE.LineDashedMaterial;
  private _rulerStartMarker?: THREE.Mesh;
  private _rulerEndMarker?: THREE.Mesh;
  private _rulerMarkerGeometry?: THREE.SphereGeometry;
  private _rulerMarkerMaterial?: THREE.MeshBasicMaterial;
  protected readonly rulerBadgeLength: WritableSignal<string> = signal<string>('');
  protected readonly rulerBadgePosition: WritableSignal<{ x: number; y: number } | null> = signal<{ x: number; y: number } | null>(null);
  private _rulerPhase: 'idle' | 'start' | 'measuring' = 'idle';

  private readonly _onPointerDown: (event: PointerEvent) => void = (
    event: PointerEvent
  ) => this._handlePointerDown(event);
  private readonly _onPointerMove: (event: PointerEvent) => void = (
    event: PointerEvent
  ) => this._handlePointerMove(event);
  private readonly _onKeyDown: (event: KeyboardEvent) => void = (
    event: KeyboardEvent
  ) => this._handleKeyDown(event);
  private readonly _onDoubleClick: (event: MouseEvent) => void = (
    event: MouseEvent
  ) => this._onCanvasDoubleClick(event);

  public constructor() {
    this._wallsGroup.name = WALLS_ROOT_GROUP_NAME;
    this._floorsGroup.name = 'room-floors';
    effect(() => {
      const walls: readonly IWallSegment[] = this.floorplanService.walls();
      const selectedWallId: string | null = this.floorplanService.selectedWallId();
      if (!this._scene || !this._wallsGroup) return;
      this._syncWalls(walls, selectedWallId);
    });

    effect(() => {
      if (!this._scene || !this._floorsGroup) return;
      const polygon: readonly { x: number; y: number }[] | null = this.floorplanService.floorPolygon();
      this._syncFloors(polygon);
    });

    afterNextRender(() => {
      this._initializeThreeJS();
      this._startAnimationLoop();
      this._setupResizeObserver();
      this._syncWalls(this.floorplanService.walls(), this.floorplanService.selectedWallId());
    });
  }

  public onAddInteriorWall(): void {
    this._setToolMode(ViewportToolMode.DrawWall);
    this._drawingStartPoint = null;
    this._hidePreviewLine();
    this._removeGhostWallMesh();
  }

  public onToggleRuler(): void {
    if (this.isRulerMode()) {
      this._cancelRuler();
    } else {
      this._setToolMode(ViewportToolMode.Ruler);
    }
  }

  public onRemoveLastWall(): void {
    this.floorplanService.removeLastWall();
  }

  public onResetRoom(): void {
    this._cancelDrawing();
    this.floorplanService.resetToDefaultRoom();
  }

  public onClearAllWalls(): void {
    this._cancelDrawing();
    this.floorplanService.clearAllWalls();
  }

  public onDeleteSelectedWall(): void {
    const selectedId: string | null = this.floorplanService.selectedWallId();
    if (!selectedId) return;
    this.floorplanService.removeWall(selectedId);
    this.floorplanService.selectWall(null);
  }

  public ngOnDestroy(): void {
    this._cleanup();
  }

  public setToolMode(mode: ViewportToolMode): void {
    this._setToolMode(mode);
  }

  private _setToolMode(mode: ViewportToolMode): void {
    const wasDrawing = this.isDrawingMode();
    const wasRuler = this.isRulerMode();

    this.isDrawingMode.set(mode === ViewportToolMode.DrawWall);
    this.isRulerMode.set(mode === ViewportToolMode.Ruler);

    if (wasDrawing && mode !== ViewportToolMode.DrawWall) {
      this._cancelDrawingInternal();
    }
    if (wasRuler && mode !== ViewportToolMode.Ruler) {
      this._cancelRulerInternal();
    }
  }

  private _cancelDrawingInternal(): void {
    this._drawingStartPoint = null;
    this._hidePreviewLine();
    this._removeGhostWallMesh();
    this._hideGhostBadge();
  }

  private _cancelRulerInternal(): void {
    this._rulerStartPoint = null;
    this._rulerEndPoint = null;
    this._rulerPhase = 'idle';
    this._removeRulerLine();
    this._removeRulerMarkers();
    this._hideRulerBadge();
  }

  private _initializeThreeJS(): void {
    const hostElement: HTMLElement = this._elementRef.nativeElement;
    const container: HTMLElement = hostElement.querySelector('.viewport-container')!;

    this._renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: VIEWPORT_RENDERER_POWER_PREFERENCE,
    });

    container.appendChild(this._renderer.domElement);
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, VIEWPORT_MAX_PIXEL_RATIO));

    const initialWidth: number =
      hostElement.clientWidth > 0 ? hostElement.clientWidth : DEFAULT_INITIAL_WIDTH;
    const initialHeight: number =
      hostElement.clientHeight > 0 ? hostElement.clientHeight : DEFAULT_INITIAL_HEIGHT;

    this._renderer.setSize(initialWidth, initialHeight);
    this._renderer.shadowMap.enabled = true;
    this._renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this._renderer.outputColorSpace = THREE.SRGBColorSpace;
    this._renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this._renderer.toneMappingExposure = VIEWPORT_TONE_MAPPING_EXPOSURE;

    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(VIEWPORT_BACKGROUND_COLOR);

    this._camera = new THREE.PerspectiveCamera(
      VIEWPORT_CAMERA_FOV,
      initialWidth / initialHeight,
      VIEWPORT_CAMERA_NEAR,
      VIEWPORT_CAMERA_FAR
    );
    this._camera.position.set(
      VIEWPORT_CAMERA_POSITION.x,
      VIEWPORT_CAMERA_POSITION.y,
      VIEWPORT_CAMERA_POSITION.z
    );
    this._camera.lookAt(
      VIEWPORT_CAMERA_LOOK_AT.x,
      VIEWPORT_CAMERA_LOOK_AT.y,
      VIEWPORT_CAMERA_LOOK_AT.z
    );

    this._controls = new OrbitControls(this._camera, this._renderer.domElement);
    this._controls.enableDamping = true;
    this._controls.dampingFactor = VIEWPORT_CONTROLS_DAMPING_FACTOR;
    this._controls.maxPolarAngle = VIEWPORT_MAX_POLAR_ANGLE;
    this._controls.minDistance = VIEWPORT_MIN_DISTANCE;
    this._controls.maxDistance = VIEWPORT_MAX_DISTANCE;

    this._setupScene();
    this._setupInteractions();
  }

  private _setupScene(): void {
    if (!this._scene) return;

    const gridHelper: THREE.GridHelper = new THREE.GridHelper(
      VIEWPORT_GRID_SIZE,
      VIEWPORT_GRID_DIVISIONS,
      VIEWPORT_GRID_COLOR_CENTER_LINE,
      VIEWPORT_GRID_COLOR_GRID
    );
    this._scene.add(gridHelper);

    const ambientLight: THREE.AmbientLight = new THREE.AmbientLight(
      VIEWPORT_AMBIENT_LIGHT_COLOR,
      VIEWPORT_AMBIENT_LIGHT_INTENSITY
    );
    this._scene.add(ambientLight);

    const directionalLight: THREE.DirectionalLight = new THREE.DirectionalLight(
      VIEWPORT_DIRECTIONAL_LIGHT_COLOR,
      VIEWPORT_DIRECTIONAL_LIGHT_INTENSITY
    );
    directionalLight.position.set(
      VIEWPORT_DIRECTIONAL_LIGHT_POSITION.x,
      VIEWPORT_DIRECTIONAL_LIGHT_POSITION.y,
      VIEWPORT_DIRECTIONAL_LIGHT_POSITION.z
    );
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = VIEWPORT_SHADOW_MAP_SIZE;
    directionalLight.shadow.mapSize.height = VIEWPORT_SHADOW_MAP_SIZE;
    directionalLight.shadow.camera.near = VIEWPORT_SHADOW_CAMERA_NEAR;
    directionalLight.shadow.camera.far = VIEWPORT_SHADOW_CAMERA_FAR;
    directionalLight.shadow.camera.left = -VIEWPORT_SHADOW_CAMERA_EXTENT;
    directionalLight.shadow.camera.right = VIEWPORT_SHADOW_CAMERA_EXTENT;
    directionalLight.shadow.camera.top = VIEWPORT_SHADOW_CAMERA_EXTENT;
    directionalLight.shadow.camera.bottom = -VIEWPORT_SHADOW_CAMERA_EXTENT;
    directionalLight.shadow.bias = VIEWPORT_SHADOW_BIAS;
    this._scene.add(directionalLight);

    const planeGeometry: THREE.PlaneGeometry = new THREE.PlaneGeometry(
      VIEWPORT_FLOOR_SIZE,
      VIEWPORT_FLOOR_SIZE
    );
    const planeMaterial: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
      color: VIEWPORT_FLOOR_COLOR,
      roughness: VIEWPORT_FLOOR_ROUGHNESS,
      metalness: VIEWPORT_FLOOR_METALNESS,
    });
    const plane: THREE.Mesh = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0;
    plane.receiveShadow = true;
    this._scene.add(plane);

    this._scene.add(this._floorsGroup);
    this._scene.add(this._wallsGroup);
    this._setupPreviewLine();
    this._syncWalls(this.floorplanService.walls());
    this._syncFloors(this.floorplanService.floorPolygon());
  }

  private _setupPreviewLine(): void {
    if (!this._scene) return;
    this._previewGeometry = new THREE.BufferGeometry();
    this._previewGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(6), 3)
    );
    this._previewMaterial = new THREE.LineBasicMaterial({
      color: VIEWPORT_PREVIEW_LINE_COLOR,
      transparent: true,
      opacity: VIEWPORT_PREVIEW_LINE_OPACITY,
    });
    this._previewLine = new THREE.Line(this._previewGeometry, this._previewMaterial);
    this._previewLine.visible = false;
    this._previewLine.name = WALL_PREVIEW_NAME;
    this._scene.add(this._previewLine);
  }

  private _setupInteractions(): void {
    if (!this._renderer) return;
    const canvas: HTMLCanvasElement = this._renderer.domElement;
    canvas.addEventListener('pointerdown', this._onPointerDown);
    canvas.addEventListener('pointermove', this._onPointerMove);
    canvas.addEventListener('dblclick', this._onDoubleClick);
    window.addEventListener('keydown', this._onKeyDown);
  }

  private _handlePointerDown(event: PointerEvent): void {
    if (event.button !== PRIMARY_POINTER_BUTTON) return;

    if (this.isDrawingMode()) {
      this._handleDrawingPointerDown(event);
    } else if (this.isRulerMode()) {
      this._handleRulerPointerDown(event);
    }
  }

  private _handleDrawingPointerDown(event: PointerEvent): void {
    const point: { x: number; y: number } | null = this._getSnappedFloorPoint(event);
    if (!point) return;

    if (!this._drawingStartPoint) {
      this._drawingStartPoint = point;
      this._updatePreviewLine(point, point);
      this._createGhostWallMesh(point, point);
      return;
    }

    const start: { x: number; y: number } = this._drawingStartPoint;
    const end: { x: number; y: number } = point;
    const isZeroLength: boolean =
      Math.abs(start.x - end.x) < WALL_PLACEMENT_EPSILON &&
      Math.abs(start.y - end.y) < WALL_PLACEMENT_EPSILON;
    if (!isZeroLength) {
      const wall: IWallSegment = {
        id: this._generateWallId(),
        start,
        end,
        height: DEFAULT_WALL_HEIGHT,
        thickness: DEFAULT_WALL_THICKNESS,
        color: DEFAULT_WALL_COLOR,
      };
      this.floorplanService.addWall(wall);
    }

    this._finishDrawing();
  }

  private _onCanvasDoubleClick(event: MouseEvent): void {
    if (!this._renderer || !this._camera) return;
    const rect: DOMRect = this._renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this._raycaster.setFromCamera(this._mouse, this._camera);
    const intersects: readonly THREE.Intersection<THREE.Object3D>[] = this._raycaster.intersectObjects(
      this._wallsGroup.children,
      true
    );

    const isWallMesh = (
      userData: Record<string, unknown>
    ): userData is IWallMeshUserData => {
      return (
        typeof userData === 'object' &&
        userData !== null &&
        (userData as unknown as IWallMeshUserData).type === 'wall' &&
        typeof (userData as unknown as IWallMeshUserData).id === 'string'
      );
    };

    const selectedId: string | null =
      intersects
        .map((intersection: THREE.Intersection<THREE.Object3D>) => intersection.object.userData)
        .find(isWallMesh)?.id ?? null;

    this.floorplanService.selectWall(selectedId);
  }

  private _handlePointerMove(event: PointerEvent): void {
    if (this.isDrawingMode() && this._drawingStartPoint) {
      const point: { x: number; y: number } | null = this._getSnappedFloorPoint(event);
      if (!point) return;
      this._updatePreviewLine(this._drawingStartPoint, point);
      this._updateGhostWallMesh(this._drawingStartPoint, point);
      this._updateGhostBadge(this._drawingStartPoint, point);
    } else if (this.isRulerMode() && this._rulerPhase !== 'idle') {
      const point: { x: number; y: number } | null = this._getSnappedFloorPoint(event);
      if (!point) return;
      this._updateRulerPreview(point);
    }
  }

  private _handleKeyDown(event: KeyboardEvent): void {
    if (event.key === ESCAPE_KEY && this.isDrawingMode()) {
      this._cancelDrawing();
    }

    if (event.key === ESCAPE_KEY && this.isRulerMode()) {
      this._cancelRuler();
    }

    if ((event.key === DELETE_KEY || event.key === BACKSPACE_KEY) && !this.isDrawingMode() && !this.isRulerMode()) {
      this.onDeleteSelectedWall();
    }
  }

  private _finishDrawing(): void {
    this._drawingStartPoint = null;
    this._hidePreviewLine();
    this._removeGhostWallMesh();
    this._hideGhostBadge();
    this._setToolMode(ViewportToolMode.View);
  }

  private _cancelDrawing(): void {
    this._cancelDrawingInternal();
    this._setToolMode(ViewportToolMode.View);
  }

  private _cancelRuler(): void {
    this._cancelRulerInternal();
    this._setToolMode(ViewportToolMode.View);
  }

  private _handleRulerPointerDown(event: PointerEvent): void {
    const point: { x: number; y: number } | null = this._getSnappedFloorPoint(event);
    if (!point) return;

    if (this._rulerPhase === 'idle' || this._rulerPhase === 'start') {
      // First click - set start point
      this._rulerStartPoint = point;
      this._rulerPhase = 'measuring';
      this._createRulerLine(point, point);
      this._createRulerMarkers(point);
    } else if (this._rulerPhase === 'measuring') {
      // Second click - lock end point
      this._rulerEndPoint = point;
      this._updateRulerLine(point);
      this._updateRulerEndMarker(point);
      this._rulerPhase = 'start'; // Ready for new measurement
    }
  }

  private _updateRulerPreview(end: { x: number; y: number }): void {
    if (!this._rulerStartPoint) return;

    this._rulerEndPoint = end;
    this._updateRulerLine(end);
    this._updateRulerEndMarker(end);
    this._updateRulerBadge(this._rulerStartPoint, end);
  }

  private _createRulerLine(start: { x: number; y: number }, end: { x: number; y: number }): void {
    if (!this._scene) return;
    this._removeRulerLine();

    this._rulerLineGeometry = new THREE.BufferGeometry();
    this._rulerLineGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(6), 3)
    );

    this._rulerLineMaterial = new THREE.LineDashedMaterial({
      color: RULER_LINE_COLOR,
      transparent: true,
      opacity: RULER_LINE_OPACITY,
      dashSize: RULER_LINE_DASH_SIZE,
      gapSize: RULER_LINE_GAP_SIZE,
      linewidth: 2,
    });

    this._rulerLine = new THREE.Line(this._rulerLineGeometry, this._rulerLineMaterial);
    this._rulerLine.computeLineDistances();
    this._rulerLine.name = 'ruler-line';
    this._scene.add(this._rulerLine);

    this._updateRulerLine(end);
  }

  private _updateRulerLine(end: { x: number; y: number }): void {
    if (!this._rulerStartPoint || !this._rulerLineGeometry || !this._rulerLine || !this._rulerLineMaterial) return;

    const start = this._rulerStartPoint;
    const positionAttribute = this._rulerLineGeometry.getAttribute('position') as THREE.BufferAttribute;
    const array = positionAttribute.array as Float32Array;

    const yPos = VIEWPORT_PREVIEW_LINE_HEIGHT_OFFSET;
    array[0] = start.x;
    array[1] = yPos;
    array[2] = start.y;
    array[3] = end.x;
    array[4] = yPos;
    array[5] = end.y;

    positionAttribute.needsUpdate = true;
    this._rulerLineGeometry.computeBoundingSphere();
    this._rulerLine.computeLineDistances();
    this._rulerLineMaterial.needsUpdate = true;
    this._rulerLine.visible = true;
  }

  private _removeRulerLine(): void {
    if (!this._rulerLine) return;
    if (this._scene) {
      this._scene.remove(this._rulerLine);
    }
    this._rulerLineGeometry?.dispose();
    this._rulerLineMaterial?.dispose();
    this._rulerLine = undefined;
    this._rulerLineGeometry = undefined;
    this._rulerLineMaterial = undefined;
  }

  private _createRulerMarkers(point: { x: number; y: number }): void {
    if (!this._scene) return;
    this._removeRulerMarkers();

    this._rulerMarkerGeometry = new THREE.SphereGeometry(RULER_MARKER_SIZE, 16, 16);
    this._rulerMarkerMaterial = new THREE.MeshBasicMaterial({
      color: RULER_MARKER_COLOR,
      transparent: true,
      opacity: 0.9,
    });

    // Start marker
    this._rulerStartMarker = new THREE.Mesh(this._rulerMarkerGeometry, this._rulerMarkerMaterial);
    this._rulerStartMarker.position.set(point.x, RULER_MARKER_HEIGHT, point.y);
    this._rulerStartMarker.name = 'ruler-start-marker';
    this._rulerStartMarker.castShadow = false;
    this._rulerStartMarker.receiveShadow = false;
    this._scene.add(this._rulerStartMarker);

    // End marker (initially at same position)
    this._rulerEndMarker = new THREE.Mesh(this._rulerMarkerGeometry, this._rulerMarkerMaterial);
    this._rulerEndMarker.position.set(point.x, RULER_MARKER_HEIGHT, point.y);
    this._rulerEndMarker.name = 'ruler-end-marker';
    this._rulerEndMarker.castShadow = false;
    this._rulerEndMarker.receiveShadow = false;
    this._scene.add(this._rulerEndMarker);
  }

  private _updateRulerEndMarker(point: { x: number; y: number }): void {
    if (this._rulerEndMarker) {
      this._rulerEndMarker.position.set(point.x, RULER_MARKER_HEIGHT, point.y);
    }
  }

  private _removeRulerMarkers(): void {
    if (this._rulerStartMarker) {
      if (this._scene) {
        this._scene.remove(this._rulerStartMarker);
      }
      this._rulerStartMarker.geometry?.dispose();
      if (Array.isArray(this._rulerStartMarker.material)) {
        this._rulerStartMarker.material.forEach((m: THREE.Material) => m.dispose());
      } else {
        this._rulerStartMarker.material?.dispose();
      }
      this._rulerStartMarker = undefined;
    }
    if (this._rulerEndMarker) {
      if (this._scene) {
        this._scene.remove(this._rulerEndMarker);
      }
      this._rulerEndMarker.geometry?.dispose();
      if (Array.isArray(this._rulerEndMarker.material)) {
        this._rulerEndMarker.material.forEach((m: THREE.Material) => m.dispose());
      } else {
        this._rulerEndMarker.material?.dispose();
      }
      this._rulerEndMarker = undefined;
    }
    this._rulerMarkerGeometry = undefined;
    this._rulerMarkerMaterial = undefined;
  }

  private _updateRulerBadge(start: { x: number; y: number }, end: { x: number; y: number }): void {
    if (!this._camera) return;
    const dx = end.x - start.x;
    const dz = end.y - start.y;
    const length = Math.hypot(dx, dz);
    const midX = (start.x + end.x) / 2;
    const midZ = (start.y + end.y) / 2;
    const projection = this._projectToScreen(
      midX,
      RULER_BADGE_HEIGHT_OFFSET,
      midZ
    );
    if (!projection) return;
    this.rulerBadgeLength.set(`${length.toFixed(2)}m`);
    this.rulerBadgePosition.set(projection);
  }

  private _hideRulerBadge(): void {
    this.rulerBadgeLength.set('');
    this.rulerBadgePosition.set(null);
  }

  private _getSnappedFloorPoint(event: PointerEvent): { x: number; y: number } | null {
    if (!this._renderer || !this._camera) return null;
    const rect: DOMRect = this._renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this._raycaster.setFromCamera(this._mouse, this._camera);
    const intersection: THREE.Vector3 | null = this._raycaster.ray.intersectPlane(
      this._floorPlane,
      this._intersectionPoint
    );
    if (!intersection) return null;

    const x: number = this._snapToGrid(this._intersectionPoint.x);
    const z: number = this._snapToGrid(this._intersectionPoint.z);
    return { x, y: z };
  }

  private _snapToGrid(value: number): number {
    return Math.round(value / VIEWPORT_GRID_SNAP) * VIEWPORT_GRID_SNAP;
  }

  private _projectToScreen(x: number, y: number, z: number): { x: number; y: number } | null {
    if (!this._renderer || !this._camera) return null;
    const rect: DOMRect = this._renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const vector: THREE.Vector3 = new THREE.Vector3(x, y, z);
    vector.project(this._camera);
    const screenX: number = (vector.x * 0.5 + 0.5) * rect.width + rect.left;
    const screenY: number = (-(vector.y * 0.5) + 0.5) * rect.height + rect.top;
    return { x: screenX, y: screenY };
  }

  private _updateGhostBadge(start: { x: number; y: number }, end: { x: number; y: number }): void {
    if (!this._camera) return;
    const dx: number = end.x - start.x;
    const dz: number = end.y - start.y;
    const length: number = Math.hypot(dx, dz);
    const midX: number = (start.x + end.x) / 2;
    const midZ: number = (start.y + end.y) / 2;
    const projection: { x: number; y: number } | null = this._projectToScreen(
      midX,
      VIEWPORT_PREVIEW_LINE_HEIGHT_OFFSET + 0.5,
      midZ
    );
    if (!projection) return;
    this.ghostBadgeLength.set(`${length.toFixed(1)}m`);
    this.ghostBadgePosition.set(projection);
  }

  private _hideGhostBadge(): void {
    this.ghostBadgeLength.set('');
    this.ghostBadgePosition.set(null);
  }

  private _updatePreviewLine(
    start: { x: number; y: number },
    end: { x: number; y: number }
  ): void {
    if (!this._previewGeometry || !this._previewLine) return;
    const positionAttribute: THREE.BufferAttribute = this._previewGeometry.getAttribute(
      'position'
    ) as THREE.BufferAttribute;
    const array: Float32Array = positionAttribute.array as Float32Array;
    array[0] = start.x;
    array[1] = VIEWPORT_PREVIEW_LINE_HEIGHT_OFFSET;
    array[2] = start.y;
    array[3] = end.x;
    array[4] = VIEWPORT_PREVIEW_LINE_HEIGHT_OFFSET;
    array[5] = end.y;
    positionAttribute.needsUpdate = true;
    this._previewGeometry.computeBoundingSphere();
    this._previewLine.visible = true;
  }

  private _hidePreviewLine(): void {
    if (this._previewLine) {
      this._previewLine.visible = false;
    }
  }

  private _createGhostWallMesh(
    start: { x: number; y: number },
    end: { x: number; y: number }
  ): void {
    if (!this._scene) return;
    this._removeGhostWallMesh();

    this._ghostWallGeometry = new THREE.BoxGeometry(
      1,
      DEFAULT_WALL_HEIGHT,
      DEFAULT_WALL_THICKNESS
    );
    this._ghostWallMaterial = new THREE.MeshStandardMaterial({
      color: VIEWPORT_GHOST_WALL_COLOR,
      transparent: true,
      opacity: VIEWPORT_GHOST_WALL_OPACITY,
      roughness: 0.6,
      metalness: 0.0,
    });
    this._ghostWallMesh = new THREE.Mesh(this._ghostWallGeometry, this._ghostWallMaterial);
    this._ghostWallMesh.name = WALL_PREVIEW_NAME;
    this._ghostWallMesh.castShadow = false;
    this._ghostWallMesh.receiveShadow = false;
    this._scene.add(this._ghostWallMesh);

    this._updateGhostWallMesh(start, end);
  }

  private _updateGhostWallMesh(
    start: { x: number; y: number },
    end: { x: number; y: number }
  ): void {
    if (!this._ghostWallMesh || !this._ghostWallGeometry) return;

    const dx: number = end.x - start.x;
    const dz: number = end.y - start.y;
    const length: number = Math.sqrt(dx * dx + dz * dz);

    if (length <= WALL_PLACEMENT_EPSILON) {
      this._ghostWallMesh.visible = false;
      return;
    }

    this._ghostWallGeometry.dispose();
    this._ghostWallGeometry = new THREE.BoxGeometry(
      length,
      DEFAULT_WALL_HEIGHT,
      DEFAULT_WALL_THICKNESS
    );
    this._ghostWallMesh.geometry = this._ghostWallGeometry;

    const midX: number = (start.x + end.x) / 2;
    const midZ: number = (start.y + end.y) / 2;
    const angle: number = Math.atan2(dz, dx);

    this._ghostWallMesh.position.set(midX, DEFAULT_WALL_HEIGHT / 2, midZ);
    this._ghostWallMesh.rotation.y = -angle;
    this._ghostWallMesh.visible = true;
  }

  private _removeGhostWallMesh(): void {
    if (!this._ghostWallMesh) return;
    if (this._scene) {
      this._scene.remove(this._ghostWallMesh);
    }
    this._ghostWallMesh.geometry?.dispose();
    this._ghostWallMaterial?.dispose();
    this._ghostWallMesh = null;
    this._ghostWallGeometry = undefined;
    this._ghostWallMaterial = undefined;
  }

  private _generateWallId(): string {
    return `${WALL_MESH_PREFIX}${WALL_ID_SEPARATOR}${Date.now()}${WALL_ID_SEPARATOR}${Math.random().toString(36).slice(2, 7)}`;
  }

  private _syncWalls(walls: ReadonlyArray<IWallSegment>, selectedWallId: string | null = null): void {
    if (!this._wallsGroup) return;
    this._disposeWallsGroup();

    const wallsMesh: THREE.Group = WallExtruder.createWallsMesh(walls, selectedWallId);
    while (wallsMesh.children.length > 0) {
      const child: THREE.Object3D = wallsMesh.children[0];
      this._wallsGroup.add(child);
    }
  }

  private _disposeWallsGroup(): void {
    this._wallsGroup.traverse((object: THREE.Object3D) => {
      if (object instanceof THREE.Mesh) {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((material: THREE.Material) => material.dispose());
        } else {
          object.material?.dispose();
        }
      }
    });
    this._wallsGroup.clear();
  }

  private _syncFloors(polygon: readonly { x: number; y: number }[] | null): void {
    if (!this._scene || !this._floorsGroup) return;

    if (this._floorMesh) {
      this._floorsGroup.remove(this._floorMesh);
      this._floorMesh.geometry.dispose();
      this._floorMaterial?.dispose();
      this._floorMesh = undefined;
      this._floorMaterial = undefined;
    }

    if (!polygon || polygon.length < 3) {
      return;
    }

    const validPoints: { x: number; y: number }[] = [];
    for (const point of polygon) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        return;
      }
      validPoints.push(point);
    }
    if (validPoints.length < 3) {
      return;
    }

    const shape: THREE.Shape = new THREE.Shape();
    shape.moveTo(validPoints[0].x, validPoints[0].y);
    for (let i: number = 1; i < validPoints.length; i++) {
      shape.lineTo(validPoints[i].x, validPoints[i].y);
    }

    const geometry: THREE.ShapeGeometry = new THREE.ShapeGeometry(shape);
    this._floorMaterial = new THREE.MeshStandardMaterial({
      color: VIEWPORT_ROOM_FLOOR_COLOR,
      transparent: true,
      opacity: VIEWPORT_ROOM_FLOOR_OPACITY,
      roughness: VIEWPORT_ROOM_FLOOR_ROUGHNESS,
      metalness: VIEWPORT_ROOM_FLOOR_METALNESS,
    });
    const mesh: THREE.Mesh = new THREE.Mesh(geometry, this._floorMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = VIEWPORT_ROOM_FLOOR_HEIGHT_OFFSET;
    mesh.receiveShadow = true;
    mesh.name = 'room-floor';
    this._floorsGroup.add(mesh);
    this._floorMesh = mesh;
  }

  private _startAnimationLoop(): void {
    this._ngZone.runOutsideAngular(() => {
      const animate = (): void => {
        this._animationFrameId = requestAnimationFrame(animate);
        this._render();
      };
      animate();
    });
  }

  private _render(): void {
    if (!this._renderer || !this._scene || !this._camera) return;

    this._controls?.update();
    this._renderer.render(this._scene, this._camera);
  }

  private _setupResizeObserver(): void {
    const hostElement: HTMLElement = this._elementRef.nativeElement;

    this._resizeObserver = new ResizeObserver((entries: ResizeObserverEntry[]) => {
      for (const entry of entries) {
        const { width, height }: { width: number; height: number } = entry.contentRect;
        if (width > 0 && height > 0) {
          this._onResize(width, height);
        }
      }
    });

    this._resizeObserver.observe(hostElement);
  }

  private _onResize(width: number, height: number): void {
    if (!this._renderer || !this._camera) return;

    this._camera.aspect = width / height;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(width, height, false);
  }

  private _cleanup(): void {
    if (this._animationFrameId !== undefined) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = undefined;
    }

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = undefined;
    }

    if (this._renderer) {
      const canvas: HTMLCanvasElement = this._renderer.domElement;
      canvas.removeEventListener('pointerdown', this._onPointerDown);
      canvas.removeEventListener('pointermove', this._onPointerMove);
      canvas.removeEventListener('dblclick', this._onDoubleClick);
      window.removeEventListener('keydown', this._onKeyDown);
      if (canvas.parentElement) {
        canvas.parentElement.removeChild(canvas);
      }

      this._renderer.dispose();
      this._renderer.forceContextLoss();
      const gl: WebGLRenderingContext | null = this._renderer.getContext() as WebGLRenderingContext | null;
      if (gl) {
        const extension: WEBGL_lose_context | null = gl.getExtension('WEBGL_lose_context');
        extension?.loseContext();
      }
      this._renderer = undefined;
    }

    if (this._scene) {
      this._scene.traverse((object: THREE.Object3D) => {
        if (object instanceof THREE.Mesh) {
          object.geometry?.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((material: THREE.Material) => material.dispose());
          } else {
            object.material?.dispose();
          }
        }
      });
      this._scene.clear();
      this._scene = undefined;
    }

    this._wallsGroup.clear();
    this._floorsGroup.traverse((object: THREE.Object3D) => {
      if (object instanceof THREE.Mesh) {
        object.geometry?.dispose();
        object.material?.dispose();
      }
    });
    this._floorsGroup.clear();
    this._removeGhostWallMesh();
    this._removeRulerLine();
    this._removeRulerMarkers();
    this._previewGeometry?.dispose();
    this._previewMaterial?.dispose();
    this._previewGeometry = undefined;
    this._previewMaterial = undefined;
    this._previewLine = undefined;
    this._drawingStartPoint = null;

    this._controls?.dispose();
    this._controls = undefined;

    this._camera = undefined;
  }
}
