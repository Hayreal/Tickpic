# AI Image Prompt Policy

This document records how Tickpic assembles the execution prompt sent directly to the image generation/edit model.

The app no longer runs a separate instruction-generation stage. Main Process combines the feature `mainPrompt`, the user `prompt`, and structured task parameters into one text prompt before calling the image model.

Runtime source of truth:

- `src/shared/domain/imageFeatureApi.ts` defines each feature `mainPrompt`.
- `electron/main/services/image-tasks/instructionPrompt.ts` implements `buildExecutionPrompt()`.

## Execution Prompt Assembly

产品套图（`product_main_image`、`product_comparison_image`、`product_multi_scene`）按以下顺序组装：

1. Feature `mainPrompt` from `getImageFeatureDefinition(feature).mainPrompt`.
2. 套图结构化控制项，以及其他 structured parameters、region summary 和 region operation hints。
3. 显式优先级护栏：用户具体场景、补充要求和反向要求只执行不与前述功能硬规则及结构化控制项冲突的部分；冲突内容由模型忽略，以前述规则为准。
4. Product image set `scenePrompt`, when present.
5. User `prompt`, if present, as `补充要求：...`.
6. User `negativePrompt`, if present, as a separate avoidance line.
7. `variantIndex` / `variantTotal` 的批次差异要求，when both are present.

非套图保持原有顺序：`mainPrompt`、用户 `prompt`、其他 structured parameters/regions、批次差异要求；若贴纸复刻提供独立 Logo/reference 图且功能主提示词未包含对应说明，最后追加贴纸 Logo 角色说明。

Structured parameters are rendered as natural lines:

- `productName`: product name, or brand replacement for sticker replication.
- `productCategory`: product category.
- `sellingPoints`: selling points.
- `capacity`: capacity/specification.
- `logoText`: logo copy.
- `colorScheme`: color/style direction.
- `showProduct`: whether to show the product.
- Product image set controls: main-image hand-held/effect modes; comparison layout, After product visibility and intensity; multi-scene single/collage/grid layout.
- `scenePrompt`: a specific scene for main and comparison images.
- `negativePrompt`: rendered as `反向要求：避免出现以下内容：...` only when non-empty.

冲突处理不尝试用自然语言 parser 删除用户文本。套图把上述显式优先级护栏写入高优先级段，要求模型忽略与 Feature 硬规则或结构化控制项冲突的用户内容。

For non-sticker features, `aspectRatio` is passed only as a model API parameter (`size` / Gemini `aspectRatio`) and is not appended to the execution prompt text. Sticker features also state the resolved request ratio in their canvas guidance so the prompt contract and API parameter agree.

## Sticker Prompt Contract

The three sticker features bypass the generic natural-parameter summary and use the dedicated builder in `electron/main/services/image-tasks/stickerExecutionPrompt.ts`. The execution instructions are written in Chinese, while visible product copy remains natural English except for exact brand and capacity literals.

Sticker prompts use a compact five-section contract:

1. Output target: resolved canvas ratio and a flat 2D label whose background, texture, and decoration fill the entire canvas and extend naturally to every edge, with no visible outline, border, edge strip, padding, backing, product, container, scene, or mockup. The 6%–8% safe distance controls content placement only and must never be rendered as a line or solid-color frame.
2. Current task: replica, variation, or original mode; numbered reference-image roles; one selected bounded variation direction; and non-empty visual-direction fields.
3. Visible-copy sources: user-provided product name, selling points, and capacity take priority. For replica and variation requests, any missing field may fall back to clearly readable source-label copy; Chinese source copy is translated into concise natural English, while readable English is preserved. The specified brand always replaces every source brand.
4. Bounded user input: supplemental instructions apply only when compatible with the contract; the optional 500-character avoid-list is preserved as prohibited data and must not be rendered, repeated, translated, paraphrased, or implied.
5. One short final check: flat label artwork fills the entire canvas, no visible border, no copy outside the allowed user/source inputs, no empty text placeholders, and no user-prohibited content.

Sticker variation uses conditional copy-source instructions to protect model attention. When a field is supplied, the prompt says to use only that user value and omits the source fallback. When product name, capacity, or selling points are missing, the prompt asks the model to preserve the corresponding clearly readable source-label copy. It keeps at most three real source selling points, translates Chinese copy to natural English, and omits the entire selling-point module when the text cannot be read reliably; empty bullets, bars, and text placeholders are forbidden.

Prompt order is deliberate: mode and image roles first, visible-copy sources second, then optional visual directions. The final check repeats only the highest-risk outcomes instead of restating the full contract.

Each of the eight variation directions declares both allowed changes and required invariants. Color variation changes only the primary/supporting palette and color proportions; background variation changes only the label's internal background; fusion may borrow abstract layout, palette, and decorative patterns but cannot copy another brand, product, or literal text.

