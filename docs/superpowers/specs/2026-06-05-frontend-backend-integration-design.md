---
comet_change: frontend-backend-integration
role: technical-design
canonical_spec: openspec
archived-with: 2026-06-05-frontend-backend-integration
status: final
---

# Frontend-Backend Integration Design Doc

## Context

Tickpic 的后端已完整实现 AI 作图两阶段流程，包括 OpenAI/Gemini 协议客户端、加密设置存储、任务队列、artifact 持久化。Preload 通过 `contextBridge` 暴露了完整的 `DesktopBridgeApi`。但前端 5 个核心组件（StickerGen、ProductProcessing、Settings、ImageUploader、Profile）全部使用模拟逻辑，从未调用 IPC 通道。

## Goals

- 前端生成组件通过 `desktop.imageTask.submit()` 提交真实任务
- 图片上传通过 `desktop.saveImportBatch()` 持久化到磁盘
- Settings 使用 `desktop.settings.get/save` 读写加密配置
- 任务状态通过 `desktop.imageTask.onStatus()` 实时更新
- 用户可完成端到端 AI 作图流程

## Non-Goals

- 不修改后端 IPC handler 或服务层
- 不统一旧任务系统和新 image task 系统
- 不实现任务取消 UI
- 不添加新模型协议支持

## Architecture

```
ImageUploader ──saveImportBatch(File[])──→ Main Process (磁盘持久化)
     ↓ 返回 ImportBatch (磁盘路径)
StickerGen/ProductProc ──useImageTask hook
     ↓ submit(ImageTaskRequest)
Main Process imageTaskController → executor → modelGateway → OpenAI/Gemini
     ↓ image-task:status 事件
useImageTask hook ← onStatus(ImageTaskRecord) ← preload bridge
     ↓ 更新 React state
UI 展示真实生成结果
```

## Technical Decisions

### 1. useImageTask Hook

**接口设计:**

```typescript
function useImageTask(): {
  submit: (request: ImageTaskRequest) => Promise<ImageTaskSubmitResult>;
  activeTask: ImageTaskRecord | null;
  isSubmitting: boolean;
  error: string | null;
  reset: () => void;
};
```

**内部实现:**
- `useRef` 跟踪 mounted 状态，防止卸载后更新
- `useState` 管理 activeTask、isSubmitting、error
- `useEffect` 注册 `desktop.imageTask.onStatus()` 监听器，通过 taskId 匹配事件
- 监听器在 mount 时注册一次，unmount 时调用返回的 unsubscribe 函数
- 状态映射：queued/running → isSubmitting=true, completed → activeTask 含输出, failed → error

**全局单监听器 vs 任务级监听器:**
选择全局单监听器：`onStatus` 在 hook mount 时订阅，通过当前 taskId 过滤事件。避免多个任务时的监听器管理复杂度。

### 2. ImageUploader 持久化

**流程:**
1. 用户上传 File 对象（drag-drop/paste/file-picker）
2. 立即调用 `desktop.saveImportBatch({ page, feature, files })` 
3. 返回 `ImportBatch`，其中 `images[].path` 是磁盘绝对路径
4. 用磁盘路径替换 blob URL 作为组件状态
5. 传给 `ImageTaskRequest.images[].path`

**序列化保证:**
- `SaveImportBatchRequest.files` 是 `File[]`，Electron IPC 使用结构化克隆，File 对象可序列化
- Main Process 接收后写入 `importsDir` 下的 batch 子目录

**错误处理:**
- `saveImportBatch` 失败时显示错误 toast
- 图片仍可预览（blob URL），但生成按钮禁用
- 重试机制：用户可点击"重新保存"按钮

### 3. Settings 双向同步

**读取:**
- mount 时调用 `desktop.settings.get()` 返回 `RendererAppSettings`
- `RendererAppSettings = Omit<AppSettings, 'n1nApiKey'> & { hasApiKey: boolean; apiKeyPreview?: string }`
- API Key 输入框：`hasApiKey ? '••••••••' : ''`，placeholder 显示 `apiKeyPreview`

