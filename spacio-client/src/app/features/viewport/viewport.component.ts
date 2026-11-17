import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  Signal,
  WritableSignal,
  afterNextRender,
  effect,
  inject,
  signal,
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  BACKSPACE_KEY,
  DEFAULT_WALL_COLOR,
  DEFAULT_WALL_HEIGHT,
  DEFAULT_WALL_THICKNESS,
  DELETE_KEY,
  ESCAPE_KEY,
  FURNITURE_FLOOR_OFFSET,
  FURNITURE_GHOST_FOOTPRINT_BORDER_COLOR,
  FURNITURE_GHOST_FOOTPRINT_BORDER_OPACITY,
  FURNITURE_GHOST_FOOTPRINT_FILL_COLOR,
  FURNITURE_GHOST_FOOTPRINT_FILL_OPACITY,
  FURNITURE_GHOST_FOOTPRINT_Y,
  FURNITURE_GHOST_MATERIAL_OPACITY,
  FURNITURE_GHOST_RENDER_ORDER,
  FURNITURE_ROTATION_STEP_RAD,
  FURNITURE_USER_DATA_TYPE,
  IFurnitureBlueprint,
  IPlacedFurniture,
  IRulerPoint,
  IWallMeshUserData,
  IWallSegment,
  POSITION_ATTRIBUTE_NAME,
  PRIMARY_POINTER_BUTTON,
  ROOM_FLOOR_MESH_NAME,
  ROOM_FLOORS_GROUP_NAME,
  RULER_BADGE_HEIGHT_OFFSET,
  RULER_END_MARKER_NAME,
  RULER_LINE_COLOR,
  RULER_LINE_DASH_SIZE,
  RULER_LINE_GAP_SIZE,
  RULER_LINE_NAME,
  RULER_LINE_OPACITY,
  RULER_MARKER_COLOR,
  RULER_MARKER_HEIGHT,
  RULER_MARKER_SIZE,
  RULER_START_MARKER_NAME,
  RulerPhase,
  VIEWPORT_AMBIENT_LIGHT_COLOR,
  VIEWPORT_AMBIENT_LIGHT_INTENSITY,
  VIEWPORT_BACKGROUND_COLOR,
  VIEWPORT_CAMERA_FAR,
  VIEWPORT_CAMERA_FOV,
  VIEWPORT_CAMERA_LOOK_AT,
  VIEWPORT_CAMERA_NEAR,
  VIEWPORT_CAMERA_POSITION,
  VIEWPORT_CLICK_DRAG_THRESHOLD_PX,
  VIEWPORT_CONTAINER_SELECTOR,
  VIEWPORT_CONTROLS_DAMPING_FACTOR,
  VIEWPORT_DIRECTIONAL_LIGHT_COLOR,
  VIEWPORT_DIRECTIONAL_LIGHT_INTENSITY,
  VIEWPORT_DIRECTIONAL_LIGHT_POSITION,
  VIEWPORT_FLOOR_COLOR,
  VIEWPORT_FLOOR_METALNESS,
  VIEWPORT_FLOOR_ROUGHNESS,
  VIEWPORT_FLOOR_SIZE,
  VIEWPORT_FURNITURE_SELECTION_OUTLINE_COLOR,
  VIEWPORT_GHOST_WALL_COLOR,
  VIEWPORT_GHOST_WALL_OPACITY,
  VIEWPORT_GRID_COLOR_CENTER_LINE,
  VIEWPORT_GRID_COLOR_GRID,
  VIEWPORT_GRID_DIVISIONS,
  VIEWPORT_GRID_SIZE,
  VIEWPORT_GRID_SNAP,
  VIEWPORT_HEMISPHERE_LIGHT_GROUND_COLOR,
  VIEWPORT_HEMISPHERE_LIGHT_INTENSITY,
  VIEWPORT_HEMISPHERE_LIGHT_SKY_COLOR,
  VIEWPORT_MAX_DISTANCE,
  VIEWPORT_MAX_PIXEL_RATIO,
  VIEWPORT_MAX_POLAR_ANGLE,
  VIEWPORT_MIN_DISTANCE,
  VIEWPORT_PREVIEW_LINE_COLOR,
  VIEWPORT_PREVIEW_LINE_HEIGHT_OFFSET,
  VIEWPORT_PREVIEW_LINE_OPACITY,
  VIEWPORT_RENDERER_POWER_PREFERENCE,
  VIEWPORT_ROOM_FLOOR_COLOR,
  VIEWPORT_ROOM_FLOOR_METALNESS,
  VIEWPORT_ROOM_FLOOR_OPACITY,
  VIEWPORT_ROOM_FLOOR_ROUGHNESS,
  VIEWPORT_ROOM_FLOOR_THICKNESS,
  VIEWPORT_ROOM_FLOOR_TOP_Y,
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
  WALL_USER_DATA_TYPE,
  WEBGL_LOSE_CONTEXT_EXTENSION,
  ViewportToolMode,
  getBlueprintBounds,
} from '@spacio/shared-types';
import { FloorplanService } from '../../core/services/floorplan.service';
import { WallExtruder } from '../../shared/utils/wall-extruder.util';
import { IGeneratedFurniture, buildParametricFurniture } from '../../shared/utils/parametric-generator.util';

const DEFAULT_INITIAL_WIDTH: number = typeof window !== 'undefined' ? window.innerWidth : 0;
const DEFAULT_INITIAL_HEIGHT: number = typeof window !== 'undefined' ? window.innerHeight : 0;
const FURNITURE_ROOT_GROUP_NAME: string = 'furniture-root';
const FURNITURE_GHOST_FOOTPRINT_NAME: string = 'furniture-ghost-footprint';
const FURNITURE_SELECTION_OUTLINE_NAME: string = 'furniture-selection-outline';

interface ISceneObjectUserData {
  id?: string;
  type?: string;
}

interface IFloorPlacementPoint {
  x: number;
  y: number;
  placementY: number;
}

interface IFurnitureFootprint {
  group: THREE.Group;
  dispose: () => void;
}

