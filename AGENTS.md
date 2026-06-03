# AGENTS.md

本文件是 Tickpic 项目的通用 Agent 工作规范。所有 Agent 在修改项目代码前必须先阅读本文、`docs/ai-image-api-implementation-plan.md`、`docs/ai-image-system-prompts.md`，涉及 Electron 架构或安全时还必须参考 `.codex/skills/electron-development/SKILL.md`。

## 项目定位

Tickpic 是一个 Electron 桌面客户端，用于电商 AI 作图、图片编辑和素材裂变。客户端由用户配置模型平台、API Key、模型 ID、协议映射和工作目录。

核心架构目标：

- Renderer 只负责界面、表单、上传、框选、任务提交、状态展示和结果预览。
- Preload 只暴露受控、类型化、白名单 IPC API。
- Main Process 负责本地文件、配置读取、模型调用、任务队列、产物保存、错误处理和原生日志。
- API Key、文件系统、模型客户端不得进入 Renderer。

## 规范目录结构

`src/` 当前必须保持为空。只有开始正式 Electron 桌面应用实现时，才允许按下面的目标结构向 `src/` 写入生产源码。当前测试脚本、演示脚本和临时验证 helper 必须放在 `scripts/` 或 `tests/`，不得放进 `src/`。

正式应用源码应按标准 Electron 桌面应用边界组织：

```text
Tickpic/
├── src/
│   ├── main/
│   │   ├── app/
│   │   │   ├── main.ts           # app.whenReady、单实例、生命周期
│   │   │   ├── windows.ts        # BrowserWindow 创建、恢复和窗口策略
│   │   │   ├── menu.ts           # 原生菜单
│   │   │   ├── tray.ts           # 托盘能力，可选
│   │   │   └── navigation.ts     # CSP、导航拦截、外链策略
│   │   ├── ipc/
│   │   │   ├── channels.ts       # IPC 通道注册表
│   │   │   ├── handlers.ts       # ipcMain.handle 注册
│   │   │   └── validators.ts     # Renderer 入参运行时校验
│   │   ├── services/
│   │   │   ├── artifact-store.ts # request/enhancement/prompt/response/image 写入
│   │   │   ├── image-workflow/   # 两阶段 AI 作图流程
│   │   │   ├── model-clients/    # OpenAI/Gemini/n1n 兼容客户端
│   │   │   ├── settings-store.ts # 本地安全配置读写
│   │   │   ├── task-queue.ts     # 异步队列、取消、进度事件
│   │   │   └── logger.ts         # 结构化日志，必须脱敏
│   │   └── workers/              # 可选后台/工具进程
│   ├── preload/
│   │   ├── index.ts              # contextBridge 入口
│   │   └── api.ts                # Renderer 可见 API 类型
│   ├── renderer/
│   │   ├── index.html
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── settings/
│   │   │   ├── image-task/
│   │   │   ├── region-select/
│   │   │   └── results/
│   │   ├── routes/
│   │   └── styles/
│   └── shared/
│       ├── constants.ts          # 功能 ID、任务状态、协议 ID
│       ├── ipc-contracts.ts      # IPC 请求、响应、事件契约
│       ├── schemas.ts            # 跨进程安全校验 schema
│       ├── image-workflow-types.ts
│       └── image-instruction-types.ts
├── scripts/                      # 演示、迁移、构建辅助脚本
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/
├── artifacts/                    # 本地生成产物，禁止提交
├── resources/                    # 图标、entitlements、打包资源
├── docs/
├── package.json
├── tsconfig.json
└── electron-builder.yml          # 需要分发时再添加
```

生产源码不得放在 `tests/`。`tests/` 只存放自动化测试、fixtures 和 e2e 用例。演示入口和演示 helper 放在 `scripts/`，运行产物写入 `artifacts/`。

## 当前可运行入口

- `scripts/sticker-replica-demo.ts`：贴纸复刻两阶段演示。
- `scripts/gpt-image-demo.ts`：GPT Image 编辑尺寸验证演示。
- `scripts/lib/`：演示脚本使用的临时 helper，不属于正式应用源码。
- `tests/unit/sticker-replication-prompt.test.ts`：提示词抽取和拼装单元测试。
- `tests/fixtures/images/image.png`：默认测试图片。
- `artifacts/output/`：模型调用和生成图片输出目录。

## AI 作图工作流规则

所有图片生成、编辑、裂变功能都必须使用两阶段流程：

