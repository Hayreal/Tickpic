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
