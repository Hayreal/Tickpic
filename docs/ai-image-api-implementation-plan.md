# AI 作图功能 API 实现方案

## 1. 总体架构

客户端由用户自行配置 n1n API Key、模型、协议和工作目录。模型不按功能写死默认值，而是基于用户配置的图像理解模型、图像生成模型和图像编辑模型选择；接口传入阶段模型时，可覆盖用户配置。

Electron 客户端采用三层结构：

| 层级 | 职责 |
|---|---|
| Renderer | 功能表单、图片上传、矩形框选、任务提交、任务状态、结果预览 |
| Preload IPC | 暴露受控 API，隔离 Renderer 和 Main |
| Main Process | 读取本地图片、组装请求、任务队列调度、图像理解增强、调用 n1n、保存结果、错误处理 |

API Key 不在 Renderer 业务代码中直接使用。用户填写的 n1n API Key 存在客户端本地安全配置中，由 Main Process 读取并调用接口。

所有图片生成、图片编辑和图片裂变任务都采用“两段式模型调用”：

1. 先调用图像理解模型，结合用户输入、参考图和矩形框选，生成结构化 JSON 控图描述。
2. 再将结构化 JSON 控图描述和最终提示词交给图片生成/编辑模型执行。

这样可以让图片模型获得更稳定的主体、场景、构图、色系、限制条件和负向约束，减少只靠自然语言 prompt 带来的不稳定性。

## 2. 客户端配置

客户端设置页需要支持以下配置：

| 配置项 | 说明 |
|---|---|
| n1n API Key | 用户自己的模型平台密钥 |
| Base URL | 默认 `https://api.n1n.ai` |
| 工作目录 | 生成结果保存位置 |
| 图像生成模型 | 用于无原图生成、场景生成、纯提示词素材生成 |
| 图像编辑模型 | 用于基于原图的编辑、替换、去除、裂变 |
| 图像理解模型 | 用于所有任务前置的 JSON 控图描述生成 |
| 模型协议映射 | 指定模型走 Gemini 协议或 OpenAI 协议 |
| 默认出图数量 | 由批次数控制，当前默认 4 |
| 最大同时运行任务数 | 当前固定为 5，可作为客户端配置项保留 |

模型配置应允许用户新增、修改和选择模型 ID。当前主要模型：

| 能力 | 模型 |
|---|---|
| 图片生成/编辑 | `gemini-3.1-flash-image-preview` |
| 图片生成/编辑 | `gemini-2.5-flash-image` |
| 图片生成/编辑 | `gpt-image-2` |
| 图片理解 | `gemini-3.1-flash-lite` |
| 图片理解 | `gpt-5.4-mini` |

## 3. 统一任务接口设计

业务层建议只暴露一个统一图像任务接口，由 `feature` 区分具体功能。

| 参数 | 必填 | 说明 |
|---|---:|---|
| feature | 是 | 功能类型 |
| modelOverrides | 否 | 阶段级模型覆盖；不传则使用用户配置模型 |
| prompt | 否 | 用户追加提示词 |
| images | 否 | 参考图、原图、产品图、Logo 图、风格图等 |
| regions | 否 | 可选矩形框选区域 |
| count | 否 | 出图数量，由批次数控制 |
| productName | 否 | 产品名称 |
| logoText | 否 | Logo 或品牌文字说明 |
| colorScheme | 否 | 自然语言色系 |
| aspectRatio | 否 | 图片比例，例如 `9:16`、`4:3`、`1:1` |

图片角色建议统一为：

| role | 含义 |
|---|---|
| source | 待处理原图 |
| reference | 效果或内容参考图 |
| style | 风格参考图 |
| product | 目标产品图 |
| logo | 目标 Logo 图 |

矩形框选只作为可选区域提示。

## 4. 功能 API 映射

