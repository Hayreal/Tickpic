# Desktop-First Project Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor Tickpic into a desktop-first Electron application with stable main/preload/renderer boundaries, explicit desktop contracts, and extracted task/storage capabilities while keeping current behavior broadly stable.

**Architecture:** The refactor proceeds from the desktop kernel outward. First define shared domain and bridge contracts, then modularize the Electron main process, then rewrite the preload and renderer desktop adapter around those contracts, then extract task lifecycle logic from UI flows, and only after that clean up renderer structure. Each phase must leave the app runnable and the desktop data flow intact.

**Tech Stack:** Electron 37, React 19, TypeScript, Vite, Vitest, pnpm

---

## File Structure Plan

### Create

- `src/shared/domain/tasks.ts`
- `src/shared/domain/images.ts`
- `src/shared/domain/settings.ts`
- `src/shared/contracts/desktop.ts`
- `src/shared/view/tasks.ts`
- `src/infrastructure/desktop/desktopBridge.ts`
- `src/infrastructure/desktop/desktopClient.ts`
- `src/features/tasks/taskService.ts`
- `src/features/tasks/taskMappers.ts`
- `electron/main/index.ts`
- `electron/main/app/createMainWindow.ts`
- `electron/main/app/loadRenderer.ts`
- `electron/main/app/startupFallback.ts`
- `electron/main/ipc/registerDesktopHandlers.ts`
- `electron/main/services/storage/storagePaths.ts`
- `electron/main/services/storage/importStorage.ts`
- `electron/main/services/storage/outputStorage.ts`
- `electron/main/services/tasks/taskRepository.ts`
- `electron/main/services/tasks/taskService.ts`
- `electron/main/services/settings/settingsService.ts`
- `electron/main/services/tasks/taskRepository.test.ts`
- `electron/main/services/storage/importStorage.test.ts`
- `electron/main/services/storage/outputStorage.test.ts`
- `src/infrastructure/desktop/desktopClient.test.ts`
- `src/features/tasks/taskService.test.ts`

### Modify

- `README.md`
- `electron/main.ts`
- `electron/preload.ts`
- `src/App.tsx`
- `src/types.ts`
- `src/lib/taskState.ts`
- `src/lib/desktopShell.ts`
- `src/components/StickerGen.tsx`
- `src/components/ProductProcessing.tsx`
- `src/components/Profile.tsx`

### Likely Remove After Migration

- `src/types.ts`
- `src/lib/taskState.ts`
- `src/lib/desktopShell.ts`

## Task 1: Establish Baseline And Correct Project Framing

**Files:**
- Modify: `README.md`
- Test: existing `src/lib/*.test.ts`, `src/components/*.test.ts`

- [ ] **Step 1: Audit the current desktop entry points and scripts**

Run:

```bash
pnpm exec rg -n "desktopShell|ipcMain.handle|ipcRenderer.invoke|tasks:list|save-import-batch|save-task-outputs" src electron
```

Expected:

```text
Results show all current bridge entry points before any refactor.
```

- [ ] **Step 2: Capture the pre-refactor quality baseline**

Run:

```bash
pnpm lint
pnpm test
```

Expected:

```text
Current pass/fail state is recorded before structural changes begin.
```

- [ ] **Step 3: Rewrite README as a desktop-first project document**

Replace the template framing with content shaped like:

```md
# Tickpic

Tickpic is a desktop-first Electron application for local creative workflows.

## Development

1. Install dependencies with `pnpm install`
2. Start renderer dev server with `pnpm dev`
3. Start Electron shell with `pnpm dev:electron`

## Desktop Build

- `pnpm desktop`
- `pnpm dist:win`

## Architecture

- `electron/` contains the desktop shell and local services
- `src/` contains the renderer UI for the desktop app
- local storage is managed by the Electron main process
```

- [ ] **Step 4: Verify the documentation change is accurate**

Run:

```bash
pnpm exec rg -n "AI Studio|npm install|npm run dev|web app" README.md
```

Expected:

```text
No matches.
```

- [ ] **Step 5: Commit the baseline framing update**

Run:

```bash
git add README.md
git commit -m "docs: define desktop-first project framing"
```

## Task 2: Introduce Shared Domain, View, And Desktop Contract Types

