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
5. Sticker-replication logo role warning, when a separate logo/reference image is provided.

Structured parameters are rendered as natural lines:

- `productName`: product name, or brand replacement for sticker replication.
- `productCategory`: product category.
- `sellingPoints`: selling points.
- `capacity`: capacity/specification.
- `logoText`: logo copy.
- `colorScheme`: color/style direction.
- `showProduct`: whether to show the product.

`aspectRatio` is passed only as a model API parameter (`size` / Gemini `aspectRatio`), not appended to the execution prompt text.

## Feature Main Prompts

| Feature | mainPrompt |
|---|---|
| `sticker_replica` | 提取产品或包装图上可见的贴纸，输出独立 2D 平面贴纸；若有 Logo 图仅作品牌标识嵌入，不要把 Logo 图当版式参考。 |
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
提取产品或包装图上可见的贴纸，输出独立 2D 平面贴纸；若有 Logo 图仅作品牌标识嵌入，不要把 Logo 图当版式参考。
补充要求：品牌名换成 WKUA，整体保留原图的高级黑金风格。
品牌名换成 WKUA。
产品品类是 car belt silencer。
整体保留原图的 black and gold 风格。
如果提供了单独 Logo 图，只把它作为品牌标识嵌入，不要把 Logo 图当作版式参考。
```

The assembled prompt is saved to `image-instruction.txt` in the task output directory for debugging and replay.
