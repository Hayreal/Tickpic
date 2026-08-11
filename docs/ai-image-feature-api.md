# AI 作图功能 API 对接文档

## 1. 文档范围

本文面向 Tickpic Electron 客户端的 Renderer、Preload IPC 和 Main Process 对接，定义 AI 作图功能的统一任务请求格式、功能枚举、图片角色、区域参数、任务返回结构和功能级示例。

本 API 是客户端内部任务 API，不是公网 HTTP API。Renderer 只负责提交结构化任务；API Key、模型调用、文件读取、任务队列和产物保存必须由 Main Process 完成。

所有功能都走单阶段出图流程：

1. Main Process 在本地组装图片执行提示词 `finalPrompt`：功能 `mainPrompt` + 用户 `prompt` + 结构化参数（产品名、品类、卖点、比例、选区等）。
2. 将 `finalPrompt` 和执行阶段需要的图片直接提交给图片生成/编辑模型出图。

纯提示词主图/素材图（`prompt_only_main_asset`）即使传入参考图，当前也不会把这些图片传给图片模型；仅通过文本提示词描述风格或构图方向。

## 2. IPC API

建议 Preload 暴露以下受控 API：

| API | 说明 |
|---|---|
| `imageTask.submit(request)` | 提交 AI 作图任务，立即返回 `taskId` 和初始状态 |
| `imageTask.cancel(taskId)` | 取消等待中或运行中的任务 |
| `imageTask.get(taskId)` | 查询任务当前状态和结果 |
| `imageTask.onStatus(listener)` | 订阅任务状态变化，返回取消订阅函数 |

IPC 通道名应在共享契约中集中维护，Renderer 不得直接访问 `ipcRenderer`。

## 3. 统一请求结构

```ts
type ImageTaskRequest = {
  feature: ImageFeature;
  prompt?: string;
  negativePrompt?: string;
  scenePrompt?: string;
  images?: ImageInput[];
  regions?: RegionInput[];
  count?: number;
  /** 同一 Renderer 出图批次的任务共享同一个输出目录。 */
  outputBatchId?: string;
  /** 套图中的第几个变体；必须和 variantTotal 成对传入。 */
  variantIndex?: number;
  /** 套图的变体总数；必须和 variantIndex 成对传入。 */
  variantTotal?: number;
  productName?: string;
  productCategory?: string;
  sellingPoints?: string[];
  capacity?: string;
  logoText?: string;
  colorScheme?: string;
  aspectRatio?: string;
  showProduct?: boolean;
  productHandheldMode?: "handheld" | "not_handheld";
  productEffectMode?: "auto" | "show" | "hide";
  comparisonLayout?: "auto" | "horizontal" | "vertical";
  comparisonIntensity?: "light" | "medium" | "heavy";
  multiSceneLayout?: "single" | "collage" | "grid";
  modelOverrides?: {
    vision?: string;
    generation?: string;
    edit?: string;
  };
};
```

字段说明：

| 字段 | 必填 | 说明 |
|---|---:|---|
| `feature` | 是 | 功能枚举，决定功能边界、主提示词、模型路由和输入校验 |
| `prompt` | 否 | 用户附加要求或纯提示词主图的主描述 |
| `negativePrompt` | 否 | 不希望出现的元素、文字、效果或画面问题 |
| `scenePrompt` | 否 | 产品主图或对比图的具体场景词 |
| `images` | 否 | 原图、参考图、目标产品图、Logo 图、风格图等 |
| `regions` | 否 | Renderer 框选区域，作为模型理解和编辑边界提示 |
| `count` | 否 | 出图数量；不传时使用客户端配置 |
| `outputBatchId` | 否 | Renderer 为一次出图生成的共享批次 ID。同一批次的任务写入同一输出目录；单张请求也应带自己的批次 ID |
| `variantIndex` | 否 | 套图中的 1 起始序号；必须与 `variantTotal` 成对传入 |
| `variantTotal` | 否 | 套图总数；必须与 `variantIndex` 成对传入 |
| `productName` | 否 | 产品名 |
| `productCategory` | 否 | 产品品类 |
| `sellingPoints` | 否 | 卖点列表 |
| `capacity` | 否 | 容量或规格文字 |
| `logoText` | 否 | Logo 或品牌文字 |
| `colorScheme` | 否 | 色系方向，例如 `蓝绿色`、`科技感蓝白色` |
| `aspectRatio` | 否 | 图片比例，例如 `1:1`、`4:3`、`9:16` |
| `showProduct` | 否 | 是否展示具体产品；仅可用于 `main_image_asset_variation`、`scene_variation`、`create_new_scene`、`product_comparison_image`，且必须为布尔值 |
| 套图结构化控制 | 否 | 主图使用 `productHandheldMode`、`productEffectMode`；对比图使用 `comparisonLayout`、`comparisonIntensity`、`showProduct`；多场景图使用 `multiSceneLayout`。字段只能用于对应的产品套图功能。 |
| `modelOverrides` | 否 | 执行阶段模型覆盖；`generation` / `edit` 按功能路由，`vision` 已废弃 |