interface IFurnitureGhost {
  generated: IGeneratedFurniture;
  clonedMaterials: THREE.MeshStandardMaterial[];
  footprint: IFurnitureFootprint;
  baseY: number;
  dispose: () => void;
}

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
  protected readonly isPlacingFurnitureMode: WritableSignal<boolean> = signal<boolean>(false);
  public readonly isDrawingModePublic: Signal<boolean> = this.isDrawingMode.asReadonly();
  public readonly isRulerModePublic: Signal<boolean> = this.isRulerMode.asReadonly();
  public readonly isPlacingFurnitureModePublic: Signal<boolean> = this.isPlacingFurnitureMode.asReadonly();

  private _renderer?: THREE.WebGLRenderer;
  private _scene?: THREE.Scene;
  private _camera?: THREE.PerspectiveCamera;
  private _controls?: OrbitControls;
  private _animationFrameId?: number;
  private _resizeObserver?: ResizeObserver;

  private readonly _wallsGroup: THREE.Group = new THREE.Group();
  private readonly _floorsGroup: THREE.Group = new THREE.Group();
  private readonly _furnitureGroup: THREE.Group = new THREE.Group();
  private readonly _furnitureInstances: Map<string, IGeneratedFurniture> = new Map<string, IGeneratedFurniture>();
  private readonly _furnitureSelectionOutlines: Map<string, THREE.BoxHelper> = new Map<string, THREE.BoxHelper>();

  private _floorMesh?: THREE.Mesh;
  private _floorMaterial?: THREE.MeshStandardMaterial;
  private _floorTopY: number = VIEWPORT_ROOM_FLOOR_TOP_Y;

  private readonly _raycaster: THREE.Raycaster = new THREE.Raycaster();
  private readonly _mouse: THREE.Vector2 = new THREE.Vector2();
  private readonly _floorPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -VIEWPORT_ROOM_FLOOR_TOP_Y);
  private readonly _intersectionPoint: THREE.Vector3 = new THREE.Vector3();

  private _drawingStartPoint: IRulerPoint | null = null;
  private _pointerDownPosition: IRulerPoint | null = null;
  protected readonly ghostBadgeLength: WritableSignal<string> = signal<string>('');
  protected readonly ghostBadgePosition: WritableSignal<IRulerPoint | null> = signal<IRulerPoint | null>(null);
  private _previewLine?: THREE.Line;
  private _previewGeometry?: THREE.BufferGeometry;
  private _previewMaterial?: THREE.LineBasicMaterial;
  private _ghostWallMesh: THREE.Mesh | null = null;
  private _ghostWallGeometry?: THREE.BoxGeometry;
  private _ghostWallMaterial?: THREE.MeshStandardMaterial;

  private _rulerStartPoint: IRulerPoint | null = null;
  private _rulerEndPoint: IRulerPoint | null = null;
  private _rulerLine?: THREE.Line;
  private _rulerLineGeometry?: THREE.BufferGeometry;
  private _rulerLineMaterial?: THREE.LineDashedMaterial;
  private _rulerStartMarker?: THREE.Mesh;
  private _rulerEndMarker?: THREE.Mesh;
  private _rulerMarkerGeometry?: THREE.SphereGeometry;
  private _rulerMarkerMaterial?: THREE.MeshBasicMaterial;
  protected readonly rulerBadgeLength: WritableSignal<string> = signal<string>('');
  protected readonly rulerBadgePosition: WritableSignal<IRulerPoint | null> = signal<IRulerPoint | null>(null);
  private _rulerPhase: RulerPhase = RulerPhase.Idle;

  private readonly _pendingBlueprint: WritableSignal<IFurnitureBlueprint | null> = signal<IFurnitureBlueprint | null>(null);
  private _pendingFurnitureRotationY: number = 0;
  private _furnitureGhost: IFurnitureGhost | null = null;

  private readonly _onPointerDown: (event: PointerEvent) => void = (event: PointerEvent): void => this._handlePointerDown(event);
  private readonly _onPointerMove: (event: PointerEvent) => void = (event: PointerEvent): void => this._handlePointerMove(event);
  private readonly _onPointerUp: (event: PointerEvent) => void = (event: PointerEvent): void => this._handlePointerUp(event);
  private readonly _onPointerCancel: () => void = (): void => {
    this._pointerDownPosition = null;
  };
  private readonly _onContextMenu: (event: MouseEvent) => void = (event: MouseEvent): void => this._handleContextMenu(event);
  private readonly _onKeyDown: (event: KeyboardEvent) => void = (event: KeyboardEvent): void => this._handleKeyDown(event);
  private readonly _onDoubleClick: (event: MouseEvent) => void = (event: MouseEvent): void => this._onCanvasDoubleClick(event);

  public constructor() {
    this._wallsGroup.name = WALLS_ROOT_GROUP_NAME;
    this._floorsGroup.name = ROOM_FLOORS_GROUP_NAME;
    this._furnitureGroup.name = FURNITURE_ROOT_GROUP_NAME;

    effect((): void => {
      const walls: readonly IWallSegment[] = this.floorplanService.walls();
      const selectedWallId: string | null = this.floorplanService.selectedWallId();
      const openings: readonly import('@spacio/shared-types').IWallOpening[] = this.floorplanService.openings();
      if (!this._scene) return;
      this._syncWalls(walls, selectedWallId, openings);
    });

    effect((): void => {
      const polygon: readonly { x: number; y: number }[] | null = this.floorplanService.floorPolygon();
      if (!this._scene) return;
      this._syncFloors(polygon);
    });

    effect((): void => {
      const furniture: readonly IPlacedFurniture[] = this.floorplanService.furniture();
      const selectedId: string | null = this.floorplanService.selectedFurnitureId();
      if (!this._scene) return;
      this._syncFurniture(furniture, selectedId);
    });

    afterNextRender((): void => {
      this._initializeThreeJS();
      this._startAnimationLoop();
      this._setupResizeObserver();
      this._syncWalls(this.floorplanService.walls(), this.floorplanService.selectedWallId(), this.floorplanService.openings());
      this._syncFurniture(this.floorplanService.furniture(), this.floorplanService.selectedFurnitureId());
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

  public onStartFurniturePlacement(blueprint: IFurnitureBlueprint): void {
    this._removeFurnitureGhost();
    this._pendingBlueprint.set(blueprint);
    this._pendingFurnitureRotationY = 0;
    this._setToolMode(ViewportToolMode.PlaceFurniture);
    this._updateFurnitureGhostAtCursor(null);
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
    const selectedWallId: string | null = this.floorplanService.selectedWallId();
    if (selectedWallId) {
      this.floorplanService.removeWall(selectedWallId);
      this.floorplanService.selectWall(null);
      return;
    }
    const selectedFurnitureId: string | null = this.floorplanService.selectedFurnitureId();
    if (selectedFurnitureId) {
      this.floorplanService.removeFurniture(selectedFurnitureId);
      this.floorplanService.selectFurniture(null);
      this._syncFurniture(this.floorplanService.furniture(), this.floorplanService.selectedFurnitureId());
    }
  }

  public ngOnDestroy(): void {
    this._cleanup();
  }

  public setToolMode(mode: ViewportToolMode): void {
    this._setToolMode(mode);
  }

  private _setToolMode(mode: ViewportToolMode): void {
    const wasDrawing: boolean = this.isDrawingMode();
    const wasRuler: boolean = this.isRulerMode();
    const wasPlacing: boolean = this.isPlacingFurnitureMode();

    this.isDrawingMode.set(mode === ViewportToolMode.DrawWall);
    this.isRulerMode.set(mode === ViewportToolMode.Ruler);
    this.isPlacingFurnitureMode.set(mode === ViewportToolMode.PlaceFurniture);

    if (wasDrawing && mode !== ViewportToolMode.DrawWall) {
      this._cancelDrawingInternal();
    }
    if (wasRuler && mode !== ViewportToolMode.Ruler) {
      this._cancelRulerInternal();
    }
    if (wasPlacing && mode !== ViewportToolMode.PlaceFurniture) {
      this._cancelFurniturePlacementInternal();
    }

    if (mode !== ViewportToolMode.View) {
      this.floorplanService.selectWall(null);
      if (mode !== ViewportToolMode.PlaceFurniture) {
        this.floorplanService.selectFurniture(null);
      }
    }

    this._updateOrbitControlsMouseButtons(mode);
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
    this._rulerPhase = RulerPhase.Idle;
    this._removeRulerLine();
    this._removeRulerMarkers();
    this._hideRulerBadge();
  }

  private _cancelFurniturePlacementInternal(): void {
    this._pendingBlueprint.set(null);
    this._removeFurnitureGhost();
  }

  private _updateOrbitControlsMouseButtons(mode: ViewportToolMode): void {
    if (!this._controls) return;
    if (mode === ViewportToolMode.PlaceFurniture) {
      this._controls.enablePan = false;
    } else {
      this._controls.enablePan = true;
    }
  }

  private _initializeThreeJS(): void {
    const hostElement: HTMLElement = this._elementRef.nativeElement;
    const container: HTMLElement = hostElement.querySelector(VIEWPORT_CONTAINER_SELECTOR) as HTMLElement;

    this._renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: VIEWPORT_RENDERER_POWER_PREFERENCE,
    });

    container.appendChild(this._renderer.domElement);
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, VIEWPORT_MAX_PIXEL_RATIO));

    const initialWidth: number = hostElement.clientWidth > 0 ? hostElement.clientWidth : DEFAULT_INITIAL_WIDTH;
    const initialHeight: number = hostElement.clientHeight > 0 ? hostElement.clientHeight : DEFAULT_INITIAL_HEIGHT;

    this._renderer.setSize(initialWidth, initialHeight);
    this._renderer.shadowMap.enabled = true;
    this._renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    THREE.ColorManagement.enabled = true;
    this._renderer.outputColorSpace = THREE.SRGBColorSpace;
    this._renderer.toneMapping = THREE.NoToneMapping;
    this._renderer.toneMappingExposure = VIEWPORT_TONE_MAPPING_EXPOSURE;

    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(VIEWPORT_BACKGROUND_COLOR);

    this._camera = new THREE.PerspectiveCamera(
      VIEWPORT_CAMERA_FOV,
      initialWidth / initialHeight,
      VIEWPORT_CAMERA_NEAR,
      VIEWPORT_CAMERA_FAR
    );
    this._camera.position.set(VIEWPORT_CAMERA_POSITION.x, VIEWPORT_CAMERA_POSITION.y, VIEWPORT_CAMERA_POSITION.z);
    this._camera.lookAt(VIEWPORT_CAMERA_LOOK_AT.x, VIEWPORT_CAMERA_LOOK_AT.y, VIEWPORT_CAMERA_LOOK_AT.z);

    this._controls = new OrbitControls(this._camera, this._renderer.domElement);
    this._controls.enableDamping = true;
    this._controls.dampingFactor = VIEWPORT_CONTROLS_DAMPING_FACTOR;
    this._controls.maxPolarAngle = VIEWPORT_MAX_POLAR_ANGLE;
    this._controls.minDistance = VIEWPORT_MIN_DISTANCE;
    this._controls.maxDistance = VIEWPORT_MAX_DISTANCE;
    this._controls.enablePan = true;

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

    const hemisphereLight: THREE.HemisphereLight = new THREE.HemisphereLight(
      VIEWPORT_HEMISPHERE_LIGHT_SKY_COLOR,
      VIEWPORT_HEMISPHERE_LIGHT_GROUND_COLOR,
      VIEWPORT_HEMISPHERE_LIGHT_INTENSITY
    );
    this._scene.add(hemisphereLight);

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

    const planeGeometry: THREE.PlaneGeometry = new THREE.PlaneGeometry(VIEWPORT_FLOOR_SIZE, VIEWPORT_FLOOR_SIZE);
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
    this._scene.add(this._furnitureGroup);
    this._setupPreviewLine();
    this._syncWalls(this.floorplanService.walls(), this.floorplanService.selectedWallId(), this.floorplanService.openings());
    this._syncFloors(this.floorplanService.floorPolygon());
    this._syncFurniture(this.floorplanService.furniture(), this.floorplanService.selectedFurnitureId());
  }

  private _setupPreviewLine(): void {
    if (!this._scene) return;
    this._previewGeometry = new THREE.BufferGeometry();
    this._previewGeometry.setAttribute(POSITION_ATTRIBUTE_NAME, new THREE.BufferAttribute(new Float32Array(6), 3));
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
    canvas.addEventListener('pointerup', this._onPointerUp);
    canvas.addEventListener('pointercancel', this._onPointerCancel);
    canvas.addEventListener('contextmenu', this._onContextMenu);
    canvas.addEventListener('dblclick', this._onDoubleClick);
    window.addEventListener('keydown', this._onKeyDown);
  }

  private _handlePointerDown(event: PointerEvent): void {
    const isRightClick: boolean = event.button === 2;
    const isPrimaryClick: boolean = event.button === PRIMARY_POINTER_BUTTON;

    if (this.isDrawingMode()) {
      if (!isPrimaryClick) return;
      this._pointerDownPosition = null;
      this._handleDrawingPointerDown(event);
      return;
    }
    if (this.isRulerMode()) {
      if (!isPrimaryClick) return;
      this._pointerDownPosition = null;
      this._handleRulerPointerDown(event);
      return;
    }
    if (this.isPlacingFurnitureMode()) {
      if (isPrimaryClick) {
        this._pointerDownPosition = null;
        this._handleFurniturePlacementPointerDown(event);
        return;
      }
      if (isRightClick) {
        this._pointerDownPosition = null;
        this._cancelFurniturePlacement();
        return;
      }
      return;
    }

    if (isPrimaryClick) {
      this._pointerDownPosition = { x: event.clientX, y: event.clientY };
    }
  }

  private _handlePointerUp(event: PointerEvent): void {
    const downPosition: { x: number; y: number } | null = this._pointerDownPosition;
    this._pointerDownPosition = null;

    const isPrimaryClick: boolean = event.button === PRIMARY_POINTER_BUTTON;

    if (!downPosition || !isPrimaryClick) return;
    if (this.isDrawingMode() || this.isRulerMode() || this.isPlacingFurnitureMode()) return;

    const dragDistance: number = Math.hypot(event.clientX - downPosition.x, event.clientY - downPosition.y);
    if (dragDistance > VIEWPORT_CLICK_DRAG_THRESHOLD_PX) return;

    const furnitureId: string | null = this._pickFurnitureId(event.clientX, event.clientY);
    if (furnitureId) {
      this.floorplanService.selectFurniture(furnitureId);
      return;
    }
    const wallId: string | null = this._pickWallId(event.clientX, event.clientY);
    if (wallId) {
      this.floorplanService.selectWall(wallId);
    } else {
      this.floorplanService.selectWall(null);
      this.floorplanService.selectFurniture(null);
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
      Math.abs(start.x - end.x) < WALL_PLACEMENT_EPSILON && Math.abs(start.y - end.y) < WALL_PLACEMENT_EPSILON;
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

  private _handleFurniturePlacementPointerDown(event: PointerEvent): void {
    event.stopPropagation();
    const blueprint: IFurnitureBlueprint | null = this._pendingBlueprint();
    if (!blueprint) return;
    const point: IFloorPlacementPoint | null = this._getFurniturePlacementPoint(event);
    if (!point) return;

    const item: IPlacedFurniture = this.floorplanService.createFurnitureFromBlueprint(blueprint, { x: point.x, y: 0, z: point.y });
    item.rotation.y = THREE.MathUtils.radToDeg(this._pendingFurnitureRotationY);

    this.floorplanService.addFurniture(item);
    this._syncFurniture(this.floorplanService.furniture(), this.floorplanService.selectedFurnitureId());

    this._removeFurnitureGhost();
    this._pendingBlueprint.set(null);
    this._setToolMode(ViewportToolMode.View);
  }

  private _onCanvasDoubleClick(event: MouseEvent): void {
    if (this.isDrawingMode() || this.isRulerMode() || this.isPlacingFurnitureMode()) return;
    const furnitureId: string | null = this._pickFurnitureId(event.clientX, event.clientY);
    if (furnitureId) {
      this.floorplanService.selectFurniture(furnitureId);
      return;
    }
    this.floorplanService.selectWall(this._pickWallId(event.clientX, event.clientY));
  }

  private _handleContextMenu(event: MouseEvent): void {
    if (this.isPlacingFurnitureMode()) {
      event.preventDefault();
      event.stopPropagation();
      this._cancelFurniturePlacement();
    }
  }

  private _pickWallId(clientX: number, clientY: number): string | null {
    if (!this._renderer || !this._camera) return null;

    const rect: DOMRect = this._renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    this._mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this._raycaster.setFromCamera(this._mouse, this._camera);
    const intersections: readonly THREE.Intersection<THREE.Object3D>[] = this._raycaster.intersectObjects(this._wallsGroup.children, true);

    for (const intersection of intersections) {
      const userData: ISceneObjectUserData = intersection.object.userData as ISceneObjectUserData;
      if (this._isWallMeshUserData(userData)) {
        return userData.id;
      }
    }
    return null;
  }

  private _pickFurnitureId(clientX: number, clientY: number): string | null {
    if (!this._renderer || !this._camera) return null;
    const rect: DOMRect = this._renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    this._mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._mouse, this._camera);
    const intersections: readonly THREE.Intersection<THREE.Object3D>[] = this._raycaster.intersectObjects(this._furnitureGroup.children, true);
    for (const intersection of intersections) {
      let obj: THREE.Object3D | null = intersection.object;
      while (obj) {
        const userData: ISceneObjectUserData = obj.userData as ISceneObjectUserData;
        if (userData.type === FURNITURE_USER_DATA_TYPE && typeof userData.id === 'string') {
          return userData.id;
        }
        obj = obj.parent;
      }
    }
    return null;
  }

  private _isWallMeshUserData(userData: ISceneObjectUserData): userData is IWallMeshUserData {
    return userData.type === WALL_USER_DATA_TYPE && typeof userData.id === 'string';
  }

  private _handlePointerMove(event: PointerEvent): void {
    if (this.isDrawingMode() && this._drawingStartPoint) {
      const point: { x: number; y: number } | null = this._getSnappedFloorPoint(event);
      if (!point) return;
      this._updatePreviewLine(this._drawingStartPoint, point);
      this._updateGhostWallMesh(this._drawingStartPoint, point);
      this._updateGhostBadge(this._drawingStartPoint, point);
    } else if (this.isRulerMode() && this._rulerPhase !== RulerPhase.Idle) {
      const point: { x: number; y: number } | null = this._getSnappedFloorPoint(event);
      if (!point) return;
      this._updateRulerPreview(point);
    } else if (this.isPlacingFurnitureMode()) {
      const point: IFloorPlacementPoint | null = this._getFurniturePlacementPoint(event);
      this._updateFurnitureGhostAtCursor(point);
    }
  }

  private _handleKeyDown(event: KeyboardEvent): void {
    if (event.key === ESCAPE_KEY) {
      this._handleEscape();
      return;
    }

    if (this.isPlacingFurnitureMode() && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const key: string = event.key.toLowerCase();
      if (key === 'r') {
        event.preventDefault();
        this._pendingFurnitureRotationY += FURNITURE_ROTATION_STEP_RAD;
        this._updateFurnitureGhostAtCursor(null);
        return;
      }
    }

    if (event.key !== DELETE_KEY && event.key !== BACKSPACE_KEY) return;
    if (this.isDrawingMode() || this.isRulerMode() || this.isPlacingFurnitureMode()) return;
    if (this._isEditableTarget(event.target)) return;

    const hasSelection: boolean = this.floorplanService.selectedWallId() !== null || this.floorplanService.selectedFurnitureId() !== null;
    if (!hasSelection) return;
    event.preventDefault();
    this.onDeleteSelectedWall();
  }

  private _handleEscape(): void {
    if (this.isDrawingMode()) this._cancelDrawing();
    if (this.isRulerMode()) this._cancelRuler();
    if (this.isPlacingFurnitureMode()) this._cancelFurniturePlacement();
    this.floorplanService.selectWall(null);
    this.floorplanService.selectFurniture(null);
  }

  private _isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tagName: string = target.tagName;
    return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || target.isContentEditable;
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

  private _finishFurniturePlacement(): void {
    this._cancelFurniturePlacementInternal();
    this._setToolMode(ViewportToolMode.View);
  }

  private _cancelFurniturePlacement(): void {
    this._cancelFurniturePlacementInternal();
    this._setToolMode(ViewportToolMode.View);
  }

  private _handleRulerPointerDown(event: PointerEvent): void {
    const point: { x: number; y: number } | null = this._getSnappedFloorPoint(event);
    if (!point) return;

    if (this._rulerPhase === RulerPhase.Idle || this._rulerPhase === RulerPhase.Start) {
      this._rulerStartPoint = point;
      this._rulerPhase = RulerPhase.Measuring;
      this._createRulerLine(point, point);
      this._createRulerMarkers(point);
    } else if (this._rulerPhase === RulerPhase.Measuring) {
      this._rulerEndPoint = point;
      this._updateRulerLine(point);
      this._updateRulerEndMarker(point);
      this._rulerPhase = RulerPhase.Start;
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
    this._rulerLineGeometry.setAttribute(POSITION_ATTRIBUTE_NAME, new THREE.BufferAttribute(new Float32Array(6), 3));
    this._rulerLineMaterial = new THREE.LineDashedMaterial({
      color: RULER_LINE_COLOR,
      transparent: true,
      opacity: RULER_LINE_OPACITY,
      dashSize: RULER_LINE_DASH_SIZE,
      gapSize: RULER_LINE_GAP_SIZE,
    });
    this._rulerLine = new THREE.Line(this._rulerLineGeometry, this._rulerLineMaterial);
    this._rulerLine.computeLineDistances();
    this._rulerLine.name = RULER_LINE_NAME;
    this._scene.add(this._rulerLine);
    this._updateRulerLine(end);
  }

  private _updateRulerLine(end: { x: number; y: number }): void {
    if (!this._rulerStartPoint || !this._rulerLineGeometry || !this._rulerLine || !this._rulerLineMaterial) return;
    const start: IRulerPoint = this._rulerStartPoint;
    const positionAttribute: THREE.BufferAttribute = this._rulerLineGeometry.getAttribute('position') as THREE.BufferAttribute;
    const array: Float32Array = positionAttribute.array as Float32Array;
    const yPos: number = VIEWPORT_PREVIEW_LINE_HEIGHT_OFFSET;
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
    if (this._scene) this._scene.remove(this._rulerLine);
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
    this._rulerMarkerMaterial = new THREE.MeshBasicMaterial({ color: RULER_MARKER_COLOR, transparent: true, opacity: 0.9 });
    this._rulerStartMarker = new THREE.Mesh(this._rulerMarkerGeometry, this._rulerMarkerMaterial);
    this._rulerStartMarker.position.set(point.x, RULER_MARKER_HEIGHT, point.y);
    this._rulerStartMarker.name = RULER_START_MARKER_NAME;
    this._scene.add(this._rulerStartMarker);
    this._rulerEndMarker = new THREE.Mesh(this._rulerMarkerGeometry, this._rulerMarkerMaterial);
    this._rulerEndMarker.position.set(point.x, RULER_MARKER_HEIGHT, point.y);
    this._rulerEndMarker.name = RULER_END_MARKER_NAME;
    this._scene.add(this._rulerEndMarker);
  }

  private _updateRulerEndMarker(point: { x: number; y: number }): void {
    if (this._rulerEndMarker) this._rulerEndMarker.position.set(point.x, RULER_MARKER_HEIGHT, point.y);
  }

  private _removeRulerMarkers(): void {
    if (this._rulerStartMarker && this._scene) this._scene.remove(this._rulerStartMarker);
    if (this._rulerEndMarker && this._scene) this._scene.remove(this._rulerEndMarker);
    this._rulerMarkerGeometry?.dispose();
    this._rulerMarkerMaterial?.dispose();
    this._rulerStartMarker = undefined;
    this._rulerEndMarker = undefined;
    this._rulerMarkerGeometry = undefined;
    this._rulerMarkerMaterial = undefined;
  }

  private _updateRulerBadge(start: { x: number; y: number }, end: { x: number; y: number }): void {
    if (!this._camera) return;
    const dx: number = end.x - start.x;
    const dz: number = end.y - start.y;
    const length: number = Math.hypot(dx, dz);
    const midX: number = (start.x + end.x) / 2;
    const midZ: number = (start.y + end.y) / 2;
    const projection: { x: number; y: number } | null = this._projectToScreen(midX, RULER_BADGE_HEIGHT_OFFSET, midZ);
    if (!projection) return;
    this.rulerBadgeLength.set(`${length.toFixed(2)}m`);
    this.rulerBadgePosition.set(projection);
  }

  private _hideRulerBadge(): void {
    this.rulerBadgeLength.set('');
    this.rulerBadgePosition.set(null);
  }

  private _getFurniturePlacementPoint(event: PointerEvent): IFloorPlacementPoint | null {
    if (!this._renderer || !this._camera) return null;
    const rect: DOMRect = this._renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._mouse, this._camera);

    const planeIntersection: THREE.Vector3 | null = this._raycaster.ray.intersectPlane(this._floorPlane, this._intersectionPoint);
    let hitPoint: THREE.Vector3 | null = planeIntersection;
    if (!hitPoint && this._floorMesh) {
      const floorIntersections: readonly THREE.Intersection<THREE.Object3D>[] = this._raycaster.intersectObject(this._floorMesh, false);
      if (floorIntersections.length > 0) hitPoint = floorIntersections[0].point;
    }
    if (!hitPoint) return null;

    const placementY: number = Math.max(hitPoint.y, this._floorTopY) + FURNITURE_FLOOR_OFFSET;
    return { x: this._snapToGrid(hitPoint.x), y: this._snapToGrid(hitPoint.z), placementY };
  }

  private _getSnappedFloorPoint(event: PointerEvent): { x: number; y: number } | null {
    if (!this._renderer || !this._camera) return null;
    const rect: DOMRect = this._renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._mouse, this._camera);

    if (this._floorMesh) {
      const floorIntersections: readonly THREE.Intersection<THREE.Object3D>[] = this._raycaster.intersectObject(this._floorMesh, false);
      if (floorIntersections.length > 0) {
        const hit: THREE.Vector3 = floorIntersections[0].point;
        const x: number = this._snapToGrid(hit.x);
        const z: number = this._snapToGrid(hit.z);
        return { x, y: z };
      }
    }

    const intersection: THREE.Vector3 | null = this._raycaster.ray.intersectPlane(this._floorPlane, this._intersectionPoint);
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
    const projection: { x: number; y: number } | null = this._projectToScreen(midX, VIEWPORT_PREVIEW_LINE_HEIGHT_OFFSET + 0.5, midZ);
    if (!projection) return;
    this.ghostBadgeLength.set(`${length.toFixed(1)}m`);
    this.ghostBadgePosition.set(projection);
  }

  private _hideGhostBadge(): void {
    this.ghostBadgeLength.set('');
    this.ghostBadgePosition.set(null);
  }

  private _updatePreviewLine(start: { x: number; y: number }, end: { x: number; y: number }): void {
    if (!this._previewGeometry || !this._previewLine) return;
    const positionAttribute: THREE.BufferAttribute = this._previewGeometry.getAttribute(POSITION_ATTRIBUTE_NAME) as THREE.BufferAttribute;
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
    if (this._previewLine) this._previewLine.visible = false;
  }

  private _createGhostWallMesh(start: { x: number; y: number }, end: { x: number; y: number }): void {
    if (!this._scene) return;
    this._removeGhostWallMesh();
    this._ghostWallGeometry = new THREE.BoxGeometry(1, DEFAULT_WALL_HEIGHT, DEFAULT_WALL_THICKNESS);
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

  private _updateGhostWallMesh(start: { x: number; y: number }, end: { x: number; y: number }): void {
    if (!this._ghostWallMesh || !this._ghostWallGeometry) return;
    const dx: number = end.x - start.x;
    const dz: number = end.y - start.y;
    const length: number = Math.sqrt(dx * dx + dz * dz);
    if (length <= WALL_PLACEMENT_EPSILON) {
      this._ghostWallMesh.visible = false;
      return;
    }
    this._ghostWallGeometry.dispose();
    this._ghostWallGeometry = new THREE.BoxGeometry(length, DEFAULT_WALL_HEIGHT, DEFAULT_WALL_THICKNESS);
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
    if (this._scene) this._scene.remove(this._ghostWallMesh);
    this._ghostWallMesh.geometry?.dispose();
    this._ghostWallMaterial?.dispose();
    this._ghostWallMesh = null;
    this._ghostWallGeometry = undefined;
    this._ghostWallMaterial = undefined;
  }

  private _generateWallId(): string {
    return `${WALL_MESH_PREFIX}${WALL_ID_SEPARATOR}${Date.now()}${WALL_ID_SEPARATOR}${Math.random().toString(36).slice(2, 7)}`;
  }

  private _syncWalls(
    walls: ReadonlyArray<IWallSegment>,
    selectedWallId: string | null = null,
    openings: ReadonlyArray<import('@spacio/shared-types').IWallOpening> = []
  ): void {
    if (!this._wallsGroup) return;
    this._disposeWallsGroup();
    const wallsMesh: THREE.Group = WallExtruder.createWallsMesh(walls, selectedWallId, openings);
    while (wallsMesh.children.length > 0) {
      const child: THREE.Object3D = wallsMesh.children[0];
      this._wallsGroup.add(child);
    }
  }

  private _disposeWallsGroup(): void {
    this._wallsGroup.traverse((object: THREE.Object3D): void => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((material: THREE.Material): void => material.dispose());
        } else {
          object.material?.dispose();
        }
      }
    });
    this._wallsGroup.clear();
  }

  private _syncFurniture(furniture: ReadonlyArray<IPlacedFurniture>, selectedId: string | null): void {
    if (!this._furnitureGroup) return;
    this._disposeFurnitureSelectionOutlines();
    for (const [, instance] of this._furnitureInstances.entries()) {
      this._furnitureGroup.remove(instance.group);
      instance.dispose();
    }
    this._furnitureInstances.clear();
    this._furnitureGroup.clear();

    for (const item of furniture) {
      const generated: IGeneratedFurniture = buildParametricFurniture(item);
      generated.group.position.set(item.position.x, this._getFurniturePlacementY(), item.position.z);
      generated.group.visible = true;
      generated.group.renderOrder = 1;
      this._furnitureGroup.add(generated.group);
      this._furnitureInstances.set(item.id, generated);
      if (item.id === selectedId) {
        this._addFurnitureSelectionOutline(generated.group, item.id);
      }
    }
  }

  private _disposeFurnitureSelectionOutlines(): void {
    for (const outline of this._furnitureSelectionOutlines.values()) {
      this._furnitureGroup.remove(outline);
      outline.geometry.dispose();
      (outline.material as THREE.Material).dispose();
    }
    this._furnitureSelectionOutlines.clear();
  }

  private _addFurnitureSelectionOutline(group: THREE.Group, id: string): void {
    group.updateMatrixWorld(true);
    const outline: THREE.BoxHelper = new THREE.BoxHelper(group, VIEWPORT_FURNITURE_SELECTION_OUTLINE_COLOR);
    const outlineMaterial: THREE.LineBasicMaterial = outline.material as THREE.LineBasicMaterial;
    outlineMaterial.transparent = true;
    outlineMaterial.opacity = 0.9;
    outlineMaterial.depthWrite = false;
    outline.name = FURNITURE_SELECTION_OUTLINE_NAME;
    outline.renderOrder = 2;
    this._furnitureGroup.add(outline);
    this._furnitureSelectionOutlines.set(id, outline);
  }

  private _updateFurnitureGhostAtCursor(point: IFloorPlacementPoint | null): void {
    const blueprint: IFurnitureBlueprint | null = this._pendingBlueprint();
    if (!blueprint || !this._scene) {
      this._removeFurnitureGhost();
      return;
    }

    if (!this._furnitureGhost) {
      const posX: number = point?.x ?? 0;
      const posZ: number = point?.y ?? 0;
      const temp: IPlacedFurniture = this.floorplanService.createFurnitureFromBlueprint(blueprint, { x: posX, y: 0, z: posZ });
      temp.rotation.y = THREE.MathUtils.radToDeg(this._pendingFurnitureRotationY);
      const generated: IGeneratedFurniture = buildParametricFurniture(temp);
      const clonedMaterials: THREE.MeshStandardMaterial[] = this._applyGhostMaterials(generated);
      const bounds: { width: number; height: number; depth: number } = getBlueprintBounds(temp.parts);
      const footprint: IFurnitureFootprint = this._createFurnitureFootprint(bounds.width, bounds.depth);
      const baseY: number = generated.group.position.y;
      const placementY: number = point?.placementY ?? this._getFurniturePlacementY();
      const ghostRotation: number = this._pendingFurnitureRotationY;

      generated.group.position.set(posX, placementY + baseY, posZ);
      generated.group.rotation.y = ghostRotation;
      generated.group.renderOrder = FURNITURE_GHOST_RENDER_ORDER;
      generated.group.visible = true;
      footprint.group.position.set(posX, this._floorTopY, posZ);
      footprint.group.rotation.y = ghostRotation;

      this._furnitureGhost = {
        generated,
        clonedMaterials,
        footprint,
        baseY,
        dispose: (): void => {
          footprint.dispose();
          clonedMaterials.forEach((material: THREE.MeshStandardMaterial): void => material.dispose());
          generated.dispose();
        },
      };

      this._scene.add(generated.group);
      this._scene.add(footprint.group);
      return;
    }

    const ghost: IFurnitureGhost = this._furnitureGhost;
    ghost.generated.group.rotation.y = this._pendingFurnitureRotationY;
    ghost.footprint.group.rotation.y = this._pendingFurnitureRotationY;
    if (point) {
      ghost.generated.group.position.set(point.x, point.placementY + ghost.baseY, point.y);
      ghost.footprint.group.position.set(point.x, this._floorTopY, point.y);
    }
  }

  private _applyGhostMaterials(generated: IGeneratedFurniture): THREE.MeshStandardMaterial[] {
    const materialCache: Map<THREE.Material, THREE.MeshStandardMaterial> = new Map<THREE.Material, THREE.MeshStandardMaterial>();
    const sourceMaterials: Set<THREE.Material> = new Set<THREE.Material>();
    const clonedMaterials: THREE.MeshStandardMaterial[] = [];

    generated.group.traverse((obj: THREE.Object3D): void => {
      const mesh: THREE.Mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const originalMaterial: THREE.Material | THREE.Material[] | undefined = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (!originalMaterial) return;

      const isArray = Array.isArray(originalMaterial);
      const sourceMaterialsForMesh: THREE.Material[] = isArray ? originalMaterial : [originalMaterial];
      const clonedMaterialsForMesh: THREE.MeshStandardMaterial[] = sourceMaterialsForMesh.map((source: THREE.Material): THREE.MeshStandardMaterial => {
        sourceMaterials.add(source);
        const cachedMaterial: THREE.MeshStandardMaterial | undefined = materialCache.get(source);
        if (cachedMaterial) return cachedMaterial;

        const standardMaterial: THREE.MeshStandardMaterial = source as THREE.MeshStandardMaterial;
        const clonedMaterial: THREE.MeshStandardMaterial = standardMaterial.clone();
        clonedMaterial.transparent = false;
        clonedMaterial.opacity = FURNITURE_GHOST_MATERIAL_OPACITY;
        clonedMaterial.depthWrite = true;
        clonedMaterial.depthTest = true;
        clonedMaterial.side = THREE.FrontSide;
        clonedMaterial.needsUpdate = true;
        materialCache.set(source, clonedMaterial);
        clonedMaterials.push(clonedMaterial);
        return clonedMaterial;
      });

      mesh.material = isArray ? clonedMaterialsForMesh : clonedMaterialsForMesh[0];
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    });

    sourceMaterials.forEach((material: THREE.Material): void => material.dispose());
    return clonedMaterials;
  }

  private _createFurnitureFootprint(width: number, depth: number): IFurnitureFootprint {
    const group: THREE.Group = new THREE.Group();
    group.name = FURNITURE_GHOST_FOOTPRINT_NAME;

    const fillGeometry: THREE.PlaneGeometry = new THREE.PlaneGeometry(width, depth);
    const fillMaterial: THREE.MeshBasicMaterial = new THREE.MeshBasicMaterial({
      color: FURNITURE_GHOST_FOOTPRINT_FILL_COLOR,
      transparent: true,
      opacity: FURNITURE_GHOST_FOOTPRINT_FILL_OPACITY,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    });
    const fill: THREE.Mesh = new THREE.Mesh(fillGeometry, fillMaterial);
    fill.rotation.x = -Math.PI / 2;
    fill.position.y = FURNITURE_GHOST_FOOTPRINT_Y;
    fill.renderOrder = FURNITURE_GHOST_RENDER_ORDER + 1;
    group.add(fill);

    const halfWidth: number = width / 2;
    const halfDepth: number = depth / 2;
    const borderGeometry: THREE.BufferGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-halfWidth, FURNITURE_GHOST_FOOTPRINT_Y, -halfDepth),
      new THREE.Vector3(halfWidth, FURNITURE_GHOST_FOOTPRINT_Y, -halfDepth),
      new THREE.Vector3(halfWidth, FURNITURE_GHOST_FOOTPRINT_Y, halfDepth),
      new THREE.Vector3(-halfWidth, FURNITURE_GHOST_FOOTPRINT_Y, halfDepth),
    ]);
    const borderMaterial: THREE.LineBasicMaterial = new THREE.LineBasicMaterial({
      color: FURNITURE_GHOST_FOOTPRINT_BORDER_COLOR,
      linewidth: 1,
      transparent: true,
      opacity: FURNITURE_GHOST_FOOTPRINT_BORDER_OPACITY,
      depthWrite: false,
      depthTest: true,
    });
    const border: THREE.LineLoop = new THREE.LineLoop(borderGeometry, borderMaterial);
    border.renderOrder = FURNITURE_GHOST_RENDER_ORDER + 2;
    group.add(border);

    return {
      group,
      dispose: (): void => {
        fillGeometry.dispose();
        fillMaterial.dispose();
        borderGeometry.dispose();
        borderMaterial.dispose();
      },
    };
  }

  private _removeFurnitureGhost(): void {
    if (!this._furnitureGhost) return;
    if (this._scene) {
      this._scene.remove(this._furnitureGhost.generated.group);
      this._scene.remove(this._furnitureGhost.footprint.group);
    }
    this._furnitureGhost.dispose();
    this._furnitureGhost = null;
  }

  private _syncGhostElevation(): void {
    if (!this._furnitureGhost) return;
    this._furnitureGhost.generated.group.position.y = this._getFurniturePlacementY() + this._furnitureGhost.baseY;
    this._furnitureGhost.footprint.group.position.y = this._floorTopY;
  }

  private _getFurniturePlacementY(): number {
    return this._floorTopY + FURNITURE_FLOOR_OFFSET;
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
      this._resetFloorElevation();
      return;
    }

    const validPoints: { x: number; y: number }[] = [];
    for (const point of polygon) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        this._resetFloorElevation();
        return;
      }
      validPoints.push(point);
    }
    if (validPoints.length < 3) {
      this._resetFloorElevation();
      return;
    }

    const shape: THREE.Shape = new THREE.Shape();
    shape.moveTo(validPoints[0].x, validPoints[0].y);
    for (let i: number = 1; i < validPoints.length; i++) {
      shape.lineTo(validPoints[i].x, validPoints[i].y);
    }

    const geometry: THREE.ExtrudeGeometry = new THREE.ExtrudeGeometry(shape, {
      depth: VIEWPORT_ROOM_FLOOR_THICKNESS,
      bevelEnabled: false,
    });
    this._floorMaterial = new THREE.MeshStandardMaterial({
      color: VIEWPORT_ROOM_FLOOR_COLOR,
      transparent: true,
      opacity: VIEWPORT_ROOM_FLOOR_OPACITY,
      roughness: VIEWPORT_ROOM_FLOOR_ROUGHNESS,
      metalness: VIEWPORT_ROOM_FLOOR_METALNESS,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const mesh: THREE.Mesh = new THREE.Mesh(geometry, this._floorMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = VIEWPORT_ROOM_FLOOR_TOP_Y;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.renderOrder = 0;
    mesh.name = ROOM_FLOOR_MESH_NAME;
    this._floorsGroup.add(mesh);
    this._floorMesh = mesh;

    const floorBox: THREE.Box3 = new THREE.Box3().setFromObject(this._floorsGroup);
    this._floorTopY = Number.isFinite(floorBox.max.y) ? floorBox.max.y : VIEWPORT_ROOM_FLOOR_TOP_Y;
    this._floorPlane.set(new THREE.Vector3(0, 1, 0), -this._floorTopY);
    this._syncGhostElevation();
  }

  private _resetFloorElevation(): void {
    this._floorTopY = VIEWPORT_ROOM_FLOOR_TOP_Y;
    this._floorPlane.set(new THREE.Vector3(0, 1, 0), -this._floorTopY);
    this._syncGhostElevation();
  }

  private _startAnimationLoop(): void {
    this._ngZone.runOutsideAngular((): void => {
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
    this._resizeObserver = new ResizeObserver((entries: ResizeObserverEntry[]): void => {
      for (const entry of entries) {
        const { width, height }: { width: number; height: number } = entry.contentRect;
        if (width > 0 && height > 0) this._onResize(width, height);
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
      canvas.removeEventListener('pointerup', this._onPointerUp);
      canvas.removeEventListener('pointercancel', this._onPointerCancel);
      canvas.removeEventListener('contextmenu', this._onContextMenu);
      canvas.removeEventListener('dblclick', this._onDoubleClick);
      window.removeEventListener('keydown', this._onKeyDown);
      if (canvas.parentElement) canvas.parentElement.removeChild(canvas);

      this._renderer.dispose();
      this._renderer.forceContextLoss();
      const gl: WebGLRenderingContext | null = this._renderer.getContext() as WebGLRenderingContext | null;
      if (gl) {
        const extension: WEBGL_lose_context | null = gl.getExtension(WEBGL_LOSE_CONTEXT_EXTENSION);
        extension?.loseContext();
      }
      this._renderer = undefined;
    }

    if (this._scene) {
      this._scene.traverse((object: THREE.Object3D): void => {
        if (object instanceof THREE.Mesh) {
          object.geometry?.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((material: THREE.Material): void => material.dispose());
          } else {
            object.material?.dispose();
          }
        }
      });
      this._scene.clear();
      this._scene = undefined;
    }

    for (const instance of this._furnitureInstances.values()) instance.dispose();
    this._furnitureInstances.clear();
    this._removeFurnitureGhost();

    this._wallsGroup.clear();
    this._disposeFurnitureSelectionOutlines();
    this._furnitureGroup.clear();
    this._floorsGroup.traverse((object: THREE.Object3D): void => {
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
