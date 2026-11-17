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
import {
  FURNITURE_CATEGORY_OPTIONS,
  IFurnitureBlueprint,
  IFurniturePart,
  IMaterialSlot,
  MATERIAL_FINISH_OPTIONS,
  PART_SHAPE_OPTIONS,
  TMaterialFinish,
  TFurnitureCategory,
  TPartShape,
  createFurnitureMaterialSlot,
  createFurniturePart,
} from '@spacio/shared-types';
import { BlueprintService } from '../../core/services/blueprint.service';
import { WorkspaceNavComponent } from '../../shared/components/workspace-nav.component';
import { buildFurnitureGroupFromBlueprint, disposeObject3D } from '../../shared/utils/furniture-blueprint-mesh.util';

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

interface ICraftMaterialEntry {
  key: string;
  slot: IMaterialSlot;
}

@Component({
  selector: 'app-craft-room',
  standalone: true,
  imports: [WorkspaceNavComponent],
  templateUrl: './craft-room.component.html',
  styleUrl: './craft-room.component.scss',
})
export class CraftRoomComponent implements OnDestroy {
  private readonly _elementRef: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly _ngZone: NgZone = inject(NgZone);
  private readonly _route: ActivatedRoute = inject(ActivatedRoute);
  private readonly _blueprintService: BlueprintService = inject(BlueprintService);

  private readonly _draft: WritableSignal<IFurnitureBlueprint> = signal<IFurnitureBlueprint>(this._blueprintService.createBlankDraft());
  private readonly _selectedPartId: WritableSignal<string | null> = signal<string | null>(null);
  private readonly _blueprintName: WritableSignal<string> = signal<string>('Untitled Piece');
  private readonly _blueprintCategory: WritableSignal<TFurnitureCategory> = signal<TFurnitureCategory>('decor');
  private readonly _saveMessage: WritableSignal<string> = signal<string>('');
  private readonly _isSaving: WritableSignal<boolean> = signal<boolean>(false);
  private readonly _mirrorX: WritableSignal<boolean> = signal<boolean>(false);
  private readonly _mirrorZ: WritableSignal<boolean> = signal<boolean>(false);

  public readonly draft: Signal<IFurnitureBlueprint> = this._draft.asReadonly();
  public readonly selectedPartId: Signal<string | null> = this._selectedPartId.asReadonly();
  public readonly blueprintName: Signal<string> = this._blueprintName.asReadonly();
  public readonly blueprintCategory: Signal<TFurnitureCategory> = this._blueprintCategory.asReadonly();
  public readonly saveMessage: Signal<string> = this._saveMessage.asReadonly();
  public readonly isSaving: Signal<boolean> = this._isSaving.asReadonly();
  public readonly mirrorX: Signal<boolean> = this._mirrorX.asReadonly();
  public readonly mirrorZ: Signal<boolean> = this._mirrorZ.asReadonly();

  public readonly blueprints: Signal<readonly IFurnitureBlueprint[]> = this._blueprintService.blueprints;
  public readonly partShapes: readonly TPartShape[] = PART_SHAPE_OPTIONS;
  public readonly finishOptions: readonly TMaterialFinish[] = MATERIAL_FINISH_OPTIONS;
  public readonly categoryOptions: readonly TFurnitureCategory[] = FURNITURE_CATEGORY_OPTIONS;

  public readonly selectedPart: Signal<IFurniturePart | null> = computed<IFurniturePart | null>(() => {
    const id: string | null = this._selectedPartId();
    if (!id) return null;
    return this._draft().parts.find((part: IFurniturePart) => part.id === id) ?? null;
  });

  public readonly materialEntries: Signal<readonly ICraftMaterialEntry[]> = computed<readonly ICraftMaterialEntry[]>(() =>
    Object.entries(this._draft().materials).map(([key, slot]: [string, IMaterialSlot]) => ({ key, slot }))
  );

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

