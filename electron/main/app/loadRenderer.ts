import fs from 'node:fs';
import type { BrowserWindow } from 'electron';
import { showStartupHelp } from './startupFallback.js';

export async function loadRenderer(mainWindow: BrowserWindow, rendererUrl: string | undefined, rendererIndexPath: string) {
  if (rendererUrl) {
    mainWindow.webContents.once('did-fail-load', () => {
      showStartupHelp(mainWindow, rendererUrl);
    });
    await mainWindow.loadURL(rendererUrl);
    return;
  }

  if (!fs.existsSync(rendererIndexPath)) {
    showStartupHelp(mainWindow, rendererIndexPath);
    return;
  }

  await mainWindow.loadFile(rendererIndexPath);
}
