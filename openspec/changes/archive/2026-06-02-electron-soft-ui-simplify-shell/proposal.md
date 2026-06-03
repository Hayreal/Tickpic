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
