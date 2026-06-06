import { useCallback, useState } from 'react';
import type { ImageTaskRecord } from '../shared/domain/imageFeatureApi';
import type { TaskRecord } from '../shared/domain/tasks';
import { useDesktopClient } from './useDesktopClient';

export interface OpenOutputDirectoryInput {
  outputDir?: string;
  filePaths?: string[];
}

export function useOpenOutputDirectory() {
  const desktopClient = useDesktopClient();
  const [opening, setOpening] = useState(false);

  const openOutputDirectory = useCallback(async (input: OpenOutputDirectoryInput) => {
    if (!desktopClient) {
      throw new Error('需要 Electron 环境才能打开目录');
    }

    if (!input.outputDir?.trim() && !(input.filePaths?.length)) {
      throw new Error('没有可打开的目录');
    }

    setOpening(true);
    try {
      return await desktopClient.openOutputDirectory(input);
    } finally {
      setOpening(false);
    }
  }, [desktopClient]);

  const openTaskOutputDirectory = useCallback(async (task: TaskRecord) => {
    const filePaths = task.outputs.map((output) => output.filePath);
    return openOutputDirectory({ filePaths });
  }, [openOutputDirectory]);

  const openActiveTaskDirectory = useCallback(async (task: ImageTaskRecord) => {
    if (task.outputDir?.trim()) {
      return openOutputDirectory({ outputDir: task.outputDir });
    }

    return openOutputDirectory({ filePaths: task.images });
  }, [openOutputDirectory]);

  return {
    openOutputDirectory,
    openTaskOutputDirectory,
    openActiveTaskDirectory,
    opening,
  };
}
