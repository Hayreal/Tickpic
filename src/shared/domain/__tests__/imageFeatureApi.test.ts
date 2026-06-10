import { describe, expect, it } from 'vitest';
import {
  getImageFeatureDefinition,
  getExecutionImageRoles,
  validateImageTaskRequest,
} from '../imageFeatureApi';

describe('image feature API contract', () => {
  it('routes prompt-only main asset as generation without second-stage image inputs', () => {
    const definition = getImageFeatureDefinition('prompt_only_main_asset');

    expect(definition.executionModel).toBe('generation');
    expect(getExecutionImageRoles({
      feature: 'prompt_only_main_asset',
      prompt: 'Create a pink laundry cleaning sheet ad asset',
      images: [
        { role: 'reference', path: '/authorized/input/style.png' },
        { role: 'style', path: '/authorized/input/light.png' },
      ],
    })).toEqual([]);
  });

  it('accepts replace logo only when source and logo images are present', () => {
    const request = validateImageTaskRequest({
      feature: 'replace_logo',
      images: [
        { role: 'source', path: '/authorized/input/original.png' },
        { role: 'logo', path: '/authorized/input/logo.png' },
      ],
      regions: [
        {
          id: 'logo',
          imageRole: 'source',
          x: 10,
          y: 20,
          width: 100,
          height: 50,
        },
      ],
    });

    expect(request.feature).toBe('replace_logo');
  });

  it('rejects image roles outside the feature contract', () => {
    expect(() => validateImageTaskRequest({
      feature: 'replace_logo',
      images: [
        { role: 'source', path: '/authorized/input/original.png' },
        { role: 'product', path: '/authorized/input/product.png' },
      ],
    })).toThrow('replace_logo does not accept image role product');
  });

  it('rejects invalid counts and negative region dimensions before queuing', () => {
    expect(() => validateImageTaskRequest({
      feature: 'remove_product',
      count: 0,
      images: [{ role: 'source', path: '/authorized/input/scene.png' }],
    })).toThrow('count must be a positive integer');

    expect(() => validateImageTaskRequest({
      feature: 'remove_product',
      images: [{ role: 'source', path: '/authorized/input/scene.png' }],
      regions: [
        {
          id: 'bad-region',
          x: 0,
          y: 0,
          width: -1,
          height: 20,
        },
      ],
    })).toThrow('region bad-region width must be a non-negative number');
  });

  it('routes sticker replica logo images to execution as logo role', () => {
    const roles = getExecutionImageRoles({
      feature: 'sticker_replica',
      images: [
        { role: 'source', path: '/authorized/input/package.png' },
        { role: 'logo', path: '/authorized/input/logo.png' },
      ],
    });

    expect(roles).toEqual(['source', 'logo']);
  });

  it('defines sticker replica as product-sticker extraction without fixed aspect ratio', () => {
    const definition = getImageFeatureDefinition('sticker_replica');

    expect(definition.mainPrompt).toBe(
      '从当前产品图中提取产品表面的贴纸/标签，展开为正视角 2D 平面贴纸图。可以按内容判断横竖比例，但外轮廓必须输出为直角矩形，不按原图圆角、弧边或瓶身曲面轮廓出图。若输入是侧拍、斜拍、弧面或可见包装侧面，必须将可见贴纸/包装版面去透视并拉平成连续平面展开稿，不保留盒体侧面、厚度、折角、阴影、反光或 3D 透视。只输出贴纸本身，不输出产品容器或背景。保留原贴纸的排版、色系、风格、装饰元素和图案位置；画面文字须为英文，若原图文字为中文则翻译为对应英文后呈现。若提供单独 Logo 图，仅作为品牌标识嵌入到对应位置，不作为版式、配色或风格参考。所有贴纸输出都必须是直角矩形平面贴纸：四角为 90 度直角，边缘为水平/垂直直线；不要圆角、弧边、圆形、椭圆、异形、模切边或瓶身弧面轮廓。',
    );
  });

  it('requires every sticker feature to output sharp-corner rectangular stickers', () => {
    for (const feature of ['sticker_replica', 'sticker_variation', 'sticker_original'] as const) {
      const prompt = getImageFeatureDefinition(feature).mainPrompt;

      expect(prompt).toContain('直角矩形');
      expect(prompt).toContain('90 度直角');
      expect(prompt).toContain('不要圆角、弧边');
    }
  });

  it('defines remove-product as a local in-place edit', () => {
    const definition = getImageFeatureDefinition('remove_product');

    expect(definition.mainPrompt).toContain('喷雾/雾气');
    expect(definition.mainPrompt).toContain('表面状态');
    expect(definition.mainPrompt).toContain('不顺带清洁');
  });
});
