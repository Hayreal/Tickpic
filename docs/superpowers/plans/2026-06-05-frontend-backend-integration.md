---
change: frontend-backend-integration
design-doc: docs/superpowers/specs/2026-06-05-frontend-backend-integration-design.md
base-ref: ac79070df3c4a0a4e813abb66390842fe607514a
archived-with: 2026-06-05-frontend-backend-integration
---

# Frontend-Backend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the frontend UI components to the already-implemented Electron Main Process IPC services, replacing all simulated/mock logic with real model calls.

**Architecture:** A new `useImageTask` hook encapsulates task submission and status subscription. `ImageUploader` persists files to disk via `saveImportBatch` before task submission. `Settings` migrates from `localStorage` to the encrypted Electron settings store. StickerGen and ProductProcessing replace `setInterval` simulations with real `imageTask.submit()` calls.

**Tech Stack:** React hooks, Electron IPC (contextBridge), TypeScript

archived-with: 2026-06-05-frontend-backend-integration
---

### Task 1: Create `useImageTask` Hook

**Files:**
- Create: `src/hooks/useImageTask.ts`

- [ ] **Step 1: Create the hook file with full implementation**

```typescript
// src/hooks/useImageTask.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import type { ImageTaskRequest, ImageTaskSubmitResult, ImageTaskRecord } from '../shared/domain/imageFeatureApi';
import { useDesktopClient } from './useDesktopClient';

export interface UseImageTaskReturn {
  submit: (request: ImageTaskRequest) => Promise<ImageTaskSubmitResult>;
  activeTask: ImageTaskRecord | null;
  isSubmitting: boolean;
  error: string | null;
  reset: () => void;
}

export function useImageTask(): UseImageTaskReturn {
  const desktopClient = useDesktopClient();
  const [activeTask, setActiveTask] = useState<ImageTaskRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!desktopClient || !currentTaskId) return;

    const unsubscribe = desktopClient.imageTask.onStatus((task: ImageTaskRecord) => {
      if (!mountedRef.current) return;
      if (task.taskId !== currentTaskId) return;

      setActiveTask(task);

      if (task.status === 'completed' || task.status === 'failed' || task.status === 'canceled') {
        setIsSubmitting(false);
        if (task.status === 'failed' && task.error) {
          setError(task.error.message);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [desktopClient, currentTaskId]);

  const submit = useCallback(async (request: ImageTaskRequest): Promise<ImageTaskSubmitResult> => {
    if (!desktopClient) {
      throw new Error('Desktop bridge unavailable');
    }

    setError(null);
    setIsSubmitting(true);
    setActiveTask(null);

    try {
      const result = await desktopClient.imageTask.submit(request);
      setCurrentTaskId(result.taskId);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Task submission failed';
      setError(message);
      setIsSubmitting(false);
      throw err;
    }
  }, [desktopClient]);

  const reset = useCallback(() => {
    setActiveTask(null);
    setIsSubmitting(false);
    setError(null);
    setCurrentTaskId(null);
  }, []);

  return { submit, activeTask, isSubmitting, error, reset };
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors related to `useImageTask.ts`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useImageTask.ts
git commit -m "feat: add useImageTask hook for task lifecycle management"
```

archived-with: 2026-06-05-frontend-backend-integration
---

### Task 2: Modify ImageUploader for Disk Persistence

**Files:**
- Modify: `src/components/ImageUploader.tsx`

- [ ] **Step 1: Update ImageUploader to persist files via IPC**

Replace the `buildBatch` callback and `processFiles` function. The key change: instead of creating blob URLs locally, call `desktop.saveImportBatch()` to persist files to disk and get real file paths.

In `src/components/ImageUploader.tsx`, add import at top:

```typescript
import { useDesktopClient } from '../hooks/useDesktopClient';
```

Inside the component function, add:

```typescript
const desktopClient = useDesktopClient();
const [isSaving, setIsSaving] = useState(false);
const [saveError, setSaveError] = useState<string | null>(null);
```

Add `useState` to the React import.

Replace the `processFiles` callback:

```typescript
const processFiles = useCallback(
  async (rawFiles: File[]) => {
    const result = collectImportFiles(rawFiles);
    if (result.hasOverflow) {
      console.warn(`最多导入 4 张图片，已忽略 ${result.rejectedCount} 张`);
    }
    if (result.accepted.length === 0) return;

    if (!desktopClient) {
      console.warn('Desktop bridge unavailable, falling back to blob URLs');
      onBatchChange(buildBatch(result.accepted));
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const saved = await desktopClient.saveImportBatch({
        page,
        feature,
        files: result.accepted,
      });
      onBatchChange(saved);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save images';
      setSaveError(message);
      onBatchChange(buildBatch(result.accepted));
    } finally {
      setIsSaving(false);
    }
  },
  [buildBatch, onBatchChange, desktopClient, page, feature],
);
```

