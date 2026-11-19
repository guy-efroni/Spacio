import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  Signal,
  WritableSignal,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  FURNITURE_PART_ID_USER_DATA_KEY,
  HtmlTag,
  IFurnitureBlueprint,
  ISculptPoint,
  KeyboardKey,
  TMaterialPreset,
  TPartShape,
  TSculptMode,
  TSculptPresetId,
  createFurniturePartSculpt,
  isSculptShape,
  sculptModeForPartShape,
} from '@spacio/shared-types';
import {
  CraftWorkbenchService,
  ICraftShapeOption,
} from '../../core/services/craft-workbench.service';
import { FurnitureCatalogService } from '../../core/services/furniture-catalog.service';
import { WorkspaceNavComponent } from '../../shared/components/workspace-nav.component';
import { buildFurnitureMesh, disposeFurnitureGroup } from '../../core/3d/furniture-mesh.builder';
import { ShapeSculptorPanelComponent } from './shape-sculptor-panel.component';

type TCraftInspectorTab = 'transform' | 'shape' | 'material';

const STAGE_CAMERA_POSITION: THREE.Vector3 = new THREE.Vector3(2.8, 2.1, 3.1);
const STAGE_CAMERA_TARGET: THREE.Vector3 = new THREE.Vector3(0, 0.45, 0);
const STAGE_CLICK_THRESHOLD_PX: number = 4;
const STAGE_RENDER_ORDER_SELECTION: number = 3;
const CRAFT_STAGE_SELECTOR: string = '.craft-stage';
const KEYDOWN_EVENT = 'keydown' as const;
const POINTERDOWN_EVENT = 'pointerdown' as const;
const POINTERUP_EVENT = 'pointerup' as const;
const CANVAS_ELEMENT_TAG = 'canvas' as const;
const CANVAS_CONTEXT_2D = '2d' as const;
const LOADED_FOR_EDIT_MESSAGE: string = 'Loaded for editing — save when ready.';
const EDIT_QUERY_PARAM: string = 'edit';
const THUMBNAIL_SIZE: number = 320;
const THUMBNAIL_MIME_TYPE: string = 'image/jpeg';
const THUMBNAIL_QUALITY: number = 0.86;
const PARTS_DENSE_THRESHOLD: number = 8;

@Component({
  selector: 'app-craft-room',
  standalone: true,
  imports: [WorkspaceNavComponent, ShapeSculptorPanelComponent],
  providers: [CraftWorkbenchService],
  templateUrl: './craft-room.component.html',
  styleUrl: './craft-room.component.scss',
})
export class CraftRoomComponent implements OnDestroy {
  private readonly _elementRef: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly _ngZone: NgZone = inject(NgZone);
  private readonly _route: ActivatedRoute = inject(ActivatedRoute);
  private readonly _catalog: FurnitureCatalogService = inject(FurnitureCatalogService);
  private readonly _workbench: CraftWorkbenchService = inject(CraftWorkbenchService);

  public readonly draft: Signal<IFurnitureBlueprint> = this._workbench.draft;
  public readonly selectedPartId: Signal<string | null> = this._workbench.selectedPartId;
  public readonly blueprintName: Signal<string> = this._workbench.blueprintName;
  public readonly saveMessage: Signal<string> = this._workbench.saveMessage;
  public readonly isSaving: Signal<boolean> = this._workbench.isSaving;
  public readonly mirrorX: Signal<boolean> = this._workbench.mirrorX;
  public readonly mirrorZ: Signal<boolean> = this._workbench.mirrorZ;
  public readonly selectedPart = this._workbench.selectedPart;

  public readonly curatedPresets: Signal<readonly IFurnitureBlueprint[]> = computed(() =>
    this._catalog
      .blueprints()
      .filter((item: IFurnitureBlueprint): boolean => item.isPreset && item.id !== 'preset-blank'),
  );
  public readonly customPieces: Signal<readonly IFurnitureBlueprint[]> = this._catalog.customPieces;
  public readonly shapeOptions: readonly ICraftShapeOption[] = this._workbench.shapeOptions;
  public readonly materialPresets = this._workbench.materialPresets;
  public readonly axes: readonly ('x' | 'y' | 'z')[] = ['x', 'y', 'z'];
  public readonly tabs: readonly { id: TCraftInspectorTab; label: string }[] = [
    { id: 'transform', label: 'Transform' },
    { id: 'shape', label: 'Shape' },
    { id: 'material', label: 'Material' },
  ];

