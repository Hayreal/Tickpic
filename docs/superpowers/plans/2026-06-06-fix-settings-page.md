---
change: fix-settings-page
design-doc: docs/superpowers/specs/2026-06-06-fix-settings-page-design.md
base-ref: 867e0db750f12a275e3fdad1898148954096f625
archived-with: 2026-06-06-fix-settings-page
---

# Fix Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复设置页面的四个问题：API Key 保存丢失、多余模型字段、假测试连接、配置未生效。

**Architecture:** 修改前端 Settings 组件和后端 settingsStore，添加真实测试连接 IPC 通道，简化模型配置类型。

**Tech Stack:** React, Electron IPC, TypeScript

archived-with: 2026-06-06-fix-settings-page
---

## File Structure

- `src/shared/domain/settings.ts` - 修改类型定义，移除 vision/edit
- `src/components/Settings.tsx` - 修改前端逻辑和 UI
- `electron/main/services/settings/settingsStore.ts` - 修改保存逻辑
- `electron/main/services/settings/settingsService.ts` - 添加测试连接
- `src/shared/contracts/desktop.ts` - 添加 IPC 通道
- `electron/main/ipc/registerDesktopHandlers.ts` - 注册新处理器

archived-with: 2026-06-06-fix-settings-page
---

### Task 1: Update Settings Type Definition

**Files:**
- Modify: `src/shared/domain/settings.ts`

- [ ] **Step 1: Update ImageStageModelSettings interface**

```typescript
export interface ImageStageModelSettings {
  generation: string;  // 移除 vision 和 edit
}
```

- [ ] **Step 2: Update createDefaultAppSettings**

```typescript
export function createDefaultAppSettings(workspaceDir: string): AppSettings {
  return {
    schemaVersion: 1,
    n1nApiKey: '',
    baseUrl: 'https://api.n1n.ai',
    workspaceDir,
    defaultModels: {
      generation: 'gemini-2.5-flash-image',
    },
    modelProtocols: {
      'gemini-3.1-flash-lite': 'gemini',
      'gemini-2.5-flash-image': 'gemini',
      'gemini-3.1-flash-image-preview': 'gemini',
      'gpt-image-2': 'openai',
      'gpt-5.4-mini': 'openai',
    },
    defaultCount: 1,
    maxCount: 8,
    maxConcurrentTasks: 5,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/domain/settings.ts
git commit -m "refactor: simplify ImageStageModelSettings to generation only"
```

archived-with: 2026-06-06-fix-settings-page
---

### Task 2: Update Settings Store Validation

**Files:**
- Modify: `electron/main/services/settings/settingsStore.ts`

- [ ] **Step 1: Remove vision/edit validation**

Remove these lines from `validateSettings`:
```typescript
if (!settings.defaultModels.vision.trim()) {
  throw new Error('defaultModels.vision is required');
}
// ...
if (!settings.defaultModels.edit.trim()) {
  throw new Error('defaultModels.edit is required');
}
```

- [ ] **Step 2: Add API Key preservation logic**

Update the `save` method:
```typescript
async save(settings) {
  const current = await this.load();
  const merged = {
    ...settings,
    n1nApiKey: settings.n1nApiKey === '__KEEP_EXISTING__'
      ? current.n1nApiKey
      : settings.n1nApiKey,
  };
  const validated = validateSettings(merged);
  await mkdir(path.dirname(settingsFile), { recursive: true });
  const payload: StoredSettingsPayload = {
    ...validated,
    n1nApiKey: encryptSecret(validated.n1nApiKey, encryptionKey),
  };
  await writeFile(settingsFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
},
```

- [ ] **Step 3: Commit**

```bash
git add electron/main/services/settings/settingsStore.ts
git commit -m "feat: add API Key preservation logic and remove vision/edit validation"
```

archived-with: 2026-06-06-fix-settings-page
---

### Task 3: Add Test Connection IPC Channel

**Files:**
- Modify: `src/shared/contracts/desktop.ts`
- Modify: `electron/main/services/settings/settingsService.ts`

- [ ] **Step 1: Add testConnection to IPC_CHANNELS**

```typescript
settings: {
  get: 'settings:get',
  save: 'settings:save',
  testConnection: 'settings:test-connection',
},
```

- [ ] **Step 2: Add testConnection to SettingsBridgeApi**

```typescript
export interface SettingsBridgeApi {
  get(): Promise<RendererAppSettings>;
  save(settings: AppSettings): Promise<void>;
  testConnection(): Promise<{ success: boolean; message: string }>;
}
```

- [ ] **Step 3: Implement testConnection handler**

