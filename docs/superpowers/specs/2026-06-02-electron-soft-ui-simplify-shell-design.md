---
comet_change: electron-soft-ui-simplify-shell
role: technical-design
canonical_spec: openspec
---

## Context

当前项目是单一 Vite + React 19 前端，入口为 [src/main.tsx](/home/hayreal/Tickpic/src/main.tsx:1)，主结构由 [src/App.tsx](/home/hayreal/Tickpic/src/App.tsx:1) 和 [src/components/WindowFrame.tsx](/home/hayreal/Tickpic/src/components/WindowFrame.tsx:1) 组织。应用目前仅能作为浏览器页面运行，没有 Electron 主进程、preload、安全边界和桌面打包配置。

界面上，`WindowFrame` 仍在模拟“桌面应用外壳”，包含样式切换、伪窗口控制和标题栏；`Sidebar` 底部还保留了 GPU / disk writing 状态块。这些内容既不参与业务，也与目标产品形态冲突。

## Goals

- 把当前项目改造成可运行的 Electron 桌面应用。
- 提供 Windows 安装包构建能力。
- 删除模拟标题栏和侧栏底部状态块，保留原有主工作区业务组件。
- 将整体界面色彩调整为更柔和的低对比深色系。

## Non-Goals

- 不在本次实现自动更新、原生菜单、系统托盘或文件系统能力。
- 不重构 `StickerGen`、`ProductProcessing`、`Settings`、`Profile` 的业务逻辑。
- 不实现自定义无边框窗口和自绘标题栏。

## Decisions

### 1. 使用 Electron + electron-builder

新增 `electron/main.ts` 和 `electron/preload.ts`，保留 Vite 作为渲染进程构建工具。`electron-builder` 负责 Windows NSIS 安装包输出。

原因：
- 与现有 React/Vite 工程最兼容。
- Windows 安装包能力成熟，配置集中。
- 改造范围可控，不需要引入 Rust 或额外运行时。

备选：
- `electron-forge`：可用，但模板和插件层更重。
- `tauri`：包体更小，但需要 Rust 工具链，超出当前项目约束。

### 2. 保留系统原生标题栏

Electron `BrowserWindow` 使用系统原生 frame，不做无边框窗口。React 层不再模拟标题栏，因此删除 `WindowFrame` 顶部区域及相关状态。

原因：
- 你已明确要删掉当前顶部仿真区域。
- 使用原生标题栏最稳定，不需要额外处理拖拽、最小化、最大化、关闭等交互。
- 更符合 Windows 应用的自然行为。

### 3. 将 WindowFrame 收敛为纯内容容器

`WindowFrame` 将删除：
- `styleMode`
- `isFullscreen`
- `scale`
- 顶部 emulator controls
- 顶部 titlebar

保留：
- 页面级背景层
- 内容包裹容器
- 主工作区布局入口

这样主界面仍有统一视觉容器，但不再伪装成“浏览器里的 Electron 截图”。

### 4. 用共享色彩方向柔化 UI

优先在 `WindowFrame` 和 `Sidebar` 的外壳层调整主背景、边框、激活态、装饰光晕和次级文本颜色，尽量避免深入每个业务面板重写颜色。

视觉方向：
- 背景：由偏黑紫改为烟灰蓝 / 暖灰紫深色层次
- 边框：降低纯黑边界感，改为低对比半透明描边
- 强调色：由高饱和紫转为柔和雾紫 / 蓝紫
- 发光背景：保留氛围，但降低饱和度和面积侵略性

这样能先把“整体观感”拉回更柔和的区间，同时控制实现成本。

## Architecture

桌面结构：

```text
Electron main
  -> create BrowserWindow(frame=true)
  -> load Vite dev server in dev
  -> load built renderer index.html in prod

Electron preload
  -> expose minimal safe bridge

Renderer (existing React app)
  -> App
  -> WindowFrame
  -> Sidebar
  -> business panels
```

构建结构：

```text
pnpm build
  -> vite build

pnpm build:electron
  -> compile electron/main.ts + preload.ts

pnpm dist:win
  -> run renderer build
  -> run electron build
  -> package NSIS installer with electron-builder
```

## Implementation Plan

1. 更新 `package.json`
- 新增 Electron 运行和打包依赖
- 新增开发、构建、打包脚本
- 增加 `build` 字段定义 `electron-builder` 的 Windows 输出

2. 新建 Electron 入口
- `electron/main.ts`：创建窗口、区分 dev/prod 加载地址
- `electron/preload.ts`：先保持最小桥接，避免直接暴露 Node API

3. 视情况补充 TypeScript 配置
- 为 Electron 入口增加单独编译目标，输出到独立目录
- 不破坏现有前端 ts 配置

4. 精简 UI 壳层
- 修改 `WindowFrame`，彻底删除顶部条和相关状态逻辑
- 修改 `Sidebar`，删除底部状态块

5. 柔化主壳层视觉
- 调整 `WindowFrame`、`Sidebar` 的背景、边框、激活态和装饰色
- 仅在必要处修正对比度，避免大面积重写业务面板

6. 验证
- 类型检查
- 前端构建
- Electron 入口构建
- Windows 安装包打包

## Risks / Trade-offs

- `electron-builder` 会引入较多依赖和更长的安装时间
  - 缓解：仅为 Windows 安装包配置最小必需字段

- 某些业务面板仍可能保留较强的旧配色
  - 缓解：优先统一最外层壳体；如果局部冲突明显，再做小范围补色

- 当前目录不是 git 仓库，无法按 Comet/Superpowers 流程完成 git 相关要求
  - 缓解：继续完成文档、计划、实现和本地验证，但不声明 git 步骤已完成

## Testing Strategy

- 运行 `pnpm lint`
- 运行 `pnpm build`
- 运行 Electron 入口编译命令
- 运行 Windows 安装包命令，确认产物可生成
- 手动检查主界面：
  - 顶部仿真 titlebar 不再出现
  - 侧栏底部状态块不再出现
  - 主要壳层颜色明显更柔和