## 4. 功能枚举

```ts
type ImageFeature =
  | "sticker_replica"
  | "sticker_variation"
  | "sticker_original"
  | "remove_product"
  | "replace_product"
  | "replace_logo"
  | "main_image_asset_variation"
  | "scene_variation"
  | "create_new_scene"
  | "prompt_only_main_asset"
  | "product_main_image"
  | "product_comparison_image"
  | "product_multi_scene";
```

## 5. 图片输入结构

```ts
type ImageInput = {
  role: ImageRole;
  path: string;
  mimeType?: string;
  label?: string;
};

type ImageRole =
  | "source"
  | "reference"
  | "style"
  | "product"
  | "logo";
```

图片角色说明：

| role | 说明 |
|---|---|
| `source` | 待处理原图，例如包装图、场景图、主图 |
| `reference` | 设计、效果、内容参考图 |
| `style` | 风格参考图 |
| `product` | 替换产品或需要展示的目标产品图；产品套图功能要求至少一张，且可提交多张 SKU 图作为同一产品的参考 |
| `logo` | 替换 Logo 任务中的目标 Logo 图 |

默认规则：

- 图片编辑和裂变功能的 `source`、`product`、`logo` 会传入图片模型作为编辑输入。
- 纯提示词主图/素材图中的 `source`、`reference`、`style` 当前不传入图片模型，仅通过组装后的文本提示词表达意图。
- 如果某个模型协议不支持执行阶段图片输入，Main Process 应提示用户调整功能或模型配置。

`path` 必须是 Main Process 可读取的本地授权路径。Renderer 上传或选择图片后，只能把受控文件引用交给 Main Process，不能自行读取 API Key 或调用模型。

## 6. 区域结构

```ts
type RegionInput = {
  id: string;
  imageRole?: ImageRole;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  operationHint?: string;
};
```

坐标建议使用相对原图像素坐标。`operationHint` 用于说明框选区域的处理意图，例如 `remove this bottle`、`replace logo here`、`extract sticker area`。

## 7. 任务返回结构

提交任务立即返回：

```ts
type ImageTaskSubmitResult = {
  taskId: string;
  feature: ImageFeature;
  status: "queued";
};
```

任务完成后返回：

```ts
type ImageTaskResult = {
  taskId: string;
  feature: ImageFeature;
  status: "completed" | "failed" | "canceled";
  model: string;
  protocol: "gemini" | "openai";
  outputDir: string;
  images: string[];
  requestJsonPath: string;
  imageInstructionPath: string;
  outputJsonPath: string;
  textNotes?: string[];
  warnings?: string[];
  error?: {
    code: string;
    message: string;
  };
};
```

## 8. 功能参数表

