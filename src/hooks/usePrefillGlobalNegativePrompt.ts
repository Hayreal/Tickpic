import { useEffect } from 'react';
import { useGlobalNegativePrompt } from './useGlobalNegativePrompt';

/** Fills empty negative-prompt fields once global settings are loaded and optional task restore finished. */
export function usePrefillGlobalNegativePrompt(
  restoreReady: boolean,
  apply: (globalNegativePrompt: string) => void,
) {
  const globalNegativePrompt = useGlobalNegativePrompt();

  useEffect(() => {
    if (!restoreReady || !globalNegativePrompt.trim()) {
      return;
    }

    apply(globalNegativePrompt);
  }, [restoreReady, globalNegativePrompt, apply]);
}