| 功能 | 能力类型 | 输入重点 | 输出重点 |
|---|---|---|---|
| 贴纸复刻 | 图像编辑 | 包装/贴纸参考图、可选框选、产品名称、Logo、色系、比例 | 相似风格的 2D 平面贴纸 |
| 贴纸裂变 | 图像裂变 | 贴纸/包装参考图、裂变方向、色系、比例 | 多张不同排版/色系/风格贴纸 |
| 贴纸原创 | 图像生成 | 产品品类、产品名称、卖点、色系、可选参考图 | 原创 2D 平面贴纸初稿 |
| 去除产品 | 图像编辑 | 商品场景图、去除说明、可选框选 | 无产品场景素材 |
| 替换产品 | 图像编辑 | 场景图、目标产品图、替换说明、可选框选 | 替换为目标产品的场景图 |
| 替换 Logo | 图像编辑 | 原图、目标 Logo、替换说明、可选框选 | 替换 Logo 后的图片 |
| 主图素材裂变 | 图像裂变 | 主图/效果参考图、卖点、色系、对比形式 | 主图设计素材初稿 |
| 场景裂变 | 图像裂变 | 场景参考图、产品品类、场景方向、色系 | 多个具体使用场景素材 |
| 创作新场景图 | 图像生成 | 产品品类、场景描述、卖点、风格参考图 | 新电商场景图或场景素材 |
| 纯提示词主图/素材图 | 图像生成 | 用户提示词或润色后的提示词 | 主图设计素材或电商素材图 |

## 5. 模型选择规则

模型由能力阶段选择，不按具体功能维护默认模型表。

模型选择优先级：

1. 单次任务接口传入的阶段级模型覆盖。
2. 用户在客户端配置的阶段模型。

阶段模型配置：

| 阶段 | 使用模型配置 | 说明 |
|---|---|
| 图像理解增强 | 用户配置的图像理解模型 | 所有任务都会先调用，用于生成结构化 JSON 控图描述 |
| 图像生成 | 用户配置的图像生成模型 | 贴纸原创、创作新场景图、纯提示词主图/素材图 |
| 图像编辑 | 用户配置的图像编辑模型 | 贴纸复刻、贴纸裂变、去除产品、替换产品、替换 Logo、主图素材裂变、场景裂变 |

阶段级覆盖参数建议：

| 参数 | 说明 |
|---|---|
| modelOverrides.vision | 覆盖图像理解模型 |
| modelOverrides.generation | 覆盖图像生成模型 |
| modelOverrides.edit | 覆盖图像编辑模型 |

能力路由：

| 功能 | 图像理解阶段 | 图片执行阶段 |
|---|---|---|
| 贴纸复刻 | 图像理解模型 | 图像编辑模型 |
| 贴纸裂变 | 图像理解模型 | 图像编辑模型 |
| 贴纸原创 | 图像理解模型 | 图像生成模型 |
| 去除产品 | 图像理解模型 | 图像编辑模型 |
| 替换产品 | 图像理解模型 | 图像编辑模型 |
| 替换 Logo | 图像理解模型 | 图像编辑模型 |
| 主图素材裂变 | 图像理解模型 | 图像编辑模型 |
| 场景裂变 | 图像理解模型 | 图像编辑模型 |
| 创作新场景图 | 图像理解模型 | 图像生成模型 |
| 纯提示词主图/素材图 | 图像理解模型 | 图像生成模型 |

## 6. 协议选择规则

模型协议由客户端配置维护，不在功能逻辑里写死。

| 协议 | 适用模型 |
|---|---|
| Gemini 协议 | Gemini 系列模型 |
| OpenAI 协议 | OpenAI 系列模型 |

调用前根据模型 ID 查询协议映射。如果用户传入模型但未配置协议，应提示用户先完成模型协议配置。

## 7. 强制提示词增强流程

所有图片生成、图片编辑和图片裂变任务，都必须先经过图像理解模型生成结构化 JSON 控图描述，再调用图片模型。

图像理解模型的职责不是直接出图，而是把用户输入、参考图、矩形框选和功能模板整理为稳定的生成控制信息。

各功能增强重点：

