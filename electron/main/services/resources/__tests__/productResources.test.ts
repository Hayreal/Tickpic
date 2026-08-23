import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { listProductHandheldReferences, resolveProductResourcePath } from '../productResources';

describe('productResources', () => {
  it('lists handheld references with absolute paths under resources/product', () => {
    const references = listProductHandheldReferences();

    expect(references).toHaveLength(9);
    expect(references[0]).toEqual(expect.objectContaining({
      id: 'handheld-pump-foam',
      label: '按压泵瓶出泡',
      filename: 'handheld-pump-foam.png',
      path: resolveProductResourcePath('product', 'handheld-pump-foam.png'),
    }));
    expect(path.basename(references[0]!.path)).toBe('handheld-pump-foam.png');
    expect(references[0]!.path).toContain(`${path.sep}resources${path.sep}product${path.sep}`);
  });
});
