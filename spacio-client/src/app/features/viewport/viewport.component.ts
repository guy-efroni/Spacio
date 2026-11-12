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
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { IWallSegment } from '@spacio/shared-types';
import { WallExtruder } from '../../shared/utils/wall-extruder.util';
import { FloorplanService } from '../../core/services/floorplan.service';

const WALL_HEIGHT = 3;
const WALL_THICKNESS = 0.2;
const GRID_SNAP = 0.5;

@Component({
  selector: 'app-viewport',
  standalone: true,
  templateUrl: './viewport.component.html',
  styleUrl: './viewport.component.scss',
})
export class ViewportComponent implements OnDestroy {
  private readonly _elementRef: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly _ngZone: NgZone = inject(NgZone);
  protected readonly floorplanService: FloorplanService = inject(FloorplanService);
  protected readonly isDrawingMode: WritableSignal<boolean> = signal<boolean>(false);

  private _renderer?: THREE.WebGLRenderer;
  private _scene?: THREE.Scene;
  private _camera?: THREE.PerspectiveCamera;
  private _controls?: OrbitControls;
  private _animationFrameId?: number;
  private _resizeObserver?: ResizeObserver;
  private readonly _wallsGroup: THREE.Group = new THREE.Group();

  private readonly _raycaster: THREE.Raycaster = new THREE.Raycaster();
  private readonly _mouse: THREE.Vector2 = new THREE.Vector2();
  private readonly _floorPlane: THREE.Plane = new THREE.Plane(
    new THREE.Vector3(0, 1, 0),
    0
  );
  private readonly _intersectionPoint: THREE.Vector3 = new THREE.Vector3();

  private _drawingStartPoint: { x: number; y: number } | null = null;
  private _previewLine?: THREE.Line;
  private _previewGeometry?: THREE.BufferGeometry;
  private _previewMaterial?: THREE.LineBasicMaterial;

  private readonly _onPointerDown: (event: PointerEvent) => void = (
    event: PointerEvent
  ) => this._handlePointerDown(event);
  private readonly _onPointerMove: (event: PointerEvent) => void = (
    event: PointerEvent
  ) => this._handlePointerMove(event);
  private readonly _onKeyDown: (event: KeyboardEvent) => void = (
    event: KeyboardEvent
  ) => this._handleKeyDown(event);

  constructor() {
    this._wallsGroup.name = 'walls-root';
    effect(() => {
      const walls: readonly IWallSegment[] = this.floorplanService.walls();
      if (!this._scene || !this._wallsGroup) return;
      this._syncWalls(walls);
    });

    afterNextRender(() => {
      this._initializeThreeJS();
      this._startAnimationLoop();
      this._setupResizeObserver();
      this._syncWalls(this.floorplanService.walls());
    });
  }

  protected _onAddInteriorWall(): void {
    this.isDrawingMode.set(true);
    this._drawingStartPoint = null;
    this._hidePreviewLine();
  }

  protected _onRemoveLastWall(): void {
    this.floorplanService.removeLastWall();
  }

  protected _onResetRoom(): void {
    this._cancelDrawing();
    this.floorplanService.resetToDefaultRoom();
  }

  ngOnDestroy(): void {
    this._cleanup();
  }

