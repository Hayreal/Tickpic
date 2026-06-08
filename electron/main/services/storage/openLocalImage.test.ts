import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const electronMock = vi.hoisted(() => ({
  openPath: vi.fn().mockResolvedValue(''),
}));

vi.mock('electron', () => ({
  shell: {
    openPath: electronMock.openPath,
  },
}));

import { openLocalImage } from './openLocalImage';

describe('openLocalImage', () => {
  let tempDir = '';

  afterEach(() => {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
    vi.clearAllMocks();
  });

  it('opens an authorized local image with the system previewer', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tickpic-open-image-'));
    const imagePath = path.join(tempDir, 'imports', 'source.png');
    fs.mkdirSync(path.dirname(imagePath), { recursive: true });
    fs.writeFileSync(imagePath, 'png-data');

    const result = await openLocalImage({ filePath: imagePath }, [tempDir]);

    expect(result).toEqual({ opened: true });
    expect(electronMock.openPath).toHaveBeenCalledWith(imagePath);
  });

  it('rejects image paths outside authorized roots', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tickpic-open-image-'));
    const imagePath = path.join(tempDir, 'outside', 'source.png');
    fs.mkdirSync(path.dirname(imagePath), { recursive: true });
    fs.writeFileSync(imagePath, 'png-data');

    await expect(openLocalImage({ filePath: imagePath }, [path.join(tempDir, 'allowed')]))
      .rejects
      .toThrow('file path is outside authorized roots');
    expect(electronMock.openPath).not.toHaveBeenCalled();
  });

  it('rejects empty image paths', async () => {
    await expect(openLocalImage({ filePath: ' ' }, ['/authorized']))
      .rejects
      .toThrow('图片路径不能为空');
    expect(electronMock.openPath).not.toHaveBeenCalled();
  });
});