```typescript
ipcMain.handle(IPC_CHANNELS.settings.testConnection, async () => {
  const settings = await store.load();
  const apiKey = settings.n1nApiKey.trim();
  if (!apiKey) {
    throw new Error('API Key 未配置');
  }

  const isOpenAI = settings.baseUrl.includes('openai');
  const url = isOpenAI
    ? `${settings.baseUrl}/models`
    : `${settings.baseUrl}/v1beta/models`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    throw new Error(`连接失败: ${response.status} ${response.statusText}`);
  }
  return { success: true, message: '连接成功' };
});
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/contracts/desktop.ts electron/main/services/settings/settingsService.ts
git commit -m "feat: add testConnection IPC channel and handler"
```

archived-with: 2026-06-06-fix-settings-page
---

### Task 4: Update Settings Component

**Files:**
- Modify: `src/components/Settings.tsx`

- [ ] **Step 1: Remove vision/edit state and UI**

Remove:
- `visionModel` state
- `editModel` state
- Vision model dropdown JSX
- Edit model dropdown JSX

- [ ] **Step 2: Change generation model to input**

Replace select with input:
```typescript
const [generationModel, setGenerationModel] = useState('gpt-image-2');
```

```jsx
<div className="space-y-2">
  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">生成模型</label>
  <input
    id="settings-generation-model"
    type="text"
    value={generationModel}
    onChange={(e) => setGenerationModel(e.target.value)}
    placeholder="输入模型 ID..."
    className="w-full bg-slate-950/80 rounded-xl border border-slate-850 focus:border-violet-500 focus:outline-none p-3.5 text-xs text-white placeholder-slate-600 transition-colors font-mono"
  />
  <p className="text-[11px] text-slate-500 font-sans">纯图片生成任务使用的模型。</p>
</div>
```

- [ ] **Step 3: Update handleSave to use __KEEP_EXISTING__**

```typescript
const settings: AppSettings = {
  schemaVersion: 1,
  n1nApiKey: apiKeyInput || (hasApiKey ? '__KEEP_EXISTING__' : ''),
  baseUrl,
  workspaceDir,
  defaultModels: {
    generation: generationModel,
  },
  modelProtocols,
  defaultCount,
  maxCount,
  maxConcurrentTasks,
};
```

- [ ] **Step 4: Implement real test connection**

```typescript
const handleTestConnection = async () => {
  if (!desktopClient) return;
  setTestState('testing');
  setTestMessage('');
  try {
    const result = await desktopClient.settings.testConnection();
    setTestState('success');
    setTestMessage(result.message);
  } catch (err) {
    setTestState('failed');
    setTestMessage(err instanceof Error ? err.message : 'Connection failed');
  }
};
```

- [ ] **Step 5: Remove vision/edit from useEffect**

Update the settings load to not set vision/edit models.

- [ ] **Step 6: Commit**

```bash
git add src/components/Settings.tsx
git commit -m "feat: simplify settings UI and implement real test connection"
```

archived-with: 2026-06-06-fix-settings-page
---

### Task 5: Update Preload Bridge

**Files:**
- Check if preload needs updates for testConnection

- [ ] **Step 1: Verify preload exposes testConnection**

Check `electron/preload/index.ts` or similar file to ensure `testConnection` is exposed.

- [ ] **Step 2: Add testConnection if missing**

```typescript
settings: {
  get: () => ipcRenderer.invoke(IPC_CHANNELS.settings.get),
  save: (settings) => ipcRenderer.invoke(IPC_CHANNELS.settings.save, settings),
  testConnection: () => ipcRenderer.invoke(IPC_CHANNELS.settings.testConnection),
},
```

- [ ] **Step 3: Commit**

```bash
git add electron/preload/
git commit -m "feat: expose testConnection in preload bridge"
```

archived-with: 2026-06-06-fix-settings-page
---

### Task 6: Verify Configuration Usage

**Files:**
- Modify: `electron/main/services/image-tasks/modelGatewayFactory.ts`

- [ ] **Step 1: Add logging for settings**

```typescript
export function createModelGatewayFromSettings(settings: AppSettings) {
  const apiKey = settings.n1nApiKey.trim();
  if (!apiKey) {
    throw new Error('n1n API Key is not configured');
  }

  console.log('[ModelGateway] Using baseUrl:', settings.baseUrl);
  console.log('[ModelGateway] API Key configured:', !!apiKey);

  return createProtocolModelGateway({
    // ... existing code
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add electron/main/services/image-tasks/modelGatewayFactory.ts
git commit -m "feat: add logging for model gateway configuration"
```

archived-with: 2026-06-06-fix-settings-page
---

### Task 7: Run Tests and Verify

- [ ] **Step 1: Run type check**

```bash
pnpm dlx tsc --noEmit
```

Expected: No errors

- [ ] **Step 2: Run unit tests**

```bash
pnpm test
```

Expected: All tests pass

- [ ] **Step 3: Manual verification checklist**

1. 保存空 API Key 时保留已有 Key
2. 保存新 API Key 正确覆盖
3. 测试连接成功/失败场景
4. 生成模型输入框工作正常
5. 配置正确传递到模型调用

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix: complete settings page fixes"
```
