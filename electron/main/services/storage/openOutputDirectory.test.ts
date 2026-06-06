import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  shell: {
    openPath: vi.fn().mockResolvedValue(''),
  },
}));

import { shell } from 'electron';
import { openOutputDirectory } from './openOutputDirectory';

describe('openOutputDirectory', () => {
  let tempDir = '';

  afterEach(() => {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
    vi.clearAllMocks();
  });

  it('opens an explicit output directory', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tickpic-open-output-'));
    const outputDir = path.join(tempDir, 'outputs', '20260606', 'task-1');
    fs.mkdirSync(outputDir, { recursive: true });

    const result = await openOutputDirectory({ outputDir }, [tempDir]);

    expect(result.openedDir).toBe(outputDir);
    expect(shell.openPath).toHaveBeenCalledWith(outputDir);
  });

  it('opens the parent directory of authorized image paths', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tickpic-open-output-'));
    const outputDir = path.join(tempDir, 'outputs', '20260606', 'task-2');
    fs.mkdirSync(outputDir, { recursive: true });
    const imagePath = path.join(outputDir, 'result-1.png');
    fs.writeFileSync(imagePath, 'png-data');

    const result = await openOutputDirectory({ filePaths: [imagePath] }, [tempDir]);

    expect(result.openedDir).toBe(outputDir);
    expect(shell.openPath).toHaveBeenCalledWith(outputDir);
  });

  it('rejects directories outside authorized roots', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tickpic-open-output-'));
    const outsideDir = path.join(tempDir, 'outside');
    fs.mkdirSync(outsideDir, { recursive: true });

    await expect(
      openOutputDirectory({ outputDir: outsideDir }, [path.join(tempDir, 'allowed')]),
    ).rejects.toThrow('file path is outside authorized roots');
  });
});
