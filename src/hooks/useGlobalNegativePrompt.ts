import { useEffect, useState } from 'react';
import { DEFAULT_GLOBAL_NEGATIVE_PROMPT } from '../shared/domain/globalNegativePrompt';
import { useDesktopClient } from './useDesktopClient';

export function useGlobalNegativePrompt(): string {
  const desktopClient = useDesktopClient();
  const [globalNegativePrompt, setGlobalNegativePrompt] = useState(DEFAULT_GLOBAL_NEGATIVE_PROMPT);

  useEffect(() => {
    if (!desktopClient) {
      return;
    }

    desktopClient.settings.get()
      .then((settings) => {
        setGlobalNegativePrompt(settings.globalNegativePrompt ?? DEFAULT_GLOBAL_NEGATIVE_PROMPT);
      })
      .catch(() => {
        // ponytail: keep built-in default when settings are unavailable (e.g. tests without field)
      });
  }, [desktopClient]);

  return globalNegativePrompt;
}
