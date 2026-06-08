import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const electronMock = vi.hoisted(() => ({
  writeImage: vi.fn(),
  createFromPath: vi.fn((filePath: string) => ({
    isEmpty: () => !filePath.endsWith('.png'),
  })),
}));

vi.mock('electron', () => ({
  clipboard: {
    writeImage: electronMock.writeImage,
  },
  nativeImage: {
    createFromPath: electronMock.createFromPath,
  },
}));

import { copyImageToClipboard } from './copyImageToClipboard';

describe('copyImageToClipboard', () => {
  let tempDir = '';

  afterEach(() => {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
    vi.clearAllMocks();
  });

  it('copies an authorized local image into the system clipboard', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tickpic-copy-image-'));
    const imagePath = path.join(tempDir, 'outputs', 'task-1', 'result-1.png');
    fs.mkdirSync(path.dirname(imagePath), { recursive: true });
    fs.writeFileSync(imagePath, 'png-data');

    const result = copyImageToClipboard({ filePath: imagePath }, [tempDir]);

    expect(result).toEqual({ copied: true });
    expect(electronMock.createFromPath).toHaveBeenCalledWith(imagePath);
    expect(electronMock.writeImage).toHaveBeenCalledTimes(1);
  });

  it('rejects image paths outside authorized roots', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tickpic-copy-image-'));
    const imagePath = path.join(tempDir, 'outside', 'result-1.png');
    fs.mkdirSync(path.dirname(imagePath), { recursive: true });
    fs.writeFileSync(imagePath, 'png-data');

    expect(() => copyImageToClipboard({ filePath: imagePath }, [path.join(tempDir, 'allowed')]))
      .toThrow('file path is outside authorized roots');
    expect(electronMock.writeImage).not.toHaveBeenCalled();
  });

  it('rejects empty image paths', () => {
    expect(() => copyImageToClipboard({ filePath: ' ' }, ['/authorized']))
      .toThrow('图片路径不能为空');
    expect(electronMock.writeImage).not.toHaveBeenCalled();
  });

  it('rejects unreadable image content', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tickpic-copy-image-'));
    const imagePath = path.join(tempDir, 'outputs', 'task-1', 'result-1.txt');
    fs.mkdirSync(path.dirname(imagePath), { recursive: true });
    fs.writeFileSync(imagePath, 'not image');

    expect(() => copyImageToClipboard({ filePath: imagePath }, [tempDir]))
      .toThrow('无法读取图片内容');
    expect(electronMock.writeImage).not.toHaveBeenCalled();
  });
});
