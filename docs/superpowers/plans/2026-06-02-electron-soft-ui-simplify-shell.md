# Electron Soft UI Simplify Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current Vite/React workspace into an Electron desktop app with Windows installer packaging, while removing the simulated shell chrome and softening the shared UI shell.

**Architecture:** Keep the existing React renderer intact and add a minimal Electron `main` and `preload` layer under `electron/`. Introduce packaging scripts and config in `package.json`, then verify the UI shell behavior through focused renderer tests before simplifying `WindowFrame` and `Sidebar`.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, Electron, electron-builder, Vitest, Testing Library

---

### Task 1: Add desktop runtime and test tooling

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Create: `tsconfig.electron.json`

- [ ] **Step 1: Add package metadata, Electron dependencies, test tooling, and scripts**

```json
{
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "vite --port=3000 --host=0.0.0.0",
    "dev:electron": "pnpm build:electron && electron dist-electron/main.js",
    "build": "vite build",
    "build:electron": "tsc -p tsconfig.electron.json",
    "dist:win": "pnpm build && pnpm build:electron && electron-builder --win nsis",
    "preview": "vite preview",
    "clean": "rm -rf dist dist-electron release server.js",
    "lint": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "electron": "^33.2.1",
    "electron-builder": "^25.1.8",
    "jsdom": "^25.0.1",
    "vitest": "^2.1.8"
  },
  "build": {
    "appId": "com.tickpic.desktop",
    "productName": "Tickpic",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "dist-electron/**/*",
      "package.json"
    ],
    "win": {
      "target": [
        "nsis"
      ]
    }
  }
}
```

- [ ] **Step 2: Update the main TypeScript config so test files are typechecked**

```json
{
  "compilerOptions": {
    "types": [
      "vitest/globals"
    ]
  },
  "include": [
    "src",
    "vite.config.ts",
    "vitest.setup.ts"
  ]
}
```

- [ ] **Step 3: Add a dedicated Electron TypeScript config**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist-electron",
    "noEmit": false,
    "allowImportingTsExtensions": false,
    "types": [
      "node"
    ]
  },
  "include": [
    "electron/**/*.ts"
  ]
}
```

### Task 2: Create failing shell simplification tests

**Files:**
- Create: `src/components/WindowFrame.test.tsx`
- Create: `src/components/Sidebar.test.tsx`
- Create: `vitest.setup.ts`

- [ ] **Step 1: Add Vitest setup for DOM assertions**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 2: Write a failing test that forbids the simulated titlebar content**

```tsx
import { render, screen } from '@testing-library/react';
import WindowFrame from './WindowFrame';