**Files:**
- Create: `src/shared/domain/tasks.ts`, `src/shared/domain/images.ts`, `src/shared/domain/settings.ts`, `src/shared/contracts/desktop.ts`, `src/shared/view/tasks.ts`
- Modify: `src/types.ts`, `src/lib/taskState.ts`, `src/lib/desktopShell.ts`, `src/components/Profile.tsx`, `src/App.tsx`
- Test: `src/features/tasks/taskService.test.ts`

- [ ] **Step 1: Write the failing test for task mapping and contract usage**

Create a test shaped like:

```ts
import { describe, expect, it } from 'vitest';
import { toTaskItem } from './taskMappers';
import type { TaskRecord } from '../../shared/domain/tasks';

describe('toTaskItem', () => {
  it('maps a task record into a profile view model', () => {
    const task: TaskRecord = {
      taskId: 'task-1',
      batchId: 'batch-1',
      category: 'sticker',
      feature: '贴纸复刻',
      status: 'Completed',
      imports: [],
      outputs: [{ id: 'o1', fileName: 'a.png', filePath: '/tmp/a.png', fileSize: 1, mimeType: 'image/png', createdAt: '2026-06-03T00:00:00.000Z' }],
      createdAt: '2026-06-03T00:00:00.000Z',
      updatedAt: '2026-06-03T00:00:00.000Z',
    };

    expect(toTaskItem(task)).toEqual({
      id: 'task-1',
      category: 'sticker',
      feature: '贴纸复刻',
      status: 'Completed',
      time: '2026-06-03T00:00:00.000Z',
      batchId: 'batch-1',
      importCount: 0,
      outputCount: 1,
    });
  });
});
```

- [ ] **Step 2: Run the new focused test and confirm failure**

Run:

```bash
pnpm test -- src/features/tasks/taskService.test.ts
```

Expected:

```text
FAIL because the new domain and mapper modules do not exist yet.
```

- [ ] **Step 3: Create domain type modules and desktop contracts**

Create the types with structure like:

```ts
export type TaskStatus = 'Pending' | 'Running' | 'Completed' | 'Failed';

export interface TaskRecord {
  taskId: string;
  batchId: string;
  category: string;
  feature: string;
  status: TaskStatus;
  imports: StoredImageRecord[];
  outputs: StoredImageRecord[];
  createdAt: string;
  updatedAt: string;
}
```

And the contract layer shaped like:

```ts
export interface DesktopBridgeApi {
  platform: string;
  saveImportBatch(request: SaveImportBatchRequest): Promise<ImportBatch>;
  saveTaskOutputs(request: SaveTaskOutputsRequest): Promise<StoredImageRecord[]>;
  createTask(record: TaskRecord): Promise<void>;
  updateTask(record: TaskRecord): Promise<void>;
  listTasks(): Promise<TaskRecord[]>;
}
```

- [ ] **Step 4: Add task view mappers and switch profile usage to view models**

Implement a mapper shaped like:

```ts
import type { TaskRecord } from '../../shared/domain/tasks';
import type { TaskItem } from '../../shared/view/tasks';

export function toTaskItem(task: TaskRecord): TaskItem {
  return {
    id: task.taskId,
    category: task.category,
    feature: task.feature,
    status: task.status,
    time: task.updatedAt,
    batchId: task.batchId,
    importCount: task.imports.length,
    outputCount: task.outputs.length,
  };
}
```

- [ ] **Step 5: Keep legacy exports temporarily to avoid a big-bang migration**

Adjust `src/types.ts` to re-export from the new modules in a compatibility form like:

```ts
export type { TaskRecord, TaskStatus } from './shared/domain/tasks';
export type { ImportBatch, StoredImageRecord } from './shared/domain/images';
export type { AppSettings } from './shared/domain/settings';
export type { TaskItem } from './shared/view/tasks';
```

- [ ] **Step 6: Run the focused tests to confirm the new model layer works**

Run:

```bash
pnpm test -- src/features/tasks/taskService.test.ts
```

Expected:

```text
PASS
```

- [ ] **Step 7: Commit the contract and domain split**

Run:

```bash
git add src/shared src/types.ts src/components/Profile.tsx src/App.tsx
git commit -m "refactor: introduce desktop domain and contract types"
```

