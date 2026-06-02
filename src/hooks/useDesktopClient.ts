import { useMemo } from 'react';
import { getDesktopShell } from '../lib/desktopShell';

export function useDesktopClient() {
  return useMemo(() => getDesktopShell(), []);
}
