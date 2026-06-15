import { app } from 'electron';
import { isActivated } from '../services/activation/activationStore.js';
import { showActivationWindow } from './showActivationWindow.js';

export async function ensureMacActivation(activationFile: string, electronDir: string): Promise<boolean> {
  if (process.platform !== 'darwin' || !app.isPackaged) {
    return true;
  }

  if (await isActivated(activationFile)) {
    return true;
  }

  return showActivationWindow(activationFile, electronDir);
}
