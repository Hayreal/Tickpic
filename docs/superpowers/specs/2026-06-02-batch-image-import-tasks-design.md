---
archived-with: 2026-06-02-batch-image-import-tasks
status: final
status: final
---
## Context

Tickpic 当前的图片输入体验仍停留在页面 demo 阶段。`src/components/StickerGen.tsx` 和 `src/components/ProductProcessing.tsx` 把上传逻辑直接写在组件里，输入源只有单张拖拽和单张文件选择，状态是 `string | null` 形式的 data URL，本地文件系统完全未参与。与此同时，`src/App.tsx` 和 `src/components/Profile.tsx` 中的任务系统只是把一次操作映射成一条轻量任务字符串，既没有真实批次概念，也没有导入/出图记录。

这次需求把两个问题连在了一起：
- 导入层必须升级为真实的多图批次导入能力，并且图片要写入项目本地目录。
- 任务层必须从“点击后追加一条文案”升级为“带批次、状态、导入记录、出图记录的真实任务”。

当前项目已经运行在 Electron 壳下，`electron/main.ts` 和 `electron/preload.ts` 是最合适的本地能力落点。因此这次设计会把“渲染进程交互”、“Electron 本地存储桥接”、“任务持久化模型”一并梳理清楚。

## Goals

- 为所有页面的所有图片上传区域提供统一的多图导入能力。
- 支持三种导入方式：拖拽、批量文件选择、上传区聚焦后的粘贴导入。
- 单次导入最多支持 4 张图片，并在当前页面展示该批次的全部图片。
- 将导入图片写入项目目录下的本地批次文件夹。
- 只有在点击开始生成后才创建任务。
- 任务必须包含任务批次 ID、导入记录、出图记录以及状态流转：待处理、进行中、成功、失败。
- 个人中心展示真实任务列表，并支持查看任务关联记录。

## Non-Goals

- 不做跨页面素材历史回显。
- 不做超过 4 张的连续队列导入或后台作业调度。
- 不在本次引入远程服务端任务系统；任务持久化先保持本地。
- 不设计全局素材库 UI。

## Current-State Problems

1. 上传能力重复且狭窄
   `StickerGen` 和 `ProductProcessing` 都直接监听 `drop` / `change`，且只读取 `files[0]`。这意味着每加一个上传区，就会复制一次几乎相同的代码，也天然不支持批量导入。

2. 渲染状态与本地文件脱节
   当前上传后的图片只活在组件 state 里，应用重启即丢失，也无法为后续任务记录提供稳定的本地文件路径。

3. 任务系统没有真实边界
   现在 `onAddTask(feature)` 只在生成结束时追加一条任务文案，既不能表示“待处理/进行中”，也不能绑定导入批次，更没有出图记录。

## Architecture

方案采用三层拆分：

1. 批次导入层
   在渲染进程中新增共享类型和导入控制逻辑，负责：
   - 收集拖拽、文件选择、粘贴得到的 `File[]`
   - 过滤非图片
   - 限制单次最多 4 张
   - 调用 preload API 将文件写入本地批次目录
   - 将返回的本地元数据映射为页面可渲染的当前批次状态

2. Electron 本地存储层
   在 `preload.ts` 暴露受控的 `desktopShell` API，在 `main.ts` 负责：
   - 创建导入批次目录
   - 写入导入图片
   - 创建输出目录并写入模拟出图文件
   - 读写任务 JSON 存储

3. 任务持久化层
   在 `App.tsx` 上层统一维护任务读取、任务创建和任务状态更新接口。各功能页在点击“开始生成”时请求创建任务，在生成进度推进和完成时更新任务。

## Data Model

建议新增以下核心结构：

