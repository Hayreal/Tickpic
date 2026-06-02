---
archived-with: 2026-06-02-batch-image-import-tasks
status: final
---
# Batch Image Import Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build batch image import, local batch storage, and persisted generation task tracking across all upload surfaces.

**Architecture:** Add a small Electron storage bridge for imports, outputs, and task persistence; define shared renderer-side types for batches and tasks; then replace per-component single-image upload state with current-batch collections that create persisted tasks only when generation starts.

**Tech Stack:** React 19, TypeScript, Vitest, Electron, Node `fs`/`path`

---

## File Structure

- Modify: `src/types.ts`
  Purpose: define persisted task, batch, and stored image types shared by the renderer.
- Create: `src/lib/importBatch.ts`
  Purpose: normalize file extraction and batch-limit validation for drag, paste, and file input flows.
- Create: `src/lib/desktopShell.ts`
  Purpose: typed wrapper around preload APIs for renderer usage and test-time fallback.
- Modify: `electron/preload.ts`
  Purpose: expose safe import/task storage methods to the renderer.
- Modify: `electron/main.ts`
  Purpose: implement local batch directory creation, file writes, output writes, and task JSON persistence.
- Modify: `src/App.tsx`
  Purpose: load persisted tasks, create/update tasks on generation start/completion, and pass handlers into feature pages.
- Modify: `src/components/StickerGen.tsx`
  Purpose: swap single-image inputs for current-batch collections and focused paste-enabled upload areas.
- Modify: `src/components/ProductProcessing.tsx`
  Purpose: same as StickerGen for product workflows.
- Modify: `src/components/Profile.tsx`
  Purpose: read richer task records and present status/import/output-aware task rows.
- Create: `src/lib/importBatch.test.ts`
  Purpose: cover file filtering and 4-image limit behavior.
- Create: `src/lib/taskState.test.ts`
  Purpose: cover task creation/update helpers if extracted during implementation.

### Task 1: Define Shared Models And Red Tests

**Files:**
- Modify: `src/types.ts`
- Create: `src/lib/importBatch.test.ts`

- [ ] **Step 1: Write the failing batch import validation test**

```ts
import { describe, expect, it } from 'vitest';

import { collectImportFiles } from './importBatch';

function makeImageFile(name: string, type = 'image/png') {
  return new File(['img'], name, { type });
}

describe('collectImportFiles', () => {
  it('keeps only the first four image files in a batch', () => {
    const result = collectImportFiles([
      makeImageFile('1.png'),
      makeImageFile('2.png'),
      makeImageFile('3.png'),
      makeImageFile('4.png'),
      makeImageFile('5.png'),
    ]);

    expect(result.accepted.map((file) => file.name)).toEqual([
      '1.png',
      '2.png',
      '3.png',
      '4.png',
    ]);
    expect(result.rejectedCount).toBe(1);
    expect(result.hasOverflow).toBe(true);
  });
});
```

- [ ] **Step 2: Run the red test**

Run: `pnpm test src/lib/importBatch.test.ts`
Expected: FAIL because `src/lib/importBatch.ts` does not exist yet.

- [ ] **Step 3: Add shared types and the minimal importBatch implementation**

```ts
export interface StoredImageRecord {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

export interface ImportBatch {
  batchId: string;
  page: 'sticker' | 'product';
  feature: string;
  images: StoredImageRecord[];
  createdAt: string;
}

export interface TaskRecord {
  taskId: string;
  batchId: string;
  category: string;
  feature: string;
  status: 'Pending' | 'Running' | 'Completed' | 'Failed';
  imports: StoredImageRecord[];
  outputs: StoredImageRecord[];
  createdAt: string;
  updatedAt: string;
}
```

```ts
const MAX_IMPORT_IMAGES = 4;

export function collectImportFiles(files: File[]) {
  const imageFiles = files.filter((file) => file.type.startsWith('image/'));
  const accepted = imageFiles.slice(0, MAX_IMPORT_IMAGES);

  return {
    accepted,
    rejectedCount: imageFiles.length - accepted.length,
    ignoredNonImages: files.length - imageFiles.length,
    hasOverflow: imageFiles.length > MAX_IMPORT_IMAGES,
  };
}
```

- [ ] **Step 4: Re-run the targeted test**

Run: `pnpm test src/lib/importBatch.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/lib/importBatch.ts src/lib/importBatch.test.ts
git commit -m "feat: add batch import models"
```

### Task 2: Add Typed Desktop Storage Bridge

