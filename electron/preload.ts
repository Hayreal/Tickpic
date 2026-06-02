import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktopShell', {
  platform: process.platform,
  saveImportBatch: (payload: {
    page: string;
    feature: string;
    files: { name: string; type: string; buffer: ArrayBuffer }[];
  }) => ipcRenderer.invoke('storage:save-import-batch', payload),
  saveTaskOutputs: (payload: {
    taskId: string;
    page: string;
    feature: string;
    outputs: { name: string; buffer: ArrayBuffer }[];
  }) => ipcRenderer.invoke('storage:save-task-outputs', payload),
  createTask: (record: unknown) => ipcRenderer.invoke('tasks:create', record),
  updateTask: (record: unknown) => ipcRenderer.invoke('tasks:update', record),
  listTasks: () => ipcRenderer.invoke('tasks:list'),
});