  public constructor() {
    this._blueprintService.load();

    effect((): void => {
      const blueprints: readonly IFurnitureBlueprint[] = this._blueprintService.blueprints();
      if (this._editApplied) return;
      const editId: string | null = this._route.snapshot.queryParamMap.get('edit');
      const source: IFurnitureBlueprint | null = this._blueprintService.peekEditSource();
      if (!source && (!editId || blueprints.length === 0)) return;
      const blueprint: IFurnitureBlueprint | null = source ?? blueprints.find((item: IFurnitureBlueprint) => item.id === editId) ?? null;
      if (!blueprint) return;
      this._editApplied = true;
      this._applyBlueprint(blueprint, `${blueprint.name} Edited`);
      this._blueprintService.clearEditSource();
      this._saveMessage.set('Editing a copy — save to add it to your catalog.');
    });

    effect((): void => {
      this._draft();
      if (this._scene) this._rebuildStage();
    });

    effect((): void => {
      this._selectedPartId();
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
    this._cleanup();
  }

  public onSelectPreset(event: Event): void {
    const id: string = this._valueFromEvent(event);
    if (id === 'blank') {
      const blank: IFurnitureBlueprint = this._blueprintService.createBlankDraft();
      this._applyBlueprint(blank, blank.name);
      this._saveMessage.set('Blank piece started.');
      return;
    }
    const blueprint: IFurnitureBlueprint | undefined = this._blueprintService.blueprints().find((item: IFurnitureBlueprint) => item.id === id);
    if (!blueprint) return;
    const draft: IFurnitureBlueprint = this._blueprintService.cloneAsDraft(blueprint);
    this._applyBlueprint(draft, draft.name);
    this._saveMessage.set(`Cloned “${blueprint.name}”.`);
  }

  public onAddPart(shape: TPartShape): void {
    const sizes: Record<TPartShape, { width: number; height: number; depth: number }> = {
      box: { width: 0.4, height: 0.4, depth: 0.4 },
      cylinder: { width: 0.2, height: 0.6, depth: 0.2 },
      sphere: { width: 0.4, height: 0.4, depth: 0.4 },
      capsule: { width: 0.2, height: 0.6, depth: 0.2 },
    };
    const dimensions: { width: number; height: number; depth: number } = sizes[shape];
    const index: number = this._draft().parts.length;
    const materialSlot: string = Object.keys(this._draft().materials)[0] ?? 'material-1';
    const part: IFurniturePart = createFurniturePart(
      this._blueprintService.generateId(),
      `${this._toTitleCase(shape)} ${index + 1}`,
      shape,
      dimensions,
      { x: (index % 3) * 0.5 - 0.5, y: dimensions.height / 2, z: 0 },
      materialSlot
    );
    this._mutateDraft((blueprint: IFurnitureBlueprint): IFurnitureBlueprint => ({ ...blueprint, parts: [...blueprint.parts, part] }));
    this._selectedPartId.set(part.id);
    this._saveMessage.set(`Added ${part.name}.`);
  }

  public onDuplicatePart(): void {
    const part: IFurniturePart | null = this.selectedPart();
    if (!part) return;
    const mirrorX: boolean = this._mirrorX();
    const mirrorZ: boolean = this._mirrorZ();
    const copy: IFurniturePart = {
      ...part,
      id: this._blueprintService.generateId(),
      name: `${part.name} Copy`,
      dimensions: { ...part.dimensions },
      position: {
        x: mirrorX ? -part.position.x : part.position.x + part.dimensions.width,
        y: part.position.y,
        z: mirrorZ ? -part.position.z : part.position.z,
      },
      rotation: { ...part.rotation, y: mirrorX || mirrorZ ? -part.rotation.y : part.rotation.y },
    };
    this._mutateDraft((blueprint: IFurnitureBlueprint): IFurnitureBlueprint => ({ ...blueprint, parts: [...blueprint.parts, copy] }));
    this._selectedPartId.set(copy.id);
    this._saveMessage.set(mirrorX || mirrorZ ? 'Duplicated with mirror.' : 'Duplicated part.');
  }

  public onDeletePart(id: string): void {
    this._mutateDraft((blueprint: IFurnitureBlueprint): IFurnitureBlueprint => ({
      ...blueprint,
      parts: blueprint.parts.filter((part: IFurniturePart) => part.id !== id),
    }));
    if (this._selectedPartId() === id) this._selectedPartId.set(null);
  }

  public onSelectPart(id: string): void {
    this._selectedPartId.set(id);
  }

  public onPartNameChange(event: Event): void {
    const name: string = this._valueFromEvent(event);
    this._updateSelectedPart((part: IFurniturePart): IFurniturePart => ({ ...part, name }));
  }

  public onPartDimensionChange(field: 'width' | 'height' | 'depth', event: Event): void {
    const value: number = this._numberFromEvent(event);
    if (!Number.isFinite(value) || value <= 0) return;
    this._updateSelectedPart((part: IFurniturePart): IFurniturePart => ({
      ...part,
      dimensions: { ...part.dimensions, [field]: value },
    }));
  }

  public onPartPositionChange(axis: 'x' | 'y' | 'z', event: Event): void {
    const value: number = this._numberFromEvent(event);
    if (!Number.isFinite(value)) return;
    this._updateSelectedPart((part: IFurniturePart): IFurniturePart => ({
      ...part,
      position: { ...part.position, [axis]: value },
    }));
  }

  public onPartRotationChange(axis: 'x' | 'y' | 'z', event: Event): void {
    const value: number = this._numberFromEvent(event);
    if (!Number.isFinite(value)) return;
    this._updateSelectedPart((part: IFurniturePart): IFurniturePart => ({
      ...part,
      rotation: { ...part.rotation, [axis]: value },
    }));
  }

  public onPartMaterialSlotChange(event: Event): void {
    const materialSlot: string = this._valueFromEvent(event);
    this._updateSelectedPart((part: IFurniturePart): IFurniturePart => ({ ...part, materialSlot }));
  }

  public onToggleMirror(axis: 'x' | 'z'): void {
    if (axis === 'x') this._mirrorX.update((value: boolean) => !value);
    else this._mirrorZ.update((value: boolean) => !value);
  }

  public onBlueprintNameChange(event: Event): void {
    this._blueprintName.set(this._valueFromEvent(event));
  }

  public onBlueprintCategoryChange(event: Event): void {
    const category: TFurnitureCategory = this._valueFromEvent(event) as TFurnitureCategory;
    this._blueprintCategory.set(category);
  }

  public onAddMaterialSlot(): void {
    const index: number = Object.keys(this._draft().materials).length + 1;
    const key: string = `material-${index}-${this._blueprintService.generateId().slice(0, 4)}`;
    this._mutateDraft((blueprint: IFurnitureBlueprint): IFurnitureBlueprint => ({
      ...blueprint,
      materials: { ...blueprint.materials, [key]: createFurnitureMaterialSlot(`Material ${index}`, '#8b5a2b', 'satin') },
    }));
  }

  public onRemoveMaterialSlot(key: string): void {
    const remaining: [string, IMaterialSlot][] = Object.entries(this._draft().materials).filter(([slotKey]: [string, IMaterialSlot]) => slotKey !== key);
    if (remaining.length === 0) return;
    const fallbackKey: string = remaining[0][0];
    this._mutateDraft((blueprint: IFurnitureBlueprint): IFurnitureBlueprint => ({
      ...blueprint,
      parts: blueprint.parts.map((part: IFurniturePart) =>
        part.materialSlot === key ? { ...part, materialSlot: fallbackKey } : part
      ),
      materials: Object.fromEntries(remaining),
    }));
  }

  public onMaterialLabelChange(key: string, event: Event): void {
    this._updateMaterial(key, (slot: IMaterialSlot): IMaterialSlot => ({ ...slot, label: this._valueFromEvent(event) }));
  }

  public onMaterialColorChange(key: string, event: Event): void {
    this._updateMaterial(key, (slot: IMaterialSlot): IMaterialSlot => ({ ...slot, color: this._valueFromEvent(event) }));
  }

  public onMaterialFinishChange(key: string, event: Event): void {
    const finish: TMaterialFinish = this._valueFromEvent(event) as TMaterialFinish;
    this._updateMaterial(key, (slot: IMaterialSlot): IMaterialSlot => ({ ...slot, finish }));
  }

  public onSave(): void {
    if (this._isSaving()) return;
    const draft: IFurnitureBlueprint = this._draft();
    if (draft.parts.length === 0) {
      this._saveMessage.set('Add at least one part before saving.');
      return;
    }
    const blueprint: IFurnitureBlueprint = {
      ...draft,
      id: this._blueprintService.generateId(),
      name: this._blueprintName().trim() || 'Untitled Piece',
      category: this._blueprintCategory(),
      isPreset: false,
      thumbnailDataUrl: this._captureThumbnail(),
    };
    this._isSaving.set(true);
    this._saveMessage.set('Saving…');
    this._blueprintService.save(blueprint).subscribe({
      next: (saved: IFurnitureBlueprint): void => {
        this._draft.set(saved);
        this._isSaving.set(false);
        this._saveMessage.set(`“${saved.name}” saved to catalog.`);
      },
      error: (): void => {
        this._isSaving.set(false);
        this._saveMessage.set('Save failed. Is the API server running?');
      },
    });
  }

  public formatNumber(value: number): string {
    return Number.isFinite(value) ? value.toFixed(2) : '0.00';
  }

  private _applyBlueprint(blueprint: IFurnitureBlueprint, name: string): void {
    this._draft.set(blueprint);
    this._blueprintName.set(name);
    this._blueprintCategory.set(blueprint.category);
    this._selectedPartId.set(blueprint.parts.length > 0 ? blueprint.parts[0].id : null);
  }

  private _mutateDraft(mutator: (blueprint: IFurnitureBlueprint) => IFurnitureBlueprint): void {
    this._draft.update(mutator);
    this._saveMessage.set('Unsaved changes');
  }

  private _updateSelectedPart(mutator: (part: IFurniturePart) => IFurniturePart): void {
    const id: string | null = this._selectedPartId();
    if (!id) return;
    this._mutateDraft((blueprint: IFurnitureBlueprint): IFurnitureBlueprint => ({
      ...blueprint,
      parts: blueprint.parts.map((part: IFurniturePart) => (part.id === id ? mutator(part) : part)),
    }));
  }

  private _updateMaterial(key: string, mutator: (slot: IMaterialSlot) => IMaterialSlot): void {
    this._mutateDraft((blueprint: IFurnitureBlueprint): IFurnitureBlueprint => {
      const slot: IMaterialSlot | undefined = blueprint.materials[key];
      if (!slot) return blueprint;
      return { ...blueprint, materials: { ...blueprint.materials, [key]: mutator(slot) } };
    });
  }

  private _valueFromEvent(event: Event): string {
    const target: HTMLInputElement | HTMLSelectElement = event.target as HTMLInputElement | HTMLSelectElement;
    return target.value;
  }

  private _numberFromEvent(event: Event): number {
    const target: HTMLInputElement = event.target as HTMLInputElement;
    return target.valueAsNumber;
  }

  private _toTitleCase(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
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
      disposeObject3D(this._blueprintGroup);
      this._blueprintGroup = undefined;
    }
    this._partMeshes.clear();
    this._disposeSelectionOutline();

    const blueprint: IFurnitureBlueprint = this._draft();
    if (blueprint.parts.length === 0) return;

    const group: THREE.Group = buildFurnitureGroupFromBlueprint(blueprint.parts, blueprint.materials);
    group.updateMatrixWorld(true);
    const bounds: THREE.Box3 = new THREE.Box3().setFromObject(group);
    if (!bounds.isEmpty()) {
      group.position.x = -(bounds.min.x + bounds.max.x) / 2;
      group.position.z = -(bounds.min.z + bounds.max.z) / 2;
    }
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
    const id: string | null = this._selectedPartId();
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
        this._selectedPartId.set(partId);
        return;
      }
    }
    this._selectedPartId.set(null);
  }

  private _captureThumbnail(): string | undefined {
    if (!this._renderer || !this._scene || !this._camera) return undefined;
    this._renderer.render(this._scene, this._camera);
    return this._renderer.domElement.toDataURL('image/png');
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
    if (this._blueprintGroup) disposeObject3D(this._blueprintGroup);
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
