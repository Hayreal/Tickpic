import { createDesktopClient } from '../infrastructure/desktop/desktopClient';
import { getDesktopBridge } from '../infrastructure/desktop/desktopBridge';

export function hasDesktopStorageApi(): boolean {
  const client = createDesktopClient(getDesktopBridge());
  return client.isAvailable();
}

export function getDesktopShell() {
  const client = createDesktopClient(getDesktopBridge());
  return client.isAvailable() ? client : undefined;
}
