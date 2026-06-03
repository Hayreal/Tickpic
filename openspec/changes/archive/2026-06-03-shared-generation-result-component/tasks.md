## 1. 类型定义

- [x] 1.1 在 `src/types.ts` 中新增 `ResultItem` 接口定义

## 2. GenerationResult 组件

- [x] 2.1 创建 `src/components/GenerationResult.tsx` 组件，实现 header（title + count + headerRight + showDownloadAll）
- [x] 2.2 实现 empty 状态渲染（仅 emptyDescription 文案居中）
- [x] 2.3 实现 multi 模式：2列 grid + aspect-square 卡片 + hover 下载 overlay
- [x] 2.4 实现 single 模式：大尺寸居中展示（max-w-lg aspect-video）+ badge + hover overlay
- [x] 2.5 实现 onDownload / onDownloadAll 回调

## 3. 重构 ProductProcessing

- [x] 3.1 重构 "去除产品" tab 右侧：使用 GenerationResult (mode=single)，配置空状态描述
- [x] 3.2 重构 "替换产品" tab 右侧：使用 GenerationResult (mode=single)，配置空状态描述
- [x] 3.3 重构 "主图裂变" tab 右侧：使用 GenerationResult (mode=multi, showCount=true)
- [x] 3.4 重构 "创作新场景" tab 右侧：使用 GenerationResult (mode=multi)，通过 headerRight 注入历史记录按钮

## 4. 验证

- [x] 4.1 运行构建确认无编译错误
- [ ] 4.2 手动检查 4 个 tab 的右侧展示与重构前视觉一致
