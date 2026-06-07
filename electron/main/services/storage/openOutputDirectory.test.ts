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
    vi.restoreAllMocks();
  });

  it('opens an explicit output directory', async () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tickpic-open-output-'));
    const outputDir = path.join(tempDir, 'outputs', '20260606', 'task-1');
    fs.mkdirSync(outputDir, { recursive: true });

    const result = await openOutputDirectory({ outputDir }, [tempDir]);

    expect(result.openedDir).toBe(outputDir);
    expect(shell.openPath).toHaveBeenCalledWith(outputDir);
    platformSpy.mockRestore();
  });

  it('opens the parent directory of authorized image paths', async () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tickpic-open-output-'));
    const outputDir = path.join(tempDir, 'outputs', '20260606', 'task-2');
    fs.mkdirSync(outputDir, { recursive: true });
    const imagePath = path.join(outputDir, 'result-1.png');
    fs.writeFileSync(imagePath, 'png-data');

    const result = await openOutputDirectory({ filePaths: [imagePath] }, [tempDir]);

    expect(result.openedDir).toBe(outputDir);
    expect(shell.openPath).toHaveBeenCalledWith(outputDir);
    platformSpy.mockRestore();
  });

  it('rejects directories outside authorized roots', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tickpic-open-output-'));
    const outsideDir = path.join(tempDir, 'outside');
    fs.mkdirSync(outsideDir, { recursive: true });

    await expect(
      openOutputDirectory({ outputDir: outsideDir }, [path.join(tempDir, 'allowed')]),
    ).rejects.toThrow('file path is outside authorized roots');
  });

  it('rejects missing directories before opening in file manager', async () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tickpic-open-output-'));
    const missingDir = path.join(tempDir, 'missing-output');

    await expect(
      openOutputDirectory({ outputDir: missingDir }, [tempDir]),
    ).rejects.toThrow('目录不存在');

    expect(shell.openPath).not.toHaveBeenCalled();
    platformSpy.mockRestore();
  });
});
