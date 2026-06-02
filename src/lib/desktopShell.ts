import type { DesktopBridgeApi } from '../shared/contracts/desktop';

declare global {
  interface Window {
    desktopShell?: DesktopBridgeApi;
  }
}

export function hasDesktopStorageApi(): boolean {
  return typeof window !== 'undefined' && Boolean(window.desktopShell?.saveImportBatch);
}

export function getDesktopShell(): DesktopBridgeApi | undefined {
  return typeof window !== 'undefined' ? window.desktopShell : undefined;
}
