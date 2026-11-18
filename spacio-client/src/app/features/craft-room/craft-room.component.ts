import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  Signal,
  afterNextRender,
  effect,
  inject,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { IFurnitureBlueprint, HtmlTag, KeyboardKey, TMaterialFinish, TPartShape } from '@spacio/shared-types';
import { CraftWorkbenchService, ICraftMaterialEntry } from '../../core/services/craft-workbench.service';
import { FurnitureCatalogService } from '../../core/services/furniture-catalog.service';
import { WorkspaceNavComponent } from '../../shared/components/workspace-nav.component';
import { buildFurnitureMesh, disposeFurnitureGroup } from '../../core/3d/furniture-mesh.builder';

const STAGE_BACKGROUND: number = 0x141418;
const STAGE_FLOOR_COLOR: number = 0x1b1b22;
const STAGE_GRID_COLOR: number = 0x3f3f46;
const STAGE_GRID_CENTER_COLOR: number = 0x52525b;
const STAGE_GRID_SIZE: number = 10;
const STAGE_GRID_DIVISIONS: number = 20;
const STAGE_CAMERA_POSITION: THREE.Vector3 = new THREE.Vector3(2.8, 2.1, 3.0);
const STAGE_CAMERA_TARGET: THREE.Vector3 = new THREE.Vector3(0, 0.45, 0);
const STAGE_CLICK_THRESHOLD_PX: number = 4;
const STAGE_RENDER_ORDER_SELECTION: number = 3;