| 功能 | 图像理解增强重点 |
|---|---|
| 贴纸复刻 | 分析贴纸区域、色系、排版结构、视觉层级、文字区域 |
| 贴纸裂变 | 分析原贴纸品类感、可变化区域、可裂变方向 |
| 贴纸原创 | 根据品类补充卖点、风格和标签结构 |
| 去除产品 | 识别产品主体、遮挡关系、背景补全方向 |
| 替换产品 | 分析原产品位置、姿态、透视、比例、光影和替换约束 |
| 替换 Logo | 分析 Logo 位置、材质、角度、透视和替换边界 |
| 主图素材裂变 | 分析卖点表达、Before/After 结构、局部细节和视觉焦点 |
| 场景裂变 | 根据品类和参考图发散具体使用场景 |
| 创作新场景图 | 根据品类、卖点和场景要求生成可控场景清单 |
| 纯提示词主图/素材图 | 将用户提示词结构化为可执行的主图/素材视觉方案 |

结构化 JSON 控图描述建议包含：

| 字段 | 说明 |
|---|---|
| feature | 功能类型 |
| taskIntent | 本次任务目标 |
| sourceImageUnderstanding | 对输入图片的主体、场景、风格、色系、构图分析 |
| regionUnderstanding | 对矩形框选区域的解释 |
| subjectPlan | 需要保留、移除、替换或生成的主体 |
| compositionPlan | 构图、视角、版式、对比结构 |
| stylePlan | 风格、色系、材质、光影、商业视觉方向 |
| textPlan | 关键文字、标题、卖点、Before/After 等文字规划 |
| scenePlan | 场景发散或场景约束 |
| constraints | 必须遵守的规则 |
| negativeConstraints | 必须避免的内容 |
| finalPrompt | 交给图片模型的最终自然语言提示词 |
| modelHints | 图片比例等模型参数提示 |

增强 JSON 不直接展示给用户，默认保存为本地任务记录，作为图片模型的上游输入。

## 8. 文件保存规则

所有结果保存到用户设置的工作目录。

建议目录结构：

```text
{workspaceDir}/outputs/{yyyyMMdd}/{taskId}/
  request.json
  prompt-enhancement.json
  result-1.png
  result-2.png
  result-3.png
  result-4.png
```

说明：

- `request.json` 仅用于本地排查和复现。
- `prompt-enhancement.json` 保存图像理解模型生成的结构化 JSON 控图描述。
- 出图数量由任务批次数控制，文件数量随 `count` 参数变化。

## 9. 结果返回

任务结果返回给 Renderer 的内容：

| 字段 | 说明 |
|---|---|
| taskId | 本次任务 ID |
| feature | 功能类型 |
| model | 实际使用模型 |
| protocol | 实际使用协议 |
| outputDir | 结果保存目录 |
| images | 结果图片路径列表 |
| promptEnhancementPath | 结构化 JSON 控图描述保存路径 |
| textNotes | 模型返回的文字说明 |
| warnings | 可展示给用户的警告 |

## 10. 异步任务队列机制

图像任务统一进入 Main Process 的本地任务队列，采用异步运行机制。

队列规则：

| 规则 | 说明 |
|---|---|
| 提交方式 | Renderer 提交任务后立即返回任务 ID |
| 执行方式 | Main Process 后台异步执行 |
| 最大并发 | 最多同时运行 5 个任务 |
| 超出并发 | 后续任务进入等待队列 |
| 状态推送 | 通过 IPC 向 Renderer 推送任务状态 |
| 结果保存 | 完成后保存到用户设置的工作目录 |
| 失败处理 | 单个任务失败不影响队列中其他任务 |
| 取消任务 | 等待中任务可直接取消；运行中任务尽量中断并标记取消 |

任务状态建议：

| 状态 | 说明 |
|---|---|
| queued | 已进入队列，等待执行 |
| running | 正在执行 |
| enhancing | 正在进行图像理解或提示词增强 |
| generating | 正在调用图片模型 |
| saving | 正在保存结果 |
| completed | 已完成 |
| failed | 已失败 |
| canceled | 已取消 |

## 11. 主流程图