Original sticker requests without images use image generation. When a style/reference image is attached, it is included in the execution image list, causing the OpenAI protocol path to use image edits; Gemini includes the reference image in its request content. The image is style-only and must not contribute brands, products, or literal copy.

The legacy sticker-replica extraction suffix and universal sticker-variation redesign suffix are not appended during finalization. This prevents duplicate rules and avoids conflicts with surgical directions such as color-only changes.

## Feature Main Prompts

| Feature | mainPrompt |
|---|---|
| `sticker_replica` | 从当前产品图中提取产品表面的贴纸/标签，展开为正视角 2D 平面贴纸图。比例按原贴纸真实形状自主判断，不强制固定画幅。若输入是侧拍、斜拍、弧面或可见包装侧面，必须将可见贴纸/包装版面去透视并拉平成连续平面展开稿，不保留盒体侧面、厚度、折角、阴影、反光或 3D 透视。只输出贴纸本身，不输出产品容器或背景。保留原贴纸的排版、色系、风格、装饰元素、图案位置和文字内容，文字尽量不变。若提供单独 Logo 图，仅作为品牌标识嵌入到对应位置，不作为版式、配色或风格参考。 |
| `sticker_variation` | 生成同品类贴纸变体，可调整布局、标题区、卖点区与色块。 |
| `sticker_original` | 设计原创 2D 平面贴纸初稿，按品类与产品信息补充卖点与视觉风格。 |
| `remove_product` | 去除目标产品及喷雾/雾气叠加，补全遮挡区域；保留用户要求的文字与表面状态，不顺带清洁或美化。 |
| `replace_product` | 用目标产品替换场景原产品，保持姿势、透视、比例与光影自然。 |
| `replace_logo` | 只替换品牌 Logo，保持原位置、透视、材质与光影。 |
| `main_image_asset_variation` | 生成主图素材变体，支持风格/构图/Before-After，默认无具体产品。 |
| `scene_variation` | 生成新的具体使用场景素材，默认无具体产品。 |
| `create_new_scene` | 创作新的电商使用场景图，按品类发散真实生活场景。 |
| `prompt_only_main_asset` | 根据用户描述完成电商主图或广告素材生成 |
| `product_main_image` | 以 SKU 产品图为唯一产品依据，生成商品主图；保持产品外观、包装和品牌信息准确，自动生成英文大标题，并突出核心场景。手持与具体效果由结构化选项控制。 |
| `product_comparison_image` | 以 SKU 产品图为依据，每张只生成一个场景的一组 Before/After；Before 不展示 SKU，After 展示由结构化选项控制，布局可自动、左右或上下，并使用英文标识。 |
| `product_multi_scene` | 以 SKU 产品图为依据发散真实适用场景；用户提示词可选，画面模式可为单场景、拼图或宫格；SKU 可不露出，默认不添加营销文字。 |

## Product Image Set Variants

套图处理的主图、对比图和多场景图会将所选生成数量拆分为同一 `outputBatchId` 下的多个任务；即使只生成一张，也会拥有独立的 `outputBatchId`。每个任务的 `variantIndex` 和 `variantTotal` 用于标识该任务在整套图中的位置，例如 `variantIndex: 2`、`variantTotal: 3` 表示第 2 张，共 3 张。

变体之间应在构图、场景、展示角度或卖点表达上有所差异，同时保持同一 SKU 产品的外观与品牌信息一致。`variantIndex` 和 `variantTotal` 只用于任务编排与变体差异说明，不参与模型尺寸参数；图片尺寸仍仅由 `aspectRatio` 映射到模型 API 的 `size` 或 Gemini `aspectRatio`。

## Example

Sticker replication request:

```text
从当前产品图中提取产品表面的贴纸/标签，展开为正视角 2D 平面贴纸图。比例按原贴纸真实形状自主判断，不强制固定画幅。若输入是侧拍、斜拍、弧面或可见包装侧面，必须将可见贴纸/包装版面去透视并拉平成连续平面展开稿，不保留盒体侧面、厚度、折角、阴影、反光或 3D 透视。只输出贴纸本身，不输出产品容器或背景。保留原贴纸的排版、色系、风格、装饰元素、图案位置和文字内容，文字尽量不变。若提供单独 Logo 图，仅作为品牌标识嵌入到对应位置，不作为版式、配色或风格参考。
补充要求：品牌名换成 WKUA，整体保留原图的高级黑金风格。
品牌名换成 WKUA。
产品品类是 car belt silencer。
整体保留原图的 black and gold 风格。
```

The assembled prompt is saved to `image-instruction.txt` in the task output directory for debugging and replay.
