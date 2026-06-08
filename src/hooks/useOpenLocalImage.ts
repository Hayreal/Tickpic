import { useCallback, useState } from 'react';
import { resolveLocalFilePath } from '../lib/fileUrl';
import { useDesktopClient } from './useDesktopClient';

interface FallbackPreview {
  filePath: string;
  fileName: string;
}

export function useOpenLocalImage() {
  const desktopClient = useDesktopClient();
  const [fallbackPreview, setFallbackPreview] = useState<FallbackPreview | null>(null);

  const openPreview = useCallback(async (filePath: string, fileName = 'image') => {
    const localPath = resolveLocalFilePath(filePath);

    if (localPath && desktopClient?.isAvailable()) {
      try {
        await desktopClient.openLocalImage({ filePath: localPath });
        return;
      } catch {
        setFallbackPreview({ filePath, fileName });
        return;
      }
    }

    setFallbackPreview({ filePath, fileName });
  }, [desktopClient]);

  const closeFallbackPreview = useCallback(() => {
    setFallbackPreview(null);
  }, []);

  return {
    openPreview,
    fallbackPreview,
    closeFallbackPreview,
  };
}
