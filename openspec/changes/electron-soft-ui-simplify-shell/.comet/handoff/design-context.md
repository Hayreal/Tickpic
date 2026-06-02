# Comet Design Handoff

- Change: electron-soft-ui-simplify-shell
- Phase: design
- Mode: compact
- Context hash: 803040cd3ae1f7539cc7b5d9138bdb8feef990fe1bbbd19149006f7161bf4dec

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/electron-soft-ui-simplify-shell/proposal.md

- Source: openspec/changes/electron-soft-ui-simplify-shell/proposal.md
- Lines: 1-25
- SHA256: 421f0c7366425dfe75ac51e0f74e923f80a4e1d2ad8e5688d4d62df7c0c3246b

```md
## Why

当前项目是纯 Vite/React 页面，只能在浏览器里运行，无法作为桌面工具直接分发给 Windows 用户。同时，现有界面整体对比度偏硬，窗口仿真元素过多，和实际使用场景不匹配。

## What Changes

- 将现有前端改造成 Electron 桌面应用，补充主进程、预加载层与开发/构建脚本。
- 增加 Windows 平台打包能力，生成可分发的桌面安装产物。
- 调整整体色彩体系，降低紫黑对比和高饱和装饰，让界面更柔和。
- 删除模拟窗口顶部 titlebar 区域，不再保留样式切换、窗口控制和标题徽标。
- 删除侧栏底部运行状态块，不再展示 GPU / disk writing 文案。

## Capabilities

### New Capabilities
- `desktop-shell-packaging`: 以 Electron 桌面壳运行现有 React 工作区，并支持 Windows 平台构建分发包。
- `workspace-surface-simplification`: 以更柔和的视觉风格呈现工作区，并移除非必要的仿真壳层信息。

### Modified Capabilities

## Impact

- 受影响代码：`package.json`、Vite 入口、主界面壳组件、侧栏样式及可能的 TypeScript 配置。
- 新增依赖：Electron 运行时与 Windows 打包工具链。
- 新增系统：Electron main/preload 进程与打包配置文件。
```

## openspec/changes/electron-soft-ui-simplify-shell/design.md

- Source: openspec/changes/electron-soft-ui-simplify-shell/design.md
- Lines: 1-35
- SHA256: 6e6d894ea9e1987d2d07d8dc31f446971b59140caa5d8bdddc5bd80015add409

```md
## Context

当前应用由 React 19 + Vite 驱动，界面入口集中在 `src/App.tsx`，外层桌面壳由 `src/components/WindowFrame.tsx` 负责，侧栏附加状态块位于 `src/components/Sidebar.tsx`。项目尚未引入 Electron，也没有主进程、preload、安全边界或桌面打包配置。

这次变更同时涉及运行时形态调整和界面结构收敛，属于跨模块改造：既要保留原有工作区组件结构，又要把浏览器页面迁移到 Electron BrowserWindow，并删除仅用于“仿真桌面”的多余 UI。

## Goals / Non-Goals

**Goals:**
- 让项目可在 Electron 中以桌面应用方式启动。
- 提供稳定的 Windows 打包命令和基础构建配置。
- 保持现有业务面板结构不变，仅移除多余壳层元素并柔化视觉配色。

**Non-Goals:**
- 不在本次变更中新增文件系统能力、自动更新、原生菜单或托盘功能。
- 不重构 Sticker/Product/Settings/Profile 业务逻辑。
- 不覆盖 macOS/Linux 打包优化，只保证 Windows 可构建。

## Decisions

- 使用 Electron + `electron-builder` 作为桌面运行和打包方案。
  - 原因：对现有 Vite 前端侵入较小，支持 Windows 安装包输出，社区工具成熟。
  - 备选：Tauri。放弃原因是需要 Rust 工具链，当前项目没有相关基础，改造成本更高。
- 保留 Vite 负责渲染进程构建，新增独立 `electron/` 目录承载 `main` 与 `preload`。
  - 原因：最小化对现有前端结构的破坏，开发阶段可分别管理前端构建与 Electron 启动。
- 将 `WindowFrame` 从“桌面模拟器”收敛为“应用内容容器”。
  - 原因：用户明确要求删除顶部 titlebar，继续保留样式切换和伪窗口控制会制造无效交互。
- 通过统一颜色变量和背景层调整柔和化 UI，而不是逐个组件做离散硬编码修补。
  - 原因：便于后续继续调色，避免局部改色导致新旧风格混杂。

## Risks / Trade-offs

- [Electron 打包链新增] → 需要额外 devDependencies 和构建脚本；通过保持目录清晰和脚本单一职责降低维护成本。
- [无 git 仓库上下文] → 无法完全按 Comet build 阶段的 git 计划元数据执行；通过在 OpenSpec 文档中记录实现边界并继续本地验证缓解。
- [配色柔化影响现有局部组件层级] → 可能出现个别文本对比不足；通过构建后人工检查主要页面并保留关键状态色缓解。
```

