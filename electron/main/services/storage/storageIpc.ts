import { ipcMain } from 'electron';
import { saveImportBatch } from './importStorage.js';
import { saveTaskOutputs } from './outputStorage.js';

export function registerImportStorageIpc(importsDir: string) {
  ipcMain.handle('storage:save-import-batch', (_event, payload: {
    page: string;
    feature: string;
    files: { name: string; type: string; buffer: ArrayBuffer }[];
  }) => {
    return saveImportBatch(importsDir, payload);
  });
}

export function registerOutputStorageIpc(outputsDir: string) {
  ipcMain.handle('storage:save-task-outputs', (_event, payload: {
    taskId: string;
    page: string;
    feature: string;
    outputs: { name: string; buffer: ArrayBuffer }[];
  }) => {
    return saveTaskOutputs(outputsDir, payload);
  });
}