**保存:**
- 用户输入新 key 时，构造完整 `AppSettings` 对象
- 需要维护一个 `apiKeyInput` 状态字段，仅在用户实际输入时包含
- 如果用户未修改 key，保存时 `n1nApiKey` 传空字符串或跳过（需与后端 schema 兼容）

**模型列表:**
- 硬编码支持的模型映射表：
  ```typescript
  const MODEL_OPTIONS = [
    { id: 'gemini-2.5-flash-image', protocol: 'gemini', label: 'Gemini 2.5 Flash Image' },
    { id: 'gpt-image-2', protocol: 'openai', label: 'GPT Image 2' },
    { id: 'gpt-5.4-mini', protocol: 'openai', label: 'GPT 5.4 Mini' },
    { id: 'gemini-3.1-flash-lite', protocol: 'gemini', label: 'Gemini 3.1 Flash Lite' },
  ];
  ```
- 三个 dropdown 分别对应 vision、generation、edit 阶段
- 选择后自动填充 `modelProtocols` 映射

**连接测试:**
- 当前无专用 IPC endpoint
- 方案：调用 `desktop.settings.get()` 验证 IPC 通道可用 + 配置可读
- 后续可新增 `desktop.settings.testConnection()` 做真实 API ping

### 4. 任务状态事件流

**事件模型:**
- 后端 `imageTaskIpc.ts` 在任务状态变化时向所有窗口广播 `image-task:status` 事件
- 事件 payload 是完整的 `ImageTaskRecord`（含 request、status、images、error、outputDir 等）
- preload 的 `onStatus` 返回 unsubscribe 函数

**前端处理:**
- `useImageTask` 在 mount 时注册监听器
- 收到事件时，检查 `event.taskId === currentTaskId`
- 匹配则更新 `activeTask` 状态
- completed 时 `activeTask.images` 包含输出图片路径（相对于 outputDir）
- 需要将路径转换为可显示的 URL（`file://` 协议或通过 IPC 读取）

**图片显示:**
- 输出图片保存在 `workspaceDir/outputs/{date}/{taskId}/`
- 前端需要用 `file://` 协议或 base64 data URL 显示
- 方案：在 `GenerationResult` 组件中使用 `file://` 路径（Electron 默认允许）

### 5. 组件改造细节

**StickerGen:**
- 三个子 tab 对应 feature ID：sticker_replica / sticker_variation / sticker_original
- 表单字段映射：
  - referenceImage → `images: [{ role: 'source', path }]`
  - logoImage → `images: [{ role: 'logo', path }]`
  - productName → `productName`
  - colorScheme → `colorScheme`
  - aspectRatio → `aspectRatio`
  - count → `count`
- 提交前检查：至少有一张 source 图片已持久化

**ProductProcessing:**
- 五个子 tab 对应 feature ID：
  - remove_product / replace_product / replace_logo / main_image_asset_variation / create_new_scene
- 差异化参数：
  - remove_product: source image only
  - replace_product: source + product images
  - replace_logo: source + logo images
  - scene_variation: source image + prompt
  - create_new_scene: prompt only (可能无图片)

**Profile (本次不改造):**
- 保持旧 tasks:list 展示
- 后续独立 change 接入 image task 历史

## Risks & Mitigations

| 风险 | 影响 | 缓解 |
|------|------|------|
| File 对象 IPC 序列化失败 | 图片无法持久化 | 降级为 ArrayBuffer 传输，后端适配 |
| RendererAppSettings 缺 API Key | 无法构造完整 AppSettings | 保存时要求用户输入 key，或新增 IPC 获取加密 key |
| onStatus 事件竞态 | 状态显示不一致 | useRef mounted 标记 + taskId 过滤 |
| 输出图片 file:// 协议限制 | 图片无法显示 | Electron webPreferences 中配置 file:// 访问策略 |
| Settings schema 版本不匹配 | 保存失败 | 后端已有版本迁移，前端传递当前 schemaVersion |

## Testing Strategy

1. **单元测试**: useImageTask hook 的状态机逻辑（mock desktopClient）
2. **集成测试**: Settings 读写往返（mock IPC）
3. **端到端验证**: 真实 API 调用，从配置到出图全流程
4. **错误路径**: 无效 API Key、网络断开、模型返回错误的 UI 反馈
