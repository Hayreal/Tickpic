import { describe, expect, it } from 'vitest';
import { parseProductSetVisionBatch } from '../productSetVisionInstructions';

describe('productSetVisionInstructions', () => {
  it('parses a fenced vision batch with the expected count', () => {
    const batch = parseProductSetVisionBatch(
      '```json\n{"instructions":[{"index":1,"variant_directive":"kitchen scene"},{"index":2,"variant_directive":"bathroom scene"},{"index":3,"variant_directive":"garage scene"}]}\n```',
      3,
    );

    expect(batch.instructions).toHaveLength(3);
    expect(batch.instructions[1]?.variant_directive).toBe('bathroom scene');
  });

  it('rejects batches with the wrong instruction count', () => {
    expect(() => parseProductSetVisionBatch('{"instructions":[{"index":1}]}', 3)).toThrow(/expected 3/);
  });

  it('rejects missing sequential indexes', () => {
    expect(() => parseProductSetVisionBatch(
      '{"instructions":[{"index":1},{"index":3}]}',
      2,
    )).toThrow(/missing instruction for index 2/);
  });
});