describe('WindowFrame', () => {
  it('does not render the simulated titlebar metadata', () => {
    render(
      <WindowFrame title="Tickpic">
        <div>content</div>
      </WindowFrame>,
    );

    expect(screen.queryByText(/ELECTRON EMULATOR/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ELECTRON \\+ TS/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the WindowFrame test and verify it fails because the old chrome still renders**

Run: `pnpm test src/components/WindowFrame.test.tsx`
Expected: FAIL with one or more titlebar strings still present in the document

- [ ] **Step 4: Write a failing test that forbids the sidebar footer status block**

```tsx
import { render, screen } from '@testing-library/react';
import Sidebar from './Sidebar';

describe('Sidebar', () => {
  it('does not render GPU or disk writing footer copy', () => {
    render(<Sidebar activeTab="sticker" onTabChange={() => {}} />);

    expect(screen.queryByText(/GPU ACCELERATED/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/LOCAL DISK WRITING/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run the Sidebar test and verify it fails because the footer still renders**

Run: `pnpm test src/components/Sidebar.test.tsx`
Expected: FAIL with the existing footer copy found in the document

### Task 3: Add the Electron desktop shell

**Files:**
- Create: `electron/main.ts`
- Create: `electron/preload.ts`

- [ ] **Step 1: Create the Electron main process**

```ts
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#d9dde8',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    void win.loadURL('http://127.0.0.1:3000');
    win.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  void win.loadFile(path.join(__dirname, '../dist/index.html'));
}

app.whenReady().then(() => {
  createMainWindow();

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

- [ ] **Step 2: Create a minimal preload bridge**

```ts
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('desktopShell', {
  platform: process.platform,
});
```

- [ ] **Step 3: Run the Electron build to verify the new entrypoints compile**

Run: `pnpm build:electron`
Expected: PASS and `dist-electron/main.js` plus `dist-electron/preload.js` exist

### Task 4: Simplify the shell UI and make tests pass

**Files:**
- Modify: `src/components/WindowFrame.tsx`
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Remove the old WindowFrame chrome and soften the shell styling**

```tsx
interface WindowFrameProps {
  children: React.ReactNode;
  title?: string;
}

export default function WindowFrame({ children }: WindowFrameProps) {
  return (
    <div className="min-h-screen bg-[#e7e4dc] text-slate-900 flex flex-col items-center justify-center p-3 sm:p-5 overflow-x-hidden relative" id="desktop-environment">
      <div className="absolute inset-x-0 top-[-15%] mx-auto h-[24rem] w-[24rem] rounded-full bg-[#cfd5e6]/45 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] h-[20rem] w-[20rem] rounded-full bg-[#d8cde2]/35 blur-[140px] pointer-events-none" />
      <div id="electron-main-window" className="w-full max-w-7xl h-[88vh] min-h-[640px] overflow-hidden rounded-[28px] border border-white/55 bg-[#f6f1ea]/86 shadow-[0_30px_90px_rgba(102,112,139,0.20)] backdrop-blur-xl">
        <div className="flex h-full overflow-hidden relative" id="electron-viewport">
          {children}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Remove the sidebar footer block and soften the navigation shell**

```tsx
return (
  <div className="w-[200px] md:w-[240px] bg-[#ece6df]/92 border-r border-[#d8d4cf] flex flex-col select-none shrink-0" id="app-sidebar">
    <div>
      <div className="p-5 flex items-center gap-3 border-b border-[#ddd7d2] bg-gradient-to-b from-[#f4efe7] to-[#ebe5dd]">
        ...
      </div>
      <div className="p-3 space-y-1.5 mt-3">
        ...
      </div>
    </div>
  </div>
);
```

- [ ] **Step 3: Re-run the focused UI tests and verify both now pass**

Run: `pnpm test src/components/WindowFrame.test.tsx src/components/Sidebar.test.tsx`
Expected: PASS

### Task 5: Verify the full desktop build path

**Files:**
- Modify: `vite.config.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Adjust build/runtime details only if the desktop shell needs them**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
  },
});
```

- [ ] **Step 2: Keep the app shell title neutral so it no longer references the removed fake Electron chrome**

```tsx
return (
  <WindowFrame title="Tickpic">
    <div className="flex-1 flex overflow-hidden w-full h-full" id="workspace-layout">
      ...
    </div>
  </WindowFrame>
);
```

- [ ] **Step 3: Run the typecheck**

Run: `pnpm lint`
Expected: PASS

- [ ] **Step 4: Run the renderer build**

Run: `pnpm build`
Expected: PASS and `dist/index.html` exists

- [ ] **Step 5: Run the Windows installer packaging command**

Run: `pnpm dist:win`
Expected: PASS and `release/` contains an `.exe` NSIS installer artifact

### Task 6: Update tracking artifacts

**Files:**
- Modify: `openspec/changes/electron-soft-ui-simplify-shell/tasks.md`

- [ ] **Step 1: Mark the OpenSpec tasks as completed after validation succeeds**

```md
## 1. Desktop Shell Setup

- [x] 1.1 Add Electron runtime, packaging dependencies, and desktop build scripts.
- [x] 1.2 Create Electron main/preload entry files and wire them to the built renderer output.
- [x] 1.3 Add packaging configuration for Windows application artifacts.
```

- [ ] **Step 2: Leave a brief implementation note if Windows packaging has environment-specific caveats**

```md
Packaging note: Windows NSIS output was verified through `pnpm dist:win`; platform-specific warnings, if any, are documented in the final verification summary.
```