1. 图片执行指令生成阶段：把 `feature`、`source/reference` 图片、`prompt`、`regions`、`productName`、`logoText`、`colorScheme`、`aspectRatio`、阶段模型等结构化参数交给图像理解/指令生成模型，直接输出 `finalPrompt`。
2. 图片生成/编辑阶段：使用 `finalPrompt` 和相关执行图片出图；必要的禁止事项应已经写入这条执行指令。

不得为了方便绕过图片执行指令生成阶段。执行指令必须作为任务产物保存，方便复现和排查。一阶段不要求模型输出 JSON，也不要求输出冗长分析报告。

编辑类任务的一阶段输出应简洁、高效，默认 1-3 句。图像生成类任务可以添加更多视觉细节，用于补足主体、场景、构图、光影、风格、文字和比例等出图信息。

纯提示词主图/素材图允许用户输入参考图或风格图，但这些图片只用于第一阶段生成图片执行指令，不得把该功能误路由为第二阶段图片编辑任务。

模型选择按阶段决定：

- `modelOverrides.vision`：图像理解和图片执行指令生成。
- `modelOverrides.generation`：纯生成任务。
- `modelOverrides.edit`：图片编辑和裂变任务。

模型默认值来自用户配置或原型环境变量，不得在功能表里硬编码。

## 功能边界

必须遵守 `docs/ai-image-system-prompts.md` 中的硬边界：

- 贴纸复刻、贴纸裂变、贴纸原创输出独立 2D 平面贴纸，不输出瓶、罐、盒、包装 mockup。
- 去除产品必须移除目标产品并自然补全背景，不得添加新产品。
- 替换产品必须展示目标产品，并替换或压制旧产品；除非用户明确要求对比，否则不得新旧产品并存。
- 替换 Logo 只替换品牌标识，不扩展成完整包装重设计。
- 主图素材裂变和场景裂变默认不展示具体产品，除非用户明确要求。
- 用户提示词与功能边界冲突时，以功能边界为准。

## Electron 安全规则

必须遵守本地 `electron-development` skill 的安全默认值：

```ts
contextIsolation: true
nodeIntegration: false
sandbox: true
webSecurity: true
allowRunningInsecureContent: false
experimentalFeatures: false
```

IPC 规则：

- Preload 必须使用 `contextBridge`，不得暴露原始 `ipcRenderer`。
- IPC 通道名集中维护在 `src/shared/constants.ts` 或 `src/shared/ipc-contracts.ts`。
- Renderer 入参必须在 Main Process 校验后才能使用。
- 任务提交、设置读写、文件对话框、取消任务使用 `ipcMain.handle()` / `ipcRenderer.invoke()`。
- 任务进度和状态推送使用事件订阅，并返回取消订阅函数。
- 禁止使用 `ipcRenderer.sendSync()`。

窗口和导航规则：

- `BrowserWindow` 创建必须集中在 `src/main/app/windows.ts`。
- 每个窗口都必须设置严格 CSP。
- 阻止非预期 `will-navigate` 和新窗口打开。
- `shell.openExternal()` 只能打开校验过的 HTTPS 白名单链接。

## 桌面应用开发规则

- 生命周期只放在 Main Process：`ready`、`activate`、`before-quit`、崩溃钩子、单实例处理。
- 菜单、托盘、文件对话框、通知、外链策略、工作目录访问都属于 Main Process。
- Renderer 必须保持响应；模型调用、图片处理、文件写入、队列任务必须通过 Main services 或 workers 执行。
- 设置存储必须有校验和版本迁移；API Key 和凭证必须安全存储，不得进入日志。
- 文件读写必须限定在用户授权路径内，写入前规范化路径并防止路径穿越。
- 日志必须脱敏 API Key、Authorization header、base64 图片和未清洗的模型响应。
- 生成产物必须可复现：`request.json`、`image-instruction.txt`、清洗后的响应、输出图片、warnings、任务状态。
- 打包时不得包含 `.env`、`artifacts/`、测试 fixture、本地输出或开发专用文件。
- 自动更新、签名、公证、安装器只在明确进入分发阶段时添加。

## 命令

本地类型检查：

```bash
npx tsc --noEmit
```

单元测试：

```bash
npm test
```

需要 `.env` 和真实模型凭证的演示：

```bash
npm run test:sticker-replica
npm run test:gpt-image-size
```

如果无法执行真实模型调用，必须说明原因，并至少运行类型检查和单元测试。

## 文档规则

- 架构、API、队列、配置、文件保存规则变化时，更新 `docs/ai-image-api-implementation-plan.md`。
- 提示词功能边界变化时，更新 `docs/ai-image-system-prompts.md`。
- 面向项目协作的规则文档使用中文。
- 系统提示词正文保持英文，因为它们面向模型和 international markets。
