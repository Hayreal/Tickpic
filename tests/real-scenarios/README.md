# AI Image Task 真实场景测试

这些 JSON 文件用于配合 `scripts/smoke-image-task.ts` 做真实模型调用的端到端 smoke 测试。

每个 JSON 代表**一次任务、输出 1 张图**。需要多张结果时，多次提交任务到队列，请求里不写 `count`。

运行前准备：

1. 在项目根目录准备 `.env`
2. 至少配置以下变量：

```env
N1N_API_KEY=your_key
N1N_BASE_URL=https://api.n1n.ai
VISION_MODEL=gemini-3.1-flash-lite
GENERATION_MODEL=gemini-2.5-flash-image
EDIT_MODEL=gemini-2.5-flash-image
```

## 推荐执行方式

所有测试产物输出到 `tests/output/` 下各自目录：

```bash
pnpm smoke:image-task --request tests/real-scenarios/prompt-only-main-asset.zh.json --run-dir tests/output/prompt-only-main-asset
pnpm smoke:image-task --request tests/real-scenarios/remove-product-hat.zh.json --run-dir tests/output/remove-product-hat
pnpm smoke:image-task --request tests/real-scenarios/replace-logo-redecas.zh.json --run-dir tests/output/replace-logo-redecas
pnpm smoke:image-task --request tests/real-scenarios/sticker-replica-belt-silencer.zh.json --run-dir tests/output/sticker-replica-belt-silencer
pnpm smoke:image-task --request tests/real-scenarios/main-image-asset-variation-metal-polish.zh.json --run-dir tests/output/main-image-asset-variation-metal-polish
```

## 场景说明

- `prompt-only-main-asset.zh.json`
  - 纯提示词主图/素材图，无输入图片
- `remove-product-hat.zh.json`
  - 去掉帽子去油广告图中的喷雾产品，保留帽子和喷雾效果
- `replace-logo-redecas.zh.json`
  - 将金属清洁剂产品图上的品牌 Logo 替换成 `wkau`
- `sticker-replica-belt-silencer.zh.json`
  - 参考现有贴纸风格，输出独立二维平面贴纸
- `main-image-asset-variation-metal-polish.zh.json`
  - 参考锅具清洁 before/after 主图风格，继续生成同类主图素材
