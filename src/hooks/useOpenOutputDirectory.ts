import { useCallback, useRef, useState } from 'react';
import type { ImageTaskRecord } from '../shared/domain/imageFeatureApi';
import type { TaskRecord } from '../shared/domain/tasks';
import { withTimeout } from '../lib/promise';
import { useDesktopClient } from './useDesktopClient';

export interface OpenOutputDirectoryInput {
  outputDir?: string;
  filePaths?: string[];
}

const OPEN_OUTPUT_DIRECTORY_TIMEOUT_MS = 15_000;

export function useOpenOutputDirectory() {
  const desktopClient = useDesktopClient();
  const [opening, setOpening] = useState(false);
  const sessionRef = useRef(0);
  const inFlightRef = useRef<Promise<unknown> | null>(null);

  const resetOpenOutputDirectory = useCallback(() => {
    sessionRef.current += 1;
    inFlightRef.current = null;
    setOpening(false);
  }, []);

  const openOutputDirectory = useCallback(async (input: OpenOutputDirectoryInput) => {
    if (!desktopClient) {
      throw new Error('需要 Electron 环境才能打开目录');
    }

    if (!input.outputDir?.trim() && !(input.filePaths?.length)) {
      throw new Error('没有可打开的目录');
    }

    const session = sessionRef.current;
    setOpening(true);
    const request = withTimeout(
      desktopClient.openOutputDirectory(input),
      OPEN_OUTPUT_DIRECTORY_TIMEOUT_MS,
      '打开目录超时，请重试',
    );
    inFlightRef.current = request;

    try {
      return await request;
    } finally {
      if (sessionRef.current === session) {
        if (inFlightRef.current === request) {
          inFlightRef.current = null;
        }
        setOpening(false);
      }
    }
  }, [desktopClient]);

  const openTaskOutputDirectory = useCallback(async (task: TaskRecord) => {
    if (task.outputDir?.trim()) {
      return openOutputDirectory({ outputDir: task.outputDir });
    }

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
    resetOpenOutputDirectory,
    opening,
  };
}
