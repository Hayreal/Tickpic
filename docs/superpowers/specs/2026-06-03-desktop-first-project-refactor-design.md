# Tickpic Desktop-First Project Refactor Design

## Summary

This change refactors Tickpic into a desktop-first application architecture. The product target is the Electron desktop app, not a web application wrapped by Electron. The renderer remains in React, but only as the desktop interface layer. Core responsibilities move toward a stable desktop kernel built around Electron `main`, a controlled `preload` bridge, and explicit local application services for imports, tasks, outputs, and settings.

The refactor is intentionally low-risk in behavior. Existing user-visible flows should remain functionally equivalent wherever possible. The main objective is to reduce structural coupling, define stable contracts, and make future iteration on desktop workflows easier and safer.

## Goals

- Reorient the project from web-first structure to desktop-first structure.
- Split the current Electron main process into clear modules with explicit responsibilities.
- Define stable contracts for desktop bridge APIs between `main`, `preload`, and `renderer`.
- Extract task, import, output, and settings capabilities into application services instead of embedding them in UI flows.
- Reduce renderer responsibility to desktop UI composition, input collection, and state presentation.
- Keep current behavior broadly stable while improving maintainability and testability.

## Non-Goals

- No migration to a multi-package workspace.
- No replacement of React as the renderer technology.
- No product redesign or major UX rewrite.
- No broad feature expansion during the refactor.
- No backend or cloud architecture work; storage remains local and desktop-scoped.

## Current Problems

### 1. Main Process Is Overloaded

`electron/main.ts` currently mixes:

- window creation
- renderer loading and startup fallback behavior
- file storage for imports and outputs
- task persistence in JSON
- IPC handler registration

This makes the desktop kernel hard to reason about and risky to extend.

### 2. Desktop Bridge Has Weak Contracts

`electron/preload.ts` exposes a loose `window.desktopShell` object, and `src/lib/desktopShell.ts` consumes it with thin type boundaries. IPC channels and payloads are aligned by convention rather than by shared contracts. This creates runtime failure risk during refactors.

### 3. UI Owns Too Much Application Logic

`src/App.tsx` and feature components currently coordinate task creation, task updates, persistence calls, and feature flow behavior directly. This couples desktop capabilities to screen-level implementation details.

### 4. Feature Components Are Too Large

Components such as `src/components/StickerGen.tsx` mix:

- UI rendering
- form state
- generation progress state
- task lifecycle transitions
- result shaping

This makes testing and change isolation difficult.

### 5. Project Framing Is Inconsistent

The repository still contains web-template residue such as the current `README.md`. That creates ambiguity around the real target platform and encourages the wrong architectural decisions.

## Target Architecture

The refactor adopts a desktop-first three-layer model:

### 1. Main Process

Owns:

- app lifecycle
- window lifecycle
- filesystem access
- local persistence
- task-oriented desktop services
- IPC handler registration

This is the desktop kernel.

### 2. Preload Bridge

Owns:

- the controlled capability boundary exposed to the renderer
- typed request and response contracts for desktop operations
- Electron-safe API adaptation

This is the stable ABI between desktop kernel and renderer.

### 3. Renderer

Owns:

- desktop UI composition
- user input collection
- transient interaction state
- rendering of task status and results

The renderer does not own storage implementation, IPC details, or task persistence mechanics.

## Module Design

### Electron Main Structure

Recommended structure:

```text
electron/
  main/
    index.ts
    app/
      createMainWindow.ts
      loadRenderer.ts
      startupFallback.ts
    ipc/
      registerDesktopHandlers.ts
    services/
      settings/
        settingsService.ts
      storage/
        importStorage.ts
        outputStorage.ts
        storagePaths.ts
      tasks/
        taskRepository.ts
        taskService.ts
```

Responsibilities:

- `createMainWindow.ts`: browser window configuration
- `loadRenderer.ts`: dev/build renderer loading policy
- `startupFallback.ts`: startup error or unavailable-renderer fallback content
- `registerDesktopHandlers.ts`: IPC registration only
- `taskRepository.ts`: `tasks.json` read/write behavior
- `taskService.ts`: task lifecycle persistence use cases
- `importStorage.ts`: imported image batch storage
- `outputStorage.ts`: generated output storage
- `storagePaths.ts`: shared path conventions rooted in Electron user data

### Bridge Contracts

Recommended structure:

```text
src/shared/
  contracts/
    desktop.ts
  domain/
    tasks.ts
    images.ts
    settings.ts
```

The desktop contract should explicitly define:

- supported channels or API methods
- request payloads
- response payloads
- constrained literal types for pages and features where appropriate

The renderer, preload, and main process should all depend on the same contract definitions.

### Renderer Structure

Recommended structure:

```text
src/
  app/
    App.tsx
  features/
    product/
    sticker/
    tasks/
    settings/
  infrastructure/
    desktop/
      desktopBridge.ts
      desktopClient.ts
  shared/
    ui/
    lib/
```

Renderer goals:

- `app/App.tsx` becomes a thin composition root
- desktop API consumption is routed through a single adapter layer
- feature modules own local UI state only
- task lifecycle orchestration is routed through shared task use cases instead of embedded directly in screens

## Capability Model

The desktop app should treat these as first-class application capabilities:

- import image batch
- save task outputs
- create task record
- update task record
- list task records
- load and persist settings

Each capability should exist as an explicit desktop use case. UI components call use cases; use cases call bridge clients; bridge clients call desktop handlers.

## Task System Design

Task handling should become a horizontal capability rather than a page-specific concern.

Task system responsibilities:

- create pending tasks
- transition tasks to running/completed/failed
- persist task state consistently
- provide task queries for profile/history views
- map storage records to view-friendly summaries where needed

This work should consolidate logic currently split across:

- `src/App.tsx`
- `src/lib/taskState.ts`
- feature components that directly manage task updates

The task domain model remains stable, but task view models should be separated from storage records.

## Migration Strategy

The refactor should proceed in the following order.

### Phase 0: Baseline

- inventory current desktop capabilities, storage paths, and IPC channels
- identify existing tests and missing critical coverage
- rewrite project documentation to state desktop-first intent

### Phase 1: Contracts And Domain

- split domain models from view models and bridge contracts
- introduce shared desktop contract definitions
- migrate existing type usage to the new structure without changing behavior

### Phase 2: Main Process Refactor

- split `electron/main.ts` into app, IPC, storage, and task service modules
- preserve current runtime behavior
- add tests around storage and repository behavior

### Phase 3: Preload And Desktop Adapter

- replace loose bridge exposure with explicit typed APIs
- centralize renderer desktop access through a single adapter
- eliminate `unknown`-style contract boundaries

### Phase 4: Task System Extraction

- move task lifecycle orchestration out of `App` and feature components
- create shared task use cases for create, update, complete, fail, and list
- update profile/history flows to consume the new task layer

### Phase 5: Renderer Cleanup

- slim `App` into an application shell
- split oversized components such as `StickerGen` and `ProductProcessing`
- keep renderer focused on interaction and presentation

### Phase 6: Integration Cleanup

- remove transitional code and duplicate types
- unify naming and directory conventions
- finalize docs and developer-facing guidance

### Phase 7: Verification

- run `pnpm lint`
- run `pnpm test`
- perform a real desktop smoke test
- verify import, task persistence, output persistence, and profile/history behavior

## Risks And Mitigations

### Risk 1: Runtime Contract Breakage

Changes to bridge payloads can silently break desktop behavior.

Mitigation:

- create shared contract definitions before implementation changes
- migrate preload, main, and renderer against the same types
- add focused tests for desktop bridge boundaries

### Risk 2: Storage Behavior Drift

Splitting `main.ts` can change path handling or persistence timing.

Mitigation:

- preserve current path conventions during early phases
- add repository and storage tests before broader cleanup
- defer structural path changes until behavior is covered

### Risk 3: UI And Desktop Logic Stay Coupled

File moves alone will not improve architecture if feature components still orchestrate desktop services directly.

Mitigation:

- require explicit application service boundaries for tasks, imports, outputs, and settings
- keep renderer modules dependent on adapters or use cases, not Electron details

### Risk 4: Refactor Stops Midway

The repository may temporarily contain both old and new structures.

Mitigation:

- phase the refactor so each phase leaves the app runnable
- clean transitional code at the end of each completed slice
- verify desktop startup repeatedly instead of waiting until the end

## Acceptance Criteria

The refactor is complete when all of the following are true:

- `electron/main.ts` is replaced by a modular main-process structure with separated window, IPC, storage, and task responsibilities.
- `preload` exposes a stable typed desktop API rather than a loose object boundary.
- renderer desktop access is centralized in a single adapter layer.
- imports, tasks, outputs, and settings are explicit application capabilities.
- `App` no longer directly owns desktop persistence orchestration.
- large feature components are reduced to clearer UI/state boundaries.
- `README.md` and startup guidance describe the project as a desktop-first application.
- `pnpm lint` passes.
- `pnpm test` passes.
- a real Electron startup smoke test confirms import, task, output, and history flows still work.

## Testing Strategy

Prioritized test coverage:

- pure task lifecycle logic
- task repository read/write behavior
- import/output storage services
- desktop bridge adapter behavior
- targeted feature-flow tests around task creation and result completion

This refactor should not begin with broad UI snapshot testing. The first priority is to protect desktop behavior and storage contracts.

## Open Decisions Already Resolved

The following constraints were confirmed during design:

- product target is desktop-first, not web-first
- renderer remains, but only as the desktop UI layer
- architecture scope is a moderate refactor, not a workspace migration
- risk tolerance is low; visible behavior should remain broadly stable

## Final Recommendation

Proceed with a desktop-first moderate refactor that stabilizes Electron responsibilities and capability boundaries before cleaning up renderer structure. This yields the best tradeoff between maintainability gain and behavior risk for the current codebase.
