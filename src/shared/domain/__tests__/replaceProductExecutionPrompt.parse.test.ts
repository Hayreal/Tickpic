import { describe, expect, it } from 'vitest';
import {
  mergeReplaceProductExecutionPrompt,
  parseAndFormatReplaceProductExecutionPrompt,
  stripJsonFence,
} from '../replaceProductExecutionPrompt';

describe('replaceProductExecutionPrompt parsing', () => {
  it('merges vision JSON with request user notes and regions', () => {
    const merged = mergeReplaceProductExecutionPrompt({
      goal: '将场景中的蓝色胶管替换为图2白色胶管',
      product: {
        source: 'reference_image_2',
        preserve: ['wkau 管身贴纸结构'],
        forbidden_changes: ['贴图感'],
      },
    }, {
      feature: 'replace_product',
      prompt: '尖口喷嘴',
      regions: [{
        id: 'region-1',
        imageRole: 'source',
        x: 0.1,
        y: 0.2,
        width: 0.5,
        height: 0.4,
        operationHint: '原位替换',
      }],
    });

    expect(merged.goal).toContain('蓝色胶管');
    expect(merged.user_notes).toBe('尖口喷嘴');
    expect(merged.regions).toHaveLength(1);
    expect(merged.product.preserve).toContain('wkau 管身贴纸结构');
  });

  it('parses fenced JSON from vision model output', () => {
    const formatted = parseAndFormatReplaceProductExecutionPrompt(
      '```json\n{"task":"replace_product","goal":"场景内替换产品"}\n```',
      {
        feature: 'replace_product',
        prompt: '保持顶部标题',
      },
    );

    const parsed = JSON.parse(formatted);
    expect(parsed.task).toBe('replace_product');
    expect(parsed.goal).toBe('场景内替换产品');
    expect(parsed.user_notes).toBe('保持顶部标题');
  });

  it('strips markdown fences', () => {
    expect(stripJsonFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
});
