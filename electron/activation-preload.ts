import { contextBridge, ipcRenderer } from 'electron';
import { ACTIVATION_IPC_CHANNELS } from '../src/shared/contracts/activation.js';

contextBridge.exposeInMainWorld('activationShell', {
  submit: (code: string) => ipcRenderer.invoke(ACTIVATION_IPC_CHANNELS.submit, code),
  cancel: () => ipcRenderer.invoke(ACTIVATION_IPC_CHANNELS.cancel),
});
