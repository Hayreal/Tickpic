# Tickpic Electron Desktop App — Full Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready Electron desktop app foundation with secure three-process architecture, complete IPC contracts, Main Process services (settings, queue, artifacts, logging), dual-protocol model clients (OpenAI + Gemini), and all 10 AI image feature handlers executing the mandatory two-stage workflow.

**Architecture:** Main Process owns all business logic — file I/O, model calls, task queue, artifact persistence, and logging. Preload exposes a typed, whitelist-only API via `contextBridge`. Renderer is a placeholder page this iteration (real UI next iteration). All image tasks go through a unified `submitImageTask` API, execute a two-stage pipeline (vision enhancement → image generation/edit), and persist structured artifacts.

**Tech Stack:** Electron + electron-vite + React + TypeScript, Zod for validation, `openai` and `@google/genai` SDKs, Node.js built-in test runner.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `electron.vite.config.ts` | Three-process Vite build config (main/preload/renderer) |
| `tsconfig.json` | Base TypeScript config (jsx: react-jsx, all @types auto-discovered) |
| `src/main/app/main.ts` | App lifecycle: ready, activate, single-instance, before-quit |
| `src/main/app/windows.ts` | BrowserWindow creation with strict security prefs |
| `src/main/app/navigation.ts` | CSP, will-navigate block, new-window deny, shell.openExternal whitelist |
| `src/main/app/menu.ts` | Minimal native menu |
| `src/main/ipc/channels.ts` | IPC channel name constants |
| `src/main/ipc/handlers.ts` | `ipcMain.handle` registrations, service wiring |
| `src/main/ipc/validators.ts` | Zod runtime validation for renderer inputs |
| `src/main/services/crypto.ts` | AES-256-GCM encrypt/decrypt for API Key (test-key injectable) |
| `src/main/services/settings-store.ts` | Encrypted JSON settings read/write with Zod validation |
| `src/main/services/logger.ts` | Structured file logs with automatic PII redaction |
| `src/main/services/artifact-store.ts` | Workspace artifact directory creation and file writes |
| `src/main/services/task-queue.ts` | FIFO queue with max-concurrent semaphore, abortable tasks, status events |
| `src/main/services/model-clients/types.ts` | `VisionClient`, `ImageClient`, `Protocol` interfaces |
| `src/main/services/model-clients/openai-client.ts` | OpenAI `responses.create` (vision) + `images.generate/edit` |
| `src/main/services/model-clients/gemini-client.ts` | Gemini `generateContent` for vision + image gen/edit |
| `src/main/services/model-clients/resolver.ts` | Maps protocol → concrete client instance |
| `src/main/services/image-workflow/prompt-templates.ts` | Loads all 10 feature prompts from `docs/ai-image-system-prompts.md` |
| `src/main/services/image-workflow/image-io.ts` | `readImageAsDataUrl`, `readPngDimensions` |
| `src/main/services/image-workflow/image-edit-prompt.ts` | Sticker-replication-specific edit prompt builder |
| `src/main/services/image-workflow/feature-registry.ts` | `FeatureHandler` interface, `createHandler` factory, `FeatureRegistry` class |
| `src/main/services/image-workflow/workflow-runner.ts` | Two-stage orchestrator: enhance → execute → persist |
| `src/main/services/image-workflow/handlers/*.ts` | One file per feature (10 files) |
| `src/preload/api.ts` | Renderer-visible API TypeScript interface |
| `src/preload/index.ts` | `contextBridge.exposeInMainWorld('tickpic', api)` |
| `src/renderer/index.html` | HTML entry with CSP meta tag |
| `src/renderer/main.tsx` | React root mount |
| `src/renderer/App.tsx` | Placeholder "Tickpic has started" page |
| `src/shared/constants.ts` | `ImageFeature`, `TaskStatus`, `IPC_CHANNELS` enums |
| `src/shared/ipc-contracts.ts` | `ImageTaskRequest`, `AppSettings`, `TaskStatusSnapshot` interfaces |
| `src/shared/schemas.ts` | Zod schemas for all cross-process data |
| `src/shared/image-workflow-types.ts` | `PromptEnhancement`, `PromptTemplates`, `Region`, `ImageRole` types |
| `src/shared/prompt-enhancement-schema.ts` | JSON Schema constant for OpenAI API `json_schema` format |
| `tests/unit/*.test.ts` | Unit tests for templates, schemas, registry, settings |
| `tests/integration/*.test.ts` | Integration tests with mock clients |

---

## Prerequisites

Before starting, read these docs (already in repo):
- `docs/ai-image-api-implementation-plan.md` — API design, task flow, model selection rules
- `docs/ai-image-system-prompts.md` — System prompts for all 10 features (English)
- `AGENTS.md` — Project rules, directory structure, security requirements
- `scripts/lib/*` — Reference implementation (read-only, do not import from `src/`)

---

### Task 1: electron-vite Scaffold + Dependency Installation

**Goal:** Initialize the three-process Electron build system with React + TypeScript. `src/` must be writable for the first time (it is currently empty, per `AGENTS.md`).

