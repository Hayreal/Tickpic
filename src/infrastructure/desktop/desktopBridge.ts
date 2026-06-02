import type { DesktopBridgeApi } from '../../shared/contracts/desktop';

declare global {
  interface Window {
    desktopShell?: DesktopBridgeApi;
  }
}

export function getDesktopBridge(): DesktopBridgeApi | undefined {
  return typeof window !== 'undefined' ? window.desktopShell : undefined;
}
