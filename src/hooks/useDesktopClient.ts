import { useMemo } from 'react';
import { createDesktopClient } from '../infrastructure/desktop/desktopClient';
import { getDesktopBridge } from '../infrastructure/desktop/desktopBridge';

export function useDesktopClient() {
  return useMemo(() => {
    const client = createDesktopClient(getDesktopBridge());
    return client.isAvailable() ? client : undefined;
  }, []);
}
