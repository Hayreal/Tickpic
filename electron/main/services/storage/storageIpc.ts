import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../../src/shared/contracts/desktop.js';
import { saveImportBatch } from './importStorage.js';
import { saveTaskOutputs } from './outputStorage.js';

export function registerImportStorageIpc(importsDir: string) {
  ipcMain.handle(IPC_CHANNELS.storage.saveImportBatch, (_event, payload: {
    page: string;
    feature: string;
    files: { name: string; type: string; buffer: ArrayBuffer }[];
  }) => {
    return saveImportBatch(importsDir, payload);
  });
}

export function registerOutputStorageIpc(outputsDir: string) {
  ipcMain.handle(IPC_CHANNELS.storage.saveTaskOutputs, (_event, payload: {
    taskId: string;
    page: string;
    feature: string;
    outputs: { name: string; buffer: ArrayBuffer }[];
  }) => {
    return saveTaskOutputs(outputsDir, payload);
  });
}
