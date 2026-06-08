import { describe, expect, it } from 'vitest';
import { collectImportFiles, extractClipboardImageFiles, normalizePastedImageFile } from '../importBatch';

function makeImageFile(name: string, type = 'image/png') {
  return new File(['img'], name, { type });
}

function makeClipboardData(files: File[]) {
  return {
    items: files.map((file) => ({
      kind: 'file',
      type: file.type,
      getAsFile: () => file,
    })),
    files,
  } as unknown as DataTransfer;
}

describe('collectImportFiles', () => {
  it('keeps all image files in a batch', () => {
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
      '5.png',
    ]);
    expect(result.rejectedCount).toBe(0);
    expect(result.hasOverflow).toBe(false);
  });
});

describe('extractClipboardImageFiles', () => {
  it('extracts image files from clipboard items', () => {
    const files = extractClipboardImageFiles(makeClipboardData([
      makeImageFile('clip.png'),
    ]));

    expect(files).toHaveLength(1);
    expect(files[0]?.name).toBe('clip.png');
  });

  it('assigns a filename to pasted files without names', () => {
    const unnamed = new File(['img'], '', { type: 'image/png' });
    const files = extractClipboardImageFiles(makeClipboardData([unnamed]));

    expect(files).toHaveLength(1);
    expect(files[0]?.name).toMatch(/^pasted-image-\d+-0\.png$/);
  });
});

describe('normalizePastedImageFile', () => {
  it('preserves named image files', () => {
    const file = normalizePastedImageFile(makeImageFile('named.png'), 0);
    expect(file.name).toBe('named.png');
    expect(file.type).toBe('image/png');
  });
});
