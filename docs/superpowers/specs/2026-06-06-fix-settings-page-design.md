---
comet_change: fix-settings-page
role: technical-design
canonical_spec: openspec
archived-with: 2026-06-06-fix-settings-page
status: final
---

# Design: Fix Settings Page Issues

## Overview

修复设置页面的四个关键问题：API Key 保存丢失、多余模型字段、假测试连接、配置未生效。

## Technical Design

### 1. API Key 保存逻辑

**Problem**: `handleSave` 发送 `n1nApiKey: apiKeyInput || ''`，空输入覆盖已有 Key。

**Solution**:

前端 `Settings.tsx`:
```typescript
const settings: AppSettings = {
  // ...
  n1nApiKey: apiKeyInput || (hasApiKey ? '__KEEP_EXISTING__' : ''),
  // ...
};
```

后端 `settingsStore.ts` save 方法:
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
  // ... write to file
}
```

### 2. 简化模型配置

**Changes**:

类型 `settings.ts`:
```typescript
export interface ImageStageModelSettings {
  generation: string;  // 移除 vision 和 edit
}
```

`createDefaultAppSettings`:
```typescript
defaultModels: {
  generation: 'gemini-2.5-flash-image',
},
```

`Settings.tsx`: 移除 vision/edit 下拉框，generation 改为输入框。

`settingsStore.ts` validation: 移除 vision/edit 校验。

### 3. 真实测试连接

**New IPC Channel**:
```typescript
settings: {
  get: 'settings:get',
  save: 'settings:save',
  testConnection: 'settings:test-connection',  // 新增
}
```

**Backend Implementation** (`settingsService.ts`):
```typescript
ipcMain.handle(IPC_CHANNELS.settings.testConnection, async () => {
  const settings = await store.load();
  const apiKey = settings.n1nApiKey.trim();
  if (!apiKey) throw new Error('API Key 未配置');

  // 根据 baseUrl 判断协议类型
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

**Frontend**: 调用 `desktopClient.settings.testConnection()`。

### 4. 配置生效保证

`modelGatewayFactory.ts` 已正确使用 `settings.n1nApiKey` 和 `settings.baseUrl`。

添加日志:
```typescript
console.log('[ModelGateway] Using baseUrl:', settings.baseUrl);
console.log('[ModelGateway] API Key configured:', !!settings.n1nApiKey.trim());
```

## Data Flow

```
┌─────────────┐     save      ┌─────────────────┐
│ Settings.tsx │──────────────▶│ settingsService  │
└─────────────┘               └────────┬────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │  settingsStore   │
                              │  (merge logic)   │
                              └─────────────────┘

┌─────────────┐  testConnection ┌─────────────────┐
│ Settings.tsx │────────────────▶│ settingsService  │
└─────────────┘                 └────────┬────────┘
                                         │
                                         ▼
                                ┌─────────────────┐
                                │  fetch API call  │
                                └─────────────────┘
```

## Testing Strategy

1. 保存空 API Key 时保留已有 Key
2. 保存新 API Key 正确覆盖
3. 测试连接成功/失败场景
4. 配置正确传递到模型调用

## Risk Mitigation

- `__KEEP_EXISTING__` 标记使用不太可能被用户输入的字符串
- 测试连接失败不影响正常使用
- 类型变更需要同步更新所有使用处
