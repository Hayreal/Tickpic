import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../../src/shared/contracts/desktop.js';
import { openOutputDirectory } from './openOutputDirectory.js';
import { saveImportBatch } from './importStorage.js';
import { saveTaskOutputs } from './outputStorage.js';
import { getAppLogger } from '../logger/appLogger.js';

type PathResolver = () => string | Promise<string>;

export function registerImportStorageIpc(resolveImportsDir: PathResolver) {
  const logger = getAppLogger();

  ipcMain.handle(IPC_CHANNELS.storage.saveImportBatch, async (_event, payload: {
    page: string;
    feature: string;
    files: { name: string; type: string; buffer: ArrayBuffer }[];
  }) => {
    logger.info('storage', '保存导入批次', {
      page: payload.page,
      feature: payload.feature,
      fileCount: payload.files.length,
    });
    const importsDir = await Promise.resolve(resolveImportsDir());
    const result = await saveImportBatch(importsDir, payload);
    logger.info('storage', '导入批次已保存', { batchId: result.batchId, fileCount: result.images.length });
    return result;
  });
}

export function registerOutputStorageIpc(resolveOutputsDir: PathResolver) {
  const logger = getAppLogger();

  ipcMain.handle(IPC_CHANNELS.storage.saveTaskOutputs, async (_event, payload: {
    taskId: string;
    page: string;
    feature: string;
    outputs: { name: string; buffer: ArrayBuffer }[];
  }) => {
    logger.info('storage', '保存任务输出', {
      taskId: payload.taskId,
      feature: payload.feature,
      outputCount: payload.outputs.length,
    });
    const outputsDir = await Promise.resolve(resolveOutputsDir());
    const result = await saveTaskOutputs(outputsDir, payload);
    logger.info('storage', '任务输出已保存', { taskId: payload.taskId, savedCount: result.length });
    return result;
  });
}

type RootsResolver = () => string[] | Promise<string[]>;

export function registerOpenOutputDirectoryIpc(resolveAuthorizedRoots: RootsResolver) {
  const logger = getAppLogger();

  ipcMain.handle(IPC_CHANNELS.storage.openOutputDirectory, async (_event, payload: {
    outputDir?: string;
    filePaths?: string[];
  }) => {
    try {
      logger.info('storage', '打开输出目录', payload);
      const authorizedRoots = await Promise.resolve(resolveAuthorizedRoots());
      const result = await openOutputDirectory(payload, authorizedRoots);
      logger.info('storage', '输出目录已打开', { openedDir: result.openedDir });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('storage', '打开输出目录失败', { message, ...payload });
      throw error instanceof Error ? error : new Error(String(error));
    }
  });
}