| 功能 | feature | 主提示词 | 图片角色 | 可选参数 | 执行模型 |
|---|---|---|---|---|---|
| 贴纸复刻 | `sticker_replica` | 从当前产品图中提取产品表面的贴纸/标签，展开为正视角 2D 平面贴纸图。侧拍、斜拍、弧面或可见包装侧面必须去透视并拉平成连续平面展开稿；只输出贴纸本身，不输出产品容器或背景。 | `source`、`reference` | `prompt`、`regions`、`productName`、`logoText`、`colorScheme`、`aspectRatio` | edit |
| 贴纸裂变 | `sticker_variation` | 参考当前贴纸的品类氛围，生成同品类感的新款 2D 平面贴纸。源图只作为氛围参考，版式需要明显不同，不能只是替换文字、图标、花色或局部配色。 | `source`、`reference` | `prompt`、`colorScheme`、`aspectRatio`、`count` | edit |
| 贴纸原创 | `sticker_original` | 设计一张适合当前产品的原创 2D 平面贴纸初稿，可贴到包装上。文字可以出现，但需要控制排版层级和字号比例：产品名可突出，但不能占满画面；辅助文案保持较小，给图标、插画、色块和版式留出足够空间。 | `reference`、`style` | `prompt`、`productName`、`productCategory`、`sellingPoints`、`capacity`、`colorScheme`、`aspectRatio` | generation |
| 去除产品 | `remove_product` | 在原图基础上仅局部去除目标产品并补全该产品遮挡的像素。源图是固定底图，非目标区域必须与原图完全一致；不要换背景、不要修饰无关区域、不要裁切或重新生成场景。 | `source` | `prompt`、`regions` | edit |
| 替换产品 | `replace_product` | 用目标产品替换场景图中的原产品，尽量保持原手持姿势、透视、大小比例与光影自然。除非明确要求对比展示，否则不保留新旧产品并存。 | `source`、`product` | `prompt`、`regions`、`colorScheme` | edit |
| 替换 Logo | `replace_logo` | 只替换原图中明显的品牌 Logo 或品牌文字。目标 Logo 仅作标识参考，保持原位置、透视、材质与光影贴合，不改包装结构、产品形态、背景及其他文字。 | `source`、`logo` | `prompt`、`regions`、`logoText`、`colorScheme` | edit |
| 主图素材裂变 | `main_image_asset_variation` | 参考当前主图，生成同类电商主图素材变体。支持不同风格、色系、构图及 Before/After 对比表达，默认不展示具体产品。 | `source`、`reference` | `prompt`、`productName`、`sellingPoints`、`colorScheme`、`aspectRatio`、`count`、`showProduct` | edit |
| 场景裂变 | `scene_variation` | 参考当前场景，生成同品类可用的新使用场景素材。发散不同具体使用场景，而非仅改色或构图，默认不展示具体产品。 | `source`、`reference` | `prompt`、`productCategory`、`colorScheme`、`showProduct`、`count` | edit |
| 创作新场景图 | `create_new_scene` | 根据产品品类与场景要求，创作新的电商使用场景图。自动发散多个真实生活场景，可含使用前后对比与细节图。 | `style` | `prompt`、`productCategory`、`sellingPoints`、`colorScheme`、`aspectRatio`、`showProduct` | generation |
| 纯提示词主图/素材图 | `prompt_only_main_asset` | 根据用户描述完成电商主图或广告素材生成 | `source`、`reference`、`style`（当前不参与出图） | `prompt`、`productName`、`sellingPoints`、`colorScheme`、`aspectRatio`、`count` | generation |
| 产品主图 | `product_main_image` | 以单张 SKU 主图为默认输入，生成 US Temu 电商主图；执行提示词为 JSON 技术规格，支持可选提示词、反向提示词、具体场景、手持和效果控制。 | 必填 `product`（默认同款单张，可多张补充视角） | `prompt`、`negativePrompt`、`scenePrompt`、`productHandheldMode`、`productEffectMode`、`aspectRatio`、`count`、`outputBatchId`、`variantIndex`、`variantTotal` | edit |
| 产品对比图 | `product_comparison_image` | 每张只生成一个场景的一组 Before/After；面板内不出现 SKU。`showProduct: true` 时以放大前景商品层展示 SKU，`showProduct: false` 时整张不展示 SKU；执行提示词为 JSON。 | 必填 `product`（默认同款单张） | `prompt`、`negativePrompt`、`scenePrompt`、`comparisonLayout`、`comparisonIntensity`、`showProduct`、`aspectRatio`、`count`、`outputBatchId`、`variantIndex`、`variantTotal` | edit |
| 产品多场景图 | `product_multi_scene` | 根据输入 SKU 识别用途并发散真实适用场景；画面不得出现 SKU/人物；可选提示词与单场景/拼图/宫格；执行提示词为 JSON。 | 必填 `product`（默认同款单张） | `prompt`、`negativePrompt`、`multiSceneLayout`、`aspectRatio`、`count`、`outputBatchId`、`variantIndex`、`variantTotal` | edit |

说明：

- `执行模型` 按功能路由到 `modelOverrides.generation` 或 `modelOverrides.edit`，未覆盖时使用用户配置的图像生成/编辑模型。
- 贴纸类功能必须输出独立 2D 平面贴纸，不输出瓶、罐、盒或包装 mockup。
- 主图素材裂变和场景裂变默认不展示具体产品，除非 `showProduct: true` 或用户明确要求展示产品。
- 纯提示词主图/素材图当前为纯文本生成，参考图不会传入图片模型。
- 纯提示词主图/素材图的 Renderer 提交时，`prompt` 会带固定前缀 `生成电商主图或广告素材：`，再接用户输入的主描述。
- 三个产品套图功能均使用 edit 执行模型，且至少需要一张 `product` 图片；多张 `product` 图片共同描述同一 SKU 的不同视角或细节。

