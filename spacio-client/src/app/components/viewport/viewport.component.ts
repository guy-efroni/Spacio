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
  template: `
    <div #container class="viewport-container">
      <canvas #canvas></canvas>
    </div>
  `,
  styles: [
    `
      .viewport-container {
        width: 100%;
        height: 100vh;
        overflow: hidden;
        position: relative;
      }

      .viewport-container canvas {
        display: block;
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class ViewportComponent implements AfterViewInit, OnDestroy {
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly containerRef = viewChild.required<HTMLElement>('container');
  protected readonly canvasRef = viewChild.required<HTMLCanvasElement>('canvas');

  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private animationFrameId?: number;
  private resizeObserver?: ResizeObserver;

  ngAfterViewInit(): void {
    afterNextRender(() => {
      this.initializeThreeJS();
      this.startAnimationLoop();
      this.setupResizeObserver();
    });
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private initializeThreeJS(): void {
    const canvas = this.canvasRef();
    const container = this.containerRef();

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    this.camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(5, 3, 8);
    this.camera.lookAt(0, 0, 0);

    this.setupScene();

    this.destroyRef.onDestroy(() => this.cleanup());
  }

  private setupScene(): void {
    if (!this.scene) return;

    const gridHelper = new THREE.GridHelper(20, 40, 0x3d3d5c, 0x2a2a4a);
    this.scene.add(gridHelper);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
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
    this.scene.add(directionalLight);

    const testGeometry = new THREE.BoxGeometry(1, 1, 1);
    const testMaterial = new THREE.MeshStandardMaterial({
      color: 0x6366f1,
      roughness: 0.3,
      metalness: 0.1,
    });
    const testMesh = new THREE.Mesh(testGeometry, testMaterial);
    testMesh.position.set(0, 0.5, 0);
    testMesh.castShadow = true;
    testMesh.receiveShadow = true;
    this.scene.add(testMesh);

    const planeGeometry = new THREE.PlaneGeometry(20, 20);
    const planeMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e1e3a,
      roughness: 0.8,
      metalness: 0.0,
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0;
    plane.receiveShadow = true;
    this.scene.add(plane);
  }

  private startAnimationLoop(): void {
    this.ngZone.runOutsideAngular(() => {
      const animate = (): void => {
        this.animationFrameId = requestAnimationFrame(animate);
        this.render();
      };
      animate();
    });
  }

  private render(): void {
    if (!this.renderer || !this.scene || !this.camera) return;

    this.renderer.render(this.scene, this.camera);
  }

  private setupResizeObserver(): void {
    const container = this.containerRef();

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          this.onResize(width, height);
        }
      }
    });

    this.resizeObserver.observe(container);
  }

  private onResize(width: number, height: number): void {
    if (!this.renderer || !this.camera) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private cleanup(): void {
    if (this.animationFrameId !== undefined) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      const gl = this.renderer.getContext() as WebGLRenderingContext | null;
      if (gl) {
        const extension = gl.getExtension('WEBGL_lose_context');
        extension?.loseContext();
      }
      this.renderer = undefined;
    }

    if (this.scene) {
      this.scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry?.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material?.dispose();
          }
        }
      });
      this.scene.clear();
      this.scene = undefined;
    }

    this.camera = undefined;
  }
}