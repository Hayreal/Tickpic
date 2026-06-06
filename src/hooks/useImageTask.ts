import { useState, useEffect, useRef, useCallback } from 'react';
import type { ImageTaskRequest, ImageTaskSubmitResult, ImageTaskRecord } from '../shared/domain/imageFeatureApi';
import { useDesktopClient } from './useDesktopClient';

export interface UseImageTaskReturn {
  submit: (request: ImageTaskRequest) => Promise<ImageTaskSubmitResult>;
  activeTask: ImageTaskRecord | null;
  isSubmitting: boolean;
  error: string | null;
  reset: () => void;
}

function applyTaskUpdate(
  task: ImageTaskRecord,
  setActiveTask: (task: ImageTaskRecord) => void,
  setError: (value: string | null) => void,
) {
  setActiveTask(task);

  if (task.status === 'failed' && task.error) {
    setError(task.error.message);
  }
}

export function useImageTask(): UseImageTaskReturn {
  const desktopClient = useDesktopClient();
  const [activeTask, setActiveTask] = useState<ImageTaskRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentTaskIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!desktopClient) return;

    const unsubscribe = desktopClient.imageTask.onStatus((task: ImageTaskRecord) => {
      if (!mountedRef.current) return;
      if (task.taskId !== currentTaskIdRef.current) return;

      applyTaskUpdate(task, setActiveTask, setError);
    });

    return () => {
      unsubscribe();
    };
  }, [desktopClient]);

  const submit = useCallback(async (request: ImageTaskRequest): Promise<ImageTaskSubmitResult> => {
    if (!desktopClient) {
      throw new Error('Desktop bridge unavailable');
    }

    setError(null);
    setIsSubmitting(true);
    currentTaskIdRef.current = null;

    try {
      if (request.images?.some((image) => image.path.startsWith('blob:'))) {
        throw new Error('图片尚未保存到本地，请等待上传完成或重新上传');
      }

      const result = await desktopClient.imageTask.submit(request);
      currentTaskIdRef.current = result.taskId;

      const task = await desktopClient.imageTask.get(result.taskId);
      if (mountedRef.current && task && task.taskId === currentTaskIdRef.current) {
        applyTaskUpdate(task, setActiveTask, setError);
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Task submission failed';
      setError(message);
      currentTaskIdRef.current = null;
      throw err;
    } finally {
      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  }, [desktopClient]);

  const reset = useCallback(() => {
    setActiveTask(null);
    setIsSubmitting(false);
    setError(null);
    currentTaskIdRef.current = null;
  }, []);

  return { submit, activeTask, isSubmitting, error, reset };
}