## Task 3: Modularize Electron Main Process

**Files:**
- Create: `electron/main/index.ts`, `electron/main/app/createMainWindow.ts`, `electron/main/app/loadRenderer.ts`, `electron/main/app/startupFallback.ts`, `electron/main/ipc/registerDesktopHandlers.ts`, `electron/main/services/storage/storagePaths.ts`, `electron/main/services/storage/importStorage.ts`, `electron/main/services/storage/outputStorage.ts`, `electron/main/services/tasks/taskRepository.ts`, `electron/main/services/tasks/taskService.ts`, `electron/main/services/settings/settingsService.ts`
- Modify: `electron/main.ts`
- Test: `electron/main/services/tasks/taskRepository.test.ts`, `electron/main/services/storage/importStorage.test.ts`, `electron/main/services/storage/outputStorage.test.ts`

- [ ] **Step 1: Write the failing repository test**

Create a test shaped like:

```ts
import { describe, expect, it } from 'vitest';
import { createTaskRepository } from './taskRepository';

describe('taskRepository', () => {
  it('creates an empty tasks file when none exists', () => {
    const repo = createTaskRepository('/tmp/tickpic-test/tasks.json');
    expect(repo.list()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the repository test and confirm failure**

Run:

```bash
pnpm test -- electron/main/services/tasks/taskRepository.test.ts
```

Expected:

```text
FAIL because the repository module does not exist yet.
```

- [ ] **Step 3: Extract storage path helpers**

Create a module shaped like:

```ts
import path from 'node:path';
import { app } from 'electron';

export function getStoragePaths() {
  const storageBase = path.join(app.getPath('userData'), 'storage');
  return {
    storageBase,
    importsDir: path.join(storageBase, 'imports'),
    outputsDir: path.join(storageBase, 'outputs'),
    tasksDir: path.join(storageBase, 'tasks'),
    tasksFile: path.join(storageBase, 'tasks', 'tasks.json'),
  };
}
```

- [ ] **Step 4: Extract import and output storage services**

Implement service signatures shaped like:

```ts
export function createImportStorage(paths: StoragePaths) {
  return {
    saveBatch(payload: SaveImportBatchRequest): ImportBatch {
      // preserve current storage structure
    },
  };
}
```

```ts
export function createOutputStorage(paths: StoragePaths) {
  return {
    saveOutputs(payload: SaveTaskOutputsRequest): StoredImageRecord[] {
      // preserve current storage structure
    },
  };
}
```

- [ ] **Step 5: Extract task repository and task service**

Implement the repository and service boundaries like:

```ts
export function createTaskRepository(tasksFile: string) {
  return {
    list(): TaskRecord[] {
      return [];
    },
    create(record: TaskRecord): void {},
    update(record: TaskRecord): void {},
  };
}
```

```ts
export function createTaskService(repository: TaskRepository) {
  return {
    listTasks: () => repository.list(),
    createTask: (record: TaskRecord) => repository.create(record),
    updateTask: (record: TaskRecord) => repository.update(record),
  };
}
```

- [ ] **Step 6: Extract window creation and renderer loading**

Implement modules shaped like:

```ts
export function createMainWindow() {
  return new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#050505',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
}
```

- [ ] **Step 7: Register IPC handlers in a dedicated module**

Implement a registration module shaped like:

```ts
export function registerDesktopHandlers(deps: {
  importStorage: ReturnType<typeof createImportStorage>;
  outputStorage: ReturnType<typeof createOutputStorage>;
  taskService: ReturnType<typeof createTaskService>;
}) {
  ipcMain.handle('storage:save-import-batch', (_event, payload) => deps.importStorage.saveBatch(payload));
  ipcMain.handle('storage:save-task-outputs', (_event, payload) => deps.outputStorage.saveOutputs(payload));
  ipcMain.handle('tasks:list', () => deps.taskService.listTasks());
  ipcMain.handle('tasks:create', (_event, record) => deps.taskService.createTask(record));
  ipcMain.handle('tasks:update', (_event, record) => deps.taskService.updateTask(record));
}
```

- [ ] **Step 8: Reduce `electron/main.ts` to a thin compatibility entry**

Refactor it into something like:

```ts
import './main/index';
```

- [ ] **Step 9: Run focused main-process tests**

Run:

```bash
pnpm test -- electron/main/services/tasks/taskRepository.test.ts electron/main/services/storage/importStorage.test.ts electron/main/services/storage/outputStorage.test.ts
```

Expected:

```text
PASS
```

- [ ] **Step 10: Commit the modular main-process refactor**

Run:

```bash
git add electron
git commit -m "refactor: modularize electron main process"
```

## Task 4: Replace Loose Preload Exposure With A Typed Desktop Bridge

**Files:**
- Create: `src/infrastructure/desktop/desktopBridge.ts`, `src/infrastructure/desktop/desktopClient.ts`, `src/infrastructure/desktop/desktopClient.test.ts`
- Modify: `electron/preload.ts`, `src/lib/desktopShell.ts`

- [ ] **Step 1: Write the failing desktop client test**

Create a test shaped like:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createDesktopClient } from './desktopClient';

describe('desktopClient', () => {
  it('returns undefined when the desktop bridge is unavailable', () => {
    const client = createDesktopClient(undefined);
    expect(client.isAvailable()).toBe(false);
  });
});
```

