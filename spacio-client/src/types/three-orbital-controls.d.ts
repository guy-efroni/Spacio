declare module 'three/examples/jsm/controls/OrbitControls' {
  import { Camera, EventDispatcher } from 'three';
  import { IOrbitControlsEventMap } from './IOrbitControlsEventMap';

  export class OrbitControls extends EventDispatcher<IOrbitControlsEventMap> {
    constructor(object: Camera, domElement?: HTMLElement);

    object: Camera;
    domElement: HTMLElement | Document;

    enabled: boolean;
    enableDamping: boolean;
    dampingFactor: number;

    minDistance: number;
    maxDistance: number;

    minPolarAngle: number;
    maxPolarAngle: number;

    minAzimuthAngle: number;
    maxAzimuthAngle: number;

    enableZoom: boolean;
    zoomSpeed: number;

    enableRotate: boolean;
    rotateSpeed: number;

    enablePan: boolean;
    panSpeed: number;
    screenSpacePanning: boolean;

    keyPanSpeed: number;

    autoRotate: boolean;
    autoRotateSpeed: number;

    enableKeys: boolean;
    keys: { LEFT: number; UP: number; RIGHT: number; BOTTOM: number };

    mouseButtons: { LEFT: number; MIDDLE: number; RIGHT: number };
    touches: { ONE: number; TWO: number };

    update(deltaTime?: number | null): boolean;
    reset(): void;
    dispose(): void;
    saveState(): void;

    connect(): void;
    disconnect(): void;

    addEventListener(type: string, listener: (event: any) => void): void;
    removeEventListener(type: string, listener: (event: any) => void): void;
    dispatchEvent(event: { type: string; [key: string]: any }): void;
  }
}