## 9. 图片执行提示词组装

Main Process 不再调用图像理解/指令生成模型。`finalPrompt` 在本地由 `buildExecutionPrompt()` 组装，规则见 `docs/ai-image-system-prompts.md`。

组装输入示例：

```json
{
  "feature": "prompt_only_main_asset",
  "prompt": "生成一张洗衣清洁片广告素材，粉色背景，泡泡、水流、清新感",
  "colorScheme": "粉色背景",
  "aspectRatio": "4:3"
}
```

组装后的 `finalPrompt` 示例：

```text
根据用户描述完成电商主图或广告素材生成
补充要求：生成一张洗衣清洁片广告素材，粉色背景，泡泡、水流、清新感
配色方向是 粉色背景。
```

## 10. 请求示例

### 10.1 贴纸复刻

```json
{
  "feature": "sticker_replica",
  "prompt": "换成 wkau，容量写 6PIECES，整体更清爽",
  "images": [
    {
      "role": "source",
      "path": "/authorized/input/package.png"
    }
  ],
  "regions": [
    {
      "id": "sticker-area",
      "imageRole": "source",
      "x": 120,
      "y": 180,
      "width": 420,
      "height": 260,
      "operationHint": "extract sticker area"
    }
  ],
  "logoText": "wkau",
  "capacity": "6PIECES",
  "aspectRatio": "1:1"
}
```

### 10.2 贴纸裂变

```json
{
  "feature": "sticker_variation",
  "prompt": "更适合夏季清洁产品",
  "images": [
    {
      "role": "source",
      "path": "/authorized/input/sticker-reference.png"
    }
  ],
  "colorScheme": "蓝绿色",
  "count": 4
}
```

### 10.3 贴纸原创

```json
{
  "feature": "sticker_original",
  "prompt": "科技感蓝白色",
  "productName": "LENS CLEANER",
  "productCategory": "镜头清洁剂",
  "capacity": "60ML",
  "colorScheme": "科技感蓝白色",
  "aspectRatio": "1:1"
}
```

### 10.4 去除产品

```json
{
  "feature": "remove_product",
  "prompt": "只去除目标产品，保留桌面、窗光、后方绿植、原构图和其他非目标元素",
  "images": [
    {
      "role": "source",
      "path": "/authorized/input/product-scene.png"
    }
  ],
  "regions": [
    {
      "id": "target-product",
      "imageRole": "source",
      "x": 360,
      "y": 210,
      "width": 260,
      "height": 520,
      "operationHint": "remove only the target product and locally inpaint the selected area"
    }
  ]
}
```

### 10.5 替换产品

```json
{
  "feature": "replace_product",
  "prompt": "放在原瓶子位置，保持厨房台面光影",
  "images": [
    {
      "role": "source",
      "path": "/authorized/input/kitchen-scene.png"
    },
    {
      "role": "product",
      "path": "/authorized/input/target-product.png"
    }
  ],
  "regions": [
    {
      "id": "old-bottle",
      "imageRole": "source",
      "x": 410,
      "y": 180,
      "width": 230,
      "height": 560,
      "operationHint": "replace this product"
    }
  ]
}
```

### 10.6 替换 Logo

```json
{
  "feature": "replace_logo",
  "prompt": "只替换瓶身顶部品牌标识",
  "images": [
    {
      "role": "source",
      "path": "/authorized/input/original-product.png"
    },
    {
      "role": "logo",
      "path": "/authorized/input/logo-line-art.png"
    }
  ],
  "regions": [
    {
      "id": "top-brand-mark",
      "imageRole": "source",
      "x": 250,
      "y": 120,
      "width": 180,
      "height": 80,
      "operationHint": "replace only this brand logo"
    }
  ]
}
```

### 10.7 主图素材裂变

```json
{
  "feature": "main_image_asset_variation",
  "prompt": "做 Before/After 对比，突出去污效果",
  "images": [
    {
      "role": "source",
      "path": "/authorized/input/main-image-reference.png"
    }
  ],
  "sellingPoints": ["去污效果"],
  "colorScheme": "蓝白色调",
  "aspectRatio": "4:3",
  "count": 4,
  "showProduct": false
}
```

