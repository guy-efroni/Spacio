import {
  AfterViewInit,
  Component,
  DestroyRef,
  NgZone,
  OnDestroy,
  Signal,
  ViewChild,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';
import * as THREE from 'three';

@Component({
  selector: 'app-viewport',
  standalone: true,
  templateUrl: './viewport.component.html',
  styleUrl: './viewport.component.scss',
})
export class ViewportComponent implements AfterViewInit, OnDestroy {
  private readonly _ngZone: NgZone = inject(NgZone);
  private readonly _destroyRef: DestroyRef = inject(DestroyRef);

  protected readonly containerRef: Signal<HTMLElement> = viewChild.required<HTMLElement>('container');
  protected readonly canvasRef: Signal<HTMLCanvasElement> = viewChild.required<HTMLCanvasElement>('canvas');

  private _renderer?: THREE.WebGLRenderer;
  private _scene?: THREE.Scene;
  private _camera?: THREE.PerspectiveCamera;
  private _animationFrameId?: number;
  private _resizeObserver?: ResizeObserver;

  ngAfterViewInit(): void {
    afterNextRender(() => {
      this._initializeThreeJS();
      this._startAnimationLoop();
      this._setupResizeObserver();
    });
  }

  ngOnDestroy(): void {
    this._cleanup();
  }

  private _initializeThreeJS(): void {
    const canvas: HTMLCanvasElement = this.canvasRef();
    const container: HTMLElement = this.containerRef();

    this._renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });

    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.setSize(container.clientWidth, container.clientHeight);
    this._renderer.shadowMap.enabled = true;
    this._renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this._renderer.outputColorSpace = THREE.SRGBColorSpace;
    this._renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this._renderer.toneMappingExposure = 1.0;

    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(0x1a1a2e);

    this._camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this._camera.position.set(5, 3, 8);
    this._camera.lookAt(0, 0, 0);

    this._setupScene();

    this._destroyRef.onDestroy(() => this._cleanup());
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

    const testGeometry: THREE.BoxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const testMaterial: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
      color: 0x6366f1,
      roughness: 0.3,
      metalness: 0.1,
    });
    const testMesh: THREE.Mesh = new THREE.Mesh(testGeometry, testMaterial);
    testMesh.position.set(0, 0.5, 0);
    testMesh.castShadow = true;
    testMesh.receiveShadow = true;
    this._scene.add(testMesh);

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

    this._renderer.render(this._scene, this._camera);
  }

  private _setupResizeObserver(): void {
    const container: HTMLElement = this.containerRef();

    this._resizeObserver = new ResizeObserver((entries: ResizeObserverEntry[]) => {
      for (const entry of entries) {
        const { width, height }: { width: number; height: number } = entry.contentRect;
        if (width > 0 && height > 0) {
          this._onResize(width, height);
        }
      }
    });

    this._resizeObserver.observe(container);
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

    this._camera = undefined;
  }
}