After the upload area `<div>`, add error/saving indicator:

```typescript
{isSaving && (
  <p className="text-[10px] text-violet-400 animate-pulse">正在保存图片...</p>
)}
{saveError && (
  <p className="text-[10px] text-red-400">保存失败: {saveError}（图片仅在内存中可用）</p>
)}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ImageUploader.tsx
git commit -m "feat: persist uploaded images to disk via saveImportBatch IPC"
```

archived-with: 2026-06-05-frontend-backend-integration
---

### Task 3: Migrate Settings Component

**Files:**
- Modify: `src/components/Settings.tsx`

- [ ] **Step 1: Rewrite Settings to use IPC bridge**

Replace the entire `Settings.tsx` content. Key changes:
- Load settings via `desktop.settings.get()` on mount
- Save via `desktop.settings.save()` with full `AppSettings`
- Model dropdowns aligned with backend models
- Connection test via IPC

```typescript
import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Eye,
  EyeOff,
  Save,
  Wifi,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import type { AppSettings, RendererAppSettings } from '../shared/domain/settings';
import { useDesktopClient } from '../hooks/useDesktopClient';

const MODEL_OPTIONS = [
  { id: 'gemini-2.5-flash-image', protocol: 'gemini' as const, label: 'Gemini 2.5 Flash Image' },
  { id: 'gpt-image-2', protocol: 'openai' as const, label: 'GPT Image 2' },
  { id: 'gpt-5.4-mini', protocol: 'openai' as const, label: 'GPT 5.4 Mini' },
  { id: 'gemini-3.1-flash-lite', protocol: 'gemini' as const, label: 'Gemini 3.1 Flash Lite' },
];

export default function Settings() {
  const desktopClient = useDesktopClient();

  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyPreview, setApiKeyPreview] = useState('');
  const [showKey, setShowKey] = useState(false);

  const [visionModel, setVisionModel] = useState('gemini-2.5-flash-image');
  const [generationModel, setGenerationModel] = useState('gpt-image-2');
  const [editModel, setEditModel] = useState('gpt-image-2');

  const [testState, setTestState] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    if (!desktopClient) return;
    desktopClient.settings.get().then((settings: RendererAppSettings) => {
      setBaseUrl(settings.baseUrl);
      setHasApiKey(settings.hasApiKey);
      setApiKeyPreview(settings.apiKeyPreview ?? '');
      setVisionModel(settings.defaultModels.vision);
      setGenerationModel(settings.defaultModels.generation);
      setEditModel(settings.defaultModels.edit);
    }).catch(console.error);
  }, [desktopClient]);

  const handleSave = async () => {
    if (!desktopClient) return;
    setSaveMessage('');

    const modelProtocols: Record<string, 'openai' | 'gemini'> = {};
    MODEL_OPTIONS.forEach((m) => {
      modelProtocols[m.id] = m.protocol;
    });

    const settings: AppSettings = {
      schemaVersion: 1,
      n1nApiKey: apiKeyInput || '',
      baseUrl,
      workspaceDir: '',
      defaultModels: {
        vision: visionModel,
        generation: generationModel,
        edit: editModel,
      },
      modelProtocols,
      defaultCount: 4,
      maxCount: 8,
      maxConcurrentTasks: 5,
    };

    try {
      await desktopClient.settings.save(settings);
      setSaveMessage('success');
      setApiKeyInput('');
      const updated = await desktopClient.settings.get();
      setHasApiKey(updated.hasApiKey);
      setApiKeyPreview(updated.apiKeyPreview ?? '');
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const handleTestConnection = async () => {
    if (!desktopClient) return;
    setTestState('testing');
    setTestMessage('');
    try {
      await desktopClient.settings.get();
      setTestState('success');
      setTestMessage('IPC 通道正常，配置已读取。');
    } catch (err) {
      setTestState('failed');
      setTestMessage(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  if (!desktopClient) {
    return (
      <div className="flex-1 bg-[#111015] p-6 flex items-center justify-center">
        <p className="text-slate-500 text-sm">需要 Electron 环境才能使用设置功能</p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#111015] p-6 md:p-8 flex flex-col overflow-y-auto select-none">
      <div className="mb-6 flex flex-col gap-1.5">
        <h2 className="text-xl font-sans font-bold text-white flex items-center gap-2">设置</h2>
        <p className="text-[12px] text-slate-500 font-sans tracking-wide">
          配置您的工作区和 AI 模型集成。
        </p>
      </div>

      <div className="w-full max-w-3xl bg-[#0c0b10]/40 rounded-xl border border-slate-900/80 p-6 space-y-6">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-900">
          <div className="w-8 h-8 rounded-lg bg-violet-950/10 border border-violet-500/10 flex items-center justify-center text-[#a78bfa]">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest leading-none">AI 模型配置</h3>
            <p className="text-[10px] text-slate-500 font-sans mt-1">设置您的 API 令牌和主机网关端点</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* API Key */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">模型 API 密钥</label>
              {hasApiKey && (
                <span className="text-[10px] text-emerald-400 font-mono">已配置 ({apiKeyPreview})</span>
              )}
            </div>
            <div className="relative flex items-center">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={hasApiKey ? '输入新密钥以更换...' : '请输入您的 API Key...'}
                className="w-full bg-slate-950/80 rounded-xl border border-slate-850 focus:border-violet-500 focus:outline-none p-3.5 pr-12 text-xs text-white placeholder-slate-600 tracking-wide transition-colors font-mono"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="cursor-pointer absolute right-3.5 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Base URL */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">基础 URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="例如 https://api.openai.com/v1"
              className="w-full bg-slate-950/80 rounded-xl border border-slate-850 focus:border-violet-500 focus:outline-none p-3.5 text-xs text-white placeholder-slate-600 transition-colors font-mono"
            />
          </div>

          {/* Vision Model */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">视觉理解模型 (Vision)</label>
            <select
              value={visionModel}
              onChange={(e) => setVisionModel(e.target.value)}
              className="cursor-pointer w-full bg-slate-950/80 rounded-xl border border-slate-850 focus:border-violet-500 focus:outline-none p-3.5 text-xs text-white appearance-none"
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m.id} value={m.id} className="bg-[#0c0b10] text-slate-300">
                  {m.label} ({m.protocol})
                </option>
              ))}
            </select>
          </div>

          {/* Generation Model */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">图片生成模型 (Generation)</label>
            <select
              value={generationModel}
              onChange={(e) => setGenerationModel(e.target.value)}
              className="cursor-pointer w-full bg-slate-950/80 rounded-xl border border-slate-850 focus:border-violet-500 focus:outline-none p-3.5 text-xs text-white appearance-none"
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m.id} value={m.id} className="bg-[#0c0b10] text-slate-300">
                  {m.label} ({m.protocol})
                </option>
              ))}
            </select>
          </div>

          {/* Edit Model */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">图片编辑模型 (Edit)</label>
            <select
              value={editModel}
              onChange={(e) => setEditModel(e.target.value)}
              className="cursor-pointer w-full bg-slate-950/80 rounded-xl border border-slate-850 focus:border-violet-500 focus:outline-none p-3.5 text-xs text-white appearance-none"
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m.id} value={m.id} className="bg-[#0c0b10] text-slate-300">
                  {m.label} ({m.protocol})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-900">
          <button
            onClick={handleTestConnection}
            disabled={testState === 'testing'}
            className={`cursor-pointer px-5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all text-slate-300 border border-slate-850 hover:bg-slate-900/60 ${testState === 'testing' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {testState === 'testing' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                正在连通测试...
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-[#a78bfa]" />
                测试连接
              </>
            )}
          </button>
          <button
            onClick={handleSave}
            className="cursor-pointer bg-[#7c3aed] hover:bg-[#8b5cf6] text-white px-5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition-all active:scale-[0.98]"
          >
            <Save className="w-3.5 h-3.5" />
            保存配置
          </button>
        </div>

        {/* Status messages */}
        {testState === 'success' && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
            <div>
              <p className="font-bold leading-none">测试连接成功！</p>
              <p className="mt-1 text-[11px] text-slate-400">{testMessage}</p>
            </div>
          </div>
        )}
        {testState === 'failed' && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <div>
              <p className="font-bold leading-none">连接测试失败</p>
              <p className="mt-1 text-[11px] text-slate-400">{testMessage}</p>
            </div>
          </div>
        )}
        {saveMessage === 'success' && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
            配置已保存！
          </div>
        )}
        {saveMessage && saveMessage !== 'success' && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            保存失败: {saveMessage}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/Settings.tsx
git commit -m "feat: migrate Settings from localStorage to Electron encrypted store"
```

archived-with: 2026-06-05-frontend-backend-integration
---

### Task 4: Modify StickerGen for Real Task Submission

**Files:**
- Modify: `src/components/StickerGen.tsx`

- [ ] **Step 1: Replace simulation with useImageTask**

In `src/components/StickerGen.tsx`:

Add imports at top:

```typescript
import { useImageTask } from '../hooks/useImageTask';
import { useDesktopClient } from '../hooks/useDesktopClient';
import type { ImageTaskRequest, ImageFeature } from '../shared/domain/imageFeatureApi';
```

Inside the component, replace the simulation-related state and logic. Remove:
- `catStickerSvg`, `fluidStickerSvg`, `metallicCubeSvg`, `violetFlowerSvg` constants
- The `runGeneration` function's `setInterval` logic

Add at the top of the component body:

```typescript
const desktopClient = useDesktopClient();
const { submit, activeTask, isSubmitting, error, reset } = useImageTask();
```

Replace the `runGeneration` function:

```typescript
const FEATURE_MAP: Record<StickerSubTab, ImageFeature> = {
  copy: 'sticker_replica',
  variation: 'sticker_variation',
  original: 'sticker_original',
};

const runGeneration = async (type: StickerSubTab) => {
  if (type === 'copy' && !copyBatch) {
    alert('请先上传一张贴纸作为参考图片！');
    return;
  }
  if (type === 'variation' && !variationBatch) {
    alert('请先上传一张参考贴纸！');
    return;
  }
  if (type === 'original' && !originalCategory && !originalBrand && !originalSellingPoint) {
    alert('请输入产品类别、品牌或卖点！');
    return;
  }

  const batch = type === 'copy' ? copyBatch : type === 'variation' ? variationBatch : originalBatch;

  const images: ImageTaskRequest['images'] = [];
  if (batch && batch.images.length > 0) {
    images.push({ role: 'source', path: batch.images[0].filePath });
  }
  if (type === 'copy' && copyLogo && copyLogo.images.length > 0) {
    images.push({ role: 'logo', path: copyLogo.images[0].filePath });
  }

  const request: ImageTaskRequest = {
    feature: FEATURE_MAP[type],
    images,
    count: type === 'copy' ? copyCount : type === 'variation' ? variationCount : originalCount,
    ...(type === 'copy' && {
      productName: copyProductName || undefined,
      colorScheme: copyColorScheme || undefined,
      aspectRatio: copyAspectRatio,
    }),
    ...(type === 'variation' && {
      colorScheme: variationColorScheme || undefined,
      prompt: variationPrompt || undefined,
    }),
    ...(type === 'original' && {
      productName: originalBrand || undefined,
      productCategory: originalCategory || undefined,
      sellingPoints: originalSellingPoint ? [originalSellingPoint] : undefined,
      capacity: originalVolume || undefined,
      colorScheme: originalColorScheme || undefined,
      prompt: originalStyle ? `Style: ${originalStyle}` : undefined,
    }),
  };

  try {
    await submit(request);
  } catch (err) {
    console.error('Task submission failed:', err);
  }
};
```

Replace the results display logic. For the `copyResults`/`variationResults`/`originalResults` state, derive from `activeTask`:

```typescript
const resultImages = activeTask?.status === 'completed' ? activeTask.images : [];
```

Update the progress display to use `isSubmitting` and `activeTask.status` instead of `genProgress`:

```typescript
{isSubmitting && (
  <div className="mb-6 p-4 rounded-xl bg-slate-950/80 border border-violet-500/10 shadow-sm animate-pulse">
    <div className="flex items-center justify-between text-xs text-white mb-2 font-mono">
      <span className="font-sans flex items-center gap-2">
        <Cpu className="w-3.5 h-3.5 text-violet-400 animate-spin" />
        {activeTask?.status === 'running' ? 'AI 模型正在生成...' : '任务排队中...'}
      </span>
    </div>
    <div className="w-full bg-slate-900 rounded-full h-1 overflow-hidden">
      <div className="bg-gradient-to-r from-violet-600 to-indigo-500 h-1 animate-pulse" style={{ width: '60%' }} />
    </div>
  </div>
)}
```

Remove all hardcoded SVG constants and the `setInterval` simulation code.

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/StickerGen.tsx
git commit -m "feat: replace StickerGen simulation with real image task submission"
```

archived-with: 2026-06-05-frontend-backend-integration
---

### Task 5: Modify ProductProcessing for Real Task Submission

**Files:**
- Modify: `src/components/ProductProcessing.tsx`

- [ ] **Step 1: Replace simulation with useImageTask**

Same pattern as StickerGen. Add imports:

```typescript
import { useImageTask } from '../hooks/useImageTask';
import { useDesktopClient } from '../hooks/useDesktopClient';
import type { ImageTaskRequest, ImageFeature } from '../shared/domain/imageFeatureApi';
```

Add inside component:

```typescript
const desktopClient = useDesktopClient();
const { submit, activeTask, isSubmitting, error, reset } = useImageTask();
```

Define feature mapping:

```typescript
const FEATURE_MAP: Record<ProductSubTab, ImageFeature> = {
  remove: 'remove_product',
  replace: 'replace_product',
  logo: 'replace_logo',
  theme: 'main_image_asset_variation',
  scene: 'create_new_scene',
};
```

Replace `runProcessing` function:

```typescript
const runProcessing = async (type: ProductSubTab) => {
  if (type === 'remove' && !removeBatch) {
    alert('请添加需要待去除的产品原图！');
    return;
  }
  if (type === 'replace' && (!replaceSceneBatch || !replaceProductBatch)) {
    alert('请同时上传原场景背景图和目标产品图！');
    return;
  }
  if (type === 'logo' && (!logoSourceBatch || !logoTargetBatch)) {
    alert('请先上传原图和透明背书新Logo！');
    return;
  }
  if (type === 'theme' && !themeRefBatch) {
    alert('请输入场景参考图以开始裂变分析');
    return;
  }
  if (type === 'scene' && !sceneDesc) {
    alert('请输入产品品类/场景描述');
    return;
  }

  const images: ImageTaskRequest['images'] = [];

  if (type === 'remove' && removeBatch) {
    images.push({ role: 'source', path: removeBatch.images[0].filePath });
  } else if (type === 'replace') {
    if (replaceSceneBatch) images.push({ role: 'source', path: replaceSceneBatch.images[0].filePath });
    if (replaceProductBatch) images.push({ role: 'product', path: replaceProductBatch.images[0].filePath });
  } else if (type === 'logo') {
    if (logoSourceBatch) images.push({ role: 'source', path: logoSourceBatch.images[0].filePath });
    if (logoTargetBatch) images.push({ role: 'logo', path: logoTargetBatch.images[0].filePath });
  } else if (type === 'theme' && themeRefBatch) {
    images.push({ role: 'source', path: themeRefBatch.images[0].filePath });
  } else if (type === 'scene' && sceneRefBatch) {
    images.push({ role: 'source', path: sceneRefBatch.images[0].filePath });
  }

  const request: ImageTaskRequest = {
    feature: FEATURE_MAP[type],
    images,
    count: type === 'theme' ? themeCount : type === 'scene' ? sceneCount : 1,
    ...(type === 'remove' && { prompt: removeDesc || undefined }),
    ...(type === 'replace' && { prompt: replaceDesc || undefined }),
    ...(type === 'logo' && { prompt: logoDesc || undefined }),
    ...(type === 'theme' && { prompt: themePrompt || undefined }),
    ...(type === 'scene' && { prompt: sceneDesc }),
  };

  try {
    await submit(request);
  } catch (err) {
    console.error('Task submission failed:', err);
  }
};
```

Remove all hardcoded SVG constants (`perfumeSvg`, `skincareCreamSvg`, etc.) and the `setInterval` simulation code.

Update result display to use `activeTask.images` when completed.

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ProductProcessing.tsx
git commit -m "feat: replace ProductProcessing simulation with real image task submission"
```

archived-with: 2026-06-05-frontend-backend-integration
---

### Task 6: Integration Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run TypeScript type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run unit tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 3: Manual end-to-end verification checklist**

1. Launch the Electron app
2. Navigate to Settings → verify settings load from Electron store
3. Enter API Key → save → verify encrypted storage
4. Navigate to StickerGen → upload image → verify file persists to disk
5. Click generate → verify real task submission (no fake progress bar)
6. Verify status updates arrive in real-time
7. Verify generated images display from actual model output
8. Repeat for ProductProcessing tabs

- [ ] **Step 4: Final commit with all fixes**

```bash
git add -A
git commit -m "feat: complete frontend-backend integration for AI image tasks"
```
