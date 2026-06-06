import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readImageDimensionsFromBuffer } from '../imageDimensions.js';

const ONE_BY_ONE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY5UAAAAASUVORK5CYII=',
  'base64',
);

describe('readImageDimensionsFromBuffer', () => {
  it('reads png dimensions', () => {
    expect(readImageDimensionsFromBuffer(ONE_BY_ONE_PNG)).toEqual({ width: 1, height: 1 });
  });

  it('reads jpeg dimensions from fixture', () => {
    const fixturePath = path.join(process.cwd(), 'docs/docx_extract/contact_sheet.jpg');
    const buffer = readFileSync(fixturePath);
    const dimensions = readImageDimensionsFromBuffer(buffer);

    expect(dimensions.width).toBeGreaterThan(0);
    expect(dimensions.height).toBeGreaterThan(0);
  });

  it('rejects unknown formats', () => {
    expect(() => readImageDimensionsFromBuffer(Buffer.from('not-an-image'))).toThrow(
      'unsupported image format for bounds check',
    );
  });
});