### 10.8 场景裂变

```json
{
  "feature": "scene_variation",
  "prompt": "厨房水槽、灶台、锅底三个方向，不展示具体产品",
  "images": [
    {
      "role": "source",
      "path": "/authorized/input/scene-reference.png"
    }
  ],
  "productCategory": "清洁产品",
  "showProduct": false,
  "count": 3
}
```

### 10.9 创作新场景图

```json
{
  "feature": "create_new_scene",
  "prompt": "清洁片在现代厨房使用，明亮自然光，突出泡腾清洁感",
  "productCategory": "清洁片",
  "sellingPoints": ["泡腾清洁", "厨房清洁"],
  "colorScheme": "明亮自然光",
  "aspectRatio": "4:3",
  "showProduct": true
}
```

### 10.10 纯提示词主图/素材图

```json
{
  "feature": "prompt_only_main_asset",
  "prompt": "生成一张洗衣清洁片广告素材，粉色背景，泡泡、水流、清新感",
  "images": [
    {
      "role": "reference",
      "path": "/authorized/input/style-reference.png"
    }
  ],
  "productCategory": "洗衣清洁片",
  "colorScheme": "粉色背景",
  "aspectRatio": "4:3",
  "count": 1
}
```

### 10.11 产品套图：多 SKU 产品主图

产品套图的 Renderer 将用户选择的 `N` 个生成数量拆分为 `N` 个请求。每个请求的 `count` 固定为 `1`，共享同一个 `outputBatchId`，并以 `variantIndex` / `variantTotal` 表示在套图中的位置。即使只生成单张，也必须生成批次 ID，并传入 `variantIndex: 1` 与 `variantTotal: 1`。

```json
{
  "feature": "product_main_image",
  "images": [
    {
      "role": "product",
      "path": "/authorized/input/sku-front.png"
    },
    {
      "role": "product",
      "path": "/authorized/input/sku-side.png"
    },
    {
      "role": "product",
      "path": "/authorized/input/sku-detail.png"
    }
  ],
  "aspectRatio": "4:3",
  "count": 1,
  "outputBatchId": "product-set-20260731-001",
  "variantIndex": 1,
  "variantTotal": 3
}
```

## 11. 校验规则

Main Process 必须在入队前完成请求校验：

| 规则 | 说明 |
|---|---|
| 功能枚举 | `feature` 必须属于 `ImageFeature` |
| 图片角色 | 不同功能只接受允许的 `ImageRole` |
| 本地路径 | 图片路径必须在用户授权范围内，规范化后不能路径穿越 |
| 区域坐标 | `regions` 坐标必须为非负数，并落在目标图片范围内 |
| 出图数量 | `count` 必须为正整数，并受客户端最大值限制 |
| 套图控制归属 | `prompt`、`negativePrompt` 对三个产品套图功能均可选；`scenePrompt` 仅主图/对比图可用；各枚举控制项仅可用于对应 Feature；所有可选字符串 trim 后为空时省略。 |
| 变体元数据 | `variantIndex` 与 `variantTotal` 必须成对传入；二者都必须为正整数，且 `variantIndex <= variantTotal`；`variantTotal` 亦不得超过运行时 `maxCount` |
| 比例 | `aspectRatio` 必须转换为模型支持的尺寸或比例参数 |
| 功能边界 | 用户 `prompt` 与功能边界冲突时，以功能边界为准 |
| 模型协议 | 选定模型必须能在用户配置中找到协议映射 |
| 纯提示词图片 | 纯提示词主图/素材图传入的参考图当前不参与图片模型调用 |

## 12. 产物要求

每个完成任务至少保存：

| 产物 | 说明 |
|---|---|
| `request.json` | 保存原始请求、功能类型、图片角色、区域、模型覆盖和脱敏后的配置摘要 |
| `image-instruction.txt` | 保存本地组装后的图片执行提示词 |
| 输出图片 | `result-{index}.png` 或模型返回的实际格式 |
| 输出 JSON | 同名 `.json`，保存输入摘要、实际模型、协议、图片执行指令、输出尺寸、脱敏响应摘要和 warnings |

图片执行指令必须进入任务产物链路，供复现和排查使用。日志和 JSON 产物不得保存 API Key、Authorization header、base64 图片或未清洗的完整模型响应。
