## Why

当前各页面的图片导入逻辑分散在组件内部，只支持单张读取，而且仅保存在前端内存中，无法满足“多图拖拽、粘贴、多选导入”和“导入文件落到项目本地目录”的新要求。同时，个人中心的任务记录仍是轻量 mock 数据，没有批次 ID、导入记录和出图记录，无法承接真实的本地生成工作流。

## What Changes

- 为所有图片上传入口增加统一的批次导入能力，支持拖拽多张、聚焦后粘贴多张、批量选择多张图片导入。
- 将单次导入上限限制为 4 张，并在页面中展示当前批次的全部已导入图片。
- 通过 Electron main/preload 暴露本地文件写入与任务存储接口，把导入图片按批次写入项目目录的本地文件夹。
- 将“开始生成”改为任务创建入口，仅在用户点击开始生成后创建任务，并记录批次 ID、任务状态、导入记录和出图记录。
- 扩展个人中心任务管理，展示真实任务状态流转与任务关联记录，而不是仅追加简单字符串任务。

## Capabilities

### New Capabilities
- `batch-image-import`: 统一处理所有页面的多图导入、批次目录落盘和当前批次图片展示。
- `generation-task-tracking`: 记录生成任务的批次 ID、状态流转、导入记录与出图记录，并在个人中心管理展示。

### Modified Capabilities

## Impact

- 受影响代码：`src/App.tsx`、`src/types.ts`、`src/components/StickerGen.tsx`、`src/components/ProductProcessing.tsx`、`src/components/Profile.tsx`。
- 新增系统：Electron preload/main 的本地文件与任务持久化桥接能力。
- 新增本地目录：项目内导入批次目录、输出目录、任务存储文件。