**Files:**
- Create: `electron.vite.config.ts`
- Modify: `package.json`
- Modify: `tsconfig.json`
- Create: `src/main/app/main.ts` (stub)
- Create: `src/preload/index.ts` (stub)
- Create: `src/renderer/index.html` (stub)
- Create: `src/renderer/main.tsx` (stub)
- Create: `src/renderer/App.tsx` (stub)

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/lixin/PycharmProjects/Tickpic
npm install electron electron-vite vite react react-dom zod
npm install -D @vitejs/plugin-react @types/react @types/react-dom
```

Expected: All packages installed without errors.

- [ ] **Step 2: Write electron-vite config**

Create `electron.vite.config.ts`:

```ts
import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    build: {
      lib: {
        entry: resolve('src/main/app/main.ts'),
        formats: ['cjs'],
        fileName: () => '[name].js',
      },
      outDir: 'out/main',
    },
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    build: {
      lib: {
        entry: resolve('src/preload/index.ts'),
        formats: ['cjs'],
        fileName: () => '[name].js',
      },
      outDir: 'out/preload',
    },
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    root: resolve('src/renderer'),
    build: {
      outDir: resolve('out/renderer'),
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
        },
      },
    },
    plugins: [react()],
  },
});
```

- [ ] **Step 3: Update package.json scripts**

Replace the `scripts` section in `package.json`:

```json
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "test": "node --import tsx --test tests/unit/*.test.ts tests/integration/*.test.ts",
    "test:unit": "node --import tsx --test tests/unit/*.test.ts",
    "test:integration": "node --import tsx --test tests/integration/*.test.ts",
    "typecheck": "npx tsc --noEmit",
    "test:sticker-replica": "node --env-file=.env --import tsx scripts/sticker-replica-demo.ts",
    "test:gpt-image-size": "node --env-file=.env --import tsx scripts/gpt-image-demo.ts"
  }
}
```

Keep existing `devDependencies` and `dependencies`. Add `electron`, `electron-vite`, `vite`, `react`, `react-dom`, `zod` to `dependencies`; add `@vitejs/plugin-react`, `@types/react`, `@types/react-dom` to `devDependencies`.

- [ ] **Step 4: Update tsconfig.json**

Replace `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": ".",
    "jsx": "react-jsx"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts", "scripts/**/*.ts"]
}
```

- [ ] **Step 5: Create minimal stubs for all three entry points**

Create `src/main/app/main.ts`:

```ts
import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(join(__dirname, '../../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}
```

Create `src/preload/index.ts`:

```ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('tickpic', {
  version: '0.1.0',
});
```

Create `src/renderer/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';" />
    <title>Tickpic</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

Create `src/renderer/main.tsx`:

```ts
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
```

Create `src/renderer/App.tsx`:

```tsx
export function App(): JSX.Element {
  return <div>Tickpic placeholder</div>;
}
```

- [ ] **Step 6: Verify dev build starts**

```bash
npm run build
```

Expected: Build completes with no errors. `out/main/main.js`, `out/preload/index.js`, `out/renderer/index.html` exist.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: electron-vite scaffold with React + TypeScript"
```

---

### Task 2: Electron Security Shell

**Goal:** Implement secure BrowserWindow creation, CSP, navigation guards, and minimal menu.

**Files:**
- Modify: `src/main/app/main.ts`
- Create: `src/main/app/windows.ts`
- Create: `src/main/app/navigation.ts`
- Create: `src/main/app/menu.ts`

- [ ] **Step 1: Write windows.ts**

Create `src/main/app/windows.ts`:

```ts
import { BrowserWindow } from 'electron';
import { join } from 'node:path';

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(join(__dirname, '../../renderer/index.html'));
  }

  return win;
}
```

- [ ] **Step 2: Write navigation.ts**

Create `src/main/app/navigation.ts`:

```ts
import { app, shell } from 'electron';

const ALLOWED_EXTERNAL_HOSTS = ['github.com', 'n1n.ai', 'api.n1n.ai'];

export function setupNavigationGuards(): void {
  app.on('web-contents-created', (_, contents) => {
    // Block unexpected navigation
    contents.on('will-navigate', (event, url) => {
      if (process.env.VITE_DEV_SERVER_URL && url.startsWith(process.env.VITE_DEV_SERVER_URL)) {
        return;
      }
      event.preventDefault();
      console.warn(`Blocked navigation to: ${url}`);
    });

    // Block new windows, allow whitelisted external links via shell.openExternal
    contents.setWindowOpenHandler(({ url }) => {
      const parsed = new URL(url);
      const isAllowed =
        parsed.protocol === 'https:' &&
        ALLOWED_EXTERNAL_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));

      if (isAllowed) {
        shell.openExternal(url);
      } else {
        console.warn(`Blocked external URL: ${url}`);
      }

      return { action: 'deny' };
    });
  });
}
```

- [ ] **Step 3: Write menu.ts**

Create `src/main/app/menu.ts`:

```ts
import { Menu } from 'electron';

export function registerMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Tickpic',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
```

- [ ] **Step 4: Update main.ts to use new modules**

Replace `src/main/app/main.ts`:

```ts
import { app } from 'electron';
import { createMainWindow } from './windows';
import { setupNavigationGuards } from './navigation';
import { registerMenu } from './menu';

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

