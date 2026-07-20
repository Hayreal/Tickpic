import { describe, expect, it } from 'vitest';
import {
  buildReplaceProductExecutionPrompt,
  buildReplaceProductExecutionPromptObject,
} from '../replaceProductExecutionPrompt';

describe('replaceProductExecutionPrompt', () => {
  it('builds a generic structured JSON prompt for replace_product', () => {
    const json = buildReplaceProductExecutionPrompt({
      feature: 'replace_product',
      prompt: '保持尖口喷嘴',
      images: [
        { role: 'source', path: '/tmp/scene.png' },
        { role: 'product', path: '/tmp/product.png' },
      ],
      regions: [{
        id: 'region-1',
        imageRole: 'source',
        x: 0.1,
        y: 0.2,
        width: 0.5,
        height: 0.4,
        operationHint: '在选区内原位替换产品，保持图2贴纸/标签结构不变，匹配场景光影',
      }],
    });

    const parsed = JSON.parse(json);
    expect(parsed.task).toBe('replace_product');
    expect(parsed.goal).toContain('通用产品替换');
    expect(parsed.images.target_product.role).toBe('product');
    expect(parsed.product.preserve.join(' ')).toContain('贴纸/标签');
    expect(parsed.product.forbidden_changes).toContain('重设计或重排贴纸/标签结构');
    expect(parsed.compositing.mode).toBe('in_place_edit');
    expect(parsed.user_notes).toBe('保持尖口喷嘴');
    expect(parsed.regions[0].hint).toContain('贴纸/标签结构');
  });

  it('omits optional fields when not provided', () => {
    const prompt = buildReplaceProductExecutionPromptObject({
      feature: 'replace_product',
      images: [
        { role: 'source', path: '/tmp/scene.png' },
        { role: 'product', path: '/tmp/product.png' },
      ],
    });

    expect(prompt.user_notes).toBeUndefined();
    expect(prompt.regions).toBeUndefined();
    expect(prompt.parameters).toBeUndefined();
  });
});
