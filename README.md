# Tickpic

Tickpic 是一个面向电商场景的 Electron 桌面客户端，用于 AI 作图、图片编辑和素材裂变。用户在本地配置模型平台、API Key、模型 ID 和工作目录，所有模型调用与文件读写均在 Main Process 完成，Renderer 只负责界面与任务提交。

## 功能概览

### 贴纸出图

| 功能 | 说明 |
|------|------|
| 贴纸复刻 | 参考原贴纸风格，生成同系列平面贴纸 |
| 贴纸裂变 | 基于已有贴纸生成风格变体 |
| 贴纸原创 | 根据提示词创作全新 2D 平面贴纸 |

### 产品处理

| 功能 | 说明 |
|------|------|
| 去除产品 | 移除目标产品并自然补全背景 |
| 替换产品 | 用目标产品替换或压制画面中的旧产品 |
| 替换 Logo | 仅替换品牌标识，不重做整版包装 |
| 主图素材裂变 | 生成主图/素材图的视觉变体 |
| 场景裂变 | 基于参考场景生成新场景 |
| 创作新场景 | 根据描述生成全新产品场景 |
| 纯提示词主图 | 仅通过文字描述生成主图/素材图 |

所有 AI 作图功能均采用**两阶段流程**：先用视觉/指令模型生成图片执行指令（`finalPrompt`），再调用生成或编辑模型出图。任务产物（`request.json`、`image-instruction.txt`、输出图片等）会保存到用户工作目录，便于复现与排查。

## 技术栈

- **桌面壳**：Electron 37（`contextIsolation`、沙箱、受控 IPC）
- **界面**：React 19 + Vite 6 + Tailwind CSS 4
- **组件**：Radix UI + shadcn/ui 风格组件
- **模型客户端**：OpenAI SDK、Google GenAI（Gemini）
- **测试**：Vitest + Testing Library
- **包管理**：pnpm

## 环境要求

- Node.js（建议使用 [nvm](https://github.com/nvm-sh/nvm) 管理版本）
- pnpm

## 快速开始

```bash
# 安装依赖
pnpm install

# 构建并启动桌面应用
pnpm desktop
```

首次使用前，在应用内打开 **设置**，配置 API Base URL、API Key、视觉模型、出图模型和工作目录，并执行连接测试。


## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm desktop` | 构建 Renderer + Electron 并启动桌面应用（推荐） |
| `pnpm dev` | 启动 Vite 开发服务器（配合 `dev:electron` 热更新开发） |
| `pnpm dev:electron` | 编译 Electron 并以开发模式启动 |
| `pnpm build` | 构建 Renderer |
| `pnpm build:electron` | 编译 Main Process 与 Preload |
| `pnpm dist:win` | 打包 Windows NSIS 安装包（输出到 `release/`） |
| `pnpm lint` | TypeScript 类型检查（`tsc --noEmit`） |
| `pnpm test` | 运行单元测试 |
| `pnpm smoke:image-task` | 通过 `.env` 配置运行图片任务冒烟脚本 |

## 配置

### 应用内设置（推荐）

桌面客户端通过 **设置** 页面持久化以下配置：

- API Base URL 与 API Key（Key 仅存于 Main Process，Renderer 仅见掩码预览）
- 出图模型（生成/编辑）；执行提示词在本地由功能主提示词与用户输入组装
- 工作目录、默认生成数量、最大数量、并发任务上限

### 脚本与冒烟测试

`scripts/` 下的演示与冒烟脚本可通过项目根目录的 `.env` 配置。参考 `.env.example`：

```env
MODEL_PROTOCOL=openai
LLM_API_KEY=sk-xxxx
LLM_BASE_URL=https://llm-api.net/v1
VISION_MODEL=gpt-5.4-mini
IMAGE_MODEL=gpt-image-2
IMAGE_SIZE=1536x1024
```

## 项目结构

```text
Tickpic/
├── electron/                 # Main Process 与 Preload
│   ├── main/
│   │   ├── app/              # 窗口创建、Renderer 加载
│   │   ├── ipc/              # IPC 处理器注册
│   │   └── services/         # 设置、存储、图片任务、任务队列
│   └── preload.ts            # contextBridge 白名单 API
├── src/                      # Renderer（React UI）
│   ├── components/           # 页面与 UI 组件
│   ├── features/             # 任务等业务逻辑
│   ├── hooks/                # 桌面客户端、图片任务等 Hook
│   ├── infrastructure/       # Preload 桥接封装
│   └── shared/               # 跨进程契约、领域类型、视图常量
├── scripts/                  # 演示与冒烟脚本
├── tests/                    # 自动化测试与 fixtures
├── docs/                     # 架构、API、系统提示词文档
└── artifacts/                # 本地生成产物（不提交）
```

## 架构与安全

进程边界遵循 Electron 安全默认值：

| 层级 | 职责 |
|------|------|
| **Renderer** | 界面、表单、上传、框选、任务提交、状态展示、结果预览 |
| **Preload** | 通过 `contextBridge` 暴露类型化、白名单 IPC API（`window.desktopShell`） |
| **Main Process** | 本地文件、配置读写、模型调用、任务队列、产物保存、日志（脱敏） |

安全约束：API Key、文件系统访问和模型客户端不得进入 Renderer；IPC 入参在 Main Process 校验；文件读写限定在用户授权的工作目录内。

主要 IPC 能力包括：`imageTask.submit/cancel/get/onStatus`、`settings.get/save/testConnection`、`storage.openOutputDirectory` 等，通道名集中定义于 `src/shared/contracts/desktop.ts`。

## 开发说明

- 修改架构、IPC 或存储行为时，请同步更新 `docs/` 下对应文档。
- 本地类型检查：`pnpm lint`
- 单元测试：`pnpm test`
- 需要真实模型凭证的脚本演示见 `scripts/sticker-replica-demo.ts`、`scripts/gpt-image-demo.ts`（需配置 `.env`）。
