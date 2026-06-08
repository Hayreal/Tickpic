import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeLocalFileProtocolUrl, assertLocalFilePathAuthorized } from './localFileProtocol';

describe('localFileProtocol', () => {
  it('decodes desktop image protocol urls back to absolute file paths', () => {
    const filePath = decodeLocalFileProtocolUrl('tickpic-file://image/%2FUsers%2Flixin%2FTickpic%20imports%2F%E8%B4%B4%E7%BA%B8%2Fimg%202.png');

    expect(filePath).toBe('/Users/lixin/Tickpic imports/贴纸/img 2.png');
  });

  it('rejects paths outside authorized workspace roots', () => {
    const root = path.join('/tmp', 'tickpic-workspace');
    const filePath = path.join('/tmp', 'outside', 'image.png');

    expect(() => assertLocalFilePathAuthorized(filePath, [root])).toThrow('file path is outside authorized roots');
  });
});