app.whenReady().then(() => {
  createMainWindow();
  setupNavigationGuards();
  registerMenu();

  app.on('activate', () => {
    if (app?.isReady && BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

Wait — `BrowserWindow` is not imported. Fix:

```ts
import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './windows';
import { setupNavigationGuards } from './navigation';
import { registerMenu } from './menu';

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

app.whenReady().then(() => {
  createMainWindow();
  setupNavigationGuards();
  registerMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

- [ ] **Step 5: Run type check**

```bash
npm run typecheck
```

Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add src/main/app/
git commit -m "feat: secure Electron shell with CSP, navigation guards, menu"
```

---

### Task 3: shared/ Types, Constants, and Zod Schemas

**Goal:** Define all cross-process types and runtime validation schemas. This is the foundation every subsequent task builds on.

**Files:**
- Create: `src/shared/constants.ts`
- Create: `src/shared/ipc-contracts.ts`
- Create: `src/shared/schemas.ts`
- Create: `src/shared/image-workflow-types.ts`
- Create: `src/shared/prompt-enhancement-schema.ts`

- [ ] **Step 1: Write constants.ts**

Create `src/shared/constants.ts`:

```ts
export const IPC_CHANNELS = {
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  SETTINGS_TEST_CONNECTION: 'settings:test-connection',
  IMAGE_TASK_SUBMIT: 'image-task:submit',
  IMAGE_TASK_CANCEL: 'image-task:cancel',
  IMAGE_TASK_GET_STATUS: 'image-task:get-status',
  DIALOG_OPEN_FILES: 'dialog:open-files',
  IMAGE_TASK_STATUS: 'image-task:status',
} as const;

export const IMAGE_FEATURES = [
  'sticker-replication',
  'sticker-variation',
  'original-sticker',
  'remove-product',
  'replace-product',
  'replace-logo',
  'main-image-variation',
  'scene-variation',
  'create-scene',
  'prompt-only-asset',
] as const;

export type ImageFeature = (typeof IMAGE_FEATURES)[number];

export const TASK_STATUSES = [
  'queued',
  'running',
  'enhancing',
  'generating',
  'saving',
  'completed',
  'failed',
  'canceled',
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
```

- [ ] **Step 2: Write ipc-contracts.ts**

Create `src/shared/ipc-contracts.ts`:

```ts
import type { ImageFeature } from './constants';

export interface ImageTaskRequest {
  feature: ImageFeature;
  modelOverrides?: {
    vision?: string;
    generation?: string;
    edit?: string;
  };
  prompt?: string;
  images?: Array<{
    role: 'source' | 'reference' | 'style' | 'product' | 'logo';
    path: string;
  }>;
  regions?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  count?: number;
  productName?: string;
  logoText?: string;
  colorScheme?: string;
  aspectRatio?: string;
}

export interface AppSettings {
  n1nApiKey: string;
  baseURL: string;
  workspaceDir: string;
  defaultVisionModel: string;
  defaultGenerationModel: string;
  defaultEditModel: string;
  modelProtocolMap: Record<string, 'openai' | 'gemini'>;
  defaultCount: number;
  maxConcurrentTasks: number;
  schemaVersion: number;
}

export interface OpenFilesOptions {
  title?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  multiSelect?: boolean;
}

export interface TaskStatusSnapshot {
  taskId: string;
  status: string;
  feature: string;
  progress?: number;
  error?: string;
  outputDir?: string;
}
```

- [ ] **Step 3: Write schemas.ts**

Create `src/shared/schemas.ts`:

```ts
import { z } from 'zod';
import { IMAGE_FEATURES } from './constants';

export const imageFeatureSchema = z.enum(IMAGE_FEATURES as [string, ...string[]]);

export const imageTaskRequestSchema = z.object({
  feature: imageFeatureSchema,
  modelOverrides: z
    .object({
      vision: z.string().optional(),
      generation: z.string().optional(),
      edit: z.string().optional(),
    })
    .optional(),
  prompt: z.string().optional(),
  images: z
    .array(
      z.object({
        role: z.enum(['source', 'reference', 'style', 'product', 'logo']),
        path: z.string(),
      }),
    )
    .optional(),
  regions: z
    .array(
      z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      }),
    )
    .optional(),
  count: z.number().int().min(1).max(10).optional(),
  productName: z.string().optional(),
  logoText: z.string().optional(),
  colorScheme: z.string().optional(),
  aspectRatio: z.string().optional(),
});

export const appSettingsSchema = z.object({
  n1nApiKey: z.string(),
  baseURL: z.string().url().default('https://api.n1n.ai'),
  workspaceDir: z.string(),
  defaultVisionModel: z.string(),
  defaultGenerationModel: z.string(),
  defaultEditModel: z.string(),
  modelProtocolMap: z.record(z.enum(['openai', 'gemini'])),
  defaultCount: z.number().int().min(1).max(10).default(4),
  maxConcurrentTasks: z.number().int().min(1).max(10).default(5),
  schemaVersion: z.number().default(1),
});

export const promptEnhancementSchema = z.object({
  feature: z.string(),
  taskIntent: z.string(),
  sourceImageUnderstanding: z.object({
    mainSubject: z.string(),
    scene: z.string(),
    style: z.string(),
    colorPalette: z.string(),
    composition: z.string(),
    lighting: z.string(),
    materialTexture: z.string(),
    textAreas: z.array(z.string()),
    commercialUse: z.string(),
  }),
  regionUnderstanding: z.array(
    z.object({
      regionLabel: z.string(),
      targetObject: z.string(),
      operationBoundary: z.string(),
      notes: z.string(),
    }),
  ),
  subjectPlan: z.object({
    keep: z.array(z.string()),
    remove: z.array(z.string()),
    replace: z.array(z.string()),
    generate: z.array(z.string()),
  }),
  compositionPlan: z.object({
    layout: z.string(),
    cameraAngle: z.string(),
    visualHierarchy: z.string(),
    comparisonStructure: z.string(),
  }),
  stylePlan: z.object({
    visualStyle: z.string(),
    colorScheme: z.string(),
    marketStyle: z.string(),
  }),
  textPlan: z.object({
    primaryText: z.array(z.string()),
    secondaryText: z.array(z.string()),
    textAccuracyRequirement: z.string(),
    avoidText: z.array(z.string()),
  }),
  additionalPromptUnderstanding: z.object({
    acceptedRequirements: z.array(z.string()),
    conflictingRequirements: z.array(z.string()),
    mergedIntoFinalPrompt: z.array(z.string()),
  }),
  scenePlan: z.object({
    sceneList: z.array(z.string()),
    sceneConstraints: z.string(),
  }),
  constraints: z.array(z.string()),
  negativeConstraints: z.array(z.string()),
  modelHints: z.object({
    aspectRatio: z.string(),
  }),
  finalPrompt: z.string(),
});
```

- [ ] **Step 4: Write image-workflow-types.ts**

Create `src/shared/image-workflow-types.ts`:

```ts
export type ImageRole = 'source' | 'reference' | 'style' | 'product' | 'logo';

export type Region = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PromptTemplates = {
  generalSystemPrompt: string;
  jsonSystemPrompt: string;
  stickerReplicationPrompt: string;
  stickerVariationPrompt: string;
  originalStickerPrompt: string;
  removeProductPrompt: string;
  replaceProductPrompt: string;
  replaceLogoPrompt: string;
  mainImageVariationPrompt: string;
  sceneVariationPrompt: string;
  createScenePrompt: string;
  promptOnlyAssetPrompt: string;
};

export type PromptEnhancement = {
  feature: string;
  taskIntent: string;
  sourceImageUnderstanding: {
    mainSubject: string;
    scene: string;
    style: string;
    colorPalette: string;
    composition: string;
    lighting: string;
    materialTexture: string;
    textAreas: string[];
    commercialUse: string;
  };
  regionUnderstanding: Array<{
    regionLabel: string;
    targetObject: string;
    operationBoundary: string;
    notes: string;
  }>;
  subjectPlan: {
    keep: string[];
    remove: string[];
    replace: string[];
    generate: string[];
  };
  compositionPlan: {
    layout: string;
    cameraAngle: string;
    visualHierarchy: string;
    comparisonStructure: string;
  };
  stylePlan: {
    visualStyle: string;
    colorScheme: string;
    marketStyle: string;
  };
  textPlan: {
    primaryText: string[];
    secondaryText: string[];
    textAccuracyRequirement: string;
    avoidText: string[];
  };
  additionalPromptUnderstanding: {
    acceptedRequirements: string[];
    conflictingRequirements: string[];
    mergedIntoFinalPrompt: string[];
  };
  scenePlan: {
    sceneList: string[];
    sceneConstraints: string;
  };
  constraints: string[];
  negativeConstraints: string[];
  modelHints: {
    aspectRatio: string;
  };
  finalPrompt: string;
};
```

- [ ] **Step 5: Write prompt-enhancement-schema.ts (JSON Schema for API)**

Create `src/shared/prompt-enhancement-schema.ts`:

```ts
export const PROMPT_ENHANCEMENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'feature',
    'taskIntent',
    'sourceImageUnderstanding',
    'regionUnderstanding',
    'subjectPlan',
    'compositionPlan',
    'stylePlan',
    'textPlan',
    'additionalPromptUnderstanding',
    'scenePlan',
    'constraints',
    'negativeConstraints',
    'modelHints',
    'finalPrompt',
  ],
  properties: {
    feature: { type: 'string' },
    taskIntent: { type: 'string' },
    sourceImageUnderstanding: {
      type: 'object',
      additionalProperties: false,
      required: [
        'mainSubject',
        'scene',
        'style',
        'colorPalette',
        'composition',
        'lighting',
        'materialTexture',
        'textAreas',
        'commercialUse',
      ],
      properties: {
        mainSubject: { type: 'string' },
        scene: { type: 'string' },
        style: { type: 'string' },
        colorPalette: { type: 'string' },
        composition: { type: 'string' },
        lighting: { type: 'string' },
        materialTexture: { type: 'string' },
        textAreas: { type: 'array', items: { type: 'string' } },
        commercialUse: { type: 'string' },
      },
    },
    regionUnderstanding: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['regionLabel', 'targetObject', 'operationBoundary', 'notes'],
        properties: {
          regionLabel: { type: 'string' },
          targetObject: { type: 'string' },
          operationBoundary: { type: 'string' },
          notes: { type: 'string' },
        },
      },
    },
    subjectPlan: {
      type: 'object',
      additionalProperties: false,
      required: ['keep', 'remove', 'replace', 'generate'],
      properties: {
        keep: { type: 'array', items: { type: 'string' } },
        remove: { type: 'array', items: { type: 'string' } },
        replace: { type: 'array', items: { type: 'string' } },
        generate: { type: 'array', items: { type: 'string' } },
      },
    },
    compositionPlan: {
      type: 'object',
      additionalProperties: false,
      required: ['layout', 'cameraAngle', 'visualHierarchy', 'comparisonStructure'],
      properties: {
        layout: { type: 'string' },
        cameraAngle: { type: 'string' },
        visualHierarchy: { type: 'string' },
        comparisonStructure: { type: 'string' },
      },
    },
    stylePlan: {
      type: 'object',
      additionalProperties: false,
      required: ['visualStyle', 'colorScheme', 'marketStyle'],
      properties: {
        visualStyle: { type: 'string' },
        colorScheme: { type: 'string' },
        marketStyle: { type: 'string' },
      },
    },
    textPlan: {
      type: 'object',
      additionalProperties: false,
      required: ['primaryText', 'secondaryText', 'textAccuracyRequirement', 'avoidText'],
      properties: {
        primaryText: { type: 'array', items: { type: 'string' } },
        secondaryText: { type: 'array', items: { type: 'string' } },
        textAccuracyRequirement: { type: 'string' },
        avoidText: { type: 'array', items: { type: 'string' } },
      },
    },
    additionalPromptUnderstanding: {
      type: 'object',
      additionalProperties: false,
      required: ['acceptedRequirements', 'conflictingRequirements', 'mergedIntoFinalPrompt'],
      properties: {
        acceptedRequirements: { type: 'array', items: { type: 'string' } },
        conflictingRequirements: { type: 'array', items: { type: 'string' } },
        mergedIntoFinalPrompt: { type: 'array', items: { type: 'string' } },
      },
    },
    scenePlan: {
      type: 'object',
      additionalProperties: false,
      required: ['sceneList', 'sceneConstraints'],
      properties: {
        sceneList: { type: 'array', items: { type: 'string' } },
        sceneConstraints: { type: 'string' },
      },
    },
    constraints: { type: 'array', items: { type: 'string' } },
    negativeConstraints: { type: 'array', items: { type: 'string' } },
    modelHints: {
      type: 'object',
      additionalProperties: false,
      required: ['aspectRatio'],
      properties: {
        aspectRatio: { type: 'string' },
      },
    },
    finalPrompt: { type: 'string' },
  },
} as const;
```

- [ ] **Step 6: Run type check**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/shared/
git commit -m "feat: shared types, constants, Zod schemas, and JSON schema"
```

---

### Task 4: Crypto Utilities + Settings Store + Logger

**Goal:** Implement encrypted local settings storage and structured logging with PII redaction.

**Files:**
- Create: `src/main/services/crypto.ts`
- Create: `src/main/services/settings-store.ts`
- Create: `src/main/services/logger.ts`
- Test: `tests/unit/services/settings-store.test.ts`

- [ ] **Step 1: Write failing test for settings-store**

Create `tests/unit/services/settings-store.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// We will create these in the implementation
let SettingsStore: typeof import('../../../src/main/services/settings-store').SettingsStore;
let setEncryptionKeyForTests: typeof import('../../../src/main/services/crypto').setEncryptionKeyForTests;

test('SettingsStore saves and retrieves settings with encrypted API key', async () => {
  // Lazy import after impl files exist
  const cryptoMod = await import('../../../src/main/services/crypto');
  setEncryptionKeyForTests = cryptoMod.setEncryptionKeyForTests;
  const storeMod = await import('../../../src/main/services/settings-store');
  SettingsStore = storeMod.SettingsStore;

  const tempDir = mkdtempSync(join(tmpdir(), 'tickpic-test-'));
  const settingsPath = join(tempDir, 'settings.json');

  setEncryptionKeyForTests(Buffer.from('0123456789abcdef0123456789abcdef', 'hex'));

  const store = new SettingsStore(settingsPath);

  const settings = {
    n1nApiKey: 'test-api-key-12345',
    baseURL: 'https://api.n1n.ai',
    workspaceDir: tempDir,
    defaultVisionModel: 'gpt-5.4-mini',
    defaultGenerationModel: 'gemini-2.5-flash-image',
    defaultEditModel: 'gpt-image-2',
    modelProtocolMap: { 'gpt-image-2': 'openai' },
    defaultCount: 4,
    maxConcurrentTasks: 5,
    schemaVersion: 1,
  };

  store.save(settings);
  const retrieved = store.get();

  assert.equal(retrieved.n1nApiKey, 'test-api-key-12345');
  assert.equal(retrieved.baseURL, 'https://api.n1n.ai');
  assert.equal(retrieved.defaultCount, 4);
  assert.equal(retrieved.schemaVersion, 1);

  rmSync(tempDir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test:unit
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Write crypto.ts**

Create `src/main/services/crypto.ts`:

```ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
let testKey: Buffer | null = null;

export function setEncryptionKeyForTests(key: Buffer): void {
  testKey = key;
}

function getKey(): Buffer {
  if (testKey) return testKey;
  try {
    const { app } = require('electron');
    return scryptSync(app.getPath('userData'), 'tickpic-settings-v1', 32);
  } catch {
    return scryptSync('fallback-test-key', 'tickpic-settings-v1', 32);
  }
}

export function encrypt(text: string): { encrypted: string; iv: string; tag: string } {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

export function decrypt(payload: { encrypted: string; iv: string; tag: string }): string {
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(payload.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'hex'));
  let decrypted = decipher.update(payload.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

- [ ] **Step 4: Write settings-store.ts**

Create `src/main/services/settings-store.ts`:

```ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { app } from 'electron';
import type { AppSettings } from '../../shared/ipc-contracts';
import { appSettingsSchema } from '../../shared/schemas';
import { encrypt, decrypt } from './crypto';

const SETTINGS_FILE_NAME = 'settings.json';

export class SettingsStore {
  private settingsPath: string;

  constructor(settingsPath?: string) {
    this.settingsPath = settingsPath ?? join(app.getPath('userData'), SETTINGS_FILE_NAME);
  }

  get(): AppSettings {
    if (!existsSync(this.settingsPath)) {
      throw new Error('Settings not configured');
    }

    const raw = JSON.parse(readFileSync(this.settingsPath, 'utf8'));
    const decrypted = this.decryptSensitiveFields(raw);

    const result = appSettingsSchema.safeParse(decrypted);
    if (!result.success) {
      throw new Error(`Invalid settings: ${result.error.message}`);
    }

    return result.data;
  }

  save(settings: AppSettings): void {
    const validated = appSettingsSchema.parse(settings);
    const encrypted = this.encryptSensitiveFields(validated);

    const dir = dirname(this.settingsPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    writeFileSync(this.settingsPath, JSON.stringify(encrypted, null, 2) + '\n', 'utf8');
  }

  testConnection(): Promise<{ ok: boolean; message?: string }> {
    return Promise.resolve({ ok: true, message: 'Connection test not yet implemented' });
  }

  private encryptSensitiveFields(settings: AppSettings): Record<string, unknown> {
    const copy: Record<string, unknown> = { ...settings };
    if (settings.n1nApiKey) {
      copy.n1nApiKey = encrypt(settings.n1nApiKey);
    }
    return copy;
  }

  private decryptSensitiveFields(raw: Record<string, unknown>): Record<string, unknown> {
    const copy: Record<string, unknown> = { ...raw };
    if (
      raw.n1nApiKey &&
      typeof raw.n1nApiKey === 'object' &&
      raw.n1nApiKey !== null &&
      'encrypted' in raw.n1nApiKey
    ) {
      copy.n1nApiKey = decrypt(raw.n1nApiKey as { encrypted: string; iv: string; tag: string });
    }
    return copy;
  }
}
```

- [ ] **Step 5: Write logger.ts**

Create `src/main/services/logger.ts`:

```ts
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

export class Logger {
  private logPath: string;

  constructor(logPath: string) {
    this.logPath = logPath;
    const dir = dirname(logPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.write('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.write('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.write('error', message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.write('debug', message, meta);
  }

  private write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.sanitize(meta),
    };
    appendFileSync(this.logPath, JSON.stringify(entry) + '\n', 'utf8');
  }

  private sanitize(meta?: Record<string, unknown>): Record<string, unknown> {
    if (!meta) return {};
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(meta)) {
      result[key] = this.isSensitive(key, value) ? '[REDACTED]' : value;
    }
    return result;
  }

  private isSensitive(key: string, value: unknown): boolean {
    const sensitiveKeys = ['apikey', 'authorization', 'api_key', 'b64_json', 'base64', 'image_base64', 'token'];
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) return true;
    if (typeof value === 'string' && value.length > 1000 && /^[A-Za-z0-9+/=]+$/.test(value)) {
      return true;
    }
    return false;
  }
}
```

- [ ] **Step 6: Run tests**

```bash
npm run test:unit
```

Expected: settings-store test passes.

- [ ] **Step 7: Run type check**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add src/main/services/ tests/unit/services/
git commit -m "feat: encrypted settings-store and structured logger with PII redaction"
```

---

### Task 5: Model Clients (OpenAI + Gemini + Resolver)

**Goal:** Implement dual-protocol model clients with unified interfaces for vision enhancement and image generation/editing.

**Files:**
- Create: `src/main/services/model-clients/types.ts`
- Create: `src/main/services/model-clients/openai-client.ts`
- Create: `src/main/services/model-clients/gemini-client.ts`
- Create: `src/main/services/model-clients/resolver.ts`

- [ ] **Step 1: Write types.ts**

Create `src/main/services/model-clients/types.ts`:

```ts
export type Protocol = 'openai' | 'gemini';

export interface VisionEnhanceParams {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  images: Array<{ dataUrl: string; detail?: 'auto' | 'low' | 'high' }>;
  schema: object;
}

export interface VisionClient {
  enhance(params: VisionEnhanceParams): Promise<string>;
}

export interface ImageGenerateParams {
  model: string;
  prompt: string;
  size?: string;
  count: number;
  aspectRatio?: string;
}

export interface ImageEditParams {
  model: string;
  prompt: string;
  imagePaths: string[];
  size?: string;
  quality?: string;
  background?: string;
  outputFormat?: string;
  inputFidelity?: string;
}

export interface ImageResult {
  buffer: Buffer;
  mimeType: string;
}

export interface ImageClient {
  generate(params: ImageGenerateParams): Promise<ImageResult[]>;
  edit(params: ImageEditParams): Promise<ImageResult[]>;
}
```

- [ ] **Step 2: Write openai-client.ts**

Create `src/main/services/model-clients/openai-client.ts`:

```ts
import { createReadStream } from 'node:fs';
import OpenAI from 'openai';
import type { VisionClient, VisionEnhanceParams, ImageClient, ImageGenerateParams, ImageEditParams, ImageResult } from './types';

export class OpenAIVisionClient implements VisionClient {
  constructor(private client: OpenAI) {}

  async enhance(params: VisionEnhanceParams): Promise<string> {
    const response = await this.client.responses.create({
      model: params.model,
      instructions: params.systemPrompt,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: params.userPrompt },
            ...params.images.map((img) => ({
              type: 'input_image' as const,
              image_url: img.dataUrl,
              detail: img.detail ?? 'auto',
            })),
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'prompt_enhancement',
          strict: true,
          schema: params.schema,
        },
        verbosity: 'low',
      },
    });

    return response.output_text;
  }
}

export class OpenAIImageClient implements ImageClient {
  constructor(private client: OpenAI) {}

  async generate(params: ImageGenerateParams): Promise<ImageResult[]> {
    const response = await this.client.images.generate({
      model: params.model,
      prompt: params.prompt,
      size: params.size as any,
      n: params.count,
      response_format: 'b64_json',
    });

    return (response.data ?? []).map((item) => ({
      buffer: Buffer.from(item.b64_json!, 'base64'),
      mimeType: 'image/png',
    }));
  }

  async edit(params: ImageEditParams): Promise<ImageResult[]> {
    const response = await this.client.images.edit({
      image: params.imagePaths.map((p) => createReadStream(p)) as any,
      model: params.model,
      prompt: params.prompt,
      size: params.size as any,
      quality: params.quality as any,
      background: params.background as any,
      output_format: params.outputFormat as any,
      input_fidelity: params.inputFidelity as any,
    });

    return (response.data ?? []).map((item: any) => {
      const b64 = item.b64_json ?? item.base64 ?? item.image_base64;
      if (b64) {
        return { buffer: Buffer.from(b64, 'base64'), mimeType: 'image/png' };
      }
      throw new Error('No image data in OpenAI response');
    });
  }
}
```

- [ ] **Step 3: Write gemini-client.ts**

Create `src/main/services/model-clients/gemini-client.ts`:

```ts
import { readFileSync } from 'node:fs';
import { GoogleGenAI } from '@google/genai';
import type { VisionClient, VisionEnhanceParams, ImageClient, ImageGenerateParams, ImageEditParams, ImageResult } from './types';

export class GeminiVisionClient implements VisionClient {
  constructor(private client: GoogleGenAI) {}

  async enhance(params: VisionEnhanceParams): Promise<string> {
    const textPart = { text: `${params.systemPrompt}\n\n${params.userPrompt}` };
    const imageParts = params.images.map((img) => {
      const base64Data = img.dataUrl.split(',')[1];
      const mimeType = img.dataUrl.split(';')[0].split(':')[1];
      return {
        role: 'user' as const,
        parts: [{ inlineData: { data: base64Data, mimeType } }],
      };
    });

    const response = await this.client.models.generateContent({
      model: params.model,
      contents: [{ role: 'user', parts: [textPart] }, ...imageParts],
      config: {
        responseMimeType: 'application/json',
        responseSchema: params.schema as any,
      },
    });

    return response.text ?? '';
  }
}

export class GeminiImageClient implements ImageClient {
  constructor(private client: GoogleGenAI) {}

  async generate(params: ImageGenerateParams): Promise<ImageResult[]> {
    const results: ImageResult[] = [];

    for (let i = 0; i < params.count; i++) {
      const response = await this.client.models.generateContent({
        model: params.model,
        contents: [{ role: 'user', parts: [{ text: params.prompt }] }],
        config: { responseModalities: ['Text', 'Image'] },
      });

      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData) {
          results.push({
            buffer: Buffer.from(part.inlineData.data, 'base64'),
            mimeType: part.inlineData.mimeType ?? 'image/png',
          });
        }
      }
    }

    return results;
  }

  async edit(params: ImageEditParams): Promise<ImageResult[]> {
    const imageParts = params.imagePaths.map((p) => ({
      inlineData: {
        data: readFileSync(p).toString('base64'),
        mimeType: 'image/png',
      },
    }));

    const response = await this.client.models.generateContent({
      model: params.model,
      contents: [{ role: 'user', parts: [...imageParts, { text: params.prompt }] }],
      config: { responseModalities: ['Text', 'Image'] },
    });

    const results: ImageResult[] = [];
    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData) {
        results.push({
          buffer: Buffer.from(part.inlineData.data, 'base64'),
          mimeType: part.inlineData.mimeType ?? 'image/png',
        });
      }
    }
    return results;
  }
}
```

- [ ] **Step 4: Write resolver.ts**

Create `src/main/services/model-clients/resolver.ts`:

```ts
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import type { Protocol, VisionClient, ImageClient } from './types';
import { OpenAIVisionClient, OpenAIImageClient } from './openai-client';
import { GeminiVisionClient, GeminiImageClient } from './gemini-client';

export class ModelResolver {
  private openaiVision: OpenAIVisionClient;
  private openaiImage: OpenAIImageClient;
  private geminiVision: GeminiVisionClient;
  private geminiImage: GeminiImageClient;

  constructor(openaiClient: OpenAI, geminiClient: GoogleGenAI) {
    this.openaiVision = new OpenAIVisionClient(openaiClient);
    this.openaiImage = new OpenAIImageClient(openaiClient);
    this.geminiVision = new GeminiVisionClient(geminiClient);
    this.geminiImage = new GeminiImageClient(geminiClient);
  }

  resolveVisionClient(protocol: Protocol): VisionClient {
    return protocol === 'openai' ? this.openaiVision : this.geminiVision;
  }

  resolveImageClient(protocol: Protocol): ImageClient {
    return protocol === 'openai' ? this.openaiImage : this.geminiImage;
  }
}
```

- [ ] **Step 5: Run type check**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/main/services/model-clients/
git commit -m "feat: OpenAI + Gemini model clients with protocol resolver"
```

---

### Task 6: Artifact Store

**Goal:** Implement artifact persistence with the directory structure specified in the spec.

**Files:**
- Create: `src/main/services/artifact-store.ts`
- Test: `tests/unit/services/artifact-store.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/services/artifact-store.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { createArtifactStore } = await import('../../../src/main/services/artifact-store');

test('artifact store creates directory structure and saves files', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'tickpic-artifact-test-'));
  const store = createArtifactStore(tempDir);

  const taskId = 'test-task-001';
  const outputDir = store.getOutputDir(taskId);

  assert.ok(outputDir.includes('outputs'));
  assert.ok(outputDir.includes(taskId));

  store.saveRequest(taskId, { feature: 'sticker-replication', status: 'test' });
  store.savePromptEnhancement(taskId, { feature: 'sticker-replication', finalPrompt: 'test prompt' });
  store.savePrompt(taskId, 'test prompt text');
  store.saveResultImage(taskId, 1, Buffer.from('fake-image-data'));

  assert.ok(existsSync(join(outputDir, 'request.json')));
  assert.ok(existsSync(join(outputDir, 'prompt-enhancement.json')));
  assert.ok(existsSync(join(outputDir, 'prompt.txt')));
  assert.ok(existsSync(join(outputDir, 'result-1.png')));

  const requestContent = readFileSync(join(outputDir, 'request.json'), 'utf8');
  assert.match(requestContent, /sticker-replication/);

  rmSync(tempDir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
npm run test:unit -- tests/unit/services/artifact-store.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write artifact-store.ts**

Create `src/main/services/artifact-store.ts`:

```ts
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface ArtifactStore {
  getOutputDir(taskId: string): string;
  saveRequest(taskId: string, request: unknown): void;
  savePromptEnhancement(taskId: string, enhancement: unknown): void;
  savePrompt(taskId: string, prompt: string): void;
  saveImageResponse(taskId: string, response: unknown): void;
  saveResultImage(taskId: string, index: number, buffer: Buffer): string;
}

export function createArtifactStore(workspaceDir: string): ArtifactStore {
  function getDateDir(): string {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  }

  function getTaskDir(taskId: string): string {
    return join(workspaceDir, 'outputs', getDateDir(), taskId);
  }

  function ensureDir(dir: string): void {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  return {
    getOutputDir(taskId) {
      return getTaskDir(taskId);
    },

    saveRequest(taskId, request) {
      const dir = getTaskDir(taskId);
      ensureDir(dir);
      writeFileSync(join(dir, 'request.json'), JSON.stringify(request, null, 2) + '\n', 'utf8');
    },

    savePromptEnhancement(taskId, enhancement) {
      const dir = getTaskDir(taskId);
      ensureDir(dir);
      writeFileSync(join(dir, 'prompt-enhancement.json'), JSON.stringify(enhancement, null, 2) + '\n', 'utf8');
    },

    savePrompt(taskId, prompt) {
      const dir = getTaskDir(taskId);
      ensureDir(dir);
      writeFileSync(join(dir, 'prompt.txt'), prompt + '\n', 'utf8');
    },

    saveImageResponse(taskId, response) {
      const dir = getTaskDir(taskId);
      ensureDir(dir);
      const sanitized = sanitizeImageResponse(response);
      writeFileSync(join(dir, 'image-response.json'), JSON.stringify(sanitized, null, 2) + '\n', 'utf8');
    },

    saveResultImage(taskId, index, buffer) {
      const dir = getTaskDir(taskId);
      ensureDir(dir);
      const path = join(dir, `result-${index}.png`);
      writeFileSync(path, buffer);
      return path;
    },
  };
}

function sanitizeImageResponse(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeImageResponse);
  }
  if (value && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value)) {
      if (typeof entryValue === 'string' && isLikelyBase64ImageField(key)) {
        sanitized[key] = `[base64 omitted, length=${entryValue.length}]`;
      } else {
        sanitized[key] = sanitizeImageResponse(entryValue);
      }
    }
    return sanitized;
  }
  return value;
}

function isLikelyBase64ImageField(key: string): boolean {
  return key === 'b64_json' || key === 'base64' || key === 'image_base64';
}
```

- [ ] **Step 4: Run test**

```bash
npm run test:unit -- tests/unit/services/artifact-store.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/artifact-store.ts tests/unit/services/artifact-store.test.ts
git commit -m "feat: artifact store with workspace directory structure"
```

---

### Task 7: Task Queue

**Goal:** Implement async task queue with max-concurrent control, cancellation, and status event emission.

**Files:**
- Create: `src/main/services/task-queue.ts`
- Test: `tests/unit/services/task-queue.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/unit/services/task-queue.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

const { TaskQueue } = await import('../../../src/main/services/task-queue');

test('TaskQueue submits and executes tasks', async () => {
  const queue = new TaskQueue(2);
  const executed: string[] = [];
  const statuses: Array<{ taskId: string; status: string }> = [];

  queue.setExecutor({
    execute: async (taskId) => {
      executed.push(taskId);
    },
  });

  queue.on('status', (snapshot: any) => {
    statuses.push({ taskId: snapshot.taskId, status: snapshot.status });
  });

  const request = { feature: 'sticker-replication' as const };
  const taskId = queue.submit(request);

  assert.ok(taskId.startsWith('task-'));

  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(executed.length, 1);
  assert.equal(executed[0], taskId);

  const queuedStatus = statuses.find((s) => s.status === 'queued');
  assert.ok(queuedStatus);
  assert.equal(queuedStatus.taskId, taskId);

  const completedStatus = statuses.find((s) => s.status === 'completed');
  assert.ok(completedStatus);
  assert.equal(completedStatus.taskId, taskId);
});

test('TaskQueue cancels waiting tasks', () => {
  const queue = new TaskQueue(1); // Only 1 concurrent
  const executed: string[] = [];

  queue.setExecutor({
    execute: async (taskId) => {
      executed.push(taskId);
      await new Promise((resolve) => setTimeout(resolve, 100));
    },
  });

  const id1 = queue.submit({ feature: 'sticker-replication' as const });
  const id2 = queue.submit({ feature: 'sticker-replication' as const });

  const canceled = queue.cancel(id2);
  assert.equal(canceled, true);

  const status2 = queue.getStatus(id2);
  assert.equal(status2?.status, 'canceled');
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
npm run test:unit -- tests/unit/services/task-queue.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write task-queue.ts**

Create `src/main/services/task-queue.ts`:

```ts
import { EventEmitter } from 'node:events';
import type { ImageTaskRequest } from '../../shared/ipc-contracts';
import type { TaskStatus } from '../../shared/constants';

export interface TaskSnapshot {
  taskId: string;
  status: TaskStatus;
  feature: string;
  progress?: number;
  error?: string;
  outputDir?: string;
}

export interface TaskExecutor {
  execute(taskId: string, request: ImageTaskRequest, signal: AbortSignal): Promise<void>;
}

interface InternalTask {
  taskId: string;
  request: ImageTaskRequest;
  abortController: AbortController;
  status: TaskStatus;
}

export class TaskQueue extends EventEmitter {
  private maxConcurrent: number;
  private running = new Map<string, InternalTask>();
  private waiting: InternalTask[] = [];
  private counter = 0;
  private executor?: TaskExecutor;

  constructor(maxConcurrent = 5) {
    super();
    this.maxConcurrent = maxConcurrent;
  }

  setExecutor(executor: TaskExecutor): void {
    this.executor = executor;
  }

  submit(request: ImageTaskRequest): string {
    this.counter += 1;
    const taskId = `task-${this.counter}-${Date.now()}`;
    const task: InternalTask = {
      taskId,
      request,
      abortController: new AbortController(),
      status: 'queued',
    };

    this.waiting.push(task);
    this.emit('status', {
      taskId,
      status: 'queued',
      feature: request.feature,
    } as TaskSnapshot);

    this.processQueue();
    return taskId;
  }

  cancel(taskId: string): boolean {
    const waitingIndex = this.waiting.findIndex((t) => t.taskId === taskId);
    if (waitingIndex >= 0) {
      const task = this.waiting.splice(waitingIndex, 1)[0]!;
      this.emit('status', {
        taskId,
        status: 'canceled',
        feature: task.request.feature,
      } as TaskSnapshot);
      return true;
    }

    const runningTask = this.running.get(taskId);
    if (runningTask) {
      runningTask.abortController.abort();
      runningTask.status = 'canceled';
      this.emit('status', {
        taskId,
        status: 'canceled',
        feature: runningTask.request.feature,
      } as TaskSnapshot);
      return true;
    }

    return false;
  }

  getStatus(taskId: string): TaskSnapshot | undefined {
    const running = this.running.get(taskId);
    if (running) {
      return {
        taskId,
        status: running.status,
        feature: running.request.feature,
      };
    }
    const waiting = this.waiting.find((t) => t.taskId === taskId);
    if (waiting) {
      return {
        taskId,
        status: waiting.status,
        feature: waiting.request.feature,
      };
    }
    return undefined;
  }

  updateTaskStatus(taskId: string, status: TaskStatus): void {
    const task = this.running.get(taskId);
    if (task) {
      task.status = status;
      this.emit('status', {
        taskId,
        status,
        feature: task.request.feature,
      } as TaskSnapshot);
    }
  }

  private async processQueue(): Promise<void> {
    while (this.running.size < this.maxConcurrent && this.waiting.length > 0) {
      const task = this.waiting.shift()!;
      this.running.set(task.taskId, task);

      this.runTask(task).catch((error) => {
        if (task.status !== 'canceled') {
          this.emit('status', {
            taskId: task.taskId,
            status: 'failed',
            feature: task.request.feature,
            error: error instanceof Error ? error.message : String(error),
          } as TaskSnapshot);
        }
      });
    }
  }

  private async runTask(task: InternalTask): Promise<void> {
    if (!this.executor) {
      throw new Error('Task executor not set');
    }

    task.status = 'running';
    this.emit('status', {
      taskId: task.taskId,
      status: 'running',
      feature: task.request.feature,
    } as TaskSnapshot);

    try {
      await this.executor.execute(task.taskId, task.request, task.abortController.signal);
      if (task.status !== 'canceled') {
        task.status = 'completed';
        this.emit('status', {
          taskId: task.taskId,
          status: 'completed',
          feature: task.request.feature,
        } as TaskSnapshot);
      }
    } finally {
      this.running.delete(task.taskId);
      this.processQueue();
    }
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test:unit -- tests/unit/services/task-queue.test.ts
```

Expected: Both tests pass.

- [ ] **Step 5: Run type check**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/main/services/task-queue.ts tests/unit/services/task-queue.test.ts
git commit -m "feat: async task queue with concurrency control and cancellation"
```