  private readonly _activeTab: WritableSignal<TCraftInspectorTab> =
    signal<TCraftInspectorTab>('transform');
  private readonly _sculptorOpen: WritableSignal<boolean> = signal<boolean>(false);
  public readonly activeTab = this._activeTab.asReadonly();
  public readonly sculptorOpen = this._sculptorOpen.asReadonly();

  public readonly sculptPoints: Signal<readonly ISculptPoint[]> = computed(() => {
    const part = this.selectedPart();
    if (!part) return [];
    if (part.sculpt) return part.sculpt.points;
    return createFurniturePartSculpt(
      sculptModeForPartShape(part.shape),
      part.shape === 'lathe-360' ? 'turned-leg' : 'rectangle',
    ).points;
  });
  public readonly sculptMode: Signal<TSculptMode> = computed(() => {
    const part = this.selectedPart();
    if (!part) return 'extrude';
    return part.sculpt?.mode ?? sculptModeForPartShape(part.shape);
  });

  private _renderer?: THREE.WebGLRenderer;
  private _scene?: THREE.Scene;
  private _camera?: THREE.PerspectiveCamera;
  private _controls?: OrbitControls;
  private readonly _stageGroup: THREE.Group = new THREE.Group();
  private _blueprintGroup?: THREE.Group;
  private readonly _partMeshes: Map<string, THREE.Mesh> = new Map<string, THREE.Mesh>();
  private _selectionOutline?: THREE.BoxHelper;
  private _grid?: THREE.LineSegments;
  private _floor?: THREE.Mesh;
  private _environmentTexture?: THREE.Texture;
  private _backdropTexture?: THREE.Texture;
  private readonly _raycaster: THREE.Raycaster = new THREE.Raycaster();
  private readonly _mouse: THREE.Vector2 = new THREE.Vector2();
  private _pointerDownPosition: { x: number; y: number } | null = null;
  private _animationFrameId?: number;
  private _resizeObserver?: ResizeObserver;
  private _editApplied: boolean = false;

  private readonly _onPointerDown: (event: PointerEvent) => void = (event: PointerEvent): void => {
    this._pointerDownPosition = { x: event.clientX, y: event.clientY };
  };
  private readonly _onPointerUp: (event: PointerEvent) => void = (event: PointerEvent): void =>
    this._handlePointerUp(event);
  private readonly _onKeyDown: (event: KeyboardEvent) => void = (event: KeyboardEvent): void =>
    this._handleKeyDown(event);

  public constructor() {
    window.addEventListener(KEYDOWN_EVENT, this._onKeyDown);

    effect((): void => {
      const blueprints: readonly IFurnitureBlueprint[] = this._catalog.blueprints();
      if (this._editApplied) return;
      const editId: string | null = this._route.snapshot.queryParamMap.get(EDIT_QUERY_PARAM);
      if (!editId || blueprints.length === 0) return;
      const blueprint: IFurnitureBlueprint | undefined = blueprints.find(
        (item: IFurnitureBlueprint): boolean => item.id === editId,
      );
      if (!blueprint) return;
      this._editApplied = true;
      this._workbench.loadBlueprint(blueprint, LOADED_FOR_EDIT_MESSAGE);
    });

    effect((): void => {
      this._workbench.draft();
      if (this._scene) {
        this._rebuildStage();
        this._updateSelectionOutline();
      }
    });

    effect((): void => {
      this._workbench.selectedPartId();
      if (this._scene) this._updateSelectionOutline();
    });

    afterNextRender((): void => {
      this._initializeStage();
      this._rebuildStage();
      this._updateSelectionOutline();
      this._startRenderLoop();
      this._setupResizeObserver();
    });
  }

  public ngOnDestroy(): void {
    window.removeEventListener(KEYDOWN_EVENT, this._onKeyDown);
    this._cleanup();
  }

  public onSelectPreset(id: string): void {
    this._workbench.selectBlueprint(id);
    this._closeSculptor();
  }

  public onStartBlank(): void {
    this._workbench.selectBlueprint('blank');
    this._closeSculptor();
  }

  public onAddPart(shape: TPartShape): void {
    this._workbench.addPart(shape);
  }

  public onDuplicatePart(): void {
    this._workbench.duplicateSelectedPart();
  }

  public onDeletePart(id: string): void {
    this._workbench.removePart(id);
    if (this._workbench.selectedPartId() === null) this._closeSculptor();
  }

  public onDeleteSelectedPart(): void {
    this._workbench.deleteSelectedPart();
    this._closeSculptor();
  }

  public onSelectPart(id: string): void {
    this._workbench.selectPart(id);
  }

  public isDensePartsList(): boolean {
    return this.draft().parts.length > PARTS_DENSE_THRESHOLD;
  }

  public setInspectorTab(tab: TCraftInspectorTab): void {
    this._activeTab.set(tab);
  }

  public onSculptOutline(): void {
    if (!this.selectedPart()) return;
    this._workbench.sculptSelectedPart();
    this._sculptorOpen.set(true);
    this._activeTab.set('shape');
  }

  public onSculptPointsChange(points: readonly ISculptPoint[]): void {
    this._workbench.updateSculptPoints(points);
  }

  public onSculptModeChange(mode: TSculptMode): void {
    this._workbench.setSculptMode(mode);
  }

  public onSculptPresetChange(preset: TSculptPresetId): void {
    this._workbench.applySculptPreset(preset);
  }

  public closeSculptor(): void {
    this._closeSculptor();
  }

  public isSculptedPart(): boolean {
    const part = this.selectedPart();
    return !!part && isSculptShape(part.shape);
  }

  public onPartNameChange(event: Event): void {
    this._workbench.updatePartName(this._valueFromEvent(event));
  }

  public onPartDimensionChange(field: 'width' | 'height' | 'depth', event: Event): void {
    this._workbench.updatePartDimension(field, this._numberFromEvent(event));
  }

  public onPartPositionChange(axis: 'x' | 'y' | 'z', event: Event): void {
    this._workbench.updatePartPosition(axis, this._numberFromEvent(event));
  }

  public stepPartPosition(axis: 'x' | 'y' | 'z', delta: number): void {
    const part = this._workbench.selectedPart();
    if (!part) return;
    this._workbench.updatePartPosition(axis, Number((part.position[axis] + delta).toFixed(3)));
  }

  public onPartRotationChange(axis: 'x' | 'y' | 'z', event: Event): void {
    this._workbench.updatePartRotation(axis, this._numberFromEvent(event));
  }

  public stepPartRotation(axis: 'x' | 'y' | 'z', delta: number): void {
    const part = this._workbench.selectedPart();
    if (!part) return;
    this._workbench.updatePartRotation(axis, Number((part.rotation[axis] + delta).toFixed(2)));
  }

  public onPartBevelChange(value: number): void {
    this._workbench.updatePartBevel(value);
  }

  public onPartTaperChange(value: number): void {
    this._workbench.updatePartTaper(value);
  }

  public onMaterialPresetChange(preset: TMaterialPreset): void {
    this._workbench.updatePartMaterialPreset(preset);
  }

  public onPartColorChange(event: Event): void {
    this._workbench.updatePartColor(this._valueFromEvent(event));
  }

  public onPartColorChangeFromSwatch(color: string): void {
    this._workbench.updatePartColor(color);
  }

  public onPartColorHexChange(event: Event): void {
    this._workbench.updatePartColor(this._valueFromEvent(event).trim());
  }

  public onDropToFloor(): void {
    this._workbench.dropSelectedToFloor();
  }

  public onCenter(): void {
    this._workbench.centerSelected();
  }

  public onMirror(axis: 'x' | 'z'): void {
    this._workbench.mirrorSelected(axis);
  }

  public onToggleMirror(axis: 'x' | 'z'): void {
    this._workbench.toggleMirror(axis);
  }

  public onBlueprintNameChange(event: Event): void {
    this._workbench.setName(this._valueFromEvent(event));
  }

  public onSave(): void {
    this._workbench.setThumbnail(this._captureThumbnail());
    this._workbench.save().subscribe();
  }

  public formatNumber(value: number): string {
    return Number.isFinite(value) ? value.toFixed(2) : '0.00';
  }

  public formatBevel(value: number): string {
    return `${Math.round(value * 100)}%`;
  }

  public formatTaper(value: number): string {
    return Number.isFinite(value) ? value.toFixed(2) : '0.00';
  }

  private _closeSculptor(): void {
    this._sculptorOpen.set(false);
  }

  private _valueFromEvent(event: Event): string {
    const target: HTMLInputElement | HTMLSelectElement = event.target as
      HTMLInputElement | HTMLSelectElement;
    return target.value;
  }

  private _numberFromEvent(event: Event): number {
    const target: HTMLInputElement = event.target as HTMLInputElement;
    return target.valueAsNumber;
  }

  private _handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this._sculptorOpen()) {
      this._closeSculptor();
      return;
    }
    if (this._isEditableTarget(event.target)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const key: string = event.key.toLowerCase();
    if (key !== KeyboardKey.Delete && key !== KeyboardKey.Backspace) return;
    if (!this._workbench.selectedPartId()) return;

    event.preventDefault();
    this._workbench.deleteSelectedPart();
    this._closeSculptor();
  }

  private _isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tagName: string = target.tagName;
    return (
      tagName === HtmlTag.Input ||
      tagName === HtmlTag.TextArea ||
      tagName === HtmlTag.Select ||
      target.isContentEditable
    );
  }

  private _initializeStage(): void {
    const container: HTMLElement | null =
      this._elementRef.nativeElement.querySelector(CRAFT_STAGE_SELECTOR);
    if (!container) return;

    const renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.addEventListener(POINTERDOWN_EVENT, this._onPointerDown);
    renderer.domElement.addEventListener(POINTERUP_EVENT, this._onPointerUp);
    container.appendChild(renderer.domElement);
    this._renderer = renderer;

    const scene: THREE.Scene = new THREE.Scene();
    this._backdropTexture = this._createBackdropTexture();
    scene.background = this._backdropTexture;
    const pmrem: THREE.PMREMGenerator = new THREE.PMREMGenerator(renderer);
    this._environmentTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = this._environmentTexture;
    pmrem.dispose();
    this._scene = scene;

    const camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100,
    );
    camera.position.copy(STAGE_CAMERA_POSITION);
    camera.lookAt(STAGE_CAMERA_TARGET);
    this._camera = camera;

    const controls: OrbitControls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.target.copy(STAGE_CAMERA_TARGET);
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.minDistance = 0.9;
    controls.maxDistance = 18;
    controls.update();
    this._controls = controls;

    this._grid = this._createFadingGrid();
    scene.add(this._grid);

    const floor: THREE.Mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.ShadowMaterial({
        color: 0x000000,
        opacity: 0.28,
        transparent: true,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.002;
    floor.receiveShadow = true;
    scene.add(floor);
    this._floor = floor;

    scene.add(new THREE.AmbientLight(0xffffff, 0.24));
    scene.add(new THREE.HemisphereLight(0xdbe6ff, 0x191a20, 0.5));

    const keyLight: THREE.DirectionalLight = new THREE.DirectionalLight(0xffe9cf, 2.7);
    keyLight.position.set(4, 6, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -5;
    keyLight.shadow.camera.right = 5;
    keyLight.shadow.camera.top = 5;
    keyLight.shadow.camera.bottom = -5;
    keyLight.shadow.bias = -0.0002;
    keyLight.shadow.normalBias = 0.02;
    keyLight.shadow.radius = 4;
    scene.add(keyLight);

    const fillLight: THREE.DirectionalLight = new THREE.DirectionalLight(0x9db4ff, 0.85);
    fillLight.position.set(-5, 3, 2);
    scene.add(fillLight);

    const rimLight: THREE.DirectionalLight = new THREE.DirectionalLight(0xffd7b0, 1.05);
    rimLight.position.set(0, 4, -5);
    scene.add(rimLight);

    scene.add(this._stageGroup);
  }

  private _createBackdropTexture(): THREE.CanvasTexture {
    const canvas: HTMLCanvasElement = document.createElement(CANVAS_ELEMENT_TAG);
    canvas.width = 512;
    canvas.height = 512;
    const context: CanvasRenderingContext2D | null = canvas.getContext(CANVAS_CONTEXT_2D);
    if (context) {
      const gradient: CanvasGradient = context.createRadialGradient(256, 205, 30, 256, 256, 390);
      gradient.addColorStop(0, '#222731');
      gradient.addColorStop(0.55, '#171a21');
      gradient.addColorStop(1, '#101216');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 512, 512);
    }
    const texture: THREE.CanvasTexture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private _createFadingGrid(): THREE.LineSegments {
    const helper: THREE.GridHelper = new THREE.GridHelper(20, 48, 0x8b93a3, 0x474d59);
    const material: THREE.ShaderMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        attribute vec3 color;
        varying vec3 vColor;
        varying float vFade;
        void main() {
          vColor = color;
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          float distanceFromCenter = length(worldPosition.xz);
          vFade = 1.0 - smoothstep(3.2, 9.5, distanceFromCenter);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vFade;
        void main() {
          gl_FragColor = vec4(vColor, 0.3 * vFade);
        }
      `,
      transparent: true,
      depthWrite: false,
    });
    helper.position.y = 0.001;
    const grid: THREE.LineSegments = new THREE.LineSegments(helper.geometry, material);
    grid.position.copy(helper.position);
    helper.material.dispose();
    return grid;
  }

  private _rebuildStage(): void {
    if (!this._scene) return;
    if (this._blueprintGroup) {
      this._stageGroup.remove(this._blueprintGroup);
      disposeFurnitureGroup(this._blueprintGroup);
      this._blueprintGroup = undefined;
    }
    this._partMeshes.clear();
    this._disposeSelectionOutline();

    const blueprint: IFurnitureBlueprint = this._workbench.draft();
    if (blueprint.parts.length === 0) return;

    const group: THREE.Group = buildFurnitureMesh(blueprint.parts, blueprint.materials, {
      ground: false,
    });
    group.updateMatrixWorld(true);
    group.traverse((object: THREE.Object3D): void => {
      const mesh: THREE.Mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const partId: string | undefined = mesh.userData[FURNITURE_PART_ID_USER_DATA_KEY] as
        string | undefined;
      if (partId) this._partMeshes.set(partId, mesh);
      mesh.frustumCulled = false;
    });
    this._stageGroup.add(group);
    this._blueprintGroup = group;
  }

  private _updateSelectionOutline(): void {
    this._disposeSelectionOutline();
    const id: string | null = this._workbench.selectedPartId();
    if (!id) return;
    const mesh: THREE.Mesh | undefined = this._partMeshes.get(id);
    if (!mesh || !this._scene) return;
    const outline: THREE.BoxHelper = new THREE.BoxHelper(mesh, 0xcbb68a);
    outline.renderOrder = STAGE_RENDER_ORDER_SELECTION;
    const material: THREE.LineBasicMaterial = outline.material as THREE.LineBasicMaterial;
    material.depthTest = false;
    material.transparent = true;
    material.opacity = 0.65;
    this._scene.add(outline);
    this._selectionOutline = outline;
  }

  private _disposeSelectionOutline(): void {
    if (!this._selectionOutline) return;
    this._selectionOutline.parent?.remove(this._selectionOutline);
    this._selectionOutline.geometry.dispose();
    (this._selectionOutline.material as THREE.Material).dispose();
    this._selectionOutline = undefined;
  }

  private _handlePointerUp(event: PointerEvent): void {
    const down: { x: number; y: number } | null = this._pointerDownPosition;
    this._pointerDownPosition = null;
    if (!down || !this._renderer || !this._camera) return;
    const distance: number = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    if (distance > STAGE_CLICK_THRESHOLD_PX) return;

    const rect: DOMRect = this._renderer.domElement.getBoundingClientRect();
    this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._mouse, this._camera);
    const intersections: readonly THREE.Intersection<THREE.Object3D>[] =
      this._raycaster.intersectObjects(this._stageGroup.children, true);
    for (const intersection of intersections) {
      const partId: string | undefined = intersection.object.userData[
        FURNITURE_PART_ID_USER_DATA_KEY
      ] as string | undefined;
      if (partId) {
        this._workbench.selectPart(partId);
        return;
      }
    }
    this._workbench.clearPartSelection();
  }

  private _captureThumbnail(): string | undefined {
    if (!this._renderer || !this._scene || !this._blueprintGroup) return undefined;

    const hidden: { object: THREE.Object3D; visible: boolean }[] = [];
    for (const object of [this._grid, this._floor, this._selectionOutline]) {
      if (!object) continue;
      hidden.push({ object, visible: object.visible });
      object.visible = false;
    }

    const bounds: THREE.Box3 = new THREE.Box3().setFromObject(this._blueprintGroup);
    const center: THREE.Vector3 = bounds.getCenter(new THREE.Vector3());
    const size: THREE.Vector3 = bounds.getSize(new THREE.Vector3());
    const radius: number = Math.max(size.x, size.y, size.z, 0.6) / 2;
    const distance: number = radius / Math.sin(THREE.MathUtils.degToRad(17));
    const thumbnailCamera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    thumbnailCamera.position
      .copy(center)
      .addScaledVector(new THREE.Vector3(1, 0.72, 1.3).normalize(), distance);
    thumbnailCamera.lookAt(center);

    this._renderer.render(this._scene, thumbnailCamera);
    const source: HTMLCanvasElement = this._renderer.domElement;
    const thumbnail: HTMLCanvasElement = document.createElement(CANVAS_ELEMENT_TAG);
    thumbnail.width = THUMBNAIL_SIZE;
    thumbnail.height = THUMBNAIL_SIZE;
    const context: CanvasRenderingContext2D | null = thumbnail.getContext(CANVAS_CONTEXT_2D);
    let dataUrl: string | undefined;
    if (context) {
      const side: number = Math.min(source.width, source.height);
      const sx: number = (source.width - side) / 2;
      const sy: number = (source.height - side) / 2;
      context.drawImage(source, sx, sy, side, side, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
      dataUrl = thumbnail.toDataURL(THUMBNAIL_MIME_TYPE, THUMBNAIL_QUALITY);
    }

    for (const item of hidden) item.object.visible = item.visible;
    if (this._camera) this._renderer.render(this._scene, this._camera);
    return dataUrl;
  }

  private _startRenderLoop(): void {
    this._ngZone.runOutsideAngular((): void => {
      const animate = (): void => {
        this._animationFrameId = requestAnimationFrame(animate);
        this._controls?.update();
        if (this._renderer && this._scene && this._camera) {
          this._renderer.render(this._scene, this._camera);
        }
      };
      animate();
    });
  }

  private _setupResizeObserver(): void {
    const host: HTMLElement = this._elementRef.nativeElement;
    this._resizeObserver = new ResizeObserver((): void => {
      const container: HTMLElement | null = host.querySelector(CRAFT_STAGE_SELECTOR);
      if (!container || !this._renderer || !this._camera) return;
      const width: number = container.clientWidth;
      const height: number = container.clientHeight;
      if (width === 0 || height === 0) return;
      this._camera.aspect = width / height;
      this._camera.updateProjectionMatrix();
      this._renderer.setSize(width, height, false);
    });
    this._resizeObserver.observe(host);
  }

  private _cleanup(): void {
    if (this._animationFrameId !== undefined) cancelAnimationFrame(this._animationFrameId);
    this._resizeObserver?.disconnect();
    if (this._renderer) {
      const canvas: HTMLCanvasElement = this._renderer.domElement;
      canvas.removeEventListener(POINTERDOWN_EVENT, this._onPointerDown);
      canvas.removeEventListener(POINTERUP_EVENT, this._onPointerUp);
      canvas.parentElement?.removeChild(canvas);
      this._renderer.dispose();
      this._renderer.forceContextLoss();
      this._renderer = undefined;
    }
    this._disposeSelectionOutline();
    if (this._blueprintGroup) disposeFurnitureGroup(this._blueprintGroup);
    this._partMeshes.clear();
    if (this._grid) {
      this._grid.geometry.dispose();
      (this._grid.material as THREE.Material).dispose();
      this._grid = undefined;
    }
    if (this._scene) {
      this._scene.traverse((object: THREE.Object3D): void => {
        const mesh: THREE.Mesh = object as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const material: THREE.Material | THREE.Material[] | undefined = mesh.material as
            THREE.Material | THREE.Material[] | undefined;
          if (Array.isArray(material)) material.forEach((item: THREE.Material) => item.dispose());
          else material?.dispose();
        }
      });
      this._scene.clear();
      this._scene = undefined;
    }
    this._environmentTexture?.dispose();
    this._environmentTexture = undefined;
    this._backdropTexture?.dispose();
    this._backdropTexture = undefined;
    this._floor = undefined;
    this._controls?.dispose();
    this._controls = undefined;
    this._camera = undefined;
  }
}