**Files:**
- Create: `src/lib/desktopShell.ts`
- Modify: `electron/preload.ts`
- Modify: `electron/main.ts`

- [ ] **Step 1: Write the failing desktop shell contract test**

```ts
import { describe, expect, it } from 'vitest';

import { hasDesktopStorageApi } from './desktopShell';

describe('hasDesktopStorageApi', () => {
  it('returns false when the preload bridge is unavailable', () => {
    expect(hasDesktopStorageApi()).toBe(false);
  });
});
```

- [ ] **Step 2: Run the red test**

Run: `pnpm test src/lib/taskState.test.ts`
Expected: FAIL because `desktopShell.ts` does not exist yet.

- [ ] **Step 3: Add the preload bridge and renderer wrapper**

```ts
contextBridge.exposeInMainWorld('desktopShell', {
  platform: process.platform,
  saveImportBatch: (...) => ipcRenderer.invoke('storage:save-import-batch', ...),
  createTask: (...) => ipcRenderer.invoke('tasks:create', ...),
  updateTask: (...) => ipcRenderer.invoke('tasks:update', ...),
  listTasks: () => ipcRenderer.invoke('tasks:list'),
  saveTaskOutputs: (...) => ipcRenderer.invoke('storage:save-task-outputs', ...),
});
```

```ts
export function hasDesktopStorageApi() {
  return typeof window !== 'undefined' && Boolean(window.desktopShell?.saveImportBatch);
}
```

```ts
ipcMain.handle('storage:save-import-batch', async (_event, payload) => {
  // create storage/imports/<page>/<feature>/<batchId>
  // write files using arrayBuffer payload
});
```

- [ ] **Step 4: Re-run the targeted test**

Run: `pnpm test src/lib/taskState.test.ts`
Expected: PASS

- [ ] **Step 5: Build Electron entrypoints**

Run: `pnpm build:electron`
Expected: PASS

### Task 3: Add Task Persistence Helpers

**Files:**
- Create or Modify: `src/lib/taskState.test.ts`
- Modify: `src/lib/desktopShell.ts`
- Modify: `src/App.tsx`
- Modify: `electron/main.ts`

- [ ] **Step 1: Write the failing task creation test**

```ts
import { describe, expect, it } from 'vitest';

import { createPendingTask } from './taskState';

describe('createPendingTask', () => {
  it('creates a pending task from an import batch only when generation starts', () => {
    const task = createPendingTask({
      category: 'sticker',
      feature: '贴纸复刻',
      batchId: 'batch-1',
      imports: [],
    });

    expect(task.status).toBe('Pending');
    expect(task.batchId).toBe('batch-1');
    expect(task.outputs).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the red test**

Run: `pnpm test src/lib/taskState.test.ts`
Expected: FAIL because `createPendingTask` is undefined.

- [ ] **Step 3: Implement minimal task helper and App task lifecycle**

```ts
export function createPendingTask(input: {
  category: string;
  feature: string;
  batchId: string;
  imports: StoredImageRecord[];
}): TaskRecord {
  const now = new Date().toISOString();
  return {
    taskId: `task-${Date.now()}`,
    batchId: input.batchId,
    category: input.category,
    feature: input.feature,
    status: 'Pending',
    imports: input.imports,
    outputs: [],
    createdAt: now,
    updatedAt: now,
  };
}
```

```ts
const [tasks, setTasks] = useState<TaskRecord[]>([]);

async function handleCreateTask(...) {
  const task = createPendingTask(...);
  await desktopShell.createTask(task);
  setTasks((prev) => [task, ...prev]);
  return task;
}
```

- [ ] **Step 4: Re-run the targeted test**

Run: `pnpm test src/lib/taskState.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/taskState.ts src/lib/taskState.test.ts src/App.tsx electron/main.ts src/lib/desktopShell.ts
git commit -m "feat: persist generation tasks"
```

### Task 4: Integrate Batch Imports Into StickerGen

**Files:**
- Modify: `src/components/StickerGen.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write a failing StickerGen interaction test for multi-import rendering**

```ts
it('shows all imported images in the current batch', async () => {
  render(<StickerGen ... />);
  // simulate selecting 3 image files
  expect(screen.getAllByAltText(/imported/i)).toHaveLength(3);
});
```

- [ ] **Step 2: Run the red test**

Run: `pnpm test src/components/StickerGen.test.tsx`
Expected: FAIL because the component still renders one image slot.

- [ ] **Step 3: Replace single-image upload state with import batches**