```ts
type TaskStatus = 'Pending' | 'Running' | 'Completed' | 'Failed';

interface StoredImageRecord {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

interface ImportBatch {
  batchId: string;
  page: 'sticker' | 'product';
  feature: string;
  images: StoredImageRecord[];
  createdAt: string;
}

interface TaskRecord {
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

目录约定：

```text
storage/
  imports/<page>/<feature>/<batchId>/*
  outputs/<page>/<feature>/<taskId>/*
  tasks/tasks.json
```

这套结构把“导入批次”和“生成任务”明确分开。一个页面当前只需要持有“当前批次”，而任务中心只关心已经开始生成的 `TaskRecord`。

## Key Decisions

### 1. 使用共享批次模型，而不是给每个上传区单独扩成数组

原因：
- 需求是“所有页面统一支持多图导入”，这本质是横切能力。
- 共享模型能把拖拽、粘贴、校验、落盘、错误提示统一起来。

替代方案：
- 直接把每个 `string | null` 改成 `string[]`。

不选原因：
- 只能解决显示多张，不能解决本地落盘和任务绑定。
- 重复逻辑会继续散落在多个组件里。

### 2. 粘贴导入只在上传区聚焦后启用

原因：
- 这是你明确指定的交互边界。
- 可以避免与 prompt 文本框、设置输入框冲突。

实现上，上传区需要具备可聚焦行为，并在获得焦点时注册当前目标；粘贴事件只作用于当前聚焦上传区。

### 3. 导入即落盘，开始生成才建任务

原因：
- 导入图片需要稳定的本地路径，后续任务和出图也需要引用它们。
- 你明确要求个人中心不记录单独导入行为。

因此导入层生成的是 `ImportBatch`，任务层消费的是该批次，而不是在导入时直接创建任务。

### 4. 任务存储先使用本地 JSON

原因：
- 当前项目没有后端任务服务。
- 本地 JSON 足以满足个人中心读取、刷新、状态展示和详情查看。

替代方案：
- IndexedDB 或 SQLite。

不选原因：
- IndexedDB 不利于和 Electron 文件目录统一管理。
- SQLite 对当前需求偏重。

## Integration Plan

### Renderer

- 抽出共享导入 hook 或工具：
  - `collectImageFiles(...)`
  - `importImageBatch(...)`
  - `focusable paste target management`
- `StickerGen` 与 `ProductProcessing` 的每个上传区改为显示当前批次图片列表，而不是单图预览。
- 生成按钮逻辑改为：
  1. 校验所需批次是否存在
  2. 创建任务
  3. 标记运行中
  4. 执行现有模拟生成流程
  5. 成功时写输出并更新任务
  6. 失败时更新任务为失败

### Electron

- `preload.ts` 暴露：
  - `saveImportBatch(files, page, feature)`
  - `saveTaskOutputs(taskId, page, feature, outputs)`
  - `listTasks()`
  - `createTask(record)`
  - `updateTask(record)`
- `main.ts` 负责目录创建、文件写入、任务 JSON 读写和错误返回。

### Profile

- 列表数据从内存 mock 改为读取持久化任务。
- 保留现有表格骨架，但字段来源改为真实任务。
- “管理效果”可以先进入基础详情展示：导入记录与出图记录。

## Error Handling

- 超过 4 张：拒绝超出部分并提示“单次最多导入 4 张图片”。
- 非图片文件：忽略并提示。
- 本地写入失败：本次导入失败，不创建任务。
- 生成失败：保留导入记录，任务状态置为 `Failed`。
- 页面切换：只保留当前页面当前批次，不自动回显历史批次。

## Testing Strategy

- 单元或组件测试覆盖：
  - 多文件选择仅保留最多 4 张
  - 未点击开始生成时不创建任务
  - 开始生成后状态从 `Pending/Running` 到 `Completed/Failed`
- 手工验证覆盖：
  - 拖拽 1-4 张图片
  - 聚焦上传区后粘贴 1-4 张图片
  - 多选文件导入
  - 任务中心刷新后仍能看到本地持久化任务
  - 成功任务展示导入记录和出图记录

## Open Questions

当前没有剩余阻塞性产品问题。实现阶段需要根据现有 UI 结构决定“当前批次图片列表”的具体布局样式，但不影响能力边界和数据模型。
