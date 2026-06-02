import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopBridgeApi } from '../src/shared/contracts/desktop.js';

const desktopShell: DesktopBridgeApi = {
  platform: process.platform,
  saveImportBatch: (payload) => ipcRenderer.invoke('storage:save-import-batch', payload),
  saveTaskOutputs: (payload) => ipcRenderer.invoke('storage:save-task-outputs', payload),
  createTask: (record) => ipcRenderer.invoke('tasks:create', record),
  updateTask: (record) => ipcRenderer.invoke('tasks:update', record),
  listTasks: () => ipcRenderer.invoke('tasks:list'),
};

contextBridge.exposeInMainWorld('desktopShell', desktopShell);
