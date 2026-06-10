# 贴纸复刻真实场景测试

本目录存放 `sticker_replica` 的 smoke 用例。测试图片在 `tests/fixtures/images/贴纸复刻&裂变/`。

用例按**真实用户填表习惯**组织：大多数人只选要复刻的图片就提交，不会填满所有可选字段。

**出图规则**：每个 JSON 对应一次任务、输出 1 张图。需要多张结果时，向任务队列多次提交，不在请求里写 `count`。

## 执行方式

```bash
pnpm smoke:image-task --request tests/sticker-replica/<场景文件>.zh.json --run-dir tests/output/sticker-replica/<场景名>
```

## 场景分组

### 只选源图（最常见）

仅 `feature` + `source` 图片，无 prompt、无品牌/容量/配色等附加项。

| 文件 | 源图 |
| --- | --- |
| `source-only-eyeglass-repair.zh.json` | `img.png` |
| `source-only-laundry-tablets.zh.json` | `img_1.png` |
| `source-only-belt-silencer.zh.json` | `img_2.png` |
| `source-only-deodorant-card.zh.json` | `img_4.png` |
| `source-only-helmet-spray.zh.json` | `img_5.png` |
| `source-only-beeswax-paste.zh.json` | `image.png` |

### 只多选一张参考图

用户额外上传 reference，仍不写文案参数。

| 文件 | 图片 |
| --- | --- |
| `source-reference-belt-silencer.zh.json` | `img_2.png` + `img_3.png` |

### 只补一项用户常填内容

| 文件 | 除图片外仅多填 |
| --- | --- |
| `prompt-only-rebrand-wkau.zh.json` | `prompt`: 换成 wkau |
| `region-only-belt-silencer.zh.json` | `regions`: 框选贴纸区域 |
| `logo-text-only.zh.json` | `logoText`: wkau |

## 推荐 smoke 顺序

先跑最简路径，再跑带单字段的变体：

```bash
pnpm smoke:image-task --request tests/sticker-replica/source-only-belt-silencer.zh.json --run-dir tests/output/sticker-replica/source-only-belt-silencer
pnpm smoke:image-task --request tests/sticker-replica/source-reference-belt-silencer.zh.json --run-dir tests/output/sticker-replica/source-reference-belt-silencer
pnpm smoke:image-task --request tests/sticker-replica/prompt-only-rebrand-wkau.zh.json --run-dir tests/output/sticker-replica/prompt-only-rebrand-wkau
```

未填字段时，会依赖功能默认主提示词（`从当前产品图中提取产品表面的贴纸...`）与源图一起提交给出图模型。
