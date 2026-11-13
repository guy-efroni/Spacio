# Spacio

AI-powered, real-time collaborative 3D interior design studio in the browser.

Built with **Angular 22**, **Three.js**, **NestJS 12**, and **Socket.io** for multi-user scene synchronization via Redis pub/sub.

## Architecture

```
spacio-client/     Angular 22 standalone frontend + Three.js WebGL studio
spacio-server/     NestJS 12 backend + Socket.io gateway + Redis pub/sub
packages/shared-types/  Shared TypeScript interfaces and domain constants
```

### Client (`spacio-client/`)

- Standalone Angular 22 components (no Angular modules).
- Reactive state via Angular Signals; RxJS reserved for HTTP and WebSocket streams.
- Three.js render loop runs outside Angular's zone via `NgZone.runOutsideAngular()`.
- `ViewportComponent` hosts the WebGL canvas, `OrbitControls`, grid floor, and wall management.
- Wall drawing workflow: single-click sets a start point, a **ghost wall preview mesh** (semi-transparent indigo, `opacity: 0.4`) follows the cursor in real time, second click commits the wall.
- Double-click a wall mesh to select it; Delete/Backspace to remove.

### Server (`spacio-server/`)

- NestJS 12 with `class-validator` / `class-transformer` DTOs for WebSocket payloads.
- Socket.io gateway handles multi-user scene state, cursor/presence sync, and room locking.
- Stateless server design backed by Redis for room state distribution.

## Getting Started

```bash
# Install workspace dependencies
npm install

# Start the client
cd spacio-client && ng serve

# Start the server
cd spacio-server && npm run start:dev
```