```ts
const [copyBatch, setCopyBatch] = useState<ImportBatch | null>(null);
const [focusedTarget, setFocusedTarget] = useState<'copy' | 'variation' | 'original' | null>(null);

async function handleImport(target: 'copy' | 'variation' | 'original', files: File[]) {
  const normalized = collectImportFiles(files);
  const batch = await desktopShell.saveImportBatch({
    page: 'sticker',
    feature: target,
    files: normalized.accepted,
  });
  if (target === 'copy') setCopyBatch(batch);
}
```

- [ ] **Step 4: Re-run the targeted test**

Run: `pnpm test src/components/StickerGen.test.tsx`
Expected: PASS

- [ ] **Step 5: Run the broader StickerGen suite**

Run: `pnpm test src/components/StickerGen.test.tsx src/lib/importBatch.test.ts`
Expected: PASS

### Task 5: Integrate Batch Imports Into ProductProcessing

**Files:**
- Modify: `src/components/ProductProcessing.tsx`

- [ ] **Step 1: Write the failing ProductProcessing batch render test**

```ts
it('renders every imported image for the active upload target', async () => {
  render(<ProductProcessing ... />);
  expect(screen.getAllByAltText(/imported/i)).toHaveLength(4);
});
```

- [ ] **Step 2: Run the red test**

Run: `pnpm test src/components/ProductProcessing.test.tsx`
Expected: FAIL because each target still stores only one image.

- [ ] **Step 3: Implement batch-based upload handling across all product targets**

```ts
const [removeBatch, setRemoveBatch] = useState<ImportBatch | null>(null);
const [replaceSceneBatch, setReplaceSceneBatch] = useState<ImportBatch | null>(null);
// repeat for remaining targets
```

- [ ] **Step 4: Re-run the targeted test**

Run: `pnpm test src/components/ProductProcessing.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ProductProcessing.tsx src/components/ProductProcessing.test.tsx
git commit -m "feat: add product batch imports"
```

### Task 6: Connect Generation Status And Output Persistence

**Files:**
- Modify: `src/components/StickerGen.tsx`
- Modify: `src/components/ProductProcessing.tsx`
- Modify: `src/App.tsx`
- Modify: `electron/main.ts`

- [ ] **Step 1: Write the failing task transition test**

```ts
it('updates a task to completed with outputs after generation succeeds', async () => {
  const updated = completeTask(task, [{ ...outputRecord }]);
  expect(updated.status).toBe('Completed');
  expect(updated.outputs).toHaveLength(1);
});
```

- [ ] **Step 2: Run the red test**

Run: `pnpm test src/lib/taskState.test.ts`
Expected: FAIL because completion helpers do not exist.

- [ ] **Step 3: Implement task transition helpers and generation callbacks**

```ts
export function completeTask(task: TaskRecord, outputs: StoredImageRecord[]): TaskRecord {
  return { ...task, status: 'Completed', outputs, updatedAt: new Date().toISOString() };
}
```

```ts
const task = await onStartGeneration(...);
await onTaskRunning(task.taskId);
const outputs = await desktopShell.saveTaskOutputs(...);
await onTaskCompleted(task.taskId, outputs);
```

- [ ] **Step 4: Re-run the targeted test**

Run: `pnpm test src/lib/taskState.test.ts`
Expected: PASS

- [ ] **Step 5: Run all task-related tests**

Run: `pnpm test src/lib/taskState.test.ts src/lib/importBatch.test.ts`
Expected: PASS

### Task 7: Upgrade Profile Task Manager

**Files:**
- Modify: `src/components/Profile.tsx`
- Modify: `src/types.ts`

- [ ] **Step 1: Write the failing Profile rendering test**

```ts
it('shows persisted task status labels from TaskRecord', () => {
  render(<Profile tasks={[task]} onRefresh={() => {}} />);
  expect(screen.getByText('已完成')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the red test**

Run: `pnpm test src/components/Profile.test.tsx`
Expected: FAIL because the profile view still expects the old `TaskItem` shape.

- [ ] **Step 3: Update Profile to consume rich task records**

```ts
const matchesSearch =
  task.taskId.toLowerCase().includes(searchQuery.toLowerCase()) ||
  task.feature.toLowerCase().includes(searchQuery.toLowerCase()) ||
  task.batchId.toLowerCase().includes(searchQuery.toLowerCase());
```

- [ ] **Step 4: Re-run the targeted test**

Run: `pnpm test src/components/Profile.test.tsx`
Expected: PASS

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `pnpm test`
Expected: PASS

Run: `pnpm lint`
Expected: PASS
