import path from 'node:path';
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

export async function openOutputDirectory(
  input: OpenOutputDirectoryInput,
  authorizedRoots: string[],
): Promise<OpenOutputDirectoryResult> {
  const directory = resolveDirectory(input);
  assertPathsUnderAuthorizedRoots([directory], authorizedRoots);

  const errorMessage = await shell.openPath(directory);
  if (errorMessage) {
    throw new Error(`无法打开目录: ${errorMessage}`);
  }

  return { openedDir: directory };
}
