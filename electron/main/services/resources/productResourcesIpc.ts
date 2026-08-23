import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../../../src/shared/contracts/desktop.js';
import { listProductHandheldReferences } from './productResources.js';

export function registerProductResourcesIpc() {
  ipcMain.handle(IPC_CHANNELS.resources.listHandheldReferences, () => listProductHandheldReferences());
}
