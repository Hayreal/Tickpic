import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type DesktopBridgeApi } from '../src/shared/contracts/desktop.js';

const desktopShell: DesktopBridgeApi = {
  platform: process.platform,
  saveImportBatch: (payload) => ipcRenderer.invoke(IPC_CHANNELS.storage.saveImportBatch, payload),
  saveTaskOutputs: (payload) => ipcRenderer.invoke(IPC_CHANNELS.storage.saveTaskOutputs, payload),
  createTask: (record) => ipcRenderer.invoke(IPC_CHANNELS.tasks.create, record),
  updateTask: (record) => ipcRenderer.invoke(IPC_CHANNELS.tasks.update, record),
  listTasks: () => ipcRenderer.invoke(IPC_CHANNELS.tasks.list),
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.settings.get),
    save: (settings) => ipcRenderer.invoke(IPC_CHANNELS.settings.save, settings),
    testConnection: () => ipcRenderer.invoke(IPC_CHANNELS.settings.testConnection),
  },
  imageTask: {
    submit: (request) => ipcRenderer.invoke(IPC_CHANNELS.imageTask.submit, request),
    cancel: (taskId) => ipcRenderer.invoke(IPC_CHANNELS.imageTask.cancel, taskId),
    get: (taskId) => ipcRenderer.invoke(IPC_CHANNELS.imageTask.get, taskId),
    onStatus: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, task: Parameters<typeof listener>[0]) => {
        listener(task);
      };
      ipcRenderer.on(IPC_CHANNELS.imageTask.status, handler);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.imageTask.status, handler);
      };
    },
  },
};

contextBridge.exposeInMainWorld('desktopShell', desktopShell);
