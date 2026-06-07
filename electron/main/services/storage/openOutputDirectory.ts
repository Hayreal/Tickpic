import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { shell } from 'electron';
import { assertPathsUnderAuthorizedRoots } from './pathAuthorization.js';

export interface OpenOutputDirectoryInput {
  outputDir?: string;
  filePaths?: string[];
}

export interface OpenOutputDirectoryResult {
  openedDir: string;
}

function normalizeFilePath(filePath: string) {
  if (filePath.startsWith('file://')) {
    return decodeURIComponent(filePath.slice('file://'.length));
  }
  return filePath;
}

function resolveDirectory(input: OpenOutputDirectoryInput) {
  if (input.outputDir?.trim()) {
    return path.resolve(input.outputDir);
  }

  const filePaths = [...new Set((input.filePaths ?? []).map(normalizeFilePath).filter(Boolean))];
  if (filePaths.length === 0) {
    throw new Error('没有可打开的目录');
  }

  return path.dirname(path.resolve(filePaths[0]));
}

async function revealDirectoryInFileManager(directory: string): Promise<void> {
  if (process.platform === 'linux') {
    await revealDirectoryWithXdgOpen(directory);
    return;
  }

  const errorMessage = await shell.openPath(directory);
  if (errorMessage) {
    throw new Error(`无法打开目录: ${errorMessage}`);
  }
}

function revealDirectoryWithXdgOpen(directory: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('xdg-open', [directory], {
      detached: true,
      stdio: 'ignore',
    });

    child.once('error', (error) => {
      reject(new Error(`无法打开目录: ${error.message}`));
    });

    if (child.pid === undefined) {
      reject(new Error('无法打开目录: xdg-open 启动失败'));
      return;
    }

    child.unref();
    resolve();
  });
}

export async function openOutputDirectory(
  input: OpenOutputDirectoryInput,
  authorizedRoots: string[],
): Promise<OpenOutputDirectoryResult> {
  const directory = resolveDirectory(input);
  assertPathsUnderAuthorizedRoots([directory], authorizedRoots);

  if (!fs.existsSync(directory)) {
    throw new Error(`目录不存在: ${directory}`);
  }

  await revealDirectoryInFileManager(directory);

  return { openedDir: directory };
}