```mermaid
flowchart TD
  A["用户选择功能"] --> B["填写参数: 产品名称 / 色系 / 比例 / 提示词"]
  B --> C["上传参考图: 原图 / 产品图 / Logo / 风格图"]
  C --> D{"是否需要框选区域?"}
  D -->|是| E["记录矩形框坐标"]
  D -->|否| F["跳过框选"]
  E --> G["生成统一任务请求"]
  F --> G["生成统一任务请求"]

  G --> H["提交到本地异步任务队列"]
  H --> I{"当前运行任务数 < 5?"}
  I -->|是| J["立即开始执行任务"]
  I -->|否| K["进入等待队列"]
  K --> L["等待运行槽位释放"]
  L --> J

  J --> M["调用图像理解模型"]
  M --> N["生成结构化 JSON 控图描述"]
  N --> O["保存 prompt-enhancement.json"]
  O --> P["按阶段模型覆盖或用户配置选择图片模型"]
  P --> Q["按模型配置选择协议"]
  Q --> R{"任务能力类型"}
  R -->|生成| S["调用图像生成模型"]
  R -->|编辑| T["调用图像编辑模型"]
  R -->|裂变| U["调用图像裂变模型"]

  S --> V["解析图片结果"]
  T --> V["解析图片结果"]
  U --> V["解析图片结果"]

  V --> W["保存到用户工作目录"]
  W --> X["释放运行槽位"]
  X --> Y["返回图片路径、控图 JSON 路径、提示、告警信息"]
```

## 12. 图像任务时序图

```mermaid
sequenceDiagram
  participant User as 用户
  participant UI as Electron Renderer
  participant IPC as Preload IPC
  participant Main as Main AI Service
  participant Queue as 本地任务队列
  participant Config as 本地配置
  participant Vision as 图像理解模型
  participant Image as 图像生成/编辑模型
  participant FS as 用户工作目录

  User->>UI: 选择功能并填写参数
  User->>UI: 上传图片 / 可选矩形框选
  UI->>IPC: 提交统一图像任务
  IPC->>Main: 转发白名单 IPC 请求
  Main->>Queue: 创建任务并进入队列
  Queue-->>Main: 返回任务 ID 和 queued 状态
  Main-->>IPC: 返回任务 ID
  IPC-->>UI: 展示排队状态

  Queue->>Queue: 检查运行中任务数
  alt 运行中任务数小于 5
    Queue->>Main: 分配运行槽位并开始任务
  else 运行中任务数达到 5
    Queue->>Queue: 等待槽位释放
    Queue->>Main: 槽位释放后开始任务
  end

  Main-->>UI: 推送 running 状态
  Main->>Config: 读取 API Key、模型、协议、工作目录
  Main->>Main: 校验参数并整理图片用途

  Main-->>UI: 推送 enhancing 状态
  Main->>Vision: 分析参考图、用户要求、功能模板和矩形框选
  Vision-->>Main: 返回结构化 JSON 控图描述
  Main->>FS: 保存 prompt-enhancement.json
  Main->>Main: 从 JSON 中提取 finalPrompt 和模型控制信息

  Main-->>UI: 推送 generating 状态
  Main->>Image: 携带控图 JSON 和 finalPrompt 发起生成/编辑请求
  Image-->>Main: 返回图片数据和文本说明
  Main-->>UI: 推送 saving 状态
  Main->>FS: 保存请求记录和结果图
  Main->>Queue: 释放运行槽位
  Main-->>IPC: 返回任务结果
  IPC-->>UI: 返回图片路径和状态
  UI-->>User: 展示结果图
```

## 13. 配置时序图

```mermaid
sequenceDiagram
  participant User as 用户
  participant UI as 设置页
  participant IPC as Preload IPC
  participant Main as Main Process
  participant Store as 本地安全配置
  participant N1N as n1n API

  User->>UI: 输入 n1n API Key
  User->>UI: 配置模型和协议
  User->>UI: 设置工作目录
  UI->>IPC: 保存配置
  IPC->>Main: 转发配置请求
  Main->>Store: 保存 API Key、模型、协议、工作目录
  Store-->>Main: 保存成功
  Main-->>UI: 返回成功

  User->>UI: 点击测试连接
  UI->>IPC: 请求测试 API Key
  IPC->>Main: 转发测试请求
  Main->>Store: 读取配置
  Main->>N1N: 使用轻量模型发起测试请求
  N1N-->>Main: 返回成功或错误
  Main-->>UI: 返回连接状态
  UI-->>User: 显示测试结果
```