## openspec/changes/electron-soft-ui-simplify-shell/tasks.md

- Source: openspec/changes/electron-soft-ui-simplify-shell/tasks.md
- Lines: 1-16
- SHA256: decbbbffaf38f5ce84a3dd818c85dfd36015774a36521aa3d41863386030c88f

```md
## 1. Desktop Shell Setup

- [ ] 1.1 Add Electron runtime, packaging dependencies, and desktop build scripts.
- [ ] 1.2 Create Electron main/preload entry files and wire them to the built renderer output.
- [ ] 1.3 Add packaging configuration for Windows application artifacts.

## 2. Workspace Shell Simplification

- [ ] 2.1 Remove the simulated top titlebar and related state/controls from the main frame component.
- [ ] 2.2 Remove the sidebar footer status block and clean up resulting layout/styling.
- [ ] 2.3 Soften the shared shell colors and background treatment across the main frame and sidebar.

## 3. Validation

- [ ] 3.1 Run type/lint/build validation for the renderer and Electron entrypoints.
- [ ] 3.2 Run the Windows packaging command to verify the desktop bundle can be produced.
```

## openspec/changes/electron-soft-ui-simplify-shell/specs/desktop-shell-packaging/spec.md

- Source: openspec/changes/electron-soft-ui-simplify-shell/specs/desktop-shell-packaging/spec.md
- Lines: 1-17
- SHA256: 8e70d7bafcf057c56b701ea9e05fcd33e54f34ce11e2ec8e88620f62ff1bf825

```md
## ADDED Requirements

### Requirement: Application runs inside an Electron desktop shell
The system SHALL provide an Electron main process that launches the existing React workspace inside a desktop window for local use.

#### Scenario: Launch desktop application in development or production
- **WHEN** the application is started through the desktop entrypoint
- **THEN** an Electron `BrowserWindow` loads the rendered React application
- **AND** the user can use the existing workspace without opening a standalone browser tab

### Requirement: Application supports Windows packaging
The system SHALL expose a build path that produces a Windows-distributable desktop application artifact.

#### Scenario: Build Windows package
- **WHEN** the maintainer runs the Windows packaging command
- **THEN** the build process compiles the renderer and Electron processes
- **AND** emits a Windows application package in the configured output directory
```

## openspec/changes/electron-soft-ui-simplify-shell/specs/workspace-surface-simplification/spec.md

- Source: openspec/changes/electron-soft-ui-simplify-shell/specs/workspace-surface-simplification/spec.md
- Lines: 1-25
- SHA256: 648f8aa2b98ab8cc1701f4fddbc4c6f50607ce4ede1052aca86196129d2d5c3f

```md
## ADDED Requirements

### Requirement: Workspace shell uses a softer visual palette
The system SHALL render the main workspace with a softer low-contrast color palette than the current dark violet shell while preserving readable navigation and content emphasis.

#### Scenario: Render main workspace shell
- **WHEN** the user opens the application
- **THEN** the workspace shell uses softened background, border, and accent colors
- **AND** primary content remains readable without relying on the previous high-contrast purple highlights

### Requirement: Window chrome simulation is removed
The system SHALL not render the simulated top window chrome that currently contains style toggles, title metadata, and close/minimize/maximize controls.

#### Scenario: Render top-level frame
- **WHEN** the main application frame is displayed
- **THEN** the content begins directly at the workspace body area
- **AND** no simulated titlebar controls or desktop-emulator labels are shown

### Requirement: Sidebar status block is removed
The system SHALL not render the sidebar footer status block that advertises GPU acceleration and local disk writing.

#### Scenario: Render sidebar footer area
- **WHEN** the sidebar is displayed
- **THEN** the footer status block is absent
- **AND** the sidebar ends after the primary navigation content
```

