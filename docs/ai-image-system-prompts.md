# AI Image Prompt Policy

This document records how Tickpic assembles the execution prompt sent directly to the image generation/edit model.

The app no longer runs a separate instruction-generation stage. Main Process combines the feature `mainPrompt`, the user `prompt`, and structured task parameters into one text prompt before calling the image model.

Runtime source of truth:

- `src/shared/domain/imageFeatureApi.ts` defines each feature `mainPrompt`.
- `electron/main/services/image-tasks/instructionPrompt.ts` implements `buildExecutionPrompt()`.

## Execution Prompt Assembly

Assembly order:

1. Feature `mainPrompt` from `getImageFeatureDefinition(feature).mainPrompt`.
2. User `prompt`, if present, as `补充要求：...`.
3. Structured parameters as short natural-language lines.
4. Region summary and region operation hints, if present.
5. Sticker-replication logo role warning, when a separate logo/reference image is provided and the feature prompt does not already include that warning.

Structured parameters are rendered as natural lines:

- `productName`: product name, or brand replacement for sticker replication.
- `productCategory`: product category.
- `sellingPoints`: selling points.
- `capacity`: capacity/specification.
- `logoText`: logo copy.
- `colorScheme`: color/style direction.
- `showProduct`: whether to show the product.

For non-sticker features, `aspectRatio` is passed only as a model API parameter (`size` / Gemini `aspectRatio`) and is not appended to the execution prompt text. Sticker features also state the resolved request ratio in their canvas guidance so the prompt contract and API parameter agree.

## Sticker Prompt Contract

The three sticker features bypass the generic natural-parameter summary and use the dedicated builder in `electron/main/services/image-tasks/stickerExecutionPrompt.ts`. The execution instructions are written in Chinese, while visible product copy remains natural English except for exact brand and capacity literals.

Sticker prompts use a compact five-section contract:

1. Output target: resolved canvas ratio, flat 2D label, full bleed to every canvas edge, and no visible outline, border, edge strip, padding, backing, product, container, scene, or mockup. The 6%–8% safe distance controls content placement only and must never be rendered as a line or solid-color frame.
2. Current task: replica, variation, or original mode; numbered reference-image roles; one selected bounded variation direction; and non-empty visual-direction fields.
3. Visible-copy whitelist: brand defaults to `wkau®`; capacity is preserved without conversion or normalization; Chinese product names and selling points are translation sources for natural English. The specified brand replaces every source brand.
4. Bounded user input: supplemental instructions apply only when compatible with the contract; the optional 500-character avoid-list is preserved as prohibited data and must not be rendered, repeated, translated, paraphrased, or implied.
5. One short final check: flat full-bleed label, no visible border, no copy outside the whitelist, and no user-prohibited content.

Sticker variation uses a strict copy whitelist. Source-image titles, descriptions, promotion claims, badge copy, fine print, and random text are not retained unless the user supplied the corresponding product-name or selling-point field. If the request supplies only a brand, the image must contain only that brand and must not invent a title, subtitle, benefits, or promotional copy.

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
