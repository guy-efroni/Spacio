# SpacioClient

An Angular 22 standalone 3D interior design studio frontend powered by Three.js.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Architecture

### Directory layout

- `src/app/core/` — Singleton services (WebSocket client, camera orchestration, authentication, global app state).
- `src/app/shared/` — Reusable UI controls, 3D math utilities, shared interfaces, standalone pipes/directives.
- `src/app/features/` — Isolated domain modules (`viewport`, `blueprint-editor`, `room-walkthrough`).

### Viewport & wall drawing

`ViewportComponent` manages the WebGL scene, `OrbitControls`, the grid floor, and reactive wall rendering via `WallExtruder`.

**Wall drawing workflow:**
1. Enter "Add Wall" mode.
2. **First click** — sets a snapped start point on the floor plane (0.5 grid snapping) and spawns a **ghost wall preview mesh** (`THREE.Mesh` with a semi-transparent indigo material, `opacity: 0.4`, color `0x818cf8`).
3. **Pointer move** — the ghost mesh follows the cursor in real time, regenerating its `BoxGeometry` to reflect the current length, angle, and midpoint.
4. **Second click** — commits the wall to `FloorplanService` and removes the ghost mesh.
5. **Escape** — cancels drawing and disposes the ghost mesh.

The ghost mesh is added to the scene on the first click and removed/disposed on commit, cancel, tool toggle, or component destruction.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.