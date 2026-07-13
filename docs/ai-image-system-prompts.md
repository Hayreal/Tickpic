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

`aspectRatio` is passed only as a model API parameter (`size` / Gemini `aspectRatio`), not appended to the execution prompt text.

## Sticker prompt contract

Sticker execution prompts have a fixed section order: non-negotiable output
contract, mode contract, optional variation strategy, structured content,
low-priority user notes, and final check. Structured content overrides the
reference; free-form user notes cannot weaken a hard rule.

### Non-negotiable output rules

Every sticker prompt requires all of the following exactly once:

- One centered, front-facing, flat 2D rectangular label with four 90-degree
  corners and straight edges.
- Label artwork only: no bottle, jar, box, container, scene, stand, hand,
  collage, mockup, or 3D packaging.
- A pure-white, horizontally centred brand wordmark with the registered mark
  at its upper-right; no gradient, outline, shadow, texture, or 3D treatment.
- Natural English only for visible text: no Chinese, misspellings, garbling,
  pseudo-text, duplication, or omitted required groups.
- Complete title, brand, selling points, subtitle, NET line, and decorative
  elements; English-adaptive title typography is about 20% smaller than an
  equivalent Chinese treatment.
- The complete group is centred with wide left/right safety margins and no
  clipping or edge blur.

### Mode differences

- **Replica:** de-perspective and unwrap the source to a front-facing flat
  label; preserve source fields unless structured content overrides them. A
  supplied logo image is for brand identification only, never layout, palette,
  style, or visual-design reference.
- **Variation:** follow the resolved variation contract exactly; it controls
  what may change, what must remain, and what is forbidden.
- **Original:** build a fresh hierarchy from structured content. Style images
  are visual-language references only—do not copy their wording or layout—and
  do not invent certifications or claims.

### Variation directions and input fidelity

There are exactly eight variation directions. The resolved strategy controls
both prompt instructions and OpenAI edit input fidelity; the task plan/request
artifact records `resolvedVariationStrategy`, which makes that fidelity
reproducible.

| Direction | May change | Must preserve | Input fidelity |
|---|---|---|---|
| `product` | Product name, claims, efficacy/product graphics, information hierarchy | Brand, registered mark, commercial design system | low |
| `color` | Primary/secondary palette, contrast, color blocks | Brand, **layout**, visible copy, graphic positions, capacity | high |
| `reverse` | Light/dark hierarchy, primary/secondary roles, visual centre | Brand, visible copy, product identity | low |
| `geometry` | Internal color blocks, sections, decorative rhythm | Brand, visible copy, capacity, main hierarchy | low |
| `layout` | **Layout**, title/claim/graphic/badge/capacity positions, hierarchy | Brand, visible copy, product identity, core palette | low |
| `background` | Internal texture, material, decorative background | Brand, foreground text structure, capacity, core product information | high |
| `fusion` | Headline strength, selling-point rhythm, mature category design language | Brand, visible copy, product identity, capacity | low |
| `key-element` | Exactly one dominant group: title container, efficacy graphic, badge, or main illustration | Brand, remaining layout, visible copy, palette, capacity | high |

`color` variation explicitly preserves the existing layout and forbids rebuilding
it. `layout` variation explicitly changes the layout and hierarchy; it is not a
single-element adjustment. Each strategy also carries forbid rules, including
no old product identity for `product`, no negative-filter or mirrored text for
`reverse`, no full redesign for `key-element`, and no third-party brands or
copied labels for `fusion`.

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
