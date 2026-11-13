# SpacioServer

A NestJS 12 backend for the Spacio 3D interior design studio. Provides a Socket.io gateway for multi-user scene state, cursor/presence sync, and room locking, backed by Redis pub/sub for stateless deployment.

## Project setup

```bash
npm install
```

## Compile and run the project

```bash
# development
npm run start

# watch mode
npm run start:dev

# production mode
npm run start:prod
```

## Run tests

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e

# test coverage
npm run test:cov
```

## Architecture

### Directory layout

- `src/core/` — Global configurations, database providers, and Redis Pub/Sub adapters.
- `src/shared/` — Shared DTOs, domain interfaces, custom decorators, and global filters/guards.
- `src/gateway/` — Socket.io gateway handlers for multi-user scene state, cursor/presence sync, and room locking.
- `src/modules/` — Feature modules (`spatial-parser`, `room-persistence`, `ai-generator`).

### Standards

- All WebSocket payloads and REST requests are validated with `class-validator` / `class-transformer` decorated DTOs.
- Socket.io event listener methods delegate transformation, spatial validation, and state persistence to injected domain services.
- Server memory is kept lean and stateless to support deployment on Render free-tier infrastructure using Redis for room state distribution.

## Deployment

When you're ready to deploy the NestJS application to production, there are several key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.