@Component({
  selector: 'app-craft-room',
  standalone: true,
  imports: [WorkspaceNavComponent],
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
  public readonly blueprintCategory: Signal<IFurnitureBlueprint['category']> = this._workbench.blueprintCategory;
  public readonly saveMessage: Signal<string> = this._workbench.saveMessage;
  public readonly isSaving: Signal<boolean> = this._workbench.isSaving;
  public readonly mirrorX: Signal<boolean> = this._workbench.mirrorX;
  public readonly mirrorZ: Signal<boolean> = this._workbench.mirrorZ;

  public readonly blueprints: Signal<readonly IFurnitureBlueprint[]> = this._catalog.blueprints;
  public readonly partShapes: readonly TPartShape[] = this._workbench.partShapes;
  public readonly finishOptions = this._workbench.finishOptions;
  public readonly categoryOptions = this._workbench.categoryOptions;

  public readonly selectedPart = this._workbench.selectedPart;
  public readonly materialEntries: Signal<readonly ICraftMaterialEntry[]> = this._workbench.materialEntries;

  private _renderer?: THREE.WebGLRenderer;
  private _scene?: THREE.Scene;
  private _camera?: THREE.PerspectiveCamera;
  private _controls?: OrbitControls;
  private _stageGroup: THREE.Group = new THREE.Group();
  private _blueprintGroup?: THREE.Group;
  private readonly _partMeshes: Map<string, THREE.Mesh> = new Map<string, THREE.Mesh>();
  private _selectionOutline?: THREE.BoxHelper;
  private readonly _raycaster: THREE.Raycaster = new THREE.Raycaster();
  private readonly _mouse: THREE.Vector2 = new THREE.Vector2();
  private _pointerDownPosition: { x: number; y: number } | null = null;
  private _animationFrameId?: number;
  private _resizeObserver?: ResizeObserver;
  private _editApplied: boolean = false;

  private readonly _onPointerDown: (event: PointerEvent) => void = (event: PointerEvent): void => {
    this._pointerDownPosition = { x: event.clientX, y: event.clientY };
  };
  private readonly _onPointerUp: (event: PointerEvent) => void = (event: PointerEvent): void => this._handlePointerUp(event);
  private readonly _onKeyDown: (event: KeyboardEvent) => void = (event: KeyboardEvent): void => this._handleKeyDown(event);

  public constructor() {
    window.addEventListener('keydown', this._onKeyDown);

    effect((): void => {
      const blueprints: readonly IFurnitureBlueprint[] = this._catalog.blueprints();
      if (this._editApplied) return;
      const editId: string | null = this._route.snapshot.queryParamMap.get('edit');
      if (!editId || blueprints.length === 0) return;
      const blueprint: IFurnitureBlueprint | undefined = blueprints.find(
        (item: IFurnitureBlueprint): boolean => item.id === editId
      );
      if (!blueprint) return;
      this._editApplied = true;
      this._workbench.loadBlueprint(blueprint, 'Loaded for editing — save when ready.');
    });

    effect((): void => {
      this._workbench.draft();
      if (this._scene) this._rebuildStage();
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
    window.removeEventListener('keydown', this._onKeyDown);
    this._cleanup();
  }

  public onSelectPreset(event: Event): void {
    this._workbench.selectBlueprint(this._valueFromEvent(event));
  }

  public onAddPart(shape: TPartShape): void {
    this._workbench.addPart(shape);
  }

  public onDuplicatePart(): void {
    this._workbench.duplicateSelectedPart();
  }

  public onDeletePart(id: string): void {
    this._workbench.removePart(id);
  }

  public onDeleteSelectedPart(): void {
    this._workbench.deleteSelectedPart();
  }

  public onSelectPart(id: string): void {
    this._workbench.selectPart(id);
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

  public onPartRotationChange(axis: 'x' | 'y' | 'z', event: Event): void {
    this._workbench.updatePartRotation(axis, this._numberFromEvent(event));
  }

  public onPartMaterialSlotChange(event: Event): void {
    this._workbench.updatePartMaterialSlot(this._valueFromEvent(event));
  }

  public onToggleMirror(axis: 'x' | 'z'): void {
    this._workbench.toggleMirror(axis);
  }

  public onBlueprintNameChange(event: Event): void {
    this._workbench.setName(this._valueFromEvent(event));
  }

  public onBlueprintCategoryChange(event: Event): void {
    this._workbench.setCategory(this._valueFromEvent(event) as IFurnitureBlueprint['category']);
  }

  public onAddMaterialSlot(): void {
    this._workbench.addMaterialSlot();
  }

  public onRemoveMaterialSlot(key: string): void {
    this._workbench.removeMaterialSlot(key);
  }

  public onMaterialLabelChange(key: string, event: Event): void {
    this._workbench.updateMaterialLabel(key, this._valueFromEvent(event));
  }

  public onMaterialColorChange(key: string, event: Event): void {
    this._workbench.updateMaterialColor(key, this._valueFromEvent(event));
  }

  public onMaterialFinishChange(key: string, event: Event): void {
    this._workbench.updateMaterialFinish(key, this._valueFromEvent(event) as TMaterialFinish);
  }

  public onSave(): void {
    this._workbench.setThumbnail(this._captureThumbnail());
    this._workbench.save().subscribe();
  }

  public formatNumber(value: number): string {
    return Number.isFinite(value) ? value.toFixed(2) : '0.00';
  }

  private _valueFromEvent(event: Event): string {
    const target: HTMLInputElement | HTMLSelectElement = event.target as HTMLInputElement | HTMLSelectElement;
    return target.value;
  }

  private _numberFromEvent(event: Event): number {
    const target: HTMLInputElement = event.target as HTMLInputElement;
    return target.valueAsNumber;
  }

  private _handleKeyDown(event: KeyboardEvent): void {
    if (this._isEditableTarget(event.target)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const key: string = event.key.toLowerCase();
    if (key !== KeyboardKey.Delete && key !== KeyboardKey.Backspace) return;
    if (!this._workbench.selectedPartId()) return;

    event.preventDefault();
    this._workbench.deleteSelectedPart();
  }

  private _isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tagName: string = target.tagName;
    return tagName === HtmlTag.Input || tagName === HtmlTag.TextArea || tagName === HtmlTag.Select || target.isContentEditable;
  }

  private _initializeStage(): void {
    const container: HTMLElement | null = this._elementRef.nativeElement.querySelector('.craft-stage');
    if (!container) return;

    const renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.addEventListener('pointerdown', this._onPointerDown);
    renderer.domElement.addEventListener('pointerup', this._onPointerUp);
    container.appendChild(renderer.domElement);
    this._renderer = renderer;

    const scene: THREE.Scene = new THREE.Scene();
    scene.background = new THREE.Color(STAGE_BACKGROUND);
    this._scene = scene;

    const camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.copy(STAGE_CAMERA_POSITION);
    camera.lookAt(STAGE_CAMERA_TARGET);
    this._camera = camera;

    const controls: OrbitControls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.copy(STAGE_CAMERA_TARGET);
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 1;
    controls.maxDistance = 20;
    controls.update();
    this._controls = controls;

    const grid: THREE.GridHelper = new THREE.GridHelper(STAGE_GRID_SIZE, STAGE_GRID_DIVISIONS, STAGE_GRID_CENTER_COLOR, STAGE_GRID_COLOR);
    grid.material.transparent = true;
    grid.material.opacity = 0.55;
    scene.add(grid);

    const axes: THREE.AxesHelper = new THREE.AxesHelper(1.2);
    axes.position.y = 0.002;
    scene.add(axes);

    const floor: THREE.Mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(STAGE_GRID_SIZE, STAGE_GRID_SIZE),
      new THREE.MeshStandardMaterial({ color: STAGE_FLOOR_COLOR, roughness: 0.95, metalness: 0 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.006;
    floor.receiveShadow = true;
    scene.add(floor);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    scene.add(new THREE.HemisphereLight(0xcbd5ff, 0x20202a, 0.6));

    const keyLight: THREE.DirectionalLight = new THREE.DirectionalLight(0xffffff, 2.1);
    keyLight.position.set(4, 6, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -5;
    keyLight.shadow.camera.right = 5;
    keyLight.shadow.camera.top = 5;
    keyLight.shadow.camera.bottom = -5;
    scene.add(keyLight);

    const fillLight: THREE.DirectionalLight = new THREE.DirectionalLight(0x9db4ff, 0.8);
    fillLight.position.set(-4, 3, 2);
    scene.add(fillLight);

    const rimLight: THREE.DirectionalLight = new THREE.DirectionalLight(0xffd9b3, 0.7);
    rimLight.position.set(0, 4, -5);
    scene.add(rimLight);

    scene.add(this._stageGroup);
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

    const group: THREE.Group = buildFurnitureMesh(blueprint.parts, blueprint.materials, { ground: false });
    group.updateMatrixWorld(true);
    group.traverse((object: THREE.Object3D): void => {
      const mesh: THREE.Mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const partId: string | undefined = mesh.userData['partId'] as string | undefined;
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
    const outline: THREE.BoxHelper = new THREE.BoxHelper(mesh, 0x7da2ff);
    outline.renderOrder = STAGE_RENDER_ORDER_SELECTION;
    const material: THREE.LineBasicMaterial = outline.material as THREE.LineBasicMaterial;
    material.depthTest = false;
    material.transparent = true;
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
    const intersections: readonly THREE.Intersection<THREE.Object3D>[] = this._raycaster.intersectObjects(this._stageGroup.children, true);
    for (const intersection of intersections) {
      const partId: string | undefined = intersection.object.userData['partId'] as string | undefined;
      if (partId) {
        this._workbench.selectPart(partId);
        return;
      }
    }
    this._workbench.clearPartSelection();
  }

  private _captureThumbnail(): string | undefined {
    if (!this._renderer || !this._scene || !this._camera) return undefined;
    this._renderer.render(this._scene, this._camera);
    const source: HTMLCanvasElement = this._renderer.domElement;
    const thumbnail: HTMLCanvasElement = document.createElement('canvas');
    thumbnail.width = 256;
    thumbnail.height = 256;
    const context: CanvasRenderingContext2D | null = thumbnail.getContext('2d');
    if (!context) return undefined;
    const side: number = Math.min(source.width, source.height);
    const sx: number = (source.width - side) / 2;
    const sy: number = (source.height - side) / 2;
    context.drawImage(source, sx, sy, side, side, 0, 0, 256, 256);
    return thumbnail.toDataURL('image/jpeg', 0.82);
  }

  private _startRenderLoop(): void {
    this._ngZone.runOutsideAngular((): void => {
      const animate = (): void => {
        this._animationFrameId = requestAnimationFrame(animate);
        this._controls?.update();
        this._renderer?.render(this._scene as THREE.Scene, this._camera as THREE.PerspectiveCamera);
      };
      animate();
    });
  }

  private _setupResizeObserver(): void {
    const host: HTMLElement = this._elementRef.nativeElement;
    this._resizeObserver = new ResizeObserver((): void => {
      const container: HTMLElement | null = host.querySelector('.craft-stage');
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
      canvas.removeEventListener('pointerdown', this._onPointerDown);
      canvas.removeEventListener('pointerup', this._onPointerUp);
      canvas.parentElement?.removeChild(canvas);
      this._renderer.dispose();
      this._renderer.forceContextLoss();
      this._renderer = undefined;
    }
    this._disposeSelectionOutline();
    if (this._blueprintGroup) disposeFurnitureGroup(this._blueprintGroup);
    this._partMeshes.clear();
    if (this._scene) {
      this._scene.traverse((object: THREE.Object3D): void => {
        const mesh: THREE.Mesh = object as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const material: THREE.Material | THREE.Material[] | undefined = mesh.material as THREE.Material | THREE.Material[] | undefined;
          if (Array.isArray(material)) material.forEach((item: THREE.Material) => item.dispose());
          else material?.dispose();
        }
      });
      this._scene.clear();
      this._scene = undefined;
    }
    this._controls?.dispose();
    this._controls = undefined;
    this._camera = undefined;
  }
}