  private _initializeThreeJS(): void {
    const hostElement: HTMLElement = this._elementRef.nativeElement;
    const container: HTMLElement = hostElement.querySelector('.viewport-container')!;

    this._renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });

    container.appendChild(this._renderer.domElement);
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const initialWidth: number =
      hostElement.clientWidth > 0 ? hostElement.clientWidth : window.innerWidth;
    const initialHeight: number =
      hostElement.clientHeight > 0 ? hostElement.clientHeight : window.innerHeight - 48;

    this._renderer.setSize(initialWidth, initialHeight);
    this._renderer.shadowMap.enabled = true;
    this._renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this._renderer.outputColorSpace = THREE.SRGBColorSpace;
    this._renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this._renderer.toneMappingExposure = 1.0;

    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(0x1a1a2e);

    this._camera = new THREE.PerspectiveCamera(
      50,
      initialWidth / initialHeight,
      0.1,
      1000
    );
    this._camera.position.set(5, 3, 8);
    this._camera.lookAt(0, 0, 0);

    this._controls = new OrbitControls(this._camera, this._renderer.domElement);
    this._controls.enableDamping = true;
    this._controls.dampingFactor = 0.05;
    this._controls.maxPolarAngle = Math.PI / 2 - 0.01;
    this._controls.minDistance = 2;
    this._controls.maxDistance = 50;

    this._setupScene();
    this._setupInteractions();
  }

  private _setupScene(): void {
    if (!this._scene) return;

    const gridHelper: THREE.GridHelper = new THREE.GridHelper(20, 40, 0x3d3d5c, 0x2a2a4a);
    this._scene.add(gridHelper);

    const ambientLight: THREE.AmbientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this._scene.add(ambientLight);

    const directionalLight: THREE.DirectionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -15;
    directionalLight.shadow.camera.right = 15;
    directionalLight.shadow.camera.top = 15;
    directionalLight.shadow.camera.bottom = -15;
    directionalLight.shadow.bias = -0.0005;
    this._scene.add(directionalLight);

    const planeGeometry: THREE.PlaneGeometry = new THREE.PlaneGeometry(20, 20);
    const planeMaterial: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e1e3a,
      roughness: 0.8,
      metalness: 0.0,
    });
    const plane: THREE.Mesh = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0;
    plane.receiveShadow = true;
    this._scene.add(plane);

    this._scene.add(this._wallsGroup);
    this._setupPreviewLine();
    this._syncWalls(this.floorplanService.walls());
  }

  private _setupPreviewLine(): void {
    if (!this._scene) return;
    this._previewGeometry = new THREE.BufferGeometry();
    this._previewGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(6), 3)
    );
    this._previewMaterial = new THREE.LineBasicMaterial({
      color: 0x7aa2ff,
      transparent: true,
      opacity: 0.9,
    });
    this._previewLine = new THREE.Line(this._previewGeometry, this._previewMaterial);
    this._previewLine.visible = false;
    this._previewLine.name = 'wall-preview';
    this._scene.add(this._previewLine);
  }

  private _setupInteractions(): void {
    if (!this._renderer) return;
    const canvas: HTMLCanvasElement = this._renderer.domElement;
    canvas.addEventListener('pointerdown', this._onPointerDown);
    canvas.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('keydown', this._onKeyDown);
  }

  private _handlePointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    if (!this.isDrawingMode()) return;

    const point: { x: number; y: number } | null = this._getSnappedFloorPoint(event);
    if (!point) return;

    if (!this._drawingStartPoint) {
      this._drawingStartPoint = point;
      this._updatePreviewLine(point, point);
      return;
    }

    const start: { x: number; y: number } = this._drawingStartPoint;
    const end: { x: number; y: number } = point;
    const isZeroLength: boolean =
      Math.abs(start.x - end.x) < 0.0001 && Math.abs(start.y - end.y) < 0.0001;
    if (!isZeroLength) {
      const wall: IWallSegment = {
        id: this._generateWallId(),
        start,
        end,
        height: WALL_HEIGHT,
        thickness: WALL_THICKNESS,
      };
      this.floorplanService.addWall(wall);
    }

    this._finishDrawing();
  }

  private _handlePointerMove(event: PointerEvent): void {
    if (!this.isDrawingMode() || !this._drawingStartPoint) return;
    const point: { x: number; y: number } | null = this._getSnappedFloorPoint(event);
    if (!point) return;
    this._updatePreviewLine(this._drawingStartPoint, point);
  }

  private _handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isDrawingMode()) {
      this._cancelDrawing();
    }
  }

  private _finishDrawing(): void {
    this._drawingStartPoint = null;
    this._hidePreviewLine();
    this.isDrawingMode.set(false);
  }

  private _cancelDrawing(): void {
    this._drawingStartPoint = null;
    this._hidePreviewLine();
    this.isDrawingMode.set(false);
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
    return Math.round(value / GRID_SNAP) * GRID_SNAP;
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
    array[1] = 0.02;
    array[2] = start.y;
    array[3] = end.x;
    array[4] = 0.02;
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

  private _generateWallId(): string {
    return `wall-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  private _syncWalls(walls: ReadonlyArray<IWallSegment>): void {
    if (!this._wallsGroup) return;
    this._disposeWallsGroup();

    const wallsMesh: THREE.Group = WallExtruder.createWallsMesh(walls);
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
