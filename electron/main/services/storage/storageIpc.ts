import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../../src/shared/contracts/desktop.js';
import { openOutputDirectory } from './openOutputDirectory.js';
import { saveImportBatch } from './importStorage.js';
import { saveTaskOutputs } from './outputStorage.js';

type PathResolver = () => string | Promise<string>;

export function registerImportStorageIpc(resolveImportsDir: PathResolver) {
  ipcMain.handle(IPC_CHANNELS.storage.saveImportBatch, async (_event, payload: {
    page: string;
    feature: string;
    files: { name: string; type: string; buffer: ArrayBuffer }[];
  }) => {
    const importsDir = await Promise.resolve(resolveImportsDir());
    return saveImportBatch(importsDir, payload);
  });
}

export function registerOutputStorageIpc(resolveOutputsDir: PathResolver) {
  ipcMain.handle(IPC_CHANNELS.storage.saveTaskOutputs, async (_event, payload: {
    taskId: string;
    page: string;
    feature: string;
    outputs: { name: string; buffer: ArrayBuffer }[];
  }) => {
    const outputsDir = await Promise.resolve(resolveOutputsDir());
    return saveTaskOutputs(outputsDir, payload);
  });
}

type RootsResolver = () => string[] | Promise<string[]>;

export function registerOpenOutputDirectoryIpc(resolveAuthorizedRoots: RootsResolver) {
  ipcMain.handle(IPC_CHANNELS.storage.openOutputDirectory, async (_event, payload: {
    outputDir?: string;
    filePaths?: string[];
  }) => {
    try {
      const authorizedRoots = await Promise.resolve(resolveAuthorizedRoots());
      return await openOutputDirectory(payload, authorizedRoots);
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  });
}
