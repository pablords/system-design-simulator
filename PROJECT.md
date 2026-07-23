# Project: System Design Simulator

## Architecture
- **Monorepo Structure**: Turborepo + npm workspaces
- **Shared (`packages/shared`)**: Pure TS simulation engine (DDD, Little's Law, CQRS, Circuit Breakers), Zod schemas, calculations. No DOM/UI or HTTP server dependencies.
- **Backend API (`packages/api`)**: Node.js 24 + Hono framework + Drizzle ORM + PostgreSQL + SSE stream endpoints + JWT auth.
- **Frontend (`packages/web`)**: React 19 + Vite + React Flow (@xyflow/react) + Zustand + Recharts + Framer Motion.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Codebase Investigation & Monorepo Audit | Inspect all packages, build system, test suites, and lint compliance | none | DONE |
| 2 | Engine & Shared Package Hardening | Implement Zod schemas in `packages/shared/src/schemas`, write 100% `CapacityCore` & >80% `SimulationCore` tests | M1 | DONE |
| 3 | API Backend & SSE Service Hardening | Refactor `routes/auth.ts` DIP, remove `as any`, generate migrations, SSE stream & route tests | M1, M2 | DONE |
| 4 | Frontend Canvas & Bundle Optimization | Add Vite `manualChunks` code-splitting, write Zustand store unit & component tests | M1, M2 | DONE |
| 5 | Dual Track E2E Testing & Forensic Audit | Run multi-tier E2E test suite, white-box adversarial verification, and Forensic Audit | M2, M3, M4 | DONE |

## Interface Contracts
### `@system-design/shared` ↔ `@system-design/api`
- Shared Zod schemas for system design components, simulation configs, user payload validation.
- Type exports consumed directly by Hono route handlers.

### `@system-design/shared` ↔ `@system-design/web`
- Simulation engine execution & metrics calculation running local-first in frontend as fallback or direct engine mode.
- Shared canvas component definitions & node/edge types.

### `@system-design/api` ↔ `@system-design/web`
- REST endpoints: Auth (`/api/auth/*`), Projects CRUD (`/api/projects/*`), Simulation SSE stream (`/api/simulation/stream`).

## Code Layout
- `packages/shared/src/engine/`: Deterministic simulation engine
- `packages/shared/src/schemas/`: Zod schemas for nodes, edges, configs
- `packages/shared/src/types.ts`: Core domain TypeScript interfaces
- `packages/api/src/routes/`: Hono HTTP route handlers
- `packages/api/src/services/`: Backend business logic
- `packages/api/src/db/`: Drizzle ORM schemas & database client
- `packages/web/src/components/`: React UI components & React Flow canvas
- `packages/web/src/store/`: Zustand state management store