- [ ] **Step 2: Run the desktop client test and confirm failure**

Run:

```bash
pnpm test -- src/infrastructure/desktop/desktopClient.test.ts
```

Expected:

```text
FAIL because the adapter modules do not exist yet.
```

- [ ] **Step 3: Create a bridge accessor around the global desktop API**

Implement `desktopBridge.ts` like:

```ts
import type { DesktopBridgeApi } from '../../shared/contracts/desktop';

declare global {
  interface Window {
    desktopShell?: DesktopBridgeApi;
  }
}

export function getDesktopBridge(): DesktopBridgeApi | undefined {
  return typeof window !== 'undefined' ? window.desktopShell : undefined;
}
```

- [ ] **Step 4: Create a renderer desktop client with explicit availability checks**

Implement `desktopClient.ts` like:

```ts
import type { DesktopBridgeApi } from '../../shared/contracts/desktop';

export function createDesktopClient(bridge: DesktopBridgeApi | undefined) {
  return {
    isAvailable: () => Boolean(bridge),
    listTasks: () => bridge?.listTasks() ?? Promise.resolve([]),
    createTask: (record) => bridge ? bridge.createTask(record) : Promise.resolve(),
    updateTask: (record) => bridge ? bridge.updateTask(record) : Promise.resolve(),
    saveImportBatch: (request) => {
      if (!bridge) throw new Error('Desktop bridge unavailable');
      return bridge.saveImportBatch(request);
    },
  };
}
```

- [ ] **Step 5: Update preload to expose the typed bridge directly**

Refactor `electron/preload.ts` toward:

```ts
import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopBridgeApi } from '../src/shared/contracts/desktop';

const desktopShell: DesktopBridgeApi = {
  platform: process.platform,
  saveImportBatch: (payload) => ipcRenderer.invoke('storage:save-import-batch', payload),
  saveTaskOutputs: (payload) => ipcRenderer.invoke('storage:save-task-outputs', payload),
  createTask: (record) => ipcRenderer.invoke('tasks:create', record),
  updateTask: (record) => ipcRenderer.invoke('tasks:update', record),
  listTasks: () => ipcRenderer.invoke('tasks:list'),
};

contextBridge.exposeInMainWorld('desktopShell', desktopShell);
```

- [ ] **Step 6: Replace legacy `src/lib/desktopShell.ts` with a compatibility wrapper**

Keep callers stable with a wrapper like:

```ts
import { createDesktopClient } from '../infrastructure/desktop/desktopClient';
import { getDesktopBridge } from '../infrastructure/desktop/desktopBridge';

export function getDesktopShell() {
  const client = createDesktopClient(getDesktopBridge());
  return client.isAvailable() ? client : undefined;
}
```

- [ ] **Step 7: Run focused bridge tests**

Run:

```bash
pnpm test -- src/infrastructure/desktop/desktopClient.test.ts
```

Expected:

```text
PASS
```

- [ ] **Step 8: Commit the typed bridge migration**

Run:

