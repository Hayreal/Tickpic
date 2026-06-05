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

export function useImageTask(): UseImageTaskReturn {
  const desktopClient = useDesktopClient();
  const [activeTask, setActiveTask] = useState<ImageTaskRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!desktopClient || !currentTaskId) return;

    const unsubscribe = desktopClient.imageTask.onStatus((task: ImageTaskRecord) => {
      if (!mountedRef.current) return;
      if (task.taskId !== currentTaskId) return;

      setActiveTask(task);

      if (task.status === 'completed' || task.status === 'failed' || task.status === 'canceled') {
        setIsSubmitting(false);
        if (task.status === 'failed' && task.error) {
          setError(task.error.message);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [desktopClient, currentTaskId]);

  const submit = useCallback(async (request: ImageTaskRequest): Promise<ImageTaskSubmitResult> => {
    if (!desktopClient) {
      throw new Error('Desktop bridge unavailable');
    }

    setError(null);
    setIsSubmitting(true);
    setActiveTask(null);

    try {
      const result = await desktopClient.imageTask.submit(request);
      setCurrentTaskId(result.taskId);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Task submission failed';
      setError(message);
      setIsSubmitting(false);
      throw err;
    }
  }, [desktopClient]);

  const reset = useCallback(() => {
    setActiveTask(null);
    setIsSubmitting(false);
    setError(null);
    setCurrentTaskId(null);
  }, []);

  return { submit, activeTask, isSubmitting, error, reset };
}
