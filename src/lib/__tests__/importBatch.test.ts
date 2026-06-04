import { describe, expect, it } from 'vitest';
import { collectImportFiles } from '../importBatch';

function makeImageFile(name: string, type = 'image/png') {
  return new File(['img'], name, { type });
}

describe('collectImportFiles', () => {
  it('keeps only the first four image files in a batch', () => {
    const result = collectImportFiles([
      makeImageFile('1.png'),
      makeImageFile('2.png'),
      makeImageFile('3.png'),
      makeImageFile('4.png'),
      makeImageFile('5.png'),
    ]);

    expect(result.accepted.map((file) => file.name)).toEqual([
      '1.png',
      '2.png',
      '3.png',
      '4.png',
    ]);
    expect(result.rejectedCount).toBe(1);
    expect(result.hasOverflow).toBe(true);
  });
});