```bash
git add electron/preload.ts src/infrastructure src/lib/desktopShell.ts
git commit -m "refactor: add typed desktop bridge"
```

## Task 5: Extract A Shared Renderer Task Service

**Files:**
- Create: `src/features/tasks/taskService.ts`, `src/features/tasks/taskMappers.ts`, `src/features/tasks/taskService.test.ts`
- Modify: `src/App.tsx`, `src/lib/taskState.ts`, `src/components/Profile.tsx`

- [ ] **Step 1: Write the failing task service test**

Create a test shaped like:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createRendererTaskService } from './taskService';

describe('renderer task service', () => {
  it('creates a pending task and persists it through the desktop client', async () => {
    const desktop = {
      createTask: vi.fn().mockResolvedValue(undefined),
      updateTask: vi.fn().mockResolvedValue(undefined),
      listTasks: vi.fn().mockResolvedValue([]),
    };

    const service = createRendererTaskService(desktop as never);
    const task = await service.createTask({
      category: 'sticker',
      feature: '贴纸复刻',
      batchId: 'batch-1',
      imports: [],
    });

    expect(task.status).toBe('Pending');
    expect(desktop.createTask).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the task service test and confirm failure**

Run:

```bash
pnpm test -- src/features/tasks/taskService.test.ts
```

Expected:

```text
FAIL because the shared renderer task service does not exist yet.
```

- [ ] **Step 3: Extract renderer task lifecycle orchestration**

Implement the service around the current `taskState` behavior, for example:

```ts
export function createRendererTaskService(desktop: Pick<DesktopBridgeApi, 'createTask' | 'updateTask' | 'listTasks'>) {
  return {
    async createTask(input: CreateTaskInput) {
      const task = createPendingTask(input);
      await desktop.createTask(task);
      return task;
    },
    async startTask(task: TaskRecord) {
      const next = markTaskRunning(task);
      await desktop.updateTask(next);
      return next;
    },
    async completeTask(task: TaskRecord, outputs: StoredImageRecord[]) {
      const next = markTaskCompleted(task, outputs);
      await desktop.updateTask(next);
      return next;
    },
  };
}
```

- [ ] **Step 4: Rename task state helpers to domain-oriented names**

Refactor `src/lib/taskState.ts` toward:

```ts
export const markTaskRunning = startTask;
export const markTaskCompleted = completeTask;
export const markTaskFailed = failTask;
```

Or fully rename the exports and update callers.

- [ ] **Step 5: Move `App` task persistence logic into the new task service**

Refactor `src/App.tsx` so the task orchestration is shaped like:

```ts
const desktop = createDesktopClient(getDesktopBridge());
const taskService = createRendererTaskService(desktop);
```

And use that service instead of calling persistence APIs inline from `App`.

- [ ] **Step 6: Switch `Profile` to consume mapped task view models**

Use the extracted mapper instead of inline object shaping in `App`.

- [ ] **Step 7: Run focused task tests**

Run:

```bash
pnpm test -- src/features/tasks/taskService.test.ts src/lib/taskState.test.ts
```

Expected:

```text
PASS
```

- [ ] **Step 8: Commit the shared task service extraction**

Run:

```bash
git add src/features/tasks src/App.tsx src/lib/taskState.ts src/components/Profile.tsx
git commit -m "refactor: extract shared renderer task service"
```

## Task 6: Slim The App Shell And Reduce Feature Component Responsibility

**Files:**
- Modify: `src/App.tsx`, `src/components/StickerGen.tsx`, `src/components/ProductProcessing.tsx`
- Test: existing component tests plus targeted task-flow tests

- [ ] **Step 1: Write a failing integration-style test around app shell task loading**

Add a test case shaped like:

```ts
it('loads persisted tasks on mount through the desktop client', async () => {
  // render App with a mocked desktop bridge and verify task refresh behavior
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run:

```bash
pnpm test -- src/components/WindowFrame.test.tsx src/components/Sidebar.test.tsx
```

Expected:

```text
Existing tests pass, and the new integration assertion fails until the app shell is simplified.
```

- [ ] **Step 3: Reduce `App` to tab selection, desktop client wiring, and feature composition**

Move it toward a structure like:

```tsx
export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('sticker');
  const desktop = useDesktopClient();
  const tasks = useDesktopTasks(desktop);

  return (
    <WindowFrame title="Tickpic">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <Workspace activeTab={activeTab} desktop={desktop} tasks={tasks} />
    </WindowFrame>
  );
}
```

- [ ] **Step 4: Remove task persistence details from `StickerGen`**

Refactor `StickerGen` so it consumes callbacks or a feature-scoped service rather than directly shaping persistence flow. Aim for seams like:

```ts
interface StickerGenProps {
  taskService: RendererTaskService;
}
```

or equivalent higher-level callbacks.

- [ ] **Step 5: Apply the same reduction to `ProductProcessing`**

Ensure it uses the same renderer task layer rather than owning its own persistence conventions.

- [ ] **Step 6: Run component and feature-flow tests**

Run:

```bash
pnpm test -- src/components/Sidebar.test.tsx src/components/WindowFrame.test.tsx src/features/tasks/taskService.test.ts
```

Expected:

```text
PASS
```

- [ ] **Step 7: Commit the app shell cleanup**

Run:

```bash
git add src/App.tsx src/components/StickerGen.tsx src/components/ProductProcessing.tsx
git commit -m "refactor: slim app shell and feature components"
```

## Task 7: Remove Compatibility Shims And Finalize The Desktop-First Structure

**Files:**
- Modify: `src/types.ts`, `src/lib/taskState.ts`, `src/lib/desktopShell.ts`, `README.md`
- Remove if safe: `src/types.ts`, `src/lib/taskState.ts`, `src/lib/desktopShell.ts`
- Test: full repo test suite

- [ ] **Step 1: Search for remaining legacy entry points**

Run:

```bash
pnpm exec rg -n "from './types'|from '../types'|from './lib/taskState'|from '../lib/taskState'|desktopShell" src electron
```

Expected:

```text
Only intentional compatibility references remain.
```

- [ ] **Step 2: Migrate remaining imports to the new modules**

Use the new import shape consistently, for example:

```ts
import type { TaskRecord } from '../shared/domain/tasks';
import { createRendererTaskService } from '../features/tasks/taskService';
import { createDesktopClient } from '../infrastructure/desktop/desktopClient';
```

- [ ] **Step 3: Remove compatibility files if all callers are migrated**

Delete the legacy modules only after the search is clean.

- [ ] **Step 4: Run static validation on the final structure**

Run:

```bash
pnpm lint
```

Expected:

```text
PASS
```

- [ ] **Step 5: Commit the final structural cleanup**

Run:

```bash
git add -A
git commit -m "refactor: finalize desktop-first application structure"
```

## Task 8: Verify Desktop Behavior End To End

**Files:**
- No new source files required
- Verify against: `electron/`, `src/`, `README.md`

- [ ] **Step 1: Run the full automated suite**

Run:

```bash
pnpm lint
pnpm test
```

Expected:

```text
PASS
```

- [ ] **Step 2: Build both renderer and Electron main**

Run:

```bash
pnpm build
pnpm build:electron
```

Expected:

```text
PASS
```

- [ ] **Step 3: Launch the desktop app and perform a smoke test**

Run:

```bash
pnpm desktop
```

Expected:

```text
Electron launches successfully.
```

Then manually verify:

```text
1. Import at least one image into a sticker flow.
2. Confirm a task record appears in the profile/history area.
3. Confirm generated output records are written through the desktop flow.
4. Restart the app and confirm persisted tasks are still listed.
```

- [ ] **Step 4: Capture final repository status**

Run:

```bash
git status --short
```

Expected:

```text
No unexpected untracked or modified files remain after verification, aside from intentional work not yet committed.
```

- [ ] **Step 5: Prepare handoff summary**

Document:

```text
- what moved
- what stayed behaviorally the same
- what compatibility shims were removed
- what manual smoke test results were observed
```

## Self-Review Checklist

- [ ] Every task preserves a runnable application state before moving on.
- [ ] Desktop-first architecture remains the scope anchor; do not drift into web-first abstractions.
- [ ] Contract types are introduced before preload/main/renderer implementation divergence.
- [ ] Task orchestration is extracted before large-scale UI cleanup.
- [ ] Legacy compatibility files are removed only after import search confirms migration